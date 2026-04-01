---
phase: 26-soul-library-search-and-population-assembly
plan: 02
subsystem: api
tags: [soul-selection, cosine-similarity, mutation, ring-leader, openai-embeddings, population-assembly]

# Dependency graph
requires:
  - phase: 26-soul-library-search-and-population-assembly
    provides: searchSoulLibrary, SoulSearchResult type from soul-library-search.ts
  - phase: 24-ring-leader-schema-and-shared-types
    provides: SOUL_DIFFERENTIATION_THRESHOLD, SoulSelectionEntry from @claw/shared-types

provides:
  - selectFromPool: class-priority greedy selection with cosine similarity < 0.85 differentiation enforcement
  - applyPreDeploymentMutation: substitution and amplification operations via gpt-4o-mini + re-embedding
  - PoolSelectionParams, SelectedSoul, MutationResult interfaces

affects:
  - 26-03+ (pioneer path and any phase consuming the population manifest)
  - Ring Leader soul assembly flow — selectFromPool feeds directly into population manifest construction

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Greedy selection with pairwise cosine similarity enforcement (skip if >= threshold)
    - Class priority sort (Artisan=0, Understudy=1, Novice=2) preserving finalRank within tier
    - Constitution directive extraction via regex over Ethical Hard Stops section
    - Pre-deployment mutation: LLM text generation at temperature=0.4 + single embed() call

key-files:
  created:
    - services/execution-service/src/services/population-assembler.ts
  modified: []

key-decisions:
  - "Class priority sort uses numeric map (Artisan=0, Understudy=1, Novice=2) stable-sorted with finalRank as tiebreaker within tier"
  - "differentiationScore = 1 - maxSimilarity across all selected souls; first selected soul defaults to 1.0"
  - "applyPreDeploymentMutation validates operation strictly (throws on non-substitution/amplification) to match SOUL-05 constraint"
  - "Constitution directives parsed from Ethical Hard Stops section + any INVIOLABLE: lines outside section"
  - "Pool shortfall (fewer than requiredPopulation selected) returns partial result; caller handles via pioneer path"

patterns-established:
  - "selectFromPool is pure synchronous (no DB I/O) — all data comes from pre-fetched SoulSearchResult pool"
  - "applyPreDeploymentMutation is async (LLM + embed); caller updates SelectedSoul.mutationApplied and soulContent after call"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 26 Plan 02: Population Assembly Summary

**Greedy class-priority soul selection with cosine differentiation enforcement (< 0.85) and pre-deployment LLM mutation (substitution/amplification) with re-embedding**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T10:44:31Z
- **Completed:** 2026-03-02T10:45:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `population-assembler.ts` implementing SOUL-04, SOUL-05, and SOUL-07 requirements
- `selectFromPool`: Artisan-first class priority sorting, greedy selection skipping any candidate with cosine similarity >= 0.85 to any already-selected soul
- `applyPreDeploymentMutation`: substitution and amplification operations via gpt-4o-mini at temperature=0.4, re-embedded via text-embedding-3-small
- TypeScript compiles cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create population-assembler.ts with class-priority selection and differentiation enforcement** - `e508d56` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `services/execution-service/src/services/population-assembler.ts` — selectFromPool and applyPreDeploymentMutation with full SoulSelectionEntry construction

## Decisions Made
- Class priority sort implemented as a numeric lookup map (`CLASS_PRIORITY = { Artisan: 0, Understudy: 1, Novice: 2 }`) with stable tiebreaker on `finalRank` descending within each tier
- `differentiationScore` set to `1 - maxSimilarity` across all previously selected souls; first soul in set defaults to 1.0 (no comparison possible)
- `applyPreDeploymentMutation` throws synchronously if operation is not `substitution` or `amplification` to enforce SOUL-05 constraint at the type level (TypeScript union) and at runtime
- Constitution directive extraction uses regex over `## Ethical Hard Stops` section plus a full-document scan for any `INVIOLABLE:` prefixed lines outside the section
- Pool shortfall (< requiredPopulation selected) is surfaced via console.log and a partial result — caller is responsible for invoking pioneer path for the remainder

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `selectFromPool` and `applyPreDeploymentMutation` are ready for consumption by the Ring Leader population manifest construction phase
- Pioneer path (pool shortfall or zero library results) must be handled by caller combining with `generateSoulPopulation` from soul-generator.ts
- `SelectedSoul.mutationApplied` must be set by caller after `applyPreDeploymentMutation` returns

## Self-Check: PASSED

- services/execution-service/src/services/population-assembler.ts: FOUND
- 26-02-SUMMARY.md: FOUND
- commit e508d56: FOUND

---
*Phase: 26-soul-library-search-and-population-assembly*
*Completed: 2026-03-02*
