---
phase: 29-real-time-execution-coordination
plan: "03"
subsystem: api
tags: [ring-leader, coordination, reallocation, failure-handling, guardrail, drizzle]

# Dependency graph
requires:
  - phase: 29-01-real-time-execution-coordination
    provides: CoordinationContext, CoordinationModule interfaces; logCoordinationEvent; coordination polling loop
  - phase: 28-ring-leader-agent-spawning
    provides: ActiveSession, ActiveSessionRegistry, getActiveSessionRegistry; spawnBot
  - phase: 24-ring-leader-schema-and-shared-types
    provides: RingLeaderMissionBrief, RingLeaderRunState types; ReallocationEvent schema
provides:
  - failure-reallocator.ts implementing CoordinationModule (COORD-03, COORD-04, COORD-05)
  - createFailureReallocator factory for plugging into coordination loop via addModule()
affects: [29-05, coordination synthesis, ring-leader fitness scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Set-based deduplication pattern for per-poll-cycle idempotent coordination module state (processedFailures / processedCompletions)
    - Non-fatal async sub-handlers pattern: top-level execute() catches per-session errors individually so one failed session never blocks others

key-files:
  created:
    - services/execution-service/src/services/failure-reallocator.ts
  modified: []

key-decisions:
  - "Guardrail detection queries bots.errorMessage for GUARDRAIL_KEYWORDS list; soul-driven classification triggers INVIOLABLE/constitution keyword check; context-driven gets redistributed not paused"
  - "COORD-04 is advisory in v1 — capacity_redirected events log the recommendation but no auto-spawn fires; rationale documents manual intervention required"
  - "Replacement spawns reuse the failed session's JWT for v1 simplicity; a future phase should mint a fresh session JWT for the replacement agent"
  - "processedFailures set marks sessionId even when handler throws to avoid infinite retry loops across poll cycles"
  - "budgetCapCents=0 treated as no-cap mode for replacement/redirection budget gate (mirrors budget-validator behavior)"

patterns-established:
  - "CoordinationModule factories use module-level Set state for deduplication across poll cycles without external storage"
  - "Guardrail detection: keyword scan on bot errorMessage followed by soul-driven vs context-driven classification determines action (paused_for_review vs redistributed)"

# Metrics
duration: 1min
completed: 2026-03-02
---

# Phase 29 Plan 03: Failure Reallocation Module Summary

**CoordinationModule implementing COORD-03/04/05: failed agent redistribution or replacement spawn, early-completion capacity evaluation, and guardrail trigger classification (soul-driven vs context-driven)**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-02T13:15:05Z
- **Completed:** 2026-03-02T13:16:28Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `createFailureReallocator()` factory returns a `CoordinationModule` with per-instance `processedFailures` and `processedCompletions` dedup sets
- COORD-03: Failed sessions are detected each poll cycle; if surviving active agents exist → `redistributed` event logged; if last agent + budget < 80% → replacement bot spawned and registered in registry + task row created
- COORD-04: Completed sessions with no remaining task siblings trigger capacity evaluation; tasks with active agents below `recommendedPopulation` receive `capacity_redirected` event (advisory v1 — no auto-spawn)
- COORD-05: Bot `errorMessage` is scanned for guardrail keywords; soul-driven triggers (INVIOLABLE/constitution) log `paused_for_review` and append anomaly to `runState.anomalies`; context-driven triggers log `redistributed`

## Task Commits

1. **Task 1: Failure reallocation coordination module** - `816a0d9` (feat)

**Plan metadata:** (docs commit — this SUMMARY)

## Files Created/Modified
- `services/execution-service/src/services/failure-reallocator.ts` - CoordinationModule implementing COORD-03, COORD-04, COORD-05; exports `createFailureReallocator`

## Decisions Made
- Guardrail detection uses keyword scan on `bots.errorMessage`; soul-driven vs context-driven classification drives `paused_for_review` vs `redistributed` action
- COORD-04 capacity redirection is advisory only in v1 — logs `capacity_redirected` event with recommendation but does not auto-spawn; rationale explicitly states "manual intervention or future auto-spawn required"
- Replacement spawns reuse the failed session's JWT (v1 simplicity); a future phase should mint a fresh session JWT for the replacement agent
- `budgetCapCents=0` treated as no-cap → always allows replacement/redirection (mirrors `budget-validator` no-cap behavior)
- `processedFailures` marks sessionId even when the handler throws, preventing infinite retry loops across poll cycles

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `createFailureReallocator()` is ready for Plans 29-04 and 29-05 to call `handle.addModule(createFailureReallocator())` during ring-leader run startup
- COORD-05 anomaly injection via `ctx.runState.anomalies.push(...)` feeds into the run state that Plan 29-04 (drift detection) and Plan 29-05 (synthesis) consume
- Future improvement: mint fresh session JWT for replacement agents rather than reusing the failed agent's JWT

---
*Phase: 29-real-time-execution-coordination*
*Completed: 2026-03-02*
