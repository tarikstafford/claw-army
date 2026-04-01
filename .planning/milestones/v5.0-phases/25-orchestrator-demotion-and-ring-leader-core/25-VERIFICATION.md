---
phase: 25-orchestrator-demotion-and-ring-leader-core
verified: 2026-03-02T10:07:08Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 25: Orchestrator Demotion and Ring Leader Core — Verification Report

**Phase Goal:** The Orchestrator becomes a thin pre-flight layer that validates the task graph and budget envelope, then hands off to a Ring Leader instance — it no longer drives soul selection, spawning, or coordination.
**Verified:** 2026-03-02T10:07:08Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Given a user objective and tool grants, the system produces a TaskGraph with per-task complexity, required tools, DAG dependencies, and min/recommended populations | VERIFIED | `parseObjectiveToTaskGraph` in task-graph-parser.ts constructs TaskGraphNode[] with all required fields; LLM output parsed + validated; fallback graph on failure |
| 2 | Task graph nodes reference each other via taskId in the dependencies array forming a valid DAG (no cycles) | VERIFIED | `validateTaskGraphDAG` uses Kahn's algorithm; dangling reference check precedes cycle check; cycle path named in error |
| 3 | Each task node has a complexity label (low/medium/high) and a non-empty requiredTools array (when tools available) | VERIFIED | `TaskGraphNode` in shared-types has `complexity: TaskComplexity` and `requiredTools: string[]`; parser coerces to 'medium' default if LLM omits |
| 4 | Orchestrator rejects a submission whose tool grants cannot satisfy the task graph's required tools, surfacing a specific constraint message naming the missing tools and affected tasks | VERIFIED | `validatePreFlight` in preflight-validator.ts aggregates missing tools across tasks into a single TOOL_GRANT_INSUFFICIENT error with affectedTasks[] and missingTools[] |
| 5 | Orchestrator rejects a submission whose budget cap cannot fund the minimum population (3 agents per task), surfacing the exact shortfall in cents | VERIFIED | Budget check computes `totalMinPopulation * costPerAgent`; BUDGET_INSUFFICIENT error includes shortfallCents, budgetCapCents, estimatedMinCostCents in details |
| 6 | Valid submissions pass pre-flight validation with no errors | VERIFIED | `validatePreFlight` returns `{ valid: true, errors: [] }` when all checks pass; `budgetCapCents=0` skips budget check (no-cap mode) |
| 7 | Orchestrator emits a structured mission brief containing objective, task_graph, tool_grants, budget_cap, runtime_limit, campaign_type, and run_id — then transfers control to the Ring Leader | VERIFIED | `spawnRingLeader` constructs `RingLeaderMissionBrief` (typed from @claw/shared-types) with all 7 fields; two-phase insert: row created first, brief updated with generated runId |
| 8 | After Ring Leader spawn, the Orchestrator takes no further action — soul selection, spawning, and execution coordination are deferred to Ring Leader (phases 26-29) | VERIFIED | POST /executions setImmediate block ends at ORCH-04 comment; no calls to generateSoulPopulation, spawnBotsForExecution, addTaskToQueue, startIdleChecker, or startCompletionPoller |
| 9 | Pre-flight validation runs synchronously before the 201 response — failures return 400 with specific constraint messages and no execution or Ring Leader row is created | VERIFIED | `planObjectiveAsTaskGraph` and `validatePreFlight` called before `createExecution` and `reply.status(201).send()`; Ring Leader spawn is in `setImmediate` after 201 |
| 10 | A ring_leader_runs row is created with status 'assembling' and the full mission brief stored in JSONB | VERIFIED | `ringLeaderRuns` schema has `status: ringLeaderStatusEnum` with default 'assembling'; `missionBrief: jsonb` column; spawner inserts with `status: 'assembling'` then updates with full brief |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/execution-service/src/services/task-graph-parser.ts` | Task graph parsing with DAG construction, complexity labeling, tool requirement extraction, and population sizing | VERIFIED | 285 lines; exports `parseObjectiveToTaskGraph` and `validateTaskGraphDAG`; Kahn's cycle detection; fallback flat graph; imports TaskGraph, TaskGraphNode, TaskComplexity, MIN_AGENTS_PER_TASK from @claw/shared-types |
| `services/execution-service/src/services/planner.service.ts` | Updated planner that delegates to task graph parser and returns TaskGraph | VERIFIED | Exports `planObjectiveAsTaskGraph` delegating to `parseObjectiveToTaskGraph`; backward-compat `planObjective` retained; `resolveModel` imported from lib |
| `services/execution-service/src/lib/resolve-model.ts` | Shared AI SDK model resolver (deviation from plan — extracted here instead of staying in planner) | VERIFIED | Exports `resolveModel(modelId): LanguageModel`; covers gpt/claude/gemini routing; explicit LanguageModel return type |
| `services/execution-service/src/services/preflight-validator.ts` | Pre-flight validation of tool grants and budget against task graph | VERIFIED | Exports `validatePreFlight`, `PreFlightResult`, `PreFlightError`; three checks accumulate errors; budgetCapCents=0 skips budget check |
| `services/execution-service/src/services/ring-leader-spawner.ts` | Ring Leader spawn: mission brief construction, ring_leader_runs row creation, and placeholder for downstream handoff | VERIFIED | Exports `spawnRingLeader`; inserts row, constructs brief with runId, links execution.ringLeaderRunId; TODO marks Phase 26 boundary |
| `services/execution-service/src/routes/executions.ts` | Refactored POST /executions route using task graph, pre-flight validation, and Ring Leader spawn | VERIFIED | Pre-flight runs before 201; setImmediate for Ring Leader spawn; no old orchestration calls in POST handler; bot-orchestrator retained for stop route |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| task-graph-parser.ts | @claw/shared-types | imports TaskGraph, TaskGraphNode, TaskComplexity, MIN_AGENTS_PER_TASK | WIRED | Lines 2-7: multi-line named import from '@claw/shared-types' |
| planner.service.ts | task-graph-parser.ts | calls parseObjectiveToTaskGraph | WIRED | Line 4: `import { parseObjectiveToTaskGraph } from './task-graph-parser.js'`; line 26: called in `planObjectiveAsTaskGraph` |
| preflight-validator.ts | @claw/shared-types | imports TaskGraph | WIRED | Line 1: `import { type TaskGraph } from '@claw/shared-types'` |
| preflight-validator.ts | task-graph-parser.ts | imports validateTaskGraphDAG | WIRED | Line 2: `import { validateTaskGraphDAG } from './task-graph-parser.js'`; called on line 36 |
| executions.ts | planner.service.ts | calls planObjectiveAsTaskGraph | WIRED | Line 9 import + line 93 call inside POST handler |
| executions.ts | preflight-validator.ts | calls validatePreFlight, returns 400 on failure | WIRED | Line 10 import + line 100 call; 400 return on lines 103-107 |
| ring-leader-spawner.ts | @claw/db | inserts into ring_leader_runs table | WIRED | Line 1 imports `db, ringLeaderRuns, executions`; line 46-56 `db.insert(ringLeaderRuns)` with `status: 'assembling'` |
| ring-leader-spawner.ts | @claw/shared-types | constructs RingLeaderMissionBrief | WIRED | Line 3 imports `RingLeaderMissionBrief`; line 65 construction with all required fields |

---

## Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| ORCH-01: Orchestrator produces structured task graph before any agent spawns | SATISFIED | planObjectiveAsTaskGraph called synchronously before createExecution |
| ORCH-02: Orchestrator validates tool grants and budget against task graph | SATISFIED | validatePreFlight called synchronously; 400 returned on failure |
| ORCH-03: Orchestrator emits structured mission brief | SATISFIED | spawnRingLeader constructs RingLeaderMissionBrief with all 7 required fields |
| ORCH-04: Orchestrator steps back after handoff | SATISFIED | setImmediate block ends at ORCH-04 comment; no downstream orchestration calls remain |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ring-leader-spawner.ts | 89 | `// TODO: Phase 26+ will trigger Ring Leader soul selection and population assembly here.` | INFO | Intentional design boundary marker; this is the planned Phase 26 handoff point, not an unimplemented stub |

No blockers or warnings found. The single TODO is the deliberate Phase 26+ handoff marker specified in the plan.

---

## Human Verification Required

None — all must-haves are structurally verifiable. The phase is intentionally a pre-flight layer only; downstream Ring Leader behavior (soul selection, spawning, coordination) is deferred to phases 26-29 by design.

---

## Gaps Summary

No gaps found. All 10 observable truths are verified against the actual codebase. All artifacts exist at full implementation depth. All key links are imported and called in production code paths.

---

_Verified: 2026-03-02T10:07:08Z_
_Verifier: Claude (gsd-verifier)_
