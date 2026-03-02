---
phase: 25-orchestrator-demotion-and-ring-leader-core
plan: 03
subsystem: api
tags: [ring-leader, orchestrator, mission-brief, task-graph, preflight-validation, drizzle]

# Dependency graph
requires:
  - phase: 25-01
    provides: planObjectiveAsTaskGraph from planner.service.ts and task-graph-parser.ts
  - phase: 25-02
    provides: validatePreFlight from preflight-validator.ts
  - phase: 24-01
    provides: ring_leader_runs table schema and executions.ringLeaderRunId column
  - phase: 24-02
    provides: RingLeaderMissionBrief, TaskGraph, CampaignType types from @claw/shared-types

provides:
  - ring-leader-spawner.ts exports spawnRingLeader — mission brief construction and ring_leader_runs DB row creation
  - POST /executions is now a thin pre-flight layer: task graph parse -> validate -> Ring Leader spawn -> done
  - ring_leader_runs row with status 'assembling' and full RingLeaderMissionBrief JSONB created per execution
  - executions.ringLeaderRunId linked back to the ring_leader_runs row

affects:
  - phases 26-29 (Ring Leader soul selection, spawning, coordination, synthesis)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Orchestrator as thin pre-flight layer: parse -> validate -> spawn -> step back
    - Mission brief construction after DB insert (runId used as brief.runId)
    - Logical FK pattern: executions.ringLeaderRunId -> ring_leader_runs.id (no explicit constraint)

key-files:
  created:
    - services/execution-service/src/services/ring-leader-spawner.ts
  modified:
    - services/execution-service/src/routes/executions.ts

key-decisions:
  - "Mission brief runId is the DB-generated UUID from ring_leader_runs.id — insert first with empty brief, then update with full brief including runId"
  - "Pre-flight validation (task graph + budget + tool grants) runs synchronously before 201 response so failures can return 400; only Ring Leader spawn goes in setImmediate after 201"
  - "Response schema updated to include 400 details field (PreFlightError[]) and 500 status for parse failures"
  - "bot-orchestrator.ts, soul-generator.ts, completion-checker.ts NOT deleted — Ring Leader will call them in phases 26-29; only the POST handler imports are removed"

patterns-established:
  - "Orchestrator delegates by creating a ring_leader_runs row with status 'assembling' and stepping back — Ring Leader takes over from there"
  - "TODO comment at handoff boundary marks exact point where Phase 26+ will trigger soul selection and population assembly"

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 25 Plan 03: Orchestrator Demotion Summary

**POST /executions is now a thin pre-flight layer: planObjectiveAsTaskGraph -> validatePreFlight -> createExecution -> 201 -> setImmediate: spawnRingLeader -> transition to running -> Orchestrator steps back (ORCH-04)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-02T09:56:32Z
- **Completed:** 2026-03-02T10:03:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `ring-leader-spawner.ts` exporting `spawnRingLeader` — constructs a `RingLeaderMissionBrief` and inserts a `ring_leader_runs` row with status `'assembling'`, then links `executions.ringLeaderRunId` back
- Refactored `POST /executions` to move task graph parsing and pre-flight validation synchronously before the 201 response, enabling true 400 rejection without creating any DB rows on validation failure
- Removed all soul generation, task queue insertion, bot spawning, idle checking, and completion polling from the POST handler — Orchestrator now delegates everything downstream to the Ring Leader

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ring-leader-spawner.ts** - `a09e626` (feat)
2. **Task 2: Refactor POST /executions** - `71dc60b` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `services/execution-service/src/services/ring-leader-spawner.ts` - Exports `spawnRingLeader`: inserts `ring_leader_runs` row, constructs `RingLeaderMissionBrief`, links execution row, returns `{ ringLeaderRunId, missionBrief }`
- `services/execution-service/src/routes/executions.ts` - Refactored POST handler; updated imports to remove old orchestration functions; added 400 `details` field and 500 to response schema

## Decisions Made
- Mission brief `runId` is the DB-generated UUID: insert row first with empty brief, then update with full brief that includes the known `runId`. This avoids a chicken-and-egg problem while keeping the mission brief self-contained.
- Pre-flight validation runs synchronously before 201 so callers see full constraint details (task graph errors + tool grant gaps + budget shortfall) in a single 400 response — no execution row is created on failure.
- Response schema updated to allow `400: { error, details? }` (preflight errors) and `500: { error }` (parse failure).
- `bot-orchestrator.ts`, `soul-generator.ts`, `completion-checker.ts` are NOT deleted — they remain for Ring Leader phases 26-29; only the POST handler's usage of these files is removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `details` field and 500 status to POST /executions response schema**
- **Found during:** Task 2 (refactor executions.ts)
- **Issue:** Existing response schema only declared `400: { error }` — the new preflight error path sends `{ error, details: PreFlightError[] }` which would fail TypeBox serialization validation, and the 500 path had no declared schema.
- **Fix:** Extended 400 schema to `{ error, details?: unknown[] }` and added `500: { error }` entry.
- **Files modified:** `services/execution-service/src/routes/executions.ts`
- **Verification:** `tsc --noEmit` passes, TypeBox schema matches all send paths
- **Committed in:** `71dc60b` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical schema field)
**Impact on plan:** Necessary for correct TypeBox serialization of preflight error responses. No scope creep.

## Issues Encountered
None — plan executed cleanly with one auto-fix for schema completeness.

## Next Phase Readiness
- Orchestrator is now a thin pre-flight layer per ORCH-01 through ORCH-04
- `ring_leader_runs` rows are created with status `'assembling'` and full mission brief JSONB on every execution
- Ring Leader phases 26-29 can now read the `ring_leader_runs` row and begin soul selection, population assembly, spawning, and coordination
- The `TODO` comment in `ring-leader-spawner.ts` marks the exact Phase 26 handoff point

---
*Phase: 25-orchestrator-demotion-and-ring-leader-core*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/ring-leader-spawner.ts
- FOUND: services/execution-service/src/routes/executions.ts
- FOUND: .planning/phases/25-orchestrator-demotion-and-ring-leader-core/25-03-SUMMARY.md
- FOUND commit: a09e626 (Task 1 - ring-leader-spawner.ts)
- FOUND commit: 71dc60b (Task 2 - refactored executions.ts)
