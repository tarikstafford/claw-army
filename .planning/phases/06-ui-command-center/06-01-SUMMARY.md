---
phase: 06-ui-command-center
plan: 01
subsystem: api
tags: [fastify, sse, cors, pubsub, redis, ioredis, drizzle-orm, typebox]

requires:
  - phase: 05-performance-intelligence-and-dna-capture
    provides: computeBotMetrics(), BotMetrics interface, bots.compositeScore/tier columns
  - phase: 04-control-plane-services
    provides: Redis budget:spend/budget:cap keys, billing_events table, bot-lifecycle Pub/Sub topics
  - phase: 03-bot-runtime-and-tool-gateway
    provides: tool_invocations table with step trace fields
  - phase: 02-core-execution-pipeline
    provides: tasks table, bots table, executions table, telemetry table

provides:
  - "GET /executions/:id/events — SSE bridge streaming Pub/Sub events filtered by executionId"
  - "GET /executions/:id/metrics — live bot count, bot-hours, Redis budget keys"
  - "GET /bots/:botId/detail — per-bot BotMetrics + tool_invocations step trace"
  - "GET /billing/history — all executions with totalCostCents/totalBotHours/taskCount"
  - "GET /billing/summary — current month totals"
  - "CORS for localhost:5173 (CORS_ORIGIN configurable)"

affects:
  - 06-02-ui-new-execution
  - 06-03-ui-live-execution
  - 06-04-ui-post-execution
  - 06-05-ui-bot-detail
  - 06-06-ui-billing

tech-stack:
  added:
    - "@fastify/sse@0.4.0 — SSE plugin for Fastify 5 (reply.sse API)"
    - "@fastify/cors@11.2.0 — CORS plugin for cross-origin browser requests"
  patterns:
    - "Per-connection Pub/Sub subscriptions: one subscription per SSE connection per topic, deleted on disconnect"
    - "Double cleanup guard: cleanedUp boolean prevents double cleanup from reply.sse.onClose + request.raw.on('close')"
    - "Redis-authoritative budget: live metrics read from Redis budget:spend/{id} not DB billing_events SUM"
    - "Correlated subselects: billing history uses single SELECT with correlated subqueries, not N+1"

key-files:
  created:
    - "services/execution-service/src/routes/sse.ts — SSE bridge: Pub/Sub per-connection subscriptions, executionId filter, cleanup"
    - "services/execution-service/src/routes/metrics.ts — Live metrics: active bot count, telemetry bot-hours, Redis budget keys"
    - "services/execution-service/src/routes/bots.ts — Bot detail: computeBotMetrics() + tool_invocations step trace"
    - "services/execution-service/src/routes/billing.ts — Billing history and monthly summary endpoints"
  modified:
    - "services/execution-service/src/app.ts — buildApp() async, CORS+SSE plugins, new route mounts"
    - "services/execution-service/src/main.ts — await buildApp() for async"
    - "services/execution-service/package.json — added @fastify/sse, @fastify/cors"

key-decisions:
  - "buildApp() converted to async: required to await app.register() for @fastify/cors and @fastify/sse; main.ts updated to await buildApp()"
  - "Per-connection Pub/Sub subscription strategy (Option A): simpler for MVP single-tenant; 4 subscriptions per connection on execution/task/bot/guardrail topics"
  - "Dual disconnect cleanup: reply.sse.onClose() + request.raw.on('close') with cleanedUp boolean guard for abnormal TCP disconnects"
  - "subscription.delete() wrapped in catch for emulator compatibility: non-fatal in local dev, required for GCP quota hygiene"
  - "Redis-authoritative live budget: metrics.ts reads budget:spend:{id} and budget:cap:{id} from Redis, not from DB billing_events aggregation"
  - "Correlated subselects in billing.ts: single Drizzle query with sql template subqueries, avoids N+1 across billing_events/telemetry/tasks"

patterns-established:
  - "SSE routes use { sse: true } option in route schema, not reply.raw (Fastify lifecycle hooks preserved)"
  - "CORS registered before routes in app.ts (Fastify plugin order matters)"

duration: 3min
completed: 2026-02-19
---

# Phase 6 Plan 1: Backend API Endpoints for UI Command Center Summary

**Five new Fastify route modules (SSE bridge, live metrics, bot detail, billing history/summary) with @fastify/cors and @fastify/sse plugins, providing all backend endpoints the SvelteKit UI requires**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T00:17:38Z
- **Completed:** 2026-02-19T00:20:51Z
- **Tasks:** 3
- **Files modified:** 6 (4 new route files, app.ts, main.ts)

## Accomplishments

- SSE bridge at `GET /executions/:id/events` creates per-connection Pub/Sub subscriptions on 4 topics, filters by executionId, and cleans up on disconnect
- Live metrics at `GET /executions/:id/metrics` returns active bot count, total bot-hours, and Redis-authoritative budget data
- Bot detail at `GET /bots/:botId/detail` reuses `computeBotMetrics()` and queries tool_invocations for the full step trace
- Billing endpoints (`GET /billing/history`, `GET /billing/summary`) aggregate cost/hours/tasks with correlated subselects
- CORS configured for `localhost:5173` (CORS_ORIGIN env var override), @fastify/sse plugin registered

## Task Commits

1. **Task 1: Install @fastify/sse and @fastify/cors, register plugins in app.ts** - `d100646` (feat)
2. **Task 2: Create SSE bridge and live metrics routes** - `077cb0f` (feat)
3. **Task 3: Create bot detail and billing routes** - `1bddaa2` (feat)

## Files Created/Modified

- `services/execution-service/src/routes/sse.ts` - SSE bridge with per-connection Pub/Sub subscriptions on execution/task/bot/guardrail topics
- `services/execution-service/src/routes/metrics.ts` - Live metrics endpoint reading active bots from DB and budget from Redis
- `services/execution-service/src/routes/bots.ts` - Bot detail endpoint using computeBotMetrics() + tool_invocations step trace
- `services/execution-service/src/routes/billing.ts` - Billing history and monthly summary with correlated subselects
- `services/execution-service/src/app.ts` - buildApp() now async, CORS before routes, SSE plugin, 4 new route mounts
- `services/execution-service/src/main.ts` - await buildApp() for async
- `services/execution-service/package.json` - @fastify/sse@^0.4.0 and @fastify/cors@^11.2.0 added

## Decisions Made

- `buildApp()` converted to async: required to `await app.register()` calls for CORS/SSE plugins; `main.ts` updated to `await buildApp()`
- Per-connection Pub/Sub subscription strategy (Option A from RESEARCH.md): 4 subscriptions per SSE connection, simpler for single-tenant MVP
- Dual disconnect cleanup: `reply.sse.onClose()` + `request.raw.on('close')` with `cleanedUp` boolean guard prevents double cleanup on abnormal TCP disconnects (RESEARCH.md Pitfall 7)
- `subscription.delete()` wrapped in `.catch(() => {})` for Pub/Sub emulator compatibility (RESEARCH.md Pitfall 4)
- Redis-authoritative live budget: `metrics.ts` reads `budget:spend:{id}` and `budget:cap:{id}` from Redis — DB `billing_events` is audit trail not live counter (RESEARCH.md Pitfall 5)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Converted buildApp() from sync to async**
- **Found during:** Task 1 (app.ts update)
- **Issue:** The plan says to `await app.register(cors, ...)` and `await app.register(sse)` but the original `buildApp()` was a synchronous function — cannot use `await` inside a non-async function
- **Fix:** Changed `export function buildApp()` to `export async function buildApp()` and updated `main.ts` to `const app = await buildApp()`
- **Files modified:** `services/execution-service/src/app.ts`, `services/execution-service/src/main.ts`
- **Verification:** TypeScript compiles clean, no errors
- **Committed in:** `d100646` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: sync function can't await)
**Impact on plan:** Required for correct async plugin registration. No scope creep.

## Issues Encountered

None beyond the auto-fixed buildApp() async conversion above.

## User Setup Required

None - no external service configuration required. CORS_ORIGIN env var is optional (defaults to localhost:5173).

## Next Phase Readiness

All 5 backend endpoints are live and TypeScript-clean. Plans 06-02 through 06-06 can now build the SvelteKit UI screens that call these endpoints:
- `POST /executions` (existing) + `GET /executions/:id/events` (new SSE) ready for 06-03 Live Execution View
- `GET /executions/:id/metrics` (new) ready for 06-03 metrics panel polling
- `GET /bots/:botId/detail` (new) ready for 06-05 Bot Detail View
- `GET /billing/history` + `GET /billing/summary` (new) ready for 06-06 Usage & Billing

---
*Phase: 06-ui-command-center*
*Completed: 2026-02-19*

## Self-Check: PASSED

All created files confirmed on disk:
- FOUND: services/execution-service/src/routes/sse.ts
- FOUND: services/execution-service/src/routes/metrics.ts
- FOUND: services/execution-service/src/routes/bots.ts
- FOUND: services/execution-service/src/routes/billing.ts
- FOUND: .planning/phases/06-ui-command-center/06-01-SUMMARY.md

All task commits confirmed in git log:
- FOUND: d100646 (Task 1 - plugins + app.ts)
- FOUND: 077cb0f (Task 2 - SSE + metrics routes)
- FOUND: 1bddaa2 (Task 3 - bots + billing routes)
