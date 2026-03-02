---
phase: 27-budget-validation-and-population-sizing
plan: 02
subsystem: execution-service
tags: [budget-validation, population-sizing, ring-leader, pipeline-integration, budget-shortfall]

requires:
  - phase: 27-01
    provides: validateBudget, BudgetValidationResult, applyTieredReduction, AGENT_COST_CENTS

provides:
  - assemble-population.ts with budget gate between manifest assembly and status->spawning transition
  - BudgetShortfallError class exported for typed error handling
  - ring-leader-spawner.ts differentiates BudgetShortfallError (warn) from unexpected errors (error)
  - Budget warnings and shortfall details persisted to ring_leader_runs.runState JSONB

affects:
  - ring-leader-spawner (BudgetShortfallError handled distinctly)
  - assemble-population (budget gate before status transition)

tech-stack:
  added: []
  patterns:
    - "Budget gate placed between assembly loop and DB persist — same transaction point, no extra round-trip"
    - "BudgetShortfallError: custom Error subclass with typed fields (shortfallCents, minimumRequiredCents, budgetCapCents)"
    - "runState JSONB used for budget metadata — consistent with Phase 24 JSONB-for-evolving-state decision"
    - "Conditional spread for runState — only set when warnings exist, avoids overwriting future runState fields"

key-files:
  created: []
  modified:
    - services/execution-service/src/services/assemble-population.ts
    - services/execution-service/src/services/ring-leader-spawner.ts

key-decisions:
  - "BudgetShortfallError defined in assemble-population.ts (not budget-validator.ts) — it's a pipeline error, not a validation concern"
  - "Budget shortfall DB write in assemble-population.ts (not spawner) — assemblePopulation already has the shortfall details at the throw site"
  - "runState for shortfall includes warnings array alongside shortfall metrics for full consumer context"
  - "Conditional runState spread only when warnings.length > 0 — avoids null-overwriting future runState values set by other phases"

duration: 2min
completed: 2026-03-02
---

# Phase 27 Plan 02: Budget Validation Integration Summary

**Budget validation gate wired into the population assembly pipeline, with BudgetShortfallError propagation and runState JSONB persistence for shortfall details and tiered-reduction warnings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T11:17:04Z
- **Completed:** 2026-03-02T11:18:36Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `BudgetShortfallError` custom error class to `assemble-population.ts` with typed fields (`shortfallCents`, `minimumRequiredCents`, `budgetCapCents`) and a descriptive message: "Budget cap of Xc cannot fund minimum populations (Yc needed, shortfall: Zc). Scope down tasks or increase budget."
- Wired `validateBudget` call after the manifest assembly loop, before the DB persist step
- On `funded=false`: logs shortfall at warn level, sets `ring_leader_runs.status='failed'` with full budget details in `runState` JSONB, throws `BudgetShortfallError`
- On `funded=true` with warnings: logs each warning at warn level, uses reduced manifests from `budgetResult.manifests`, persists `{ budgetWarnings }` to `runState`
- Updated `ring-leader-spawner.ts` to import `BudgetShortfallError` and handle it distinctly: logs at `warn` level (expected constraint), skips redundant DB write (already done by `assemblePopulation`)
- All 17 budget-validator tests pass, `tsc --noEmit` clean, no regressions in other test suites

## Task Commits

1. **Task 1: Wire budget validation into population assembly pipeline** — `2de11ce` (feat)

## Files Created/Modified

- `services/execution-service/src/services/assemble-population.ts` — Added `BudgetShortfallError` class, `validateBudget` import, budget gate (Step 7), conditional `runState` persistence, uses `budgetResult.manifests` as final manifests
- `services/execution-service/src/services/ring-leader-spawner.ts` — Added `BudgetShortfallError` import, updated `.catch` handler to distinguish budget shortfalls from unexpected errors

## Decisions Made

- `BudgetShortfallError` defined in `assemble-population.ts` (not `budget-validator.ts`) because it is a pipeline-layer concern — it signals that the assembly pipeline cannot proceed, not that the budget calculation failed
- Budget shortfall DB write happens inside `assemblePopulation` at the throw site (not in the spawner's `.catch`) — assemblePopulation has all the details at that point and writing there ensures the row is updated even if the `.catch` handler itself encounters an error
- `runState` spread is conditional (`warnings.length > 0`) to avoid overwriting `runState` values that future coordination phases may set — writing `undefined` was avoided with the `...(runStatePayload !== undefined ? { runState: runStatePayload } : {})` pattern
- `runState` for shortfall includes the `warnings` array alongside `shortfallCents`, `minimumRequiredCents`, `budgetCapCents` — so API/UI consumers can surface the full picture (e.g., "we already tried Tier 1 and Tier 2 reduction")

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing `tests/e2e.test.ts` failure (`app.ready is not a function`) — unrelated to this plan, verified pre-existing before my changes via `git stash`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Budget validation fully integrated into the live pipeline: VM spawning is now gated on budget fit
- `BudgetShortfallError` available for API layer to catch and return 400 with constraint details (Phase 28 or API route handlers)
- `ring_leader_runs.runState` carries budget constraint metadata for UI consumption

---
*Phase: 27-budget-validation-and-population-sizing*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: `services/execution-service/src/services/assemble-population.ts`
- FOUND: `services/execution-service/src/services/ring-leader-spawner.ts`
- FOUND: `.planning/phases/27-budget-validation-and-population-sizing/27-02-SUMMARY.md`
- FOUND: commit `2de11ce` (feat — budget validation integration)
