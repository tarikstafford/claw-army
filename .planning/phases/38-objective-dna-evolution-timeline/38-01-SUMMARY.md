---
phase: 38-objective-dna-evolution-timeline
plan: "01"
subsystem: api
tags: [fastify, drizzle-orm, postgresql, typescript, svelte]

# Dependency graph
requires:
  - phase: 37-objective-crud-ui
    provides: Objective detail page and CRUD endpoints the timeline builds on
provides:
  - GET /objectives/:id/timeline endpoint with pagination, filtering, and merged council verdict + pioneer events
  - ObjectiveTimelineEvent and ObjectiveTimeline TypeScript interfaces in types.ts
  - getObjectiveTimeline API client function in api.ts
affects: [38-02-objective-dna-evolution-timeline-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ROW_NUMBER() window function for sequential run numbering across objective executions
    - In-memory merge + sort pattern for combining heterogeneous event sources (verdicts + pioneer benchmarks)
    - Drizzle leftJoin with raw sql`` aliases for cross-table joins without Drizzle table references
    - fromClass derivation via progression chain array (Novice/Understudy/Artisan) indexed by verdictType

key-files:
  created: []
  modified:
    - services/execution-service/src/routes/objectives.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts

key-decisions:
  - "Pioneer events sourced from category_benchmarks JOIN executions — no council_verdicts row exists for pioneer events"
  - "fromClass derived in-app (not DB) by reversing toClass through the progression chain — simpler than storing it"
  - "In-memory sort + slice for pagination — feasible since timeline events per objective are bounded (one verdict per bot per run)"
  - "filter=pioneer skips verdict query entirely (allowedVerdictTypes=[]) to avoid unnecessary DB work"

patterns-established:
  - "deriveFromClass helper encapsulates class transition logic using CHAIN=['Novice','Understudy','Artisan'] array"
  - "VERDICT_FILTER_MAP record maps filter string to allowed verdict type list — extensible for new filter values"

requirements-completed: [OBJ-04]

# Metrics
duration: 15min
completed: 2026-03-03
---

# Phase 38 Plan 01: DNA Evolution Timeline Backend Summary

**Paginated GET /objectives/:id/timeline endpoint returning merged council verdict + pioneer events with class transition derivation, run numbers, and filter support for the DNA evolution timeline UI**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-03T09:07:00Z
- **Completed:** 2026-03-03T09:22:21Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `ObjectiveTimelineEvent` and `ObjectiveTimeline` interfaces to types.ts covering all council verdict types and pioneer events
- Added `getObjectiveTimeline` API client function to api.ts with limit, offset, and filter params
- Implemented `GET /:id/timeline` Fastify handler in objectives.ts with:
  - ROW_NUMBER() window function for sequential run number assignment
  - Council verdicts joined with agent_classes + dna_store for class context
  - Pioneer events sourced from category_benchmarks joined to executions
  - In-memory merge + sort (newest first) + pagination with total/hasMore
  - Filter param supporting: all, promote, demote, retire, monitor_maintain, pioneer
  - fromClass derivation from dna_store.agentClassAtWrite + verdictType progression chain

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ObjectiveTimelineEvent and ObjectiveTimeline types to types.ts** - `f6eaafc` (feat)
2. **Task 2: Add getObjectiveTimeline function to api.ts** - `c941b79` (feat)
3. **Task 3: Add GET /:id/timeline endpoint to objectives.ts** - `aa70ea8` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `services/execution-service/src/routes/objectives.ts` - Added TimelineEventSchema TypeBox schema, TimelineEventSchema, deriveFromClass helper, and GET /:id/timeline handler with verdict + pioneer query logic
- `services/ui/src/lib/types.ts` - Added ObjectiveTimelineEvent and ObjectiveTimeline interfaces
- `services/ui/src/lib/api.ts` - Added ObjectiveTimeline import and getObjectiveTimeline function

## Decisions Made

- **Pioneer events sourced from category_benchmarks:** Pioneer detection stores a benchmark row, not a council verdict, so they require a separate query and are merged in-app.
- **fromClass derived in-app:** The DB doesn't store the previous class at verdict time, so we reverse-engineer it from toClass + verdictType using the progression chain. This avoids schema changes.
- **In-memory pagination:** Events per objective are bounded (one verdict per bot per run), so fetching all then slicing is acceptable for v1. If an objective runs 1000+ times with 20 bots each, this would need SQL-level pagination.
- **filter=pioneer optimization:** When filter=pioneer, verdict query is entirely skipped (allowedVerdictTypes=[]).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript narrowing for CHAIN array element access**
- **Found during:** Task 3 (tsc verification)
- **Issue:** `CHAIN[idx - 1]` and `CHAIN[idx + 1]` return `string | undefined`, not `string | null` — TypeScript correctly flags this as incompatible with the return type
- **Fix:** Added `?? null` fallback: `(CHAIN[idx - 1] ?? null)` and `(CHAIN[idx + 1] ?? null)`
- **Files modified:** services/execution-service/src/routes/objectives.ts
- **Verification:** tsc --noEmit shows no objectives.ts errors
- **Committed in:** aa70ea8 (Task 3 commit)

**2. [Rule 1 - Bug] Fixed `allowedVerdictTypes` type narrowing**
- **Found during:** Task 3 (tsc verification)
- **Issue:** TypeScript inferred `VERDICT_FILTER_MAP[filter]` as `string[] | undefined` even with `??` fallback chain, causing "possibly undefined" error at `.length` access
- **Fix:** Added explicit `: string[]` type annotation and extra `?? []` fallback
- **Files modified:** services/execution-service/src/routes/objectives.ts
- **Verification:** tsc --noEmit shows no objectives.ts errors
- **Committed in:** aa70ea8 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - TypeScript narrowing bugs)
**Impact on plan:** Both fixes were necessary for type correctness. No scope creep.

## Issues Encountered

- Pre-existing tsc error in `billing.ts` (pre_flight status not in schema type) — confirmed pre-existing before this plan, out of scope per deviation rules. Logged to deferred items.

## Next Phase Readiness

- All backend data layer ready for Plan 38-02 (DNA Evolution Timeline UI)
- `getObjectiveTimeline` API function ready for Svelte component consumption
- `ObjectiveTimelineEvent` type covers all rendering needs (fromClass/toClass, runNumber, eventType, judge outputs)

---
*Phase: 38-objective-dna-evolution-timeline*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: services/execution-service/src/routes/objectives.ts
- FOUND: services/ui/src/lib/types.ts
- FOUND: services/ui/src/lib/api.ts
- FOUND: .planning/phases/38-objective-dna-evolution-timeline/38-01-SUMMARY.md
- FOUND commit: aa70ea8 (objectives.ts endpoint)
- FOUND commit: c941b79 (api.ts function)
- FOUND commit: f6eaafc (types.ts interfaces)
