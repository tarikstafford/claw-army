---
phase: 27-budget-validation-and-population-sizing
verified: 2026-03-02T16:51:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 27: Budget Validation and Population Sizing Verification Report

**Phase Goal:** Ring Leader validates that the assembled population fits the budget cap before any agent spawns, applies tiered reduction when needed, and surfaces a clear constraint message to the user when the minimum viable population cannot be funded.
**Verified:** 2026-03-02T16:51:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ring Leader estimates total run cost from population manifest and compares against budget cap before any VM spawns | VERIFIED | `assemble-population.ts` line 232 calls `validateBudget(manifests, missionBrief.budgetCapCents)` after the full manifest assembly loop and before the `status: 'spawning'` DB transition at line 286 |
| 2 | When cost exceeds budget cap, Ring Leader applies tiered reduction (Artisans -> Understudies, then trim to 3) with a warning at each tier | VERIFIED | `applyTieredReduction` in `budget-validator.ts` implements Tier 1 (Artisan -> Understudy swap) with early-return if budget fits, then Tier 2 (truncate to `MIN_AGENTS_PER_TASK`). Warnings logged via `console.warn` and persisted to `ring_leader_runs.runState` as `budgetWarnings`. 17 vitest tests pass. |
| 3 | Ring Leader never reduces a task below 3 worker agents regardless of cost pressure | VERIFIED | `applyTieredReduction` guards Tier 2 reduction with `if (before > MIN_AGENTS_PER_TASK)` — tasks already at or below 3 are untouched. `MIN_AGENTS_PER_TASK = 3` imported from `@claw/shared-types`. Tests confirm extreme budget pressure (1c cap) still leaves 3+ souls per task. |
| 4 | When budget cannot fund minimum populations, user sees a specific constraint message with exact shortfall and options to scope down or increase budget | VERIFIED | `BudgetShortfallError` message: "Budget cap of Xc cannot fund minimum populations (Yc needed, shortfall: Zc). Scope down tasks or increase budget." Shortfall details (`shortfallCents`, `minimumRequiredCents`, `budgetCapCents`, `warnings`) persisted to `ring_leader_runs.runState` JSONB for API/UI consumption. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/execution-service/src/services/budget-validator.ts` | `estimatePopulationCost`, `validateBudget`, `BudgetValidationResult`, `AGENT_COST_CENTS` | VERIFIED | 164 lines. All four exports present and substantive. Imports `PopulationManifest`, `MIN_AGENTS_PER_TASK` from `@claw/shared-types`. |
| `services/execution-service/src/services/__tests__/budget-validator.test.ts` | Test suite covering all 4 BUDG requirements | VERIFIED | 341 lines, 17 test cases across 5 describe blocks: cost estimation (BUDG-01), tiered reduction (BUDG-02), minimum population guard (BUDG-03), budget shortfall (BUDG-04), orchestrator behavior. All 17 pass. |
| `services/execution-service/src/services/assemble-population.ts` | Budget validation gate between population assembly and status transition to spawning | VERIFIED | `validateBudget` called at Step 7 (line 232), after manifest loop (ends ~line 224), before `status: 'spawning'` DB write (line 286). `BudgetShortfallError` defined and exported. |
| `services/execution-service/src/services/ring-leader-spawner.ts` | Budget failure error propagation to caller | VERIFIED | Imports `BudgetShortfallError` from `./assemble-population`. `.catch` handler at line 93 checks `instanceof BudgetShortfallError` — logs at `warn` level vs `error` for unexpected errors. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `assemble-population.ts` | `budget-validator.ts` | `import { validateBudget }` | WIRED | Line 9: `import { validateBudget } from './budget-validator'`. Called at line 232 with actual manifests and budget cap. |
| `assemble-population.ts` | `@claw/shared-types` | `import PopulationManifest` | WIRED | Line 10: `import type { RingLeaderMissionBrief, PopulationManifest, TaskGraphNode } from '@claw/shared-types'` |
| `budget-validator.ts` | `@claw/shared-types` | `imports PopulationManifest, MIN_AGENTS_PER_TASK` | WIRED | Line 1: `import { type PopulationManifest, MIN_AGENTS_PER_TASK } from '@claw/shared-types'`. `MIN_AGENTS_PER_TASK = 3` confirmed in `packages/shared-types/src/ring-leader.ts` line 173. |
| `assemble-population.ts` | `ring_leader_runs` DB | `persists budget warnings and reduced manifests` | WIRED | Lines 244-257: DB update sets `status='failed'` + `runState` with full shortfall details on budget failure. Lines 279-292: conditional `runState: { budgetWarnings }` on warnings-only path. |
| `ring-leader-spawner.ts` | `assemble-population.ts` | `import BudgetShortfallError` | WIRED | Line 4: `import { assemblePopulation, BudgetShortfallError } from './assemble-population'`. Used in `instanceof` check at line 94. |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| BUDG-01: Cost estimation from population manifest | SATISFIED | `estimatePopulationCost` sums `AGENT_COST_CENTS[soul.agentClass]` across all souls in all manifests |
| BUDG-02: Tiered reduction (Artisan->Understudy, then population trim) | SATISFIED | `applyTieredReduction` implements both tiers with early-return after Tier 1 if budget fits |
| BUDG-03: Minimum 3 agents per task | SATISFIED | `if (before > MIN_AGENTS_PER_TASK)` guard in Tier 2 — hard floor enforced |
| BUDG-04: Shortfall result with exact cents | SATISFIED | `funded=false` path returns `shortfallCents = costAfterReduction - budgetCapCents` and `minimumRequiredCents = costAfterReduction` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No TODOs, FIXMEs, placeholder returns, or stub implementations detected across any of the four key files.

### Human Verification Required

None — all success criteria are verifiable programmatically through code inspection and test execution.

### Gaps Summary

No gaps. All four observable truths are verified:

- The budget validation module (`budget-validator.ts`) is fully implemented with all four BUDG requirements covered by 17 passing tests.
- The wiring into the pipeline (`assemble-population.ts`) places the budget gate at the correct position: after all manifests are assembled, before the `status='spawning'` DB transition.
- `BudgetShortfallError` propagates the constraint message with exact shortfall figures and is handled distinctly in `ring-leader-spawner.ts`.
- Budget warnings and shortfall details are persisted to `ring_leader_runs.runState` for downstream API/UI consumers.
- TypeScript compiles cleanly (`tsc --noEmit` exits 0).
- All 17 tests pass (`vitest run` 3ms, 0 failures).
- All three phase commits exist in git history (`77ed14a`, `d16c6c6`, `2de11ce`).

---

_Verified: 2026-03-02T16:51:00Z_
_Verifier: Claude (gsd-verifier)_
