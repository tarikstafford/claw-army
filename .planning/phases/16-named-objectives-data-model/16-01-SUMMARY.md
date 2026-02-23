---
phase: 16-named-objectives-data-model
plan: 01
subsystem: database
tags: [drizzle, postgres, typescript, schema, migrations, shared-types]

# Dependency graph
requires:
  - phase: 15-bot-reliability
    provides: executions table with final column set (taskCategory added in Phase 9)
provides:
  - objectives Drizzle pgTable with 10 columns and 2 indexes
  - nullable objectiveId FK column on executions table (ON DELETE SET NULL)
  - SQL migrations 0009 and 0010 for idempotent schema application
  - Objective and NewObjective TypeScript interfaces in shared-types
affects:
  - 16-02 (API routes for objectives CRUD depend on this schema)
  - 16-03 (execution linking depends on objectiveId FK)
  - 16-04 (UI depends on shared-types Objective interface)

# Tech tracking
tech-stack:
  added: []
  patterns: [drizzle pgTable with third-arg index array, idempotent SQL migrations with IF NOT EXISTS, shared-types interfaces mirroring DB schema without Drizzle dependency]

key-files:
  created:
    - packages/db/src/schema/objectives.ts
    - packages/db/migrations/0009_objectives.sql
    - packages/db/migrations/0010_executions_objective_id.sql
    - packages/shared-types/src/objective.ts
  modified:
    - packages/db/src/schema/executions.ts
    - packages/db/src/schema/index.ts
    - packages/shared-types/src/index.ts

key-decisions:
  - "objectiveId on executions is nullable with ON DELETE SET NULL — existing executions unaffected, no backfill needed"
  - "Migration 0010 uses DO $$ block for idempotent FK constraint addition (constraint_name check in information_schema)"
  - "NewObjective omits id, isArchived, createdAt, updatedAt — server always assigns these, clients never send them"

patterns-established:
  - "Drizzle index pattern: third argument to pgTable is an array of index() calls on (t) => [...], matching existing schema files"
  - "Shared-types pattern: mirror DB shape with branded types (UUID, Cents, ISOTimestamp) from common.ts, no Drizzle import"

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 16 Plan 01: Named Objectives Data Model Summary

**Objectives Drizzle schema + SQL migrations (0009, 0010) + shared-types Objective interface establishing the data foundation for the Named Objectives feature**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T00:00:00Z
- **Completed:** 2026-02-22T00:08:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created `objectives` Drizzle pgTable with 10 columns (uuid PK, name, description, 4 default-setting columns, isArchived, two timestamps) and 2 btree indexes
- Added nullable `objectiveId` FK column to `executions` table referencing `objectives.id` with ON DELETE SET NULL
- Wrote two idempotent SQL migration files (0009 CREATE TABLE IF NOT EXISTS, 0010 ALTER TABLE + DO $$ FK guard)
- Exported `Objective` interface and `NewObjective` type from `@claw/shared-types` matching the DB schema without any Drizzle dependency
- Both packages (`packages/db`, `packages/shared-types`) compile cleanly with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create objectives Drizzle schema and SQL migration** - `11956aa` (feat)
2. **Task 2: Add objectiveId FK to executions schema + migration + shared types** - `50faf1f` (feat)

**Plan metadata:** (see final metadata commit below)

## Files Created/Modified
- `packages/db/src/schema/objectives.ts` - Drizzle pgTable for objectives with 10 columns, 2 indexes, Objective and NewObjective inferred types
- `packages/db/src/schema/index.ts` - Added `export * from './objectives'` barrel export
- `packages/db/migrations/0009_objectives.sql` - Idempotent CREATE TABLE IF NOT EXISTS for objectives with all columns and indexes
- `packages/db/src/schema/executions.ts` - Added objectives import and nullable objectiveId FK column
- `packages/db/migrations/0010_executions_objective_id.sql` - Idempotent ALTER TABLE + DO $$ block for FK constraint
- `packages/shared-types/src/objective.ts` - Objective interface (10 fields) and NewObjective type
- `packages/shared-types/src/index.ts` - Added `export * from './objective'` barrel export

## Decisions Made
- `objectiveId` on `executions` is nullable with ON DELETE SET NULL — preserves existing execution rows unchanged, no backfill required
- Migration 0010 uses a `DO $$` block with `information_schema.table_constraints` check to make FK addition idempotent, following established migration patterns in this codebase
- `NewObjective` omits `id`, `isArchived`, `createdAt`, and `updatedAt` — these are always server-assigned; clients creating objectives only need to provide content and default-setting fields

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npx tsc` resolves to an npm shim on this machine; compiled using the package-local binary at `packages/db/node_modules/.bin/tsc`. Both packages passed without errors.

## User Setup Required

None - no external service configuration required. Migrations must be applied to the database when ready (run `0009_objectives.sql` then `0010_executions_objective_id.sql` in order).

## Next Phase Readiness
- Schema and types are fully in place; Plan 16-02 (objectives CRUD API routes) can proceed immediately
- Both DB and shared-types packages compile cleanly — no blockers for downstream plans
- Idempotent migrations are safe to apply to production once pgvector blocker (from STATE.md) is resolved

## Self-Check: PASSED

All files verified present on disk. Both task commits (11956aa, 50faf1f) confirmed in git log.

---
*Phase: 16-named-objectives-data-model*
*Completed: 2026-02-22*
