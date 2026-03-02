---
phase: 29-real-time-execution-coordination
plan: "01"
subsystem: api
tags: [ring-leader, coordination, polling, pubsub, drizzle]

# Dependency graph
requires:
  - phase: 28-ring-leader-agent-spawning
    provides: getActiveSessionRegistry, ActiveSessionRegistry, ActiveSession types
  - phase: 24-ring-leader-schema-and-shared-types
    provides: RingLeaderRunState, RingLeaderMissionBrief, TaskState, TaskRunStatus types; ring_leader_runs schema
provides:
  - coordination-loop.ts with startCoordinationLoop, stopCoordinationLoop, getCoordinationHandle
  - CoordinationContext and CoordinationModule extension-point interfaces for plans 29-02 to 29-05
  - coordination-events.ts with logCoordinationEvent, getCoordinationLog, clearCoordinationLog
  - publishRingLeaderEvent in publisher.ts publishing to ring-leader-events topic
affects: [29-02, 29-03, 29-04, 29-05, coordination modules, ring-leader synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Extension-point architecture via CoordinationModule interface — each plan 29-02 to 29-05 calls addModule() to plug in without modifying coordination-loop.ts
    - Poll-persist-check pattern — each tick builds runState, runs modules, persists to DB, checks termination
    - Non-fatal poll cycles — try/catch around full tick, module errors caught individually, loop never crashes

key-files:
  created:
    - services/execution-service/src/services/coordination-events.ts
    - services/execution-service/src/services/coordination-loop.ts
  modified:
    - services/execution-service/src/events/publisher.ts

key-decisions:
  - "activeIntervals Map decoupled from CoordinationHandle — handle.stop() calls stopCoordinationLoop which looks up interval by runId; avoids exposing intervalId on public interface"
  - "buildRunState is async and separate from startCoordinationLoop — clean separation between state construction and loop lifecycle"
  - "objectiveDriftScore defaults to 0 and anomalies defaults to [] — Plan 29-04 will populate drift; modules append to anomalies via ctx.runState.anomalies"
  - "COST_PER_1K_TOKENS_CENTS = 0.3 defined as a constant with explicit placeholder comment — clearly signals this needs to be replaced with real model pricing"
  - "No-op handle returned if registry not found — callers never need to null-check, and error is logged instead of thrown"

patterns-established:
  - "CoordinationModule pattern: each coordination concern (intelligence routing, reallocation, drift detection, budget) lives in its own module file added via addModule()"
  - "Coordination log in coordination-events.ts: in-memory Map with clearCoordinationLog on run teardown prevents unbounded growth"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 29 Plan 01: Coordination Polling Loop and Run State Summary

**Configurable 30s polling loop (COORD-01) persisting live RingLeaderRunState to DB each cycle, with extension-point architecture for coordination modules and in-memory event log via publishRingLeaderEvent**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T13:10:35Z
- **Completed:** 2026-03-02T13:12:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Coordination polling loop polls at configurable interval (default 30s via `COORDINATION_POLL_INTERVAL_MS`) and persists `RingLeaderRunState` to `ring_leader_runs.runState` on every cycle
- `CoordinationModule` extension-point interface lets plans 29-02 through 29-05 register modules via `addModule()` without touching this file
- In-memory coordination event log with publish-to-PubSub support via new `publishRingLeaderEvent` in publisher.ts
- `buildRunState` computes all COORD-01 fields: elapsed time, budget from `tool_invocations` llm_call sum, per-task agent state categorization, drift=0 (placeholder), anomalies=[]

## Task Commits

1. **Task 1: Coordination event logger** - `6ad968d` (feat)
2. **Task 2: Coordination polling loop with live run state** - `8add5aa` (feat)

**Plan metadata:** (docs commit — this SUMMARY)

## Files Created/Modified
- `services/execution-service/src/services/coordination-events.ts` - In-memory event log; exports `logCoordinationEvent`, `getCoordinationLog`, `clearCoordinationLog`
- `services/execution-service/src/services/coordination-loop.ts` - Polling loop; exports `startCoordinationLoop`, `stopCoordinationLoop`, `getCoordinationHandle`, `CoordinationContext`, `CoordinationModule`, `CoordinationHandle`
- `services/execution-service/src/events/publisher.ts` - Added `publishRingLeaderEvent` publishing to `ring-leader-events` topic; added `ringLeaderEventSchema` import

## Decisions Made
- `activeIntervals` Map decoupled from `CoordinationHandle` — handle.stop() calls `stopCoordinationLoop` which looks up interval by runId, avoids exposing intervalId on public interface
- `buildRunState` is async and separate from loop lifecycle — clean separation of concerns
- `objectiveDriftScore` defaults to 0 and `anomalies` defaults to `[]` — Plan 29-04 computes real drift; modules append anomalies via `ctx.runState.anomalies` before persistence
- `COST_PER_1K_TOKENS_CENTS = 0.3` defined as explicit placeholder constant — clearly signals future replacement with real model pricing
- No-op `CoordinationHandle` returned if session registry not found at loop start — callers never need to null-check; error is logged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `startCoordinationLoop` is ready for plans 29-02 through 29-05 to register `CoordinationModule` implementations via `addModule()`
- `CoordinationContext` provides all context needed by downstream modules: runId, executionId, missionBrief, registry, runState, pollIntervalMs, startedAt
- `logCoordinationEvent` is ready for coordination event publishing as modules fire events
- Plan 29-02 (intelligence routing) can import `CoordinationModule`, implement `execute(ctx)`, and call `handle.addModule(module)`

---
*Phase: 29-real-time-execution-coordination*
*Completed: 2026-03-02*
