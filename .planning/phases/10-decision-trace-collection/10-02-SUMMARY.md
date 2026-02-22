---
phase: 10-decision-trace-collection
plan: "02"
subsystem: api
tags: [fastify, admin, decision-traces, ttl-cleanup, openclaw, attribution]

# Dependency graph
requires:
  - phase: 10-decision-trace-collection
    plan: "01"
    provides: pruneDecisionTraces export from attribution-compiler.ts

provides:
  - POST /admin/cleanup/decision-traces HTTP endpoint calling pruneDecisionTraces
  - adminRoutes Fastify plugin registered in app.ts under /admin prefix
  - decision_annotation stub comment in openclaw-client.ts documenting future real-time annotation path

affects:
  - 11-council-evaluation (admin cleanup keeps decision_traces table within 5M row TTL policy)
  - future-openclaw-integration (stub documents decision_annotation handler location)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Admin route as simple Fastify async plugin (FastifyInstance) — no TypeBox schema needed for internal trigger endpoints
    - Stub comments as living documentation — points to attribution-compiler.ts as the active path while reserving the real-time handler location

key-files:
  created:
    - services/execution-service/src/routes/admin.ts
  modified:
    - services/execution-service/src/app.ts
    - services/execution-service/src/orchestrator/openclaw-client.ts

key-decisions:
  - "Admin route uses plain FastifyInstance (not FastifyPluginAsyncTypebox) — no TypeBox schema needed for internal Cloud Scheduler trigger endpoint"
  - "No auth middleware on /admin prefix at this stage — execution service is internal, protected by GCP firewall rules per CLAUDE.md; auth hook can be added later as a Fastify onRequest hook on the prefix"
  - "decision_annotation stub placed after task_failed handler inside handleMessage() — this is the natural extension point when OpenClaw adds annotation support"

patterns-established:
  - "Admin route plugin pattern: simple async function(app: FastifyInstance) — no TypeBox needed for trigger-style endpoints"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 10 Plan 02: Admin Cleanup Endpoint and OpenClaw Stub Summary

**Fastify POST /admin/cleanup/decision-traces endpoint wired to pruneDecisionTraces, plus decision_annotation stub comment in openclaw-client.ts marking the future real-time annotation path**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T16:57:29Z
- **Completed:** 2026-02-21T16:58:37Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Created `services/execution-service/src/routes/admin.ts` with `POST /cleanup/decision-traces` calling `pruneDecisionTraces()` and returning `{ status: 'ok', deleted: N }`
- Registered `adminRoutes` in `app.ts` under `/admin` prefix with a Phase 10 comment, making the cleanup endpoint reachable at `POST /admin/cleanup/decision-traces`
- Added decision_annotation stub block comment inside `handleMessage()` in `openclaw-client.ts`, documenting: (a) why real-time annotation is not wired, (b) where to add the handler when OpenClaw adds support, (c) why tool streaming events cannot be used as a substitute

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin cleanup route, register in app.ts, and add OpenClaw decision_annotation stub** - `193c023` (feat)

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `services/execution-service/src/routes/admin.ts` - New admin route plugin; exports `adminRoutes`; imports `pruneDecisionTraces` from `attribution-compiler.ts`; POST `/cleanup/decision-traces` returns `{ status: 'ok', deleted: number }`
- `services/execution-service/src/app.ts` - Added `import { adminRoutes }` + `app.register(adminRoutes, { prefix: '/admin' })` after billing routes
- `services/execution-service/src/orchestrator/openclaw-client.ts` - Added 15-line stub comment block in `handleMessage()` after `task_failed` handler documenting `decision_annotation` future path and explaining why stream:'tool' events cannot substitute

## Decisions Made

- Admin route uses plain `FastifyInstance` type (not `FastifyPluginAsyncTypebox`) — this is an internal trigger endpoint with no request body schema; TypeBox overhead not warranted
- No auth middleware on the `/admin` prefix — execution service is internal to GCP, protected by firewall; auth hook can be added as a Fastify `onRequest` hook on the prefix later if needed
- Stub comment references GitHub Issues #6467 and #8901 (per plan spec) to anchor the "confirmed Feb 2026" statement and provide traceability for future contributors

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled cleanly on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 10 (DTRC-01 and DTRC-02) is fully complete:
  - DTRC-01: Post-hoc attribution compiler (Plan 01) produces decision_traces rows
  - DTRC-02: Admin TTL cleanup endpoint (Plan 02) enforces 90-day / 5M-row policy
- Phase 11 Council evaluation can proceed — decision_traces table is populated and maintainable
- Cloud Scheduler can be configured to POST `/admin/cleanup/decision-traces` on a cron schedule to enforce the TTL policy automatically

---
*Phase: 10-decision-trace-collection*
*Completed: 2026-02-22*

## Self-Check: PASSED

- FOUND: `services/execution-service/src/routes/admin.ts`
- FOUND: `10-02-SUMMARY.md`
- FOUND: commit `193c023`
- FOUND: `adminRoutes` import and `/admin` prefix in `app.ts`
- FOUND: `pruneDecisionTraces` import in `admin.ts`
- FOUND: `decision_annotation` stub in `openclaw-client.ts`
- FOUND: `attribution-compiler` reference in `openclaw-client.ts`
