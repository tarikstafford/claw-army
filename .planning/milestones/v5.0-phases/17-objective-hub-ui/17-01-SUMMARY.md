---
phase: 17-objective-hub-ui
plan: 01
subsystem: api, ui
tags: [fastify, drizzle-orm, typebox, svelte5, typescript, objectives, executions]

# Dependency graph
requires:
  - phase: 16-named-objectives-data-model
    provides: objectives table, executions.objectiveId FK, GET /objectives and GET /objectives/:id endpoints

provides:
  - GET /objectives/:id/executions — returns all runs for an objective with cost, botCount, avgCompositeScore
  - GET /objectives/:id/stats — returns aggregate totals, class breakdown, classTrendSummary
  - Objective, ObjectiveListItem, ObjectiveRun, ObjectiveStats TypeScript interfaces in UI types.ts
  - getObjectives, getObjective, getObjectiveExecutions, getObjectiveStats API client functions in ui/api.ts

affects:
  - 17-02-objectives-list-page
  - 17-03-objective-detail-page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.execute() returns QueryResult not array — use db.select() with sql<T> correlated subqueries for all queries"
    - "Correlated subquery for stats: select from objectives WHERE id = :id with sql<number> subquery fields"
    - "avgCompositeScore uses CAST AS float to avoid PostgreSQL numeric-as-string pitfall"
    - "innerJoin with sql template literals for raw table aliases (agent_classes ac)"

key-files:
  created: []
  modified:
    - services/execution-service/src/routes/objectives.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts

key-decisions:
  - "db.execute() rejected in favor of db.select() with sql<T> correlated subqueries — QueryResult is not iterable"
  - "Stats endpoint uses single db.select() from objectives with 4 correlated subquery fields (runCount, totalSpendCents, totalTasksCompleted, totalBotHours)"
  - "Class breakdown uses db.select() with raw SQL aliases (agent_classes ac) via innerJoin sql templates"
  - "avgCompositeScore CAST AS float in executions endpoint to avoid numeric string coercion pitfall from research"
  - "/:id/executions and /:id/stats registered before /:id to prevent Fastify Radix tree ambiguity"

patterns-established:
  - "Use db.select({ field: sql<T>`subquery` }).from(objectives).where(eq(objectives.id, id)) for per-objective aggregation queries"
  - "Convert Number() all sql<number> results — Drizzle returns PostgreSQL numeric types as strings"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 17 Plan 01: Backend API Extensions and UI Data Layer Summary

**Two new Fastify GET endpoints (/:id/executions, /:id/stats) in objectives.ts plus four TypeScript interfaces and four API client functions enabling the Objective Hub UI pages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T08:55:27Z
- **Completed:** 2026-02-22T08:57:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `GET /objectives/:id/executions` returning all execution runs with totalCostCents, botCount, and avgCompositeScore (CAST AS float to prevent numeric string coercion)
- Added `GET /objectives/:id/stats` returning aggregate spend, task count, bot-hours, class breakdown by Novice/Understudy/Artisan/Retired, and human-readable classTrendSummary string
- Added Objective, ObjectiveListItem, ObjectiveRun, ObjectiveStats interfaces to `types.ts` with ObjectiveListItem extending Objective
- Added getObjectives, getObjective, getObjectiveExecutions, getObjectiveStats to `api.ts` using established apiFetch pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /:id/executions and GET /:id/stats endpoints** - `89732b6` (feat)
2. **Task 2: Add UI types and API client functions for objectives** - `1e6c56a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/execution-service/src/routes/objectives.ts` - Added two new GET endpoints before existing /:id handler
- `services/ui/src/lib/types.ts` - Added Phase 17 Objective Hub interfaces (Objective, ObjectiveListItem, ObjectiveRun, ObjectiveStats)
- `services/ui/src/lib/api.ts` - Extended type imports, added four objective API client functions

## Decisions Made
- Used `db.select()` with correlated subquery fields rather than `db.execute()` because `db.execute()` returns `QueryResult<T>` which is not iterable (TypeScript error TS2488)
- Stats query pulls all four aggregate fields from a single `db.select().from(objectives)` with correlated sql subqueries — clean, readable, follows Phase 16 pattern
- Class breakdown query uses `db.select()` with raw SQL table aliases via `innerJoin(sql\`agent_classes ac\`, ...)` — necessary because agentClasses Drizzle table wasn't imported and raw aliases are cleaner for this GROUP BY pattern
- CAST AVG(composite_score) AS float in executions endpoint (Research pitfall 1 — PostgreSQL returns numeric as string)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced db.execute() with db.select() pattern**
- **Found during:** Task 1 verification (TypeScript compile check)
- **Issue:** `db.execute<T>()` returns `QueryResult<T>` not an array — TS2488: "must have a '[Symbol.iterator]()' method"
- **Fix:** Rewrote both raw SQL queries as `db.select({ field: sql<T>\`...\` }).from(objectives).where(...)` and `db.select(...).from(sql\`agent_classes ac\`).innerJoin(...)` patterns
- **Files modified:** `services/execution-service/src/routes/objectives.ts`
- **Verification:** `pnpm --filter=execution-service exec tsc --noEmit` passes with 0 errors
- **Committed in:** `89732b6` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Necessary correctness fix. No scope creep. Same SQL semantics, correct TypeScript type.

## Issues Encountered
- `db.execute()` is not iterable in drizzle-orm/node-postgres — resolved by using `db.select()` with correlated sql subqueries (same established pattern from objectives.ts GET / handler)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four API functions and TypeScript interfaces are importable from `$lib/api` and `$lib/types`
- Both new endpoints verified to compile and TypeScript-complete
- Ready for 17-02 (Objectives list page) and 17-03 (Objective detail page) — both can be built in parallel

---
*Phase: 17-objective-hub-ui*
*Completed: 2026-02-22*
