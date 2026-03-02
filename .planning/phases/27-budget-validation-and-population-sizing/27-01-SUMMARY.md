---
phase: 27-budget-validation-and-population-sizing
plan: 01
subsystem: execution-service
tags: [budget-validation, population-sizing, tiered-reduction, ring-leader, tdd, vitest]

requires:
  - phase: 26-soul-library-search-and-population-assembly
    provides: PopulationManifest, SoulSelectionEntry types used in cost estimation
  - phase: 24-ring-leader-schema-and-shared-types
    provides: MIN_AGENTS_PER_TASK constant (=3), PopulationManifest type, SoulSelectionEntry type

provides:
  - budget-validator.ts with estimatePopulationCost, validateBudget, applyTieredReduction, AGENT_COST_CENTS, BudgetValidationResult
  - BUDG-01: Per-class cost rates (Artisan=100c, Understudy=50c, Novice=30c)
  - BUDG-02: Tiered reduction (Tier 1 Artisan->Understudy swap, Tier 2 population trim to 3)
  - BUDG-03: Minimum population guard — no task ever below 3 agents
  - BUDG-04: Shortfall result with exact cents deficit when minimum populations still exceed budget

affects:
  - ring-leader-spawner (will call validateBudget before spawning VMs)
  - assemble-population (post-assembly validation before status->spawning transition)

tech-stack:
  added: []
  patterns:
    - "structuredClone for deep-cloning manifests before mutation to preserve immutability of inputs"
    - "Tiered reduction with early-return after Tier 1 — avoids Tier 2 when not needed"
    - "budgetCapCents=0 no-cap mode consistent with preflight-validator.ts pattern"

key-files:
  created:
    - services/execution-service/src/services/budget-validator.ts
    - services/execution-service/src/services/__tests__/budget-validator.test.ts
  modified: []

key-decisions:
  - "AGENT_COST_CENTS constants defined in budget-validator.ts (not shared-types) — implementation detail, not domain contract"
  - "applyTieredReduction exported separately so callers can apply reduction standalone without full orchestration"
  - "Tier 2 reduction preserves first N souls (not best N) — order from population-assembler already encodes selection quality"
  - "BudgetValidationResult.manifests always populated even when funded=false — caller can inspect reduced state"

patterns-established:
  - "TDD RED/GREEN with vitest in __tests__ subdirectory — consistent with existing test infrastructure setup"

duration: 2min
completed: 2026-03-02
---

# Phase 27 Plan 01: Budget Validator Summary

**Pure budget validation module with tiered Artisan->Understudy cost reduction and 3-agent minimum population guard, covering BUDG-01 through BUDG-04**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T11:13:12Z
- **Completed:** 2026-03-02T11:15:01Z
- **Tasks:** 2 (RED + GREEN TDD cycle)
- **Files modified:** 2

## Accomplishments

- Created `budget-validator.ts` with `estimatePopulationCost`, `applyTieredReduction`, `validateBudget`, `AGENT_COST_CENTS`, and `BudgetValidationResult` — all four BUDG requirements covered
- 17 tests all passing: cost estimation, Tier 1 Artisan replacement, Tier 2 population trim, minimum population guard (3-agent floor), budget shortfall with exact cents, no-cap mode
- Zero TypeScript type errors (`tsc --noEmit` clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for budget-validator** - `77ed14a` (test)
2. **Task 2: GREEN — Implement budget-validator.ts to pass all tests** - `d16c6c6` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks follow RED → GREEN commit cycle_

## Files Created/Modified

- `services/execution-service/src/services/budget-validator.ts` — Core budget validation module with cost constants, estimation function, tiered reduction, and orchestrator
- `services/execution-service/src/services/__tests__/budget-validator.test.ts` — 17 test cases covering BUDG-01 through BUDG-04

## Decisions Made

- `AGENT_COST_CENTS` constants defined in `budget-validator.ts` (not `@claw/shared-types`) — implementation detail, not a domain contract that other packages need
- `applyTieredReduction` exported separately so callers can apply reduction standalone without full `validateBudget` orchestration
- Tier 2 reduction preserves the first 3 souls in each task's `assignedSouls` array — the array ordering from `population-assembler.ts` already encodes selection quality (Artisan > Understudy > Novice with final rank tiebreaker)
- `BudgetValidationResult.manifests` is always populated even when `funded=false` — callers can inspect the maximally-reduced state

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `validateBudget` is ready to be wired into `ring-leader-spawner.ts` and `assemble-population.ts` (Plan 27-02 or later)
- All BUDG-01 through BUDG-04 requirements fulfilled at module level
- `BudgetValidationResult` type available for callers to handle funded/unfunded scenarios

---
*Phase: 27-budget-validation-and-population-sizing*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: `services/execution-service/src/services/budget-validator.ts`
- FOUND: `services/execution-service/src/services/__tests__/budget-validator.test.ts`
- FOUND: `.planning/phases/27-budget-validation-and-population-sizing/27-01-SUMMARY.md`
- FOUND: commit `77ed14a` (test — RED phase)
- FOUND: commit `d16c6c6` (feat — GREEN phase)
