---
phase: 13-god-layer-and-agent-class-system
plan: "02"
subsystem: god-layer
tags: [tdd, class-machine, pure-function, state-machine, clas-02, clas-03, clas-04, clas-05, vitest]
dependency_graph:
  requires: []
  provides:
    - computeClassTransition pure function
    - ClassState / VerdictInput / ClassTransition / ClassTransitionResult types
  affects:
    - God Layer worker (will call computeClassTransition inside DB transaction)
    - agent_classes table upsert logic (Plan 03+)
tech_stack:
  added: []
  patterns:
    - Pure function state machine with no side effects
    - TDD (RED -> GREEN) with Vitest
    - Threshold constants as typed const objects for readability
key_files:
  created:
    - services/execution-service/src/god-layer/class-machine.ts
    - services/execution-service/src/__tests__/class-machine.test.ts
  modified: []
decisions:
  - VerdictInput exported as interface (not inline type) to enable God Layer worker to build verdict inputs from DB rows
  - ClassTransitionResult interface exported separately for artisanGraduated optional flag — keeps ClassTransition type union clean
  - Threshold constants grouped into named const objects (NOVICE_PROMOTION, UNDERSTUDY_PROMOTION, DEMOTION) with "as const" — self-documenting and avoids magic numbers
  - Counter update always runs before transition evaluation, using updated counters for threshold checks — matches plan spec exactly
  - Novice Demote verdict returns type:none (no-op) — Novice cannot be demoted further; only Understudy/Artisan are demotable
  - Non-soul-driven Retire returns type:none — consistency with CLAS-04 pattern (context-driven events never trigger irreversible transitions)
metrics:
  duration_seconds: 127
  completed_date: "2026-02-22"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
  tests_added: 18
---

# Phase 13 Plan 02: Agent Class State Machine Summary

Pure function `computeClassTransition` implementing CLAS-01 through CLAS-05 threshold logic with 18 Vitest test cases covering every transition path.

## What Was Built

### `services/execution-service/src/god-layer/class-machine.ts`

A zero-dependency pure function that takes `ClassState` (accumulated run counters) and `VerdictInput` (council verdict fields) and returns `{ newState, transition, artisanGraduated? }`.

**Exported types:**
- `ClassState` — per-bot, per-category counter accumulator
- `VerdictInput` — council verdict fields needed for transition evaluation
- `ClassTransition` — discriminated union of all possible transition outcomes
- `ClassTransitionResult` — return type including optional `artisanGraduated` flag
- `computeClassTransition` — the pure function itself

**Transition logic implemented:**

| Rule | Trigger | Guard |
|------|---------|-------|
| CLAS-02 Novice→Understudy | `verdictType='Promote'` + `currentClass='Novice'` | `aboveBenchmark>=2, humanConfirm>=1, confidence>0.65, !hasUnresolvedDA, benchmarkMature` |
| CLAS-03 Understudy→Artisan | `verdictType='Promote'` + `currentClass='Understudy'` | `aboveBenchmark>=5, belowBenchmark<=1, humanConfirm>=2, confidence>0.80, benchmarkMature` |
| CLAS-04 Demotion | `verdictType='Demote'` + `isSoulDriven=true` | `consecutiveBelow>=2, confidence>0.70`; blocked entirely if `isSoulDriven=false` |
| CLAS-05 Retirement | `verdictType='Retire'` + `isSoulDriven=true` | Already-Retired guard returns `type:'none'` |

### `services/execution-service/src/__tests__/class-machine.test.ts`

429-line test file with 18 test cases:

1. Novice→Understudy promotion — all conditions met
2. Novice promotion blocked — benchmarkMature=false
3. Novice promotion blocked — hasHumanConfirmation=false with count=0
4. Novice promotion blocked — confidence=0.60 (below 0.65)
5. Understudy→Artisan promotion — all conditions met + artisanGraduated=true
6. Understudy→Artisan blocked — confidence=0.75 (below 0.80)
7. Understudy→Artisan blocked — belowBenchmarkCount=2 (exceeds max of 1)
8. Demotion: Understudy→Novice — consecutiveBelow=2, soul-driven, confidence=0.75
9. Demotion blocked — isSoulDriven=false (Monitor treatment)
10. Demotion blocked — confidence=0.65 (below 0.70)
11. Retirement — Retire verdict + isSoulDriven=true → currentClass='Retired'
12. Already Retired — any verdict returns type:none
13. Above-benchmark counter update — aboveBenchmark incremented, consecutiveBelow reset
14. Below-benchmark counter update — consecutiveBelow incremented, belowBenchmark incremented
15. Unresolved DA blocks Novice→Understudy — hasUnresolvedDA=true
16. Retirement blocked — isSoulDriven=false
17. Novice promotion blocked — aboveBenchmarkCount=0 (becomes 1 after update, needs 2)
18. Artisan demotion — Artisan→Novice on Demote verdict

## Deviations from Plan

None — plan executed exactly as written. The 18 tests map directly to the 15 specified test cases plus 3 additional edge cases (non-soul-driven retirement block, aboveBenchmark=0 state, Artisan demotion path).

## Self-Check: PASSED

### Files Created
- FOUND: `services/execution-service/src/god-layer/class-machine.ts`
- FOUND: `services/execution-service/src/__tests__/class-machine.test.ts`

### Commits
- FOUND: `26d9c6b` — test(13-02): add failing tests for class-machine computeClassTransition
- FOUND: `c26fecc` — feat(13-02): implement computeClassTransition pure function (class-machine)
