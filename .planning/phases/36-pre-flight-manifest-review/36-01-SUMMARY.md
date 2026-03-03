---
phase: 36-pre-flight-manifest-review
plan: "01"
subsystem: execution-service
tags: [pre-flight, execution-status, state-machine, api, manifest-review]
dependency_graph:
  requires: []
  provides: [pre_flight-status, confirm-endpoint, cancel-endpoint, decoupled-manifest-assembly]
  affects: [execution-service, db-schema, shared-types]
tech_stack:
  added: []
  patterns: [TypeBox schema, Fastify plugin, Drizzle ORM, atomic state transitions]
key_files:
  created:
    - packages/db/migrations/0015_add_pre_flight_status.sql
  modified:
    - packages/db/src/schema/executions.ts
    - packages/db/migrations/meta/_journal.json
    - packages/shared-types/src/execution.ts
    - services/execution-service/src/services/assemble-population.ts
    - services/execution-service/src/services/execution.service.ts
    - services/execution-service/src/routes/executions.ts
decisions:
  - pre_flight status added before 'queued' in enum — preserves existing status ordering for all terminal states
  - assemblePopulation now stops at manifest persistence (status: assembling->spawning) without calling spawnAgentsForRun — cleaner separation of concerns
  - confirm endpoint uses setImmediate for bot spawning — consistent with existing async handoff pattern in POST /
  - ringLeaderRuns table mark-as-failed on cancel — prevents orphaned ring_leader_runs rows for cancelled executions
metrics:
  duration: "~8 minutes"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 6
  files_created: 1
---

# Phase 36 Plan 01: Pre-Flight Execution Status and Confirm/Cancel Endpoints Summary

Pre_flight execution status added to DB enum and shared types, manifest assembly decoupled from bot spawning, and confirm/cancel endpoints exposed for user-gated execution launch.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add pre_flight to execution status enum, shared types, migration | 3775f3e | executions.ts schema, execution.ts shared-types, 0015 migration |
| 2 | Decouple manifest assembly, change initial status, add confirm/cancel | 1697e01 | assemble-population.ts, execution.service.ts, routes/executions.ts |

## What Was Built

### DB Schema & Migration
- Added `'pre_flight'` as first value in `executionStatusEnum` pgEnum (before `'queued'`)
- Changed default status in `executions` table from `'queued'` to `'pre_flight'`
- Created `0015_add_pre_flight_status.sql` with `ALTER TYPE "execution_status" ADD VALUE IF NOT EXISTS 'pre_flight' BEFORE 'queued'` (must run outside transaction block)
- Added migration entry 0015 to `_journal.json`

### Shared Types
- Added `'pre_flight'` to `ExecutionStatus` type union (before `'queued'`)
- Added `'pre_flight'` to `EXECUTION_STATUSES` const array

### Decoupled Manifest Assembly
- Removed `import { spawnAgentsForRun }` from `assemble-population.ts`
- Removed fire-and-forget `spawnAgentsForRun(...)` call (Step 9) — function now ends after persisting `populationManifest` and transitioning ring_leader_run status to `'spawning'`
- Removed executionId DB query from `assemblePopulation` (no longer needed without spawnAgentsForRun)

### execution.service.ts
- Changed `createExecution` return type from `{ executionId: string; status: 'queued' }` to `{ executionId: string; status: 'pre_flight' }`
- Changed DB insert status from `'queued'` to `'pre_flight'`

### routes/executions.ts Changes
- Added `spawnAgentsForRun` static import from `../services/agent-spawner`
- Added `ringLeaderRuns` to `@claw/db` import
- Updated `POST /` response schema: status literal changed from `'queued'` to `'pre_flight'`
- Updated `POST /` handler result type to `{ executionId: string; status: 'pre_flight' }`
- Removed `transitionExecution(executionId, 'queued', 'running')` from setImmediate block
- Removed `publishExecutionStatusChanged` from setImmediate block
- Updated error handling: transitions `pre_flight -> failed` (not `queued -> failed`)
- Added `'pre_flight'` to GET `/:id` status union
- Added `'pre_flight'` to GET `/all` status union
- Added `POST /:id/confirm` endpoint:
  - Auth: verifyAuthToken
  - Validates execution is in `pre_flight` status (409 if not)
  - Validates `populationManifest` is assembled (409 if not)
  - Transitions `pre_flight -> queued` atomically
  - Fires `setImmediate` to transition `queued -> running` and call `spawnAgentsForRun`
- Added `POST /:id/cancel` endpoint:
  - Auth: verifyAuthToken
  - Validates execution is in `pre_flight` status (409 if not)
  - Transitions `pre_flight -> stopped`
  - Updates `ring_leader_runs.status = 'failed'` to prevent orphaned rows

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

### Files Created
- [x] FOUND: packages/db/migrations/0015_add_pre_flight_status.sql

### Files Modified
- [x] FOUND: packages/db/src/schema/executions.ts (contains pre_flight)
- [x] FOUND: packages/shared-types/src/execution.ts (contains pre_flight x2)
- [x] FOUND: services/execution-service/src/services/assemble-population.ts (spawnAgentsForRun removed)
- [x] FOUND: services/execution-service/src/routes/executions.ts (confirm and cancel endpoints added)

### Commits
- [x] FOUND: 3775f3e - feat(36-01): add pre_flight to execution status enum, shared types, and migration
- [x] FOUND: 1697e01 - feat(36-01): decouple manifest assembly from bot spawning, add confirm/cancel endpoints
