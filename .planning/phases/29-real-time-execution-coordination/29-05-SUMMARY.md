---
phase: 29-real-time-execution-coordination
plan: "05"
subsystem: coordination
tags: [ring-leader, budget-degradation, coordination-loop, tiered-degradation, agent-spawner]

# Dependency graph
requires:
  - phase: 29-01
    provides: coordination-loop.ts infrastructure, CoordinationModule/CoordinationContext interfaces, startCoordinationLoop
  - phase: 29-02
    provides: intelligence-router.ts CoordinationModule
  - phase: 29-03
    provides: failure-reallocator.ts CoordinationModule
  - phase: 29-04
    provides: drift-detector.ts CoordinationModule
provides:
  - budget-degradation.ts: CoordinationModule implementing COORD-08 — budget projection and tiered degradation
  - Full coordination pipeline wiring: all four modules registered in agent-spawner.ts
affects:
  - phase-30-synthesis
  - coordination-loop termination (hard-stop anomaly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Budget burn rate projection: elapsedSeconds > 10 guard before computing budgetConsumed / elapsedSeconds * runtimeLimitSeconds
    - Tier debounce: module-level Map<runId, state> tracks lastTierChangeAt; 60s minimum between transitions
    - Fire-and-forget coordination start: startCoordinationLoop called after status=coordinating DB update; spawnAgentsForRun returns immediately

key-files:
  created:
    - services/execution-service/src/services/budget-degradation.ts
  modified:
    - services/execution-service/src/services/agent-spawner.ts

key-decisions:
  - "budgetCap === 0 returns early — no-cap configured runs bypass budget degradation entirely"
  - "Projected overrun early warning at 20% overrun threshold escalates 'normal' to 'deprioritize' before actual consumption reaches 55%"
  - "Module-level runStateMap per runId avoids re-allocating state on each poll cycle; tier persists across cycles"
  - "Hard-stop anomaly appended on every poll cycle when tier is hard_stop (not just on transition) — loop termination check reads anomalies array"

patterns-established:
  - "CoordinationModule factory pattern: createXxx() returns { name, execute(ctx) } — same shape as intelligence-router, failure-reallocator, drift-detector"
  - "All four modules registered in agent-spawner.ts Step 4; startCoordinationLoop is the single wiring point"

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 29 Plan 05: Budget Degradation and Full Coordination Wiring Summary

**Budget projection module (COORD-08) with burn-rate-to-run-end projection, four tiered thresholds (55/70/85/95%), and full pipeline wiring: agent-spawner now starts the coordination loop with all four modules after every spawn run**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-02T13:19:07Z
- **Completed:** 2026-03-02T13:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Budget degradation module projecting consumption to run end on every poll cycle using burn rate (cents/second * runtimeLimitSeconds)
- Tiered degradation with four thresholds: deprioritize at 55%, consolidate at 70%, wrap_up at 85%, hard_stop at 95% — plus early-warning escalation from projection when projected overrun >20%
- Tier transitions debounced to max one per 60s, logged as BudgetDegradationEvent via logCoordinationEvent
- Hard-stop anomaly appended on every cycle once tier reaches hard_stop for loop termination detection
- agent-spawner.ts now calls startCoordinationLoop with all four modules (intelligence-router, failure-reallocator, drift-detector, budget-degradation) as Step 4 after status=coordinating

## Task Commits

1. **Task 1: Budget projection and tiered degradation module** - `9b60b27` (feat)
2. **Task 2: Wire coordination loop into agent spawner pipeline** - `95e1be6` (feat)

## Files Created/Modified

- `services/execution-service/src/services/budget-degradation.ts` - CoordinationModule implementing COORD-08: burn rate projection, tiered thresholds, tier debounce, BudgetDegradationEvent logging, hard-stop anomaly
- `services/execution-service/src/services/agent-spawner.ts` - Added Step 4 imports and startCoordinationLoop call with all four coordination modules registered

## Decisions Made

- `budgetCap === 0` short-circuits the module: no-cap configured runs bypass budget degradation. Consistent with Phase 25 decision (budgetCapCents=0 skips budget check).
- Projected overrun early warning escalates only from 'normal' -> 'deprioritize', not to higher tiers. Actual consumption thresholds govern consolidate/wrap_up/hard_stop. This prevents projection noise from triggering severe tier jumps on early burn spikes.
- Module-level `runStateMap` keyed by runId. State persists across poll cycles within the same process lifetime (same pattern as drift-detector and intelligence-router).
- Hard-stop anomaly appended on every poll cycle when tier is hard_stop (not just on the transition cycle). The coordination loop reads anomalies each tick; repeated anomaly ensures the loop's termination logic fires even if a cycle missed the initial transition.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 29 complete: all five plans delivered — coordination loop (01), intelligence routing (02), failure reallocation (03), drift detection (04), budget degradation + wiring (05)
- Full coordination pipeline operational: spawn -> status=coordinating -> loop polls every 30s -> all four modules run on each cycle -> synthesizing on completion
- Ready for Phase 30: Ring Leader synthesis (SYNTH-01 through SYNTH-04)

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/budget-degradation.ts
- FOUND: services/execution-service/src/services/agent-spawner.ts
- FOUND: .planning/phases/29-real-time-execution-coordination/29-05-SUMMARY.md
- FOUND: commit 9b60b27 (Task 1)
- FOUND: commit 95e1be6 (Task 2)

---
*Phase: 29-real-time-execution-coordination*
*Completed: 2026-03-02*
