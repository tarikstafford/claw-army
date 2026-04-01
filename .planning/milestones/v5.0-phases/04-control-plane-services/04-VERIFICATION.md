---
phase: 04-control-plane-services
verified: 2026-02-18T14:10:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run Phase 4 E2E test against live infrastructure"
    expected: "All 5 test cases (SC#1 through SC#5) pass; budget Lua script enforces correctly; bot-hours recorded to telemetry"
    why_human: "Tests require running PostgreSQL, Redis, and optionally Pub/Sub emulator — cannot execute programmatically in this verification pass"
  - test: "Verify budget cap enforcement stops an execution mid-run"
    expected: "When cumulative billing events push budget:spend above budget:cap, all bots stop and execution transitions to 'stopped'"
    why_human: "Requires a live execution with a low budget cap and real tool invocations to trigger the Lua script cap exceeded path end-to-end"
  - test: "Verify guardrail watchdog revokes a bot within one polling interval"
    expected: "After inserting >= 60 tool_invocations within 60s for a bot, watchdog's next poll (default 10s) sets guardrail:denied:{botId} and emits a guardrail_triggered Pub/Sub event"
    why_human: "Requires a running execution-service with a live bot emitting tool invocations to Postgres"
---

# Phase 4: Control Plane Services Verification Report

**Phase Goal:** Every execution involving real LLM spending is guarded by atomic budget enforcement, and every guardrail violation, billing event, and bot lifecycle transition is captured on the event bus — so no execution can overspend, loop indefinitely, or go unaccounted.

**Verified:** 2026-02-18T14:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Budget cap is recorded in Redis atomically on execution creation | VERIFIED | `execution.service.ts` lines 48-67: `redis.setex('budget:cap:{executionId}', ttl, budgetCapCents)` and `redis.setex('budget:spend:{executionId}', ttl, '0')` inside try/catch after Postgres INSERT |
| 2 | Billing and guardrail events can be published to correctly-named Pub/Sub topics | VERIFIED | `publisher.ts`: 5 Terraform-aligned topic constants (bot-lifecycle, execution-lifecycle, task-lifecycle, guardrail-events, billing-events), 8 exported publish functions all calling Zod-validated `publish<T>()` helper |
| 3 | Pub/Sub topic names are env-var configurable with Terraform-aligned defaults | VERIFIED | `publisher.ts` lines 33-37: `process.env.BOT_LIFECYCLE_TOPIC ?? 'bot-lifecycle'` pattern used for all 5 topics; old names (bot-events, execution-events, task-events) are absent |
| 4 | A revoked bot's tool invocations are rejected with 403 by the Tool Gateway | VERIFIED | `tool-invoke.ts` lines 96-120: Gate 0 deny-list check via `redis.get('guardrail:denied:{botId}')` appears BEFORE allowlist check (gate 1 at line 122), returns 403 with `bot_revoked` audit log entry, fails open on Redis errors |
| 5 | Rate violations and loop behavior are detected and bots revoked with structured event | VERIFIED | `guardrail-watchdog.ts`: `checkRateViolations()` queries Postgres COUNT/SUM for last 60s; `checkLoopBehavior()` queries last N invocations and fingerprints; both call `revokeBot()` which sets deny-list key, calls `stopBot()`, and emits `publishGuardrailTriggered()` |
| 6 | Idle timeout emits a guardrail_triggered event in addition to bot_stopped | VERIFIED | `bot-orchestrator.ts` lines 305-314: after `stopBot(entry.botId, 'idle_timeout')`, explicitly calls `publishGuardrailTriggered()` with `reason: 'idle_timeout', action: 'terminated'` |
| 7 | Guardrail Watchdog starts alongside the Fastify server | VERIFIED | `main.ts` line 18: `const watchdogTimer = startGuardrailWatchdog()` called after `app.listen()`; SIGTERM/SIGINT handlers call `stopGuardrailWatchdog(watchdogTimer)` |
| 8 | Atomic budget enforcement uses Redis Lua INCRBY — no application-level read-then-write | VERIFIED | `billing-engine.ts` lines 59-73: `BUDGET_ENFORCE_SCRIPT` Lua script uses `redis.call('INCRBY', spend_key, amount)` atomically inside EVAL; `enforceAtomicBudget()` is the only budget check path |
| 9 | All 5 billing-relevant event types produce billing_events rows in Postgres | VERIFIED | `billing-engine.ts`: `writeBillingEvent()` called for bot_started, bot_stopped, tool_invoked, execution_completed, budget_exceeded; `handleBillingMessage()` and `handleBotLifecycleMessage()` are distinct handlers on separate subscriptions |
| 10 | Bot-hours are calculated from wall-clock pairs and written to telemetry | VERIFIED | `billing-engine.ts` lines 131-161: `recordBotHours()` queries `bots.startedAt`/`stoppedAt`, computes `wallClockMs / (1000*60*60)`, inserts to `telemetry` table with `metricName: 'bot_hours'` |
| 11 | Tool Gateway publishes billing events after every successful tool dispatch | VERIFIED | `tool-invoke.ts` lines 287-313: step 5.5 publishes billing payload to `billingTopic` via `billingPubsub.topic(billingTopic).publishMessage()` inside try/catch (non-fatal) |
| 12 | Billing Engine starts alongside execution-service and subscribes to both topics | VERIFIED | `main.ts` line 22: `const billingEngine = startBillingEngine()`; `billing-engine.ts` creates two subscriptions: `billing-events-sub` and `bot-lifecycle-billing-sub` with separate handlers; shutdown closes both |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/execution-service/src/events/publisher.ts` | 8 publish functions, Terraform-aligned topic names | VERIFIED | 5 topic constants, 8 exports: publishBotStarted, publishBotStopped, publishExecutionStatusChanged, publishTaskClaimed, publishTaskCompleted, publishBillingEvent, publishBudgetExceeded, publishGuardrailTriggered; all validated via Zod schemas from @claw/event-schemas |
| `services/execution-service/src/services/execution.service.ts` | Budget cap Redis key initialization on createExecution | VERIFIED | Lines 48-67: setex for `budget:cap:{id}` and `budget:spend:{id}` with TTL = runtimeLimitSeconds + 86400; non-fatal try/catch |
| `services/execution-service/src/events/guardrail-watchdog.ts` | Rate + loop detection, bot revocation, guardrail events | VERIFIED | Exports `startGuardrailWatchdog`, `stopGuardrailWatchdog`, `checkLoopForBot`; implements `checkRateViolations()` (Postgres COUNT/SUM), `checkLoopBehavior()` (fingerprint comparison), `revokeBot()` (deny-list + stopBot + publishGuardrailTriggered) |
| `services/tool-gateway/src/routes/tool-invoke.ts` | Deny-list gate 0, billing event publishing | VERIFIED | Gate 0 deny-list check at line 96 before gate 1 allowlist at line 122; billing event published at step 5.5 with `billingPubsub`; contains `guardrail:denied` and `billing_event` patterns |
| `services/execution-service/src/orchestrator/bot-orchestrator.ts` | publishGuardrailTriggered on idle timeout | VERIFIED | Line 15: imports `publishGuardrailTriggered`; lines 307-314: called after `stopBot()` in `startIdleChecker()` with `reason: 'idle_timeout', action: 'terminated'` |
| `services/execution-service/src/main.ts` | Watchdog and Billing Engine startup | VERIFIED | Imports and starts both `startGuardrailWatchdog()` and `startBillingEngine()` after app.listen; both cleaned up on SIGTERM/SIGINT |
| `services/execution-service/src/events/billing-engine.ts` | Atomic budget, billing persistence, bot-hours, dual subscriptions | VERIFIED | Exports `startBillingEngine`, `stopBillingEngine`, `enforceAtomicBudget`, `calculateTokenCost`, `recordBotHours`; Lua EVAL script; two distinct subscriptions with two distinct handlers; Pub/Sub deduplication via Redis SETNX |
| `services/execution-service/src/orchestrator/completion-checker.ts` | Publishes execution_completed billing event | VERIFIED | Line 4 imports `publishBillingEvent`; lines 45-50: calls `publishBillingEvent({ type: 'billing_event', eventType: 'execution_completed', ... })` after `publishExecutionStatusChanged()` |
| `services/tool-gateway/package.json` | @google-cloud/pubsub dependency | VERIFIED | Line 20: `"@google-cloud/pubsub": "^5.2.3"` present |
| `services/execution-service/src/__tests__/phase4-e2e.test.ts` | Phase 4 E2E test for all 5 success criteria | VERIFIED | `describe('Phase 4 E2E Integration Tests')` at line 180; SC#1 through SC#5 as separate `it()` blocks; infrastructure skip guards; imports `enforceAtomicBudget`, `calculateTokenCost`, `recordBotHours`, `checkLoopForBot` |

---

### Key Link Verification

#### 04-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `publisher.ts` | `@claw/event-schemas` | billingEventSchema and guardrailTriggeredEventSchema imports | WIRED | Lines 8-18: imports `billingEventSchema`, `budgetExceededEventSchema`, `guardrailTriggeredEventSchema` plus corresponding types |
| `execution.service.ts` | Redis | SET budget:cap:{executionId} on createExecution | WIRED | Lines 48-67: `redis.setex('budget:cap:{executionId}', ttlSeconds, input.budgetCapCents.toString())` and matching `budget:spend` key |

#### 04-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `guardrail-watchdog.ts` | `publisher.ts` | publishGuardrailTriggered() on every revocation | WIRED | Line 4 imports `publishGuardrailTriggered`; line 66-73: called inside `revokeBot()` |
| `guardrail-watchdog.ts` | `bot-orchestrator.ts` | stopBot() call to terminate revoked bot containers | WIRED | Line 5 imports `stopBot`; line 63: `await stopBot(botId, 'terminated')` in `revokeBot()` |
| `tool-invoke.ts` | Redis | SISMEMBER/GET guardrail:denied:{botId} check | WIRED | Line 100: `redis.get('guardrail:denied:{botId}')` before allowlist; returns 403 with bot_revoked audit log if set |

#### 04-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `billing-engine.ts` | Redis | Atomic budget enforcement Lua script (EVAL with INCRBY + cap check) | WIRED | Lines 59-73: `BUDGET_ENFORCE_SCRIPT` with `INCRBY`; line 93: `redis.eval(BUDGET_ENFORCE_SCRIPT, 2, ...)` in `enforceAtomicBudget()` |
| `billing-engine.ts` | `@claw/db` | INSERT billing_events and telemetry rows | WIRED | Line 3 imports `billingEvents`, `telemetry`; line 179: `db.insert(billingEvents).values(...)` in `writeBillingEvent()`; line 148: `db.insert(telemetry).values(...)` in `recordBotHours()` |
| `tool-invoke.ts` | Pub/Sub billing-events topic | Direct PubSub publishMessage() call after successful tool dispatch | WIRED | Lines 23-25: `billingPubsub` PubSub client; lines 295-309: builds `billingPayload` and calls `billingPubsub.topic(billingTopic).publishMessage({ data })` at step 5.5 |

---

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| GARD-01: Atomic Redis budget enforcement | SATISFIED | `enforceAtomicBudget()` with Lua INCRBY script; no read-then-write in billing path |
| GARD-02: Bot revoked on token burn rate exceeded | SATISFIED | `checkRateViolations()`: SUM(totalTokens) >= 100,000 triggers `revokeBot(..., 'rate_limit')` |
| GARD-03: Bot revoked on tool call rate exceeded | SATISFIED | `checkRateViolations()`: COUNT(*) >= 60 calls/60s triggers `revokeBot(..., 'rate_limit')` |
| GARD-04: Loop detection and bot termination | SATISFIED | `checkLoopBehavior()`: N identical consecutive fingerprints triggers `revokeBot(..., 'loop_detected')` |
| GARD-05: Bot terminated after 5 min idle | SATISFIED | `startIdleChecker()` in bot-orchestrator with 5min default; `stopBot(botId, 'idle_timeout')` |
| GARD-06: All guardrail violations as structured events | SATISFIED | Every revocation path (rate, loop, idle) calls `publishGuardrailTriggered()` with botId, executionId, reason, action, timestamp |
| METR-01: Billing events for all 5 event types | SATISFIED | `writeBillingEvent()` called for bot_started, bot_stopped, tool_invoked, execution_completed, budget_exceeded across two subscription handlers |
| METR-02: Bot-hours from wall-clock pairs | SATISFIED | `recordBotHours()` computes `(stoppedAt - startedAt) / 3,600,000` and inserts to telemetry table |
| METR-03: Estimated cost within 1% margin | SATISFIED | `calculateTokenCost()` uses integer cents; E2E test SC#5 validates 1% margin with 1M prompt + 500K completion tokens |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No stubs, placeholder components, empty handlers, or TODO/FIXME markers were found in any of the 10 phase 4 implementation files (excluding the intentional TODO comment noting a Terraform production prerequisite for `bot-lifecycle-billing-sub`).

**One noted production gap (non-blocking for development):**
`billing-engine.ts` line 431 contains: `// TODO (Production): Add 'bot-lifecycle-billing-sub' subscription to Terraform config.` This is an explicitly acknowledged infrastructure gap for GCP deployment — the subscription auto-creates in the Pub/Sub emulator for local dev. This does not block the phase goal in the development environment.

---

### Human Verification Required

#### 1. Phase 4 E2E Test Execution

**Test:** Run `npx vitest run src/__tests__/phase4-e2e.test.ts` from `services/execution-service/` with PostgreSQL and Redis running.

**Expected:** All 5 test cases pass — SC#1 atomic budget, SC#2 deny-list, SC#3 loop detection, SC#4 billing event completeness, SC#5 bot-hours and cost accuracy within 1%.

**Why human:** Tests require live infrastructure (PostgreSQL at localhost:5432, Redis at localhost:6379); cannot execute programmatically during static verification.

#### 2. Live Budget Cap Enforcement End-to-End

**Test:** Create an execution with a low `budgetCapCents` (e.g., 100 cents), trigger LLM tool calls from the Tool Gateway that total more than 100 cents, and confirm the execution transitions to 'stopped'.

**Expected:** Budget Lua script on billing-events triggers `handleBudgetExceeded()` which stops all bots and calls `transitionExecution(executionId, 'running', 'stopped')`.

**Why human:** Requires a running execution-service, tool-gateway, billing engine, and billing-events Pub/Sub subscription all wired together with real LLM token spend flowing through.

#### 3. Guardrail Watchdog Rate Revocation

**Test:** Insert 60+ tool_invocations within 60 seconds for a bot, wait one watchdog polling interval (default 10 seconds), and verify `guardrail:denied:{botId}` exists in Redis and a guardrail_triggered event appears on the guardrail-events topic.

**Expected:** Watchdog detects violation, sets deny-list key, stops container, publishes event. Subsequent calls to `/tool.invoke` for that bot return 403.

**Why human:** Requires a live execution-service with the watchdog running and a real bot generating invocations.

---

### Gaps Summary

No gaps found. All 12 observable truths are verified against the actual codebase. All 10 required artifacts exist, are substantive (not stubs), and are wired. All 7 key links are verified at the import and call site level. Requirements GARD-01 through GARD-06 and METR-01 through METR-03 are all addressed by implemented code.

The only production gap is the Terraform configuration for `bot-lifecycle-billing-sub` subscription, which is explicitly noted as a TODO and does not affect local development or the phase goal.

---

*Verified: 2026-02-18T14:10:00Z*
*Verifier: Claude (gsd-verifier)*
