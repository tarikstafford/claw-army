---
phase: 28-ring-leader-agent-spawning
plan: 02
subsystem: execution-service
tags: [dag, wave-spawning, session-registry, ring-leader, agent-spawning, bot-orchestrator]

# Dependency graph
requires:
  - phase: 28-01
    provides: mintSessionJwt and buildAgentSessionPrompt for per-agent JWT and prompt assembly
  - phase: 27-budget-validation-and-population-sizing
    provides: validated population manifests with soul assignments per task
  - phase: 25-orchestrator-demotion-and-ring-leader-core
    provides: RingLeaderMissionBrief, TaskGraph types with DAG adjacency map
provides:
  - agent-spawner.ts: DAG-respecting spawner, ActiveSessionRegistry, spawnAgentsForRun, getActiveSessionRegistry, getAllActiveRegistries
  - assemble-population.ts (updated): triggers spawnAgentsForRun after budget validation and manifest persistence
affects:
  - 28-03 and beyond: coordination phase can query ActiveSessionRegistry via getActiveSessionRegistry(runId)
  - ring_leader_runs.status: spawning -> coordinating transition now happens inside spawnAgentsForRun

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DAG spawn wave computation: reverse-dependency map built from dag adjacency; topological sort via greedy wave assignment"
    - "Fire-and-forget spawning: spawnAgentsForRun called without await so assemblePopulation returns immediately after status=spawning"
    - "Module-level registry map keyed by ringLeaderRunId — survives across async boundaries within a process"
    - "Promise.allSettled for wave-parallel spawning — failures log but do not block sibling agents"

key-files:
  created:
    - services/execution-service/src/services/agent-spawner.ts
  modified:
    - services/execution-service/src/services/assemble-population.ts

key-decisions:
  - "sessionId in ActiveSession uses botId returned from spawnBot — OpenClaw session protocol is unverified (see STATE.md blocker), botId is the reliable unique identifier until sessions_list is confirmed"
  - "upstream output collection returns empty array — tasks table has no ring_leader_task_id column to link mission brief taskId to task rows; DAG ordering is still respected (tasks wait for upstream wave spawns), but intelligence injection is deferred to a future schema addition"
  - "executionId sourced from ring_leader_runs DB row (Option A) to preserve assemblePopulation public interface (2-arg signature unchanged for ring-leader-spawner.ts caller)"
  - "Cycle detection in computeSpawnWaves: if no progress can be made, all remaining tasks dumped into one wave with a WARN — prevents infinite loop on malformed DAGs"

patterns-established:
  - "Wave-sequential, agent-parallel spawning: outer loop is sequential (waves), inner Promise.allSettled is parallel (agents within wave)"
  - "Registry entries start as 'spawning', transition to 'active' after Promise.allSettled resolves for their wave"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 28 Plan 02: DAG-Respecting Agent Spawner Summary

**DAG topological wave spawning with per-agent JWT+prompt assembly and module-level active session registry wired into the population assembly pipeline**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T12:35:54Z
- **Completed:** 2026-03-02T12:37:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `agent-spawner.ts`: `spawnAgentsForRun` computes topological spawn waves from `TaskGraph.dag`, spawns wave 0 tasks immediately in parallel, holds dependent tasks until upstream waves complete (SPAWN-06); every session registered in `ActiveSessionRegistry` (SPAWN-05); each agent receives session JWT via `mintSessionJwt` and assembled prompt via `buildAgentSessionPrompt`; transitions `ring_leader_runs.status` to `'coordinating'` after all waves
- `assemble-population.ts`: Step 9 added — fire-and-forget `spawnAgentsForRun` call after manifests persisted; `executionId` queried from DB at function start; error handler transitions run to `'failed'` if spawning throws; pipeline now flows: assemblePopulation → budget validation → persist manifests → spawnAgentsForRun

## Task Commits

Each task was committed atomically:

1. **Task 1: DAG-respecting agent spawner with session registry** - `8e0baa9` (feat)
2. **Task 2: Wire agent spawner into population assembly pipeline** - `7d9d182` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/execution-service/src/services/agent-spawner.ts` — DAG wave computation, parallel agent spawning per wave, ActiveSessionRegistry, status coordination; exports `spawnAgentsForRun`, `getActiveSessionRegistry`, `getAllActiveRegistries`
- `services/execution-service/src/services/assemble-population.ts` — added `spawnAgentsForRun` import, executionId DB query at start, Step 9 fire-and-forget spawning trigger with error fallback

## Decisions Made

- `sessionId` in `ActiveSession` uses `botId` returned from `spawnBot` — the OpenClaw sessions protocol is unverified (v4.0 blocker in STATE.md), so botId is the reliable unique session identifier until `sessions_list` is confirmed working
- Upstream output collection (`collectUpstreamOutputs`) returns an empty array — the `tasks` table has no `ring_leader_task_id` column to link mission brief `taskId` strings to task rows; DAG ordering is still fully respected, but intelligence injection into session prompts is deferred to a future schema migration
- `executionId` sourced from `ring_leader_runs` row via DB query (Option A from plan) — preserves the 2-argument public interface of `assemblePopulation` so `ring-leader-spawner.ts` caller requires no changes
- Cycle detection in `computeSpawnWaves` — if no progress can be made (all remaining tasks have unresolvable deps), remaining tasks are dumped into a single wave with a `WARN` log to prevent infinite loops on malformed DAGs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Upstream output query not feasible without schema column**

- **Found during:** Task 1 implementation
- **Issue:** The plan specifies querying `tasks` table by `taskId` for upstream outputs, but the `tasks` table has no column linking to mission brief `taskId` strings (only `id`, `executionId`, `description`, `result`)
- **Fix:** `collectUpstreamOutputs` returns empty array with a detailed TODO comment explaining that a `ring_leader_task_id` varchar column on the tasks table is needed. DAG ordering still respected — tasks wait for upstream wave spawns before they spawn. Constitution-bound intelligence injection deferred.
- **Files modified:** `agent-spawner.ts` (collectUpstreamOutputs function with TODO)
- **Commit:** `8e0baa9`

## Issues Encountered

None blocking.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `spawnAgentsForRun` and `ActiveSessionRegistry` are ready for Phase 28 Plan 03+ (coordination)
- `getActiveSessionRegistry(runId)` provides the coordination phase a queryable view of all active sessions
- Upstream output injection will require adding `ring_leader_task_id` to the tasks schema (future plan)

---
*Phase: 28-ring-leader-agent-spawning*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/agent-spawner.ts
- FOUND: services/execution-service/src/services/assemble-population.ts (updated)
- FOUND commit 8e0baa9 (feat(28-02): DAG-respecting agent spawner)
- FOUND commit 7d9d182 (feat(28-02): wire agent spawner into population assembly pipeline)
