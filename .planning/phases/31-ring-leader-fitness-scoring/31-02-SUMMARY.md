---
phase: 31-ring-leader-fitness-scoring
plan: "02"
subsystem: api
tags: [ring-leader, fitness-scoring, soul-selection, llm, zod, ai-sdk]

# Dependency graph
requires:
  - phase: 30-run-synthesis
    provides: RingLeaderSynthesis with soulSelectionRetrospective and pioneerEvents
  - phase: 24-ring-leader-schema-and-shared-types
    provides: SoulSelectionScore interface, PopulationManifest types from @claw/shared-types
  - phase: 26-soul-library-search-and-population-assembly
    provides: PopulationManifest with differentiationScore, source, mutationApplied fields
provides:
  - scoreSoulSelectionQuality() function scoring five FIT-02 dimensions (0-1 each)
  - SoulSelectionScoringParams interface for caller integration
  - Deterministic fallback scoring without LLM dependency
affects:
  - 31-03-ring-leader-composite-scorer (consumes SoulSelectionScore)
  - 31-04-fitness-api (exposes SoulSelectionScore via API)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Single LLM call with Zod output schema for structured dimension scoring
    - Deterministic fallback returns library-ratio and avg-differentiation-score estimates
    - resolveModel() with per-scorer env var override (SOUL_SELECTION_SCORER_MODEL)

key-files:
  created:
    - services/execution-service/src/services/soul-selection-scorer.ts
  modified: []

key-decisions:
  - "SOUL_SELECTION_SCORER_MODEL env var with claude-sonnet-4-6 default — same pattern as SYNTHESIS_MODEL in run-synthesis.ts"
  - "librarySearchQuality fallback = library souls / total souls (ratio); not 0.5 neutral because count is deterministically available"
  - "differentiationEffectiveness fallback = average differentiationScore across manifests — already deterministic from PopulationManifest data"
  - "mutationDecisionQuality, pioneerHandling, selectionRetrospectiveQuality fallback = 0.5 — qualitative dimensions require LLM for fair assessment"
  - "Prompt includes per-task manifest detail, population sizing delta, soul class/source distribution, mutation ratio, and full retrospective text"

patterns-established:
  - "Soul scorer follows same generateText + Output.object + try/catch pattern as run-synthesis.ts"
  - "Aggregation helpers (aggregateSoulStats) separate data collection from prompt building for testability"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 31 Plan 02: Soul Selection Quality Scoring Module Summary

**LLM-based five-dimension soul selection scorer (FIT-02) with library-ratio and differentiation-average deterministic fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T15:34:46Z
- **Completed:** 2026-03-02T15:36:21Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `soul-selection-scorer.ts` with `scoreSoulSelectionQuality()` scoring five FIT-02 dimensions
- Single LLM call at temperature 0.2 via `resolveModel()` with `SOUL_SELECTION_SCORER_MODEL` env var override
- Deterministic fallback: library ratio, avg differentiation score, 0.5 neutrals for qualitative dimensions
- Comprehensive prompt includes task graph summary, per-task manifest detail, soul source/class distribution, mutation ratio, pioneer events, and Ring Leader's soulSelectionRetrospective

## Task Commits

Each task was committed atomically:

1. **Task 1: Create soul selection quality scoring module** - `80d57c3` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `services/execution-service/src/services/soul-selection-scorer.ts` - Five-dimension FIT-02 scorer using Zod output schema and LLM call

## Decisions Made
- `SOUL_SELECTION_SCORER_MODEL` env var defaults to `claude-sonnet-4-6` — consistent with synthesis model pattern
- `librarySearchQuality` fallback uses library/total ratio (deterministic from manifest data), not neutral 0.5
- `differentiationEffectiveness` fallback uses average `differentiationScore` across all manifests (already available without LLM)
- Three qualitative dimensions (mutationDecisionQuality, pioneerHandling, selectionRetrospectiveQuality) default to 0.5 neutral — these require LLM reasoning to score meaningfully
- Prompt includes rubric inline to guide LLM scoring consistent with PRD 9.2 requirements

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The scorer uses the same AI SDK (`generateText`, `Output.object`) already configured in the execution service.

## Next Phase Readiness
- `soul-selection-scorer.ts` ready for consumption by Plan 31-03 (composite fitness scorer)
- Export `scoreSoulSelectionQuality` and `SoulSelectionScoringParams` available for import
- TypeScript compiles clean (zero errors verified)

---
*Phase: 31-ring-leader-fitness-scoring*
*Completed: 2026-03-02*
