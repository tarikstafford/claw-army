---
phase: 04-control-plane-services
plan: 02
subsystem: api
tags: [guardrail, redis, ioredis, pubsub, drizzle, postgres, rate-limit, loop-detection, watchdog]

# Dependency graph
requires:
  - phase: 04-01
    provides: publishGuardrailTriggered() in publisher.ts
  - phase: 03-bot-runtime-and-tool-gateway
    provides: tool-gateway rate-limit middleware (rl:calls/rl:tokens keys), tool-invoke.ts handler structure, bot-orchestrator.ts idle checker
  - phase: 01-data-foundation
    provides: tool_invocations Drizzle schema with botId, invokedAt, totalTokens, toolName, requestSummary fields
provides:
  - Guardrail Watchdog module (guardrail-watchdog.ts): setInterval-based polling for rate violations and loop behavior
  - Redis deny-list keys (guardrail:denied:{botId}) with TTL for revoked bot enforcement
  - Tool Gateway deny-list check gate 0 in /tool.invoke before allowlist check
  - guardrail_triggered events on idle timeout in bot-orchestrator startIdleChecker()
  - Watchdog started in main.ts with SIGTERM/SIGINT graceful shutdown
affects:
  - 04-03-billing-engine (uses same bot-registry and redis patterns)
  - 05-observer-service (subscribes to guardrail-events Pub/Sub topic)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Postgres-based rate violation counting (not rate-limiter-flexible internal keys) for reliable watchdog checks
    - Redis deny-list pattern: SETEX guardrail:denied:{botId} with TTL for automatic expiration
    - Fail-open on Redis errors in enforcement gates (same pattern as rate-limit middleware)
    - Per-bot try/catch in watchdog polling loops — one bot failure never blocks others
    - Never-throw watchdog polling: all errors caught and logged, setInterval always survives

key-files:
  created:
    - services/execution-service/src/events/guardrail-watchdog.ts
  modified:
    - services/execution-service/src/orchestrator/bot-orchestrator.ts
    - services/execution-service/src/main.ts
    - services/tool-gateway/src/routes/tool-invoke.ts

key-decisions:
  - "Rate violation detection uses Postgres tool_invocations COUNT/SUM queries (not rate-limiter-flexible internal Redis keys) — internal key format is an implementation detail that could change"
  - "Deny-list uses per-key SETEX (not SADD to a set) for automatic TTL expiration — revoked bot keys expire after GUARDRAIL_DENY_TTL_SECONDS (default 1 hour) without manual cleanup"
  - "Tool Gateway deny-list check fails open on Redis errors — same pattern as rate-limit middleware, avoids 500s blocking legitimate bots during Redis outages"
  - "Guardrail Watchdog starts globally in main.ts (not per-execution like idle checker) — rate/loop violations are per-bot, not per-execution; one watchdog covers all active bots"
  - "Idle timeout guardrail_triggered action is 'terminated' (not 'revoked') — idle bots are stopped, not deny-listed; they won't make future requests anyway"

patterns-established:
  - "Watchdog never-throw pattern: setInterval callback wrapped in try/catch, individual per-bot checks also wrapped; errors logged and discarded"
  - "Gate 0 deny-list check: before all other enforcement in /tool.invoke handler, runs first with fail-open on Redis errors"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 4 Plan 02: Guardrail Watchdog and Tool Gateway Deny-List Summary

**Redis deny-list-backed Guardrail Watchdog detecting rate violations and loop behavior via Postgres queries, with 403-returning deny-list enforcement gate in Tool Gateway**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T13:35:44Z
- **Completed:** 2026-02-18T13:37:46Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `guardrail-watchdog.ts`: setInterval-based module polling every WATCHDOG_INTERVAL_MS (default 10s) for rate violations (>= 60 calls or >= 100k tokens per 60s from Postgres) and loop behavior (N identical consecutive tool invocations); revokes violating bots via Redis SETEX deny-list, stopBot(), and publishGuardrailTriggered()
- Added deny-list enforcement as gate 0 in Tool Gateway `/tool.invoke`: Redis GET check before allowlist check, returns 403 with bot_revoked audit log entry, fails open on Redis errors
- Added `publishGuardrailTriggered` emission in `startIdleChecker()` after `stopBot()` — idle timeout now emits a structured guardrail_triggered event (GARD-05, GARD-06)
- Updated `main.ts` to start the Guardrail Watchdog alongside the Fastify server with SIGTERM/SIGINT graceful shutdown cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Guardrail Watchdog module with rate and loop violation detection** - `8ef609c` (feat)
2. **Task 2: Add bot deny-list check to Tool Gateway /tool.invoke** - `e729046` (feat)

## Files Created/Modified
- `services/execution-service/src/events/guardrail-watchdog.ts` - Guardrail Watchdog: IORedis client, revokeBot(), checkRateViolations(), checkLoopBehavior(), startGuardrailWatchdog(), stopGuardrailWatchdog()
- `services/execution-service/src/orchestrator/bot-orchestrator.ts` - Added publishGuardrailTriggered import; emit guardrail_triggered (idle_timeout / terminated) after stopBot() in startIdleChecker()
- `services/execution-service/src/main.ts` - Import and start watchdog after app.listen(); SIGTERM/SIGINT shutdown handler cleans up timer
- `services/tool-gateway/src/routes/tool-invoke.ts` - IORedis client; deny-list check gate 0 (guardrail:denied:{botId} GET); 403 response with bot_revoked audit log; fail-open on Redis errors

## Decisions Made
- Rate violation detection uses Postgres `tool_invocations` COUNT/SUM queries rather than rate-limiter-flexible internal Redis keys — the internal key format (`rl:calls:{botId}`) is an implementation detail of rate-limiter-flexible that could change across versions. Postgres queries are reliable and version-independent.
- Deny-list uses per-key `SETEX guardrail:denied:{botId}` (not `SADD` to a shared set) for automatic TTL expiration — revoked bot keys expire after `GUARDRAIL_DENY_TTL_SECONDS` (default 1 hour) without requiring manual cleanup or a separate expiry job.
- Guardrail Watchdog starts globally in `main.ts` rather than per-execution (like the idle checker in `executions.ts`) — rate/loop violations are per-bot concerns, not per-execution; a single global watchdog covers all active bots across all executions.
- Idle timeout guardrail_triggered action is `'terminated'` (not `'revoked'`) because idle bots are stopped cleanly and not added to the deny-list — they won't make future requests after being stopped, so deny-listing would be redundant.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The Guardrail Watchdog uses the same `REDIS_URL`, `DATABASE_URL`, and `PUBSUB_EMULATOR_HOST` environment variables already configured for the execution service.

## Next Phase Readiness
- GARD-02 through GARD-06 enforcement is complete: rate violations, loop detection, idle timeout, deny-list blocking, and guardrail event emission all implemented
- Revoked bots are blocked at the Tool Gateway within one watchdog polling interval (default 10s)
- guardrail_triggered events flow to the guardrail-events Pub/Sub topic — ready for observer/dashboard subscription in Phase 5
- TypeScript compiles with zero errors in both execution-service and tool-gateway

---
*Phase: 04-control-plane-services*
*Completed: 2026-02-18*
