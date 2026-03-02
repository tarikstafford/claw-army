---
phase: 31-ring-leader-fitness-scoring
plan: "01"
subsystem: execution-service
tags: [ring-leader, fitness-scoring, llm, coordination, ai-sdk, zod]

requires:
  - phase: 30-run-synthesis
    provides: RingLeaderSynthesis type, generateRunSynthesis function used as input
  - phase: 24-ring-leader-schema-and-shared-types
    provides: CoordinationScore, COORDINATION_WEIGHTS from @claw/shared-types

provides:
  - scoreCoordinationQuality(CoordinationScoringParams): Promise<CoordinationScore>
  - CoordinationScoringParams interface for callers
  - Deterministic fallback scoring when LLM unavailable

affects:
  - 31-ring-leader-fitness-scoring (plans 02+)
  - Any phase that aggregates or persists fitness scores

tech-stack:
  added: []
  patterns:
    - "Single LLM call via generateText + Output.object + Zod schema (same pattern as run-synthesis.ts)"
    - "Deterministic fallback scoring path for LLM failures — never throws, always returns valid CoordinationScore"
    - "COORDINATION_WEIGHTS imported from @claw/shared-types — not redefined locally"

key-files:
  created:
    - services/execution-service/src/services/coordination-scorer.ts
  modified: []

key-decisions:
  - "COORDINATION_WEIGHTS imported from @claw/shared-types (not redefined locally) — ensures scoring stays consistent with domain contract"
  - "Fallback scoring is deterministic from raw metrics: collectiveOutcome=completedTasks/total, driftPrevention=1-driftScore, reallocationEffectiveness=0.5 neutral, budgetManagement based on variance ratio"
  - "No imports from coordination-loop.ts — only @claw/shared-types and coordination-events.ts to prevent circular deps"

patterns-established:
  - "Coordination scorer follows run-synthesis.ts LLM pattern: generateText + Output.object + Zod schema + temperature 0.2"
  - "Fallback path logs a WARN but does not throw — callers always get a valid score"

duration: 1min
completed: 2026-03-02
---

# Phase 31 Plan 01: Ring Leader Fitness Scoring — Coordination Scorer Summary

**LLM-based coordination quality scorer with four weighted FIT-01 dimensions (collectiveOutcome 40%, driftPrevention 25%, reallocationEffectiveness 20%, budgetManagement 15%) and deterministic fallback**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-02T00:14:25Z
- **Completed:** 2026-03-02T00:15:46Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `coordination-scorer.ts` exporting `scoreCoordinationQuality` accepting the full run context (synthesis, coordination log, mission brief, run state) and returning a `CoordinationScore` with four 0-1 dimension scores
- LLM call uses `generateText` + `Output.object` with a Zod schema (temperature 0.2) — same pattern as `run-synthesis.ts`
- `COORDINATION_WEIGHTS` imported from `@claw/shared-types` to avoid redefining domain constants locally
- Deterministic fallback scoring path computes all four dimensions from raw metrics when the LLM is unavailable — never throws
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create coordination quality scoring module with LLM-based dimension scoring** - `650c0be` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `services/execution-service/src/services/coordination-scorer.ts` — LLM-based coordination quality scorer with four weighted dimensions and deterministic fallback

## Decisions Made
- `COORDINATION_WEIGHTS` imported from `@claw/shared-types` (not redefined locally) to ensure scoring stays consistent with the domain contract
- Fallback scoring uses deterministic formulas: collectiveOutcome = completed/total, driftPrevention = 1 - driftScore (clamped), reallocationEffectiveness = 0.5 (neutral), budgetManagement = variance-based ratio
- No imports from `coordination-loop.ts` or any module that would create circular dependencies

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The `COORDINATION_SCORER_MODEL` env var defaults to `claude-sonnet-4-6`.

## Next Phase Readiness
- Coordination scorer is ready for use by Phase 31 plan 02 (soul selection scorer) and the final composite fitness aggregator
- No blockers

---
*Phase: 31-ring-leader-fitness-scoring*
*Completed: 2026-03-02*
