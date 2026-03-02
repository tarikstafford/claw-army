---
phase: 25-orchestrator-demotion-and-ring-leader-core
plan: 02
subsystem: api
tags: [preflight, validation, tool-grants, budget, ring-leader, task-graph]

# Dependency graph
requires:
  - phase: 25-orchestrator-demotion-and-ring-leader-core
    plan: 01
    provides: validateTaskGraphDAG standalone export from task-graph-parser.ts
  - phase: 24-ring-leader-schema-and-shared-types
    provides: TaskGraph, TaskGraphNode, MIN_AGENTS_PER_TASK types from @claw/shared-types
provides:
  - Pre-flight validation gate rejecting tool-grant gaps and budget shortfalls before Ring Leader spawn
  - Aggregated TOOL_GRANT_INSUFFICIENT error naming all missing tools and affected task IDs
  - BUDGET_INSUFFICIENT error with exact shortfall in cents and increase-to amount
  - INVALID_TASK_GRAPH error surfacing DAG structural failures (cycles, dangling refs)
  - totalMinPopulation, totalRecommendedPopulation, estimatedMinCostCents on all result paths
affects: [25-03-mission-brief-construction, orchestrator-route-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Accumulate-all-errors pattern (run all checks, collect errors, return single result)
    - budgetCapCents=0 means no-cap — skip budget validation (preserved from v1.0 behavior)
    - ESTIMATED_AGENT_COST_CENTS env override with 50c default (placeholder until Phase 27 cost estimation)

key-files:
  created:
    - services/execution-service/src/services/preflight-validator.ts
  modified: []

key-decisions:
  - "All three validation checks run regardless of earlier failures — errors accumulate so callers see the full constraint picture in one response"
  - "budgetCapCents=0 skips budget check entirely to preserve v1.0 no-cap behavior"
  - "ESTIMATED_AGENT_COST_CENTS env var allows override of 50c default — real cost estimation deferred to Phase 27"
  - "Tool grant errors aggregated into one error (not one per task) to keep response compact and actionable"

patterns-established:
  - "Pre-flight accumulate-all-errors: run all checks, collect PreFlightError[], return valid=errors.length===0"
  - "Tool grant aggregation: collect missing tools per task, deduplicate across tasks, emit single error with both affectedTasks and missingTools arrays"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 25 Plan 02: Pre-Flight Validator Summary

**Pre-flight validation of tool grants and budget cap against task graph requirements, rejecting with specific constraint messages naming missing tools, affected tasks, and exact budget shortfall in cents**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T09:54:02Z
- **Completed:** 2026-03-02T09:56:00Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Created `preflight-validator.ts` exporting `validatePreFlight`, `PreFlightResult`, and `PreFlightError`
- DAG structural validation delegates to `validateTaskGraphDAG` from task-graph-parser (standalone export from 25-01)
- Tool grant check collects missing tools per task then aggregates into one descriptive error with affected task IDs and missing tool names
- Budget check computes `totalMinPopulation * costPerAgent` and names exact shortfall in cents; budgetCapCents=0 skips check
- All three checks run regardless of prior failures — callers get the full constraint picture in one call
- `tsc --noEmit` passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create preflight-validator.ts with tool grant and budget validation** - `282af83` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/execution-service/src/services/preflight-validator.ts` - Pre-flight gate: structural DAG check + tool grant aggregation + budget shortfall calculation

## Decisions Made
- All three validation checks run and errors accumulate rather than fail-fast — callers need the full picture in one response to show users a complete rejection reason
- budgetCapCents=0 skips budget validation to maintain v1.0 no-cap behavior
- ESTIMATED_AGENT_COST_CENTS env var defaults to 50c as conservative placeholder; Phase 27 will replace with real cost estimation
- Tool grant errors aggregated into one error (not one per task) to keep the error surface compact and actionable for callers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. `ESTIMATED_AGENT_COST_CENTS` env var is optional (defaults to 50).

## Next Phase Readiness
- `validatePreFlight` ready for integration into the execution route (plan 25-03)
- `PreFlightResult` and `PreFlightError` types exported for route handler to inspect and map to HTTP 400 responses
- Budget estimate is conservative at 50c/agent — sufficient for gating; real cost model comes in Phase 27

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/preflight-validator.ts
- FOUND commit: 282af83 (feat(25-02): add preflight-validator with tool grant and budget validation)
- EXPORTS VERIFIED: validatePreFlight, PreFlightResult, PreFlightError
- TYPE CHECK: tsc --noEmit passed with zero errors

---
*Phase: 25-orchestrator-demotion-and-ring-leader-core*
*Completed: 2026-03-02*
