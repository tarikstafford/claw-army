---
phase: 16-named-objectives-data-model
plan: 02
subsystem: api
tags: [fastify, typebox, drizzle-orm, postgres, cors, objectives, rest-api]

# Dependency graph
requires:
  - phase: 16-01
    provides: objectives Drizzle schema, SQL migrations 0009/0010, shared-types Objective interface

provides:
  - FastifyPluginAsyncTypebox objectivesRoutes with 5 REST endpoints at /objectives
  - POST /objectives: create named objective with auth guard
  - GET /objectives: list non-archived objectives with lastRunStatus, runCount, totalSpendCents, bestBotClass aggregation
  - GET /objectives/:id: get single objective by ID or 404
  - DELETE /objectives/:id: delete objective with auth (FK cascade via ON DELETE SET NULL)
  - PATCH /objectives/:id: selective update / archive with auth

affects:
  - 16-03-ui-objectives-panel
  - any phase building UI that calls /objectives endpoints

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TypeBox ObjectiveSchema reuse — base schema + aggregation-extended schema for GET list"
    - "Drizzle correlated sql<T> subqueries for aggregation (matching billing.ts pattern)"
    - "Selective PATCH updates — build updates object from only defined body fields, always set updatedAt"
    - "401 response type in TypeBox schema required for auth-protected routes with preHandler"

key-files:
  created:
    - services/execution-service/src/routes/objectives.ts
  modified:
    - services/execution-service/src/app.ts

key-decisions:
  - "TypeBox response schemas for auth-protected routes must declare 401 as a valid response code or TS2345 is raised"
  - "CORS methods expanded to include PATCH and DELETE for browser preflight support on objectives endpoints"

patterns-established:
  - "Selective PATCH: build updates = { updatedAt: new Date() }, conditionally add body fields by undefined check"
  - "401 declared in all auth-gated route response schemas alongside the happy-path codes"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 16 Plan 02: Named Objectives REST API Summary

**Five-endpoint Fastify objectives CRUD with correlated subquery aggregation (lastRunStatus, runCount, totalSpendCents, bestBotClass) serving OBJ-01 through OBJ-04**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T08:20:29Z
- **Completed:** 2026-02-22T08:22:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `services/execution-service/src/routes/objectives.ts` as a `FastifyPluginAsyncTypebox` plugin with all 5 endpoints (POST, GET /, GET /:id, DELETE /:id, PATCH /:id)
- GET /objectives uses 4 correlated Drizzle `sql<T>` subqueries to return lastRunStatus, runCount, totalSpendCents, and bestBotClass alongside base fields, filtered to non-archived records
- PATCH /:id implements selective update pattern — only fields present in the request body are updated, plus `updatedAt` is always refreshed
- Registered `objectivesRoutes` at `/objectives` prefix in `app.ts` and expanded CORS methods to include PATCH and DELETE

## Task Commits

Each task was committed atomically:

1. **Task 1: Create objectives route file with all five endpoints** - `a9ea131` (feat)
2. **Task 2: Register objectives routes in app.ts and update CORS** - `32c6ebe` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `services/execution-service/src/routes/objectives.ts` - FastifyPluginAsyncTypebox with 5 handler endpoints, TypeBox schemas, correlated subquery aggregation, auth preHandlers
- `services/execution-service/src/app.ts` - import + register objectivesRoutes at /objectives, CORS methods expanded

## Decisions Made
- TypeBox response schemas for auth-protected routes must explicitly declare 401 as a valid response code — TypeBox's type system raises TS2345 when reply.code(401) is called without a matching schema entry
- CORS methods array updated to include PATCH and DELETE — browser preflight checks (OPTIONS) enforce the declared method list; objectives endpoints require both methods

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 401 response types to TypeBox schemas for auth-protected routes**
- **Found during:** Task 1 (Create objectives route file)
- **Issue:** TypeScript raised TS2345 on `reply.code(401).send(...)` because the TypeBox response schema didn't declare 401 as a valid response code for POST, DELETE, and PATCH routes
- **Fix:** Added `401: Type.Object({ error: Type.String() })` to the response schema for all three auth-protected routes
- **Files modified:** services/execution-service/src/routes/objectives.ts
- **Verification:** `pnpm --filter=execution-service exec tsc --noEmit` passes cleanly
- **Committed in:** a9ea131 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Required fix for TypeScript correctness. No scope creep, aligned with pattern used in other auth routes.

## Issues Encountered
None beyond the auto-fixed TypeBox 401 schema issue above.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All files found and all commits verified (a9ea131, 32c6ebe).

## Next Phase Readiness
- All 5 objectives REST endpoints are live and TypeScript-clean
- GET /objectives aggregation provides UI-ready data for OBJ-03 (last run status, counts, spend, best class)
- CORS is open for PATCH and DELETE methods
- Phase 16 Plan 03 (UI objectives panel) can now call all endpoints

---
*Phase: 16-named-objectives-data-model*
*Completed: 2026-02-22*
