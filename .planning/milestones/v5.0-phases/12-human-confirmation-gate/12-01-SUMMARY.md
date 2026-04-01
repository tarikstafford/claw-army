---
phase: 12-human-confirmation-gate
plan: "01"
subsystem: api
tags: [fastify, drizzle-orm, typebox, postgres, council-verdicts, confirmation-gate]

# Dependency graph
requires:
  - phase: 11-the-council
    provides: council_verdicts table with verdictType/status/confirmedBy columns and full council pipeline
  - phase: 08-database-schema-and-shared-types
    provides: councilVerdicts Drizzle schema and @claw/db package exports

provides:
  - Fastify verdicts route plugin with 5 endpoints (pending list, single verdict, confirm, reject, calibration)
  - timeOnScreenMs nullable integer column on council_verdicts (migration 0006)
  - Idempotency-guarded confirm/reject endpoints (409 on already-resolved)
  - Anti-rubber-stamp calibration endpoint with warningTriggered flag

affects: [12-02, 13-god-layer, phase-12-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FastifyPluginAsyncTypebox with TypeBox response schemas for typed API endpoints
    - Drizzle .returning({ id }) for idempotency detection in UPDATE operations
    - inArray() from drizzle-orm for enum-constrained WHERE clauses
    - Guard pattern: UPDATE WHERE status=pending AND verdictType IN (Promote,Retire) — atomic idempotency without SELECT-then-UPDATE

key-files:
  created:
    - services/execution-service/src/routes/verdicts.ts
    - packages/db/migrations/0006_add_time_on_screen_ms.sql
    - packages/db/migrations/meta/0006_snapshot.json
  modified:
    - packages/db/src/schema/council-verdicts.ts
    - packages/db/migrations/meta/_journal.json
    - services/execution-service/src/app.ts

key-decisions:
  - "GET /verdicts/pending only surfaces Promote and Retire verdicts — Maintain/Monitor/Demote never require human confirmation per CONF requirements"
  - "Confirm and reject use a single atomic UPDATE with WHERE status=pending AND verdictType IN (Promote,Retire) plus .returning() — eliminates race conditions vs SELECT-then-UPDATE; 0 rows returned means 409"
  - "reject endpoint does NOT set confirmedAt — only confirmedBy and timeOnScreenMs, same as a confirmation outcome without the timestamp semantics"
  - "warningTriggered threshold: total>=10 AND rate>0.95 — requires meaningful sample size before triggering anti-rubber-stamp alert"
  - "Migration renamed from 0006_parallel_rage to 0006_add_time_on_screen_ms following established pattern from phases 08-02, 09-03, 10-01"

patterns-established:
  - "Guard-on-UPDATE pattern: use .returning() to detect 0-row updates instead of SELECT-then-UPDATE for idempotency"
  - "Confirmation gate contract: only Promote/Retire + status=pending can transition; all other combinations rejected with 409"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 12 Plan 01: Human Confirmation Gate Backend Summary

**Fastify verdict confirmation API with 5 endpoints: pending queue, single verdict detail, atomic confirm/reject with 409 idempotency guard, and per-user calibration rate with anti-rubber-stamp warning**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T02:32:33Z
- **Completed:** 2026-02-22T02:35:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `timeOnScreenMs` nullable integer column to `council_verdicts` schema with Drizzle migration `0006_add_time_on_screen_ms.sql`
- Created `verdictsRoutes` FastifyPluginAsyncTypebox plugin with 5 endpoints following the project's TypeBox + Drizzle patterns
- Registered verdicts plugin at `/verdicts` prefix in `app.ts` after admin routes
- Confirmed all 7 verification checks pass: TypeScript compiles cleanly in both packages, all routes present, idempotency guard works via `.returning()`, calibration filters correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add timeOnScreenMs column to council_verdicts schema and generate migration** - `1249537` (feat)
2. **Task 2: Create verdicts route plugin with 4 endpoints and register in app.ts** - `134b536` (feat)

**Plan metadata:** (docs commit — created below)

## Files Created/Modified

- `packages/db/src/schema/council-verdicts.ts` - Added `integer` import and `timeOnScreenMs: integer('time_on_screen_ms')` column after `confirmedBy`
- `packages/db/migrations/0006_add_time_on_screen_ms.sql` - Single ALTER TABLE ADD COLUMN migration
- `packages/db/migrations/meta/_journal.json` - Updated tag from `0006_parallel_rage` to `0006_add_time_on_screen_ms`
- `packages/db/migrations/meta/0006_snapshot.json` - Auto-generated snapshot (numerically indexed, unaffected by rename)
- `services/execution-service/src/routes/verdicts.ts` - New FastifyPluginAsyncTypebox with 5 endpoints
- `services/execution-service/src/app.ts` - Import and register `verdictsRoutes` at `/verdicts` prefix

## Decisions Made

- GET /verdicts/pending only surfaces Promote and Retire verdicts — Maintain/Monitor/Demote never require human confirmation per CONF requirements
- Confirm and reject use a single atomic UPDATE with WHERE status=pending AND verdictType IN (Promote,Retire) plus .returning() — eliminates race conditions vs SELECT-then-UPDATE; 0 rows returned means 409
- reject endpoint does NOT set confirmedAt — only confirmedBy and timeOnScreenMs, consistent with the semantic that rejection is not a "confirmation" event
- warningTriggered threshold: total>=10 AND rate>0.95 — requires meaningful sample size before triggering anti-rubber-stamp alert
- Migration renamed from 0006_parallel_rage to 0006_add_time_on_screen_ms following established pattern from phases 08-02, 09-03, 10-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration `0006_add_time_on_screen_ms.sql` is ready to apply via `cd packages/db && npx drizzle-kit migrate` once the Phase 8 pgvector blocker is resolved.

## Next Phase Readiness

- Verdict confirmation API contract fully established: operators can list, inspect, confirm, and reject Promote/Retire verdicts
- Plan 02 (operator confirmation UI) can now build against these 5 endpoints
- Phase 13 (God Layer) will consume verdict status to gate Promote/Retire outcomes

## Self-Check: PASSED

All files and commits verified:
- FOUND: services/execution-service/src/routes/verdicts.ts
- FOUND: packages/db/migrations/0006_add_time_on_screen_ms.sql
- FOUND: packages/db/migrations/meta/0006_snapshot.json
- FOUND: .planning/phases/12-human-confirmation-gate/12-01-SUMMARY.md
- FOUND commit: 1249537 (Task 1)
- FOUND commit: 134b536 (Task 2)

---
*Phase: 12-human-confirmation-gate*
*Completed: 2026-02-22*
