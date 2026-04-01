---
phase: 32-dashboard-and-reporting
plan: 01
subsystem: api
tags: [ring-leader, sse, pubsub, typebox, fastify, svelte]

# Dependency graph
requires:
  - phase: 31-ring-leader-fitness-scoring
    provides: ring_leader_fitness table with coordination/soul-selection scores
  - phase: 29-real-time-execution-coordination
    provides: coordination-events.ts with getCoordinationLog, ring-leader-events PubSub topic
  - phase: 30-run-synthesis
    provides: synthesis column in ring_leader_runs, RingLeaderSynthesis type
provides:
  - GET /ring-leader/runs/by-execution/:executionId/state — live run state endpoint
  - GET /ring-leader/runs/by-execution/:executionId/events — coordination event log endpoint
  - GET /ring-leader/runs/by-execution/:executionId/synthesis — synthesis + fitness endpoint
  - SSE relay extended to forward ring-leader-events topic to browser
  - UI TypeScript interfaces for all Ring Leader dashboard data
  - UI API functions: getRingLeaderManifest, getRingLeaderState, getRingLeaderEvents, getRingLeaderSynthesis
affects: [32-02, 32-03, 32-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [TypeBox response schemas collocated in route file, JSONB cast to shared-types interfaces, getCoordinationLog used in HTTP route handler]

key-files:
  created: []
  modified:
    - services/execution-service/src/routes/ring-leader.ts
    - services/execution-service/src/routes/sse.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/sse.ts

key-decisions:
  - "runState returns null (not 404) when ring_leader_run exists but coordination not yet started — UI can distinguish assembling/spawning from coordinating phase"
  - "fitness compositeScore cast from numeric string to Number() in route handler — ring_leader_fitness.compositeScore is Drizzle numeric column returned as string"
  - "Ring Leader SSE events forwarded via existing per-connection subscription fan-out in sse.ts — no new route needed, just add topic to topicNames array"
  - "CoordinationEvent payload typed as Record<string, unknown> in UI to avoid coupling UI types to RingLeaderEvent union discriminators"

patterns-established:
  - "Pattern: JSONB columns cast to shared-type interfaces at route handler boundary (not in DB layer)"
  - "Pattern: Ring Leader UI types mirror shared-types interfaces but are independent declarations to avoid package coupling in SvelteKit"

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 32 Plan 01: Ring Leader Dashboard Data Layer Summary

**5 typed API endpoints (3 new) and SSE relay extension giving UI typed access to Ring Leader run state, coordination events, synthesis, and fitness scores**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T16:08:34Z
- **Completed:** 2026-03-02T16:11:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Three new GET endpoints in ring-leader.ts: /state (live run state), /events (coordination log), /synthesis (synthesis + fitness)
- SSE relay now subscribes to ring-leader-events PubSub topic alongside existing topics, forwarding coordination events in real time
- Full Ring Leader TypeScript interface set added to types.ts (RingLeaderRunState, TaskState, RingLeaderSynthesis, CoordinationScore, SoulSelectionScore, etc.)
- Four API functions added to api.ts (getRingLeaderManifest, getRingLeaderState, getRingLeaderEvents, getRingLeaderSynthesis)
- Five Ring Leader SSE event types added to sse.ts EVENT_TYPES for real-time browser subscription

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Ring Leader data endpoints to execution service** - `945e4ce` (feat)
2. **Task 2: Extend SSE relay and add UI client types/functions** - `eb0c722` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `services/execution-service/src/routes/ring-leader.ts` - Added 3 new GET endpoints + TypeBox schemas for RunStateSchema, EventsResponseSchema, SynthesisResponseSchema
- `services/execution-service/src/routes/sse.ts` - Added RING_LEADER_EVENTS_TOPIC constant and included in topicNames array
- `services/ui/src/lib/types.ts` - Added 13 Ring Leader TypeScript interfaces (RingLeaderRunState, TaskState, RingLeaderStateResponse, CoordinationEvent, RingLeaderEventsResponse, RingLeaderManifestResponse, PopulationManifest, SoulSelectionEntry, CoordinationScore, SoulSelectionScore, RingLeaderSynthesis, RingLeaderSynthesisResponse)
- `services/ui/src/lib/api.ts` - Added 4 Ring Leader API functions + imports
- `services/ui/src/lib/sse.ts` - Added 5 Ring Leader event types to EVENT_TYPES

## Decisions Made
- `runState` returns `null` (not 404) when ring_leader_run exists but coordination not yet started — UI can distinguish phases without error handling
- `fitness.compositeScore` cast via `Number()` because Drizzle returns `numeric` column as string
- Ring Leader SSE events forwarded via existing per-connection subscription fan-out — no new route needed
- `CoordinationEvent.payload` typed as `Record<string, unknown>` in UI to avoid coupling to backend union discriminators

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Ring Leader data endpoints are live; Plans 32-02, 32-03, and 32-04 can now build UI panels against these endpoints
- SSE relay forwards ring-leader coordination events, enabling real-time dashboard updates
- No blockers

## Self-Check: PASSED

- FOUND: services/execution-service/src/routes/ring-leader.ts
- FOUND: services/execution-service/src/routes/sse.ts
- FOUND: services/ui/src/lib/api.ts
- FOUND: services/ui/src/lib/types.ts
- FOUND: services/ui/src/lib/sse.ts
- FOUND commit: 945e4ce (Task 1)
- FOUND commit: eb0c722 (Task 2)

---
*Phase: 32-dashboard-and-reporting*
*Completed: 2026-03-02*
