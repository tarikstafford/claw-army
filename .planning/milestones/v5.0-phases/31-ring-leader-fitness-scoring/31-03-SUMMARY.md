---
phase: 31-ring-leader-fitness-scoring
plan: "03"
subsystem: execution-service
tags: [ring-leader, fitness-scoring, composite-score, akashic-library, coordination, soul-selection]

# Dependency graph
requires:
  - phase: 31-ring-leader-fitness-scoring
    plan: "01"
    provides: scoreCoordinationQuality(CoordinationScoringParams) — coordination scorer
  - phase: 31-ring-leader-fitness-scoring
    plan: "02"
    provides: scoreSoulSelectionQuality(SoulSelectionScoringParams) — soul selection scorer
  - phase: 24-ring-leader-schema-and-shared-types
    provides: RingLeaderFitnessScore, FITNESS_CATEGORY_WEIGHTS from @claw/shared-types
  - phase: 30-run-synthesis
    provides: generateRunSynthesis — synthesis output chained into fitness scoring

provides:
  - computeAndPersistFitness(FitnessParams) — orchestrates both scorers in parallel and persists to ring_leader_fitness
  - FitnessParams interface for callers
  - ring_leader_fitness row with all FIT-03 and FIT-04 Akashic Library metadata fields
  - Fitness scoring wired into coordination loop termination path (both isRunComplete and isRuntimeLimitReached)

affects:
  - 31-04 (fitness API — reads from ring_leader_fitness table)
  - Any phase querying ring_leader_fitness for Ring Leader promotion logic

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.all for parallel scorer invocation — both scorers run concurrently, not sequentially"
    - "Composite score = coordWeighted * 0.60 + selectionWeighted * 0.40 (FITNESS_CATEGORY_WEIGHTS)"
    - "Fire-and-forget chain: generateRunSynthesis().then(fitness).catch() — handle.stop() called synchronously"
    - "Non-fatal error handling: computeAndPersistFitness catches all errors, returns null, never throws"

key-files:
  created:
    - services/execution-service/src/services/ring-leader-fitness.ts
  modified:
    - services/execution-service/src/services/coordination-loop.ts

key-decisions:
  - "Promise.all for parallel scorer invocation — both scorers are independent, no reason to sequence them"
  - "computeAndPersistFitness wraps entire body in try/catch, returns null on failure — run completion is never blocked by fitness scoring"
  - "Fitness is chained after synthesis via .then() — preserves fire-and-forget pattern while ensuring fitness runs after synthesis data is available"
  - "librarySearchQueries derived from manifests: per-task summary with taskId, taskDescription, soulCount, sources[], pioneerFlag"
  - "mutationSuccessRate computed as: mutated souls on completed tasks / total mutated souls; null if no mutations applied"
  - "executionId passed in FitnessParams for future use (logging, tracing) but not used in DB insert (runId is the FK)"

patterns-established:
  - "Fitness scorer follows same non-fatal pattern as synthesis: errors logged as WARN, caller not disrupted"
  - "Akashic Library metadata derived from manifests at write-time (not stored separately) — snapshots the state at the moment fitness is computed"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 31 Plan 03: Ring Leader Fitness Scoring — Composite Scorer and Akashic Library Persistence Summary

**Composite fitness scorer (FIT-03) with full Akashic Library persistence (FIT-04) wired fire-and-forget into the coordination loop termination path**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T15:39:01Z
- **Completed:** 2026-03-02T15:40:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `ring-leader-fitness.ts` with `computeAndPersistFitness()` calling both scorers in parallel via `Promise.all`
- Composite score computed as coordWeighted * 0.60 + selectionWeighted * 0.40 using `FITNESS_CATEGORY_WEIGHTS` from `@claw/shared-types`
- Full FIT-04 Akashic Library row persisted: soulSelectionLog, librarySearchQueries, selectionRetrospective, pioneerTasksHandled, mutationOperationsApplied, mutationSuccessRate
- Wired into `coordination-loop.ts` — fitness fires after synthesis resolves in both termination paths, preserving the fire-and-forget pattern via `.then()` chaining

## Task Commits

Each task was committed atomically:

1. **Task 1: Create composite fitness computation and Akashic Library persistence module** - `03060b4` (feat)
2. **Task 2: Wire fitness computation into coordination loop termination path** - `a51d734` (feat)

**Plan metadata:** (docs: complete plan — see final commit below)

## Files Created/Modified
- `services/execution-service/src/services/ring-leader-fitness.ts` — Composite scorer orchestrating both dimension scorers and persisting to ring_leader_fitness table with all FIT-03/FIT-04 fields
- `services/execution-service/src/services/coordination-loop.ts` — Added import and chained computeAndPersistFitness after generateRunSynthesis in termination block

## Decisions Made
- `Promise.all` for parallel scorer invocation — both scorers are independent inputs, no need to sequence them
- `computeAndPersistFitness` wraps entire body in try/catch and returns `null` on failure — fitness scoring failure is non-fatal and never blocks run completion
- Fitness chained via `.then()` after synthesis to ensure synthesis data is available before scoring runs
- `librarySearchQueries` derived from manifests at write-time: per-task summary with `{taskId, taskDescription, soulCount, sources[], pioneerFlag}`
- `mutationSuccessRate` returns `null` if no mutations applied; otherwise formats as `"0.000"`–`"1.000"` for the `numeric(4,3)` DB column
- `executionId` included in `FitnessParams` for future use (logging, audit) but not used in the DB insert

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. `computeAndPersistFitness` uses the same DB client and scorer modules already established in prior phases.

## Next Phase Readiness
- `ring_leader_fitness` table is now populated after every Ring Leader run termination
- Plan 31-04 (fitness API) can read from this table for external exposure
- TypeScript compiles with zero errors

## Self-Check: PASSED

- `services/execution-service/src/services/ring-leader-fitness.ts` — FOUND
- `services/execution-service/src/services/coordination-loop.ts` — FOUND
- `.planning/phases/31-ring-leader-fitness-scoring/31-03-SUMMARY.md` — FOUND
- Commit `03060b4` — FOUND
- Commit `a51d734` — FOUND

---
*Phase: 31-ring-leader-fitness-scoring*
*Completed: 2026-03-02*
