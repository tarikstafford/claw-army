---
phase: 29-real-time-execution-coordination
plan: "02"
subsystem: api
tags: [ring-leader, coordination, intelligence-routing, jaccard, drizzle]

# Dependency graph
requires:
  - phase: 29-real-time-execution-coordination
    provides: CoordinationModule interface, CoordinationContext, logCoordinationEvent, coordination-loop extension points
  - phase: 28-ring-leader-agent-spawning
    provides: ActiveSession, ActiveSessionRegistry, tasks table with ringLeaderTaskId column
  - phase: 24-ring-leader-schema-and-shared-types
    provides: IntelligenceRoutingEvent type from @claw/event-schemas
provides:
  - intelligence-router.ts with createIntelligenceRouter returning CoordinationModule
  - Keyword-overlap (Jaccard) relevance heuristic for cross-task intelligence routing
  - Intel-prefixed task row insertion strategy for downstream upstream intelligence pipeline
  - clearIntelligenceRouterState() for memory cleanup on run teardown
affects: [29-03, 29-04, 29-05, ring-leader synthesis, coordination loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level processedSessionsByRun Map prevents re-routing on subsequent poll cycles
    - Intel-prefixed ringLeaderTaskId (intel:{sourceTaskId}:{targetTaskId}) distinguishes intelligence signals from regular task rows
    - Jaccard similarity via set intersection/union — zero external dependencies, deterministic
    - All DB and publish errors non-fatal: WARN logged, routing continues

key-files:
  created:
    - services/execution-service/src/services/intelligence-router.ts
  modified: []

key-decisions:
  - "Jaccard keyword-overlap heuristic at threshold=0.15 chosen for v1 — avoids embedding API calls on every poll cycle while providing useful routing signal"
  - "Intel-prefixed ringLeaderTaskId (intel:sourceTaskId:targetTaskId) lets collectUpstreamOutputs pick up routed intelligence without schema changes"
  - "processedSessionsByRun Map prevents re-processing completed sessions across poll cycles — avoids duplicate routing events"
  - "DB insert errors for intel task rows are non-fatal — event log is still written even if DB insert fails"
  - "clearIntelligenceRouterState() added as companion to clearCoordinationLog for run teardown memory management"

patterns-established:
  - "Intelligence routing via task table rows: intel: prefix distinguishes from real task rows while reusing upstream pipeline"
  - "Non-fatal coordination module: all errors wrapped in try/catch, logged as WARN, never propagate to loop"

# Metrics
duration: 1min
completed: 2026-03-02
---

# Phase 29 Plan 02: Intelligence Routing Module Summary

**Jaccard keyword-overlap intelligence router (COORD-02) scanning completed agent results and routing relevant discoveries to active tasks via intel-prefixed task rows and logged IntelligenceRoutingEvent payloads**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-02T13:14:57Z
- **Completed:** 2026-03-02T13:16:19Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `createIntelligenceRouter()` factory function implements `CoordinationModule` (name='intelligence-router'), plugging into the coordination loop via `addModule()`
- Each poll cycle: scans unprocessed completed sessions, retrieves task results, computes Jaccard similarity against active target task descriptions, routes relevant intelligence
- Intelligence is routed by: (1) inserting an `intel:{sourceTaskId}:{targetTaskId}` prefixed task row (consumed by `collectUpstreamOutputs` in Phase 28-04), and (2) logging an `IntelligenceRoutingEvent` with `fromTaskId`, `toTaskId`, `signalSummary`, and `routingRationale` (Jaccard score + keyword overlap)
- Module-level `processedSessionsByRun` Map prevents re-processing on subsequent poll cycles
- All errors (DB, event log, relevance check) are non-fatal — logged as WARN, routing failures never crash the coordination loop

## Task Commits

1. **Task 1: Intelligence routing coordination module** - `eb5bfd4` (feat)

**Plan metadata:** (docs commit — this SUMMARY)

## Files Created/Modified
- `services/execution-service/src/services/intelligence-router.ts` - Intelligence routing CoordinationModule; exports `createIntelligenceRouter`, `clearIntelligenceRouterState`

## Decisions Made
- Jaccard keyword-overlap heuristic at threshold=0.15 chosen for v1 — avoids embedding API calls on every poll cycle while still providing useful routing signal (future enhancement could use embedding similarity)
- Intel-prefixed `ringLeaderTaskId` (`intel:sourceTaskId:targetTaskId`) reuses existing `collectUpstreamOutputs` pipeline without schema changes — intelligence signals flow naturally as a special task row type
- `processedSessionsByRun` Map prevents re-routing on subsequent poll cycles — each completed session's intelligence is routed exactly once per run
- DB insert errors for intel task rows are non-fatal — `logCoordinationEvent` is still called even if row insert fails, preserving event log integrity
- `clearIntelligenceRouterState(runId)` added alongside `clearCoordinationLog` for proper memory cleanup on run teardown

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `createIntelligenceRouter()` is ready to be registered via `handle.addModule(createIntelligenceRouter())` after `startCoordinationLoop`
- Plan 29-03 (agent reallocation) can follow the same CoordinationModule pattern: implement `execute(ctx)`, return from factory, register via `addModule()`
- Intel-prefixed task rows are immediately visible to `collectUpstreamOutputs` for any downstream agents spawned after routing occurs
- `clearIntelligenceRouterState` should be called alongside `stopCoordinationLoop` in the run teardown path

---
*Phase: 29-real-time-execution-coordination*
*Completed: 2026-03-02*
