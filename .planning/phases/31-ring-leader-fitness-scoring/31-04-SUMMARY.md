---
phase: 31-ring-leader-fitness-scoring
plan: "04"
subsystem: execution-service
tags: [ring-leader, class-progression, fitness-scoring, promotion-thresholds, agent-classes]

# Dependency graph
requires:
  - phase: 31-ring-leader-fitness-scoring
    plan: "03"
    provides: computeAndPersistFitness — fitness scorer and Akashic Library persistence
  - phase: 24-ring-leader-schema-and-shared-types
    provides: RING_LEADER_PROMOTION_THRESHOLDS from @claw/shared-types
  - phase: 24-ring-leader-schema-and-shared-types
    provides: agent_classes table with botId + taskCategory unique composite key

provides:
  - evaluateRingLeaderPromotion(RingLeaderPromotionParams) — threshold evaluation with agent_classes update
  - RingLeaderPromotionResult interface
  - Class progression evaluated after every fitness score computation (FIT-05)
  - Full pipeline: synthesis -> fitness scoring -> class progression evaluation

affects:
  - Any phase querying agent_classes for Ring Leader promotion state (taskCategory='ring_leader')

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ring Leader class progression is independent from bot agent class-machine.ts (different promotion criteria)"
    - "agent_classes reused for Ring Leaders: soulId stored in botId column, taskCategory='ring_leader'"
    - "Qualifying run count computed via raw SQL avg of 5 JSONB dimension fields in soul_selection_score"
    - "Class progression is non-fatal: wrapped in own try/catch inside computeAndPersistFitness"
    - "Early exit on null soulId — pioneer/test runs without assigned souls skip promotion silently"

key-files:
  created:
    - services/execution-service/src/services/ring-leader-class-progression.ts
  modified:
    - services/execution-service/src/services/ring-leader-fitness.ts

key-decisions:
  - "Ring Leader class progression uses agent_classes with taskCategory='ring_leader' (reuses existing table, no migration needed)"
  - "Qualifying run count for Understudy->Artisan gate uses SQL avg of 5 JSONB soul_selection_score dimensions — single pass query"
  - "Class progression failure is non-fatal: own try/catch block, logs WARN, never propagates to run completion"
  - "Artisan is terminal class — evaluateRingLeaderPromotion returns early with promoted=false when already Artisan"
  - "Qualifying run query only executes when basic gates (runCount + compositeScore) pass — avoids unnecessary DB queries on obvious failure"

patterns-established:
  - "soulId=null early exit pattern: Ring Leaders without souls skip promotion silently (pioneer/test run path)"
  - "agent_classes row auto-created on first promotion attempt for new Ring Leader souls"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 31 Plan 04: Ring Leader Class Progression Evaluation Summary

**Ring Leader class promotion threshold enforcement (FIT-05) wired into the fitness computation pipeline after Akashic Library persistence**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T15:43:02Z
- **Completed:** 2026-03-02T15:45:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `ring-leader-class-progression.ts` with `evaluateRingLeaderPromotion()` enforcing both FIT-05 promotion gates
- Novice->Understudy gate: `runCount >= 4 && compositeScore >= 0.68`
- Understudy->Artisan gate: `runCount >= 9 && compositeScore >= 0.85 && qualifyingRunCount >= 6` (where qualifying = avg soul selection score >= 0.75 across the 5 JSONB dimensions)
- Qualifying run count computed via raw SQL avg of 5 JSONB fields in `soul_selection_score` column with a join to `ring_leader_runs` for soulId filtering
- `agent_classes` updated on promotion with `lastTransitionAt` and `artisanGraduationAt` (Artisan only)
- `ring-leader-fitness.ts` updated to call `evaluateRingLeaderPromotion` after fitness persistence, wrapped in own try/catch (non-fatal)
- `getSoulIdForRun()` helper added to resolve soulId from `ring_leader_runs` by run id

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Ring Leader class progression evaluation module** - `859d86d` (feat)
2. **Task 2: Wire class progression into fitness computation pipeline** - `53c2882` (feat)

**Plan metadata:** (docs: complete plan — see final commit below)

## Files Created/Modified
- `services/execution-service/src/services/ring-leader-class-progression.ts` — Class progression module with threshold evaluation and agent_classes update; exports `evaluateRingLeaderPromotion` and `RingLeaderPromotionResult`
- `services/execution-service/src/services/ring-leader-fitness.ts` — Added import, getSoulIdForRun helper, and non-fatal class progression call after fitness persistence

## Decisions Made
- `agent_classes` reused for Ring Leaders: `botId` stores `soulId`, `taskCategory='ring_leader'` — no new table or migration needed
- Qualifying run count for Artisan gate uses single SQL query with JSONB field extraction and avg computation — avoids application-layer looping over all runs
- Class progression failure is non-fatal: own `try/catch` block separate from the outer fitness try/catch so a promotion failure doesn't mask the fitness result
- Artisan is the terminal class — early return with `promoted: false` when already at Artisan avoids unnecessary queries
- Qualifying run SQL only executes when `runCount >= 9 && compositeScore >= 0.85` — basic gate check before the expensive JSONB aggregation query

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — uses existing `agent_classes` table and `@claw/db` client. No schema migration needed.

## Next Phase Readiness
- Ring Leader class state is now maintained in `agent_classes` after every fitness computation
- TypeScript compiles with zero errors
- Full pipeline verified: synthesis -> fitness scoring -> class progression evaluation

## Self-Check: PASSED

- `services/execution-service/src/services/ring-leader-class-progression.ts` — FOUND
- `services/execution-service/src/services/ring-leader-fitness.ts` — FOUND
- `.planning/phases/31-ring-leader-fitness-scoring/31-04-SUMMARY.md` — FOUND
- Commit `859d86d` — FOUND
- Commit `53c2882` — FOUND

---
*Phase: 31-ring-leader-fitness-scoring*
*Completed: 2026-03-02*
