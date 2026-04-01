---
phase: 25-orchestrator-demotion-and-ring-leader-core
plan: 01
subsystem: api
tags: [task-graph, dag, planner, llm, shared-types, ring-leader]

# Dependency graph
requires:
  - phase: 24-ring-leader-schema-and-shared-types
    provides: TaskGraph, TaskGraphNode, TaskComplexity, MIN_AGENTS_PER_TASK types from @claw/shared-types
provides:
  - LLM-based DAG decomposition of objectives into validated TaskGraph
  - Kahn's algorithm cycle detection and dangling reference validation
  - Population sizing per task (min=3, recommended by complexity: low=3/medium=4/high=5)
  - Flat fallback graph on LLM failure or DAG validation failure
  - planObjectiveAsTaskGraph export for downstream orchestrator/mission-brief consumers
affects: [25-02-preflight-validation, 25-03-mission-brief-construction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - resolveModel extracted to shared lib/resolve-model.ts for multi-file AI SDK use
    - Kahn's topological sort for DAG cycle detection
    - Fallback flat graph resilience pattern (same approach as existing planner)

key-files:
  created:
    - services/execution-service/src/lib/resolve-model.ts
    - services/execution-service/src/services/task-graph-parser.ts
  modified:
    - services/execution-service/src/services/planner.service.ts

key-decisions:
  - "resolveModel extracted to lib/resolve-model.ts so both planner.service.ts and task-graph-parser.ts can import it without duplication"
  - "planObjective kept with original flat PlannedTask[] signature for backward compatibility; planObjectiveAsTaskGraph is the new structured export"
  - "validateTaskGraphDAG exported standalone so plan 25-02 pre-flight validation can use it directly without re-importing task-graph-parser"

patterns-established:
  - "Task graph parser: LLM returns JSON, parse + validate, fallback to flat graph on any failure"
  - "Population sizing: min=MIN_AGENTS_PER_TASK(3), recommended by complexity (low=3, medium=4, high=5)"
  - "DAG adjacency map: dep->task direction (dep must complete before task starts)"

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 25 Plan 01: Task Graph Parser Summary

**LLM-based DAG decomposition into validated TaskGraph with complexity labels, tool requirements, population sizing, and Kahn's cycle detection**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T09:49:34Z
- **Completed:** 2026-03-02T09:52:53Z
- **Tasks:** 2
- **Files modified:** 3 (1 created as deviation, 2 from plan)

## Accomplishments
- Created `task-graph-parser.ts` with `parseObjectiveToTaskGraph` and `validateTaskGraphDAG` exports
- Kahn's algorithm DAG cycle detection with descriptive cycle member error messages
- Dangling dependency reference validation before cycle check
- Population sizing: minPopulation=3 (MIN_AGENTS_PER_TASK), recommendedPopulation per complexity tier
- Extracted `resolveModel` helper to `lib/resolve-model.ts` for DRY imports across planner and parser
- Updated `planner.service.ts` with `planObjectiveAsTaskGraph` export while maintaining `planObjective` backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create task-graph-parser.ts with LLM-based DAG decomposition** - `d50a763` (feat)
2. **Task 2: Update planner.service.ts to return TaskGraph via task-graph-parser** - `2f393c7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/execution-service/src/lib/resolve-model.ts` - Shared AI SDK model resolver (gpt/claude/gemini routing)
- `services/execution-service/src/services/task-graph-parser.ts` - LLM DAG decomposition, DAG validation, TaskGraph construction
- `services/execution-service/src/services/planner.service.ts` - Updated with planObjectiveAsTaskGraph, resolveModel now imported from lib

## Decisions Made
- Extracted `resolveModel` to `lib/resolve-model.ts` rather than keeping in `planner.service.ts` to avoid circular imports and enable clean sharing with `task-graph-parser.ts`
- `planObjective` (flat) kept unchanged for backward compat; route handlers will migrate in plan 25-03
- `validateTaskGraphDAG` exported standalone so 25-02 pre-flight can call it directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added LanguageModel return type annotation to resolveModel**
- **Found during:** Task 1 (extracting resolve-model.ts)
- **Issue:** TypeScript error TS2742: inferred return type cannot be named without reference to internal pnpm path
- **Fix:** Added `import type { LanguageModel } from 'ai'` and explicit `: LanguageModel` return type annotation
- **Files modified:** services/execution-service/src/lib/resolve-model.ts
- **Verification:** `tsc --noEmit` passes with zero errors
- **Committed in:** d50a763 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing type annotation for correctness)
**Impact on plan:** Required for TypeScript strict compilation. No scope creep.

## Issues Encountered
None — TypeScript error on resolveModel return type was caught immediately and fixed inline.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `parseObjectiveToTaskGraph` ready for use by pre-flight validation (25-02)
- `validateTaskGraphDAG` exported standalone for 25-02 to call without importing parser
- `planObjectiveAsTaskGraph` ready for orchestrator route integration (25-03)
- `planObjective` backward compat maintained — existing route callers unaffected

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/task-graph-parser.ts
- FOUND: services/execution-service/src/lib/resolve-model.ts
- FOUND: services/execution-service/src/services/planner.service.ts
- FOUND: .planning/phases/25-orchestrator-demotion-and-ring-leader-core/25-01-SUMMARY.md
- FOUND commit: d50a763 (task-graph-parser + resolve-model)
- FOUND commit: 2f393c7 (planner.service update)
- TYPE CHECK: tsc --noEmit passed with zero errors

---
*Phase: 25-orchestrator-demotion-and-ring-leader-core*
*Completed: 2026-03-02*
