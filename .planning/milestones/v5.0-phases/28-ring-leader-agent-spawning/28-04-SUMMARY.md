---
phase: 28-ring-leader-agent-spawning
plan: "04"
subsystem: database
tags: [drizzle, postgres, ring-leader, upstream-intelligence, agent-spawner]

requires:
  - phase: 28-ring-leader-agent-spawning
    provides: DAG-respecting agent spawner with active session registry and population assembly wiring

provides:
  - ring_leader_task_id varchar(255) column on tasks table (schema + SQL migration 0012)
  - tasks_ring_leader_task_id_idx index for efficient upstream output queries
  - collectUpstreamOutputs() querying tasks by ring_leader_task_id WHERE status=completed
  - task row creation during Ring Leader agent spawning with ringLeaderTaskId linkage
  - end-to-end functional upstream intelligence pipeline

affects:
  - openclaw-dispatcher (updates task rows to completed/failed and populates result field)
  - agent-session-builder (receives upstream outputs via collectUpstreamOutputs)
  - Phase 29 Ring Leader coordination

tech-stack:
  added: []
  patterns:
    - "Ring Leader task linkage: ringLeaderTaskId varchar on tasks table links mission brief taskId strings to DB task rows"
    - "Non-fatal upstream intelligence: collectUpstreamOutputs wraps DB query in try/catch returning [] on failure"
    - "Idempotent migrations: IF NOT EXISTS for both ADD COLUMN and CREATE INDEX"

key-files:
  created:
    - packages/db/migrations/0012_add_ring_leader_task_id.sql
  modified:
    - packages/db/src/schema/tasks.ts
    - packages/db/migrations/meta/_journal.json
    - services/execution-service/src/services/agent-spawner.ts

key-decisions:
  - "ringLeaderTaskId is varchar(255) nullable with no FK — mission brief taskIds are opaque strings like 'task-1' not UUIDs"
  - "collectUpstreamOutputs is non-fatal: try/catch returns [] on DB error so upstream intelligence failure never blocks agent spawning"
  - "Task row created after spawnBot succeeds with status=claimed; openclaw-dispatcher transitions to completed/failed and populates result"
  - "inArray(tasks.ringLeaderTaskId, upstreamTaskIds) short-circuits on empty array to avoid invalid SQL"

patterns-established:
  - "Upstream intelligence pattern: ring_leader_task_id links opaque mission brief taskIds to DB rows; query by this column to collect completed outputs"

duration: 2min
completed: 2026-03-02
---

# Phase 28 Plan 04: Upstream Intelligence Pipeline (SPAWN-03 Gap Closure) Summary

**ring_leader_task_id varchar column on tasks table + real collectUpstreamOutputs DB query closes the upstream intelligence gap so downstream agents receive completed upstream task results in their session prompts**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T12:40:56Z
- **Completed:** 2026-03-02T12:42:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `ringLeaderTaskId` varchar(255) nullable column to Drizzle tasks schema with `tasks_ring_leader_task_id_idx` index
- Created idempotent SQL migration `0012_add_ring_leader_task_id.sql` registered in `_journal.json` at idx 12
- Replaced `collectUpstreamOutputs()` stub with real Drizzle query: `tasks WHERE ring_leader_task_id IN (...) AND status=completed`
- Added `db.insert(tasks)` call after `spawnBot()` to create task rows with `ringLeaderTaskId=taskId` linkage during agent spawning
- Upstream intelligence pipeline now end-to-end functional: upstream task completes with result -> downstream `collectUpstreamOutputs` finds it -> `buildAgentSessionPrompt` renders "## Upstream Intelligence" section

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ring_leader_task_id column to tasks schema and create SQL migration** - `3286a80` (feat)
2. **Task 2: Create task rows during agent spawning and implement collectUpstreamOutputs** - `e1ddda7` (feat)

**Plan metadata:** (see below)

## Files Created/Modified

- `packages/db/src/schema/tasks.ts` - Added `ringLeaderTaskId` varchar(255) column, `tasks_ring_leader_task_id_idx` index, and `varchar` import
- `packages/db/migrations/0012_add_ring_leader_task_id.sql` - Idempotent SQL migration for new column and index
- `packages/db/migrations/meta/_journal.json` - Journal entry idx 12 for migration 0012
- `services/execution-service/src/services/agent-spawner.ts` - Real `collectUpstreamOutputs()` implementation + `db.insert(tasks)` in spawn loop

## Decisions Made

- `ringLeaderTaskId` is `varchar(255)` nullable with no FK — mission brief taskIds are opaque strings like `"task-1"` or `"research-phase"`, not UUIDs referencing another table
- `collectUpstreamOutputs()` is non-fatal: wrapped in try/catch, returns `[]` on DB error so upstream intelligence failure never blocks agent spawning
- Task row created after `spawnBot()` succeeds with `status='claimed'`; `openclaw-dispatcher` will later transition to `completed`/`failed` and populate the `result` field
- `inArray()` short-circuits on empty `upstreamTaskIds` to avoid invalid SQL (`IN ()`); returns `[]` immediately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration `0012_add_ring_leader_task_id.sql` must be applied to the database manually (as with migrations 0008-0010).

**Apply migration:**
```sql
-- Apply via psql or the DB migration process
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ring_leader_task_id" varchar(255);
CREATE INDEX IF NOT EXISTS "tasks_ring_leader_task_id_idx" ON "tasks" USING btree ("ring_leader_task_id");
```

## Next Phase Readiness

- Upstream intelligence pipeline is end-to-end functional: `agent-spawner.ts` creates task rows, `openclaw-dispatcher.ts` will populate `result` and update `status`, `collectUpstreamOutputs()` queries the results, `buildAgentSessionPrompt()` injects them into downstream agent sessions
- Phase 29 (Ring Leader coordination) can rely on task rows being created during spawning with `ringLeaderTaskId` linkage
- Migration 0012 must be applied to production DB before Ring Leader runs will create task rows

---
*Phase: 28-ring-leader-agent-spawning*
*Completed: 2026-03-02*

## Self-Check: PASSED

- tasks.ts: FOUND
- 0012_add_ring_leader_task_id.sql: FOUND
- agent-spawner.ts: FOUND
- 28-04-SUMMARY.md: FOUND
- Commit 3286a80: FOUND
- Commit e1ddda7: FOUND
