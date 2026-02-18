---
phase: 04-control-plane-services
plan: 01
subsystem: api
tags: [pubsub, redis, ioredis, event-schemas, billing, guardrail, terraform]

# Dependency graph
requires:
  - phase: 02-core-execution-pipeline
    provides: execution.service.ts createExecution() and IORedis dependency already installed
  - phase: 01-data-foundation
    provides: event-schemas package with billingEventSchema, budgetExceededEventSchema, guardrailTriggeredEventSchema
provides:
  - publishBillingEvent(), publishBudgetExceeded(), publishGuardrailTriggered() in publisher.ts
  - Terraform-aligned topic name constants (bot-lifecycle, execution-lifecycle, task-lifecycle, billing-events, guardrail-events)
  - budget:cap:{executionId} and budget:spend:{executionId} Redis keys initialized on execution creation
affects:
  - 04-02-guardrail-watchdog (uses publishGuardrailTriggered and budget:spend Redis keys)
  - 04-03-billing-engine (uses publishBillingEvent, publishBudgetExceeded, budget:cap and budget:spend Redis keys)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Env-var-configurable Pub/Sub topic names defaulting to Terraform naming conventions
    - Module-level IORedis singleton in execution.service.ts for budget cap write-path (enableOfflineQueue: true)
    - try/catch on Redis calls in write-path: non-fatal, logged only, never blocks execution creation

key-files:
  created: []
  modified:
    - services/execution-service/src/events/publisher.ts
    - services/execution-service/src/services/execution.service.ts

key-decisions:
  - "Pub/Sub topic name env vars default to Terraform naming without env suffix — emulator auto-creates topics on first publish, local dev works without suffix"
  - "IORedis singleton in execution.service.ts uses enableOfflineQueue: true (default) — write-path should queue on Redis slow, not fail fast like rate-limiter"
  - "Budget key initialization is non-fatal: try/catch logs only — billing engine handles missing keys (no cap = allow all spending per GARD-01 Lua script design)"
  - "budget:spend initialized explicitly to 0 on execution creation — ensures key exists for monitoring before any spend occurs"

patterns-established:
  - "Env-var-configurable Pub/Sub topics: const TOPIC = process.env.TOPIC_VAR ?? 'default-terraform-name'"
  - "Budget key TTL = runtimeLimitSeconds + 86400 — keys outlive execution by 24h buffer"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 4 Plan 01: Pub/Sub Topic Alignment and Budget Cap Redis Initialization Summary

**Terraform-aligned Pub/Sub topic constants with env-var configurability, 3 new billing/guardrail publish functions, and atomic budget cap Redis key initialization on execution creation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T13:30:05Z
- **Completed:** 2026-02-18T13:32:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced 3 hardcoded Pub/Sub topic names with 5 env-var-configurable Terraform-aligned constants (bot-lifecycle, execution-lifecycle, task-lifecycle, guardrail-events, billing-events)
- Added publishBillingEvent(), publishBudgetExceeded(), and publishGuardrailTriggered() — prerequisites for Billing Engine (04-03) and Guardrail Watchdog (04-02)
- Added IORedis singleton to execution.service.ts and budget cap key initialization (budget:cap, budget:spend) in createExecution() with 24h buffer TTL and non-fatal error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Align topic names and add billing + guardrail publish functions** - `b1724fb` (feat)
2. **Task 2: Initialize budget cap Redis key on execution creation** - `16e7629` (feat)

## Files Created/Modified
- `services/execution-service/src/events/publisher.ts` - 5 env-configurable topic constants, 8 total publish functions (5 updated + 3 new: publishBillingEvent, publishBudgetExceeded, publishGuardrailTriggered)
- `services/execution-service/src/services/execution.service.ts` - IORedis singleton, budget:cap and budget:spend Redis key initialization in createExecution() with try/catch non-fatal pattern

## Decisions Made
- Pub/Sub topic env vars default to Terraform naming without env suffix because the Pub/Sub emulator auto-creates topics on first publish — local dev works without the -dev/-prod suffix that Terraform appends for GCP
- IORedis singleton uses enableOfflineQueue: true (default) because execution creation is write-path — it should queue behind a slow Redis rather than fail fast (unlike the rate-limiter which is on the hot read path and uses enableOfflineQueue: false)
- Budget key initialization is non-fatal (try/catch, log only) because the billing engine's Lua script handles missing keys gracefully — a missing cap key means "no cap" rather than a crash

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Budget keys will be auto-initialized when executions are created. Topic names can be overridden via env vars when deploying to GCP to match Terraform-provisioned names with environment suffixes.

## Next Phase Readiness
- publishGuardrailTriggered() is ready for Guardrail Watchdog (04-02) to call on every bot revocation
- publishBillingEvent() and publishBudgetExceeded() are ready for Billing Engine (04-03)
- budget:cap and budget:spend Redis keys are initialized on every execution creation — GARD-01 Lua script in 04-03 can perform atomic spend enforcement against them
- All TypeScript compiles with zero errors

---
*Phase: 04-control-plane-services*
*Completed: 2026-02-18*
