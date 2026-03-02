---
phase: 24-ring-leader-schema-and-shared-types
plan: 02
subsystem: api
tags: [typescript, zod, shared-types, event-schemas, ring-leader, domain-types]

# Dependency graph
requires: []
provides:
  - Ring Leader domain types: RingLeaderMissionBrief, TaskGraph, TaskGraphNode, PopulationManifest, SoulSelectionEntry, RingLeaderRunState, TaskState, RingLeaderSynthesis, TaskSummary, RingLeaderFitnessScore, CoordinationScore, SoulSelectionScore
  - Ring Leader enums and constants: RingLeaderStatus, CampaignType, TaskComplexity, BudgetDegradationTier and all threshold/weight constants
  - Ring Leader Zod event schemas: ringLeaderStatusChangeEventSchema, intelligenceRoutingEventSchema, reallocationEventSchema, reanchoringEventSchema, budgetDegradationEventSchema, ringLeaderEventSchema discriminated union
affects: [25-ring-leader-db-schema, 26-ring-leader-api, 27-ring-leader-soul-selection, 28-ring-leader-coordination, 29-ring-leader-synthesis, 30-ring-leader-fitness, 31-ring-leader-dashboard, 32-ring-leader-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ring Leader domain types follow JSDoc + interface pattern established in soul.ts and execution.ts"
    - "Zod event schemas follow discriminated union pattern from soul-lifecycle-events.ts"
    - "Constants exported as readonly arrays and const objects for safe consumer use"

key-files:
  created:
    - packages/shared-types/src/ring-leader.ts
    - packages/event-schemas/src/ring-leader-events.ts
  modified:
    - packages/shared-types/src/index.ts
    - packages/event-schemas/src/index.ts

key-decisions:
  - "Imported UUID and Cents from common.ts as type-only imports (import type) for zero runtime overhead"
  - "Followed existing Zod v4 syntax (z.uuid(), z.iso.datetime()) to match soul-lifecycle-events.ts pattern"
  - "Exported all constants (weights, thresholds, tier arrays) so downstream business logic phases can import without magic numbers"

patterns-established:
  - "Ring Leader types use 'import type' for common branded types to ensure no runtime cost"
  - "Zod event schemas follow discriminated union on 'type' field — consistent with all other event schema files"
  - "Fitness and coordination weights exported as const objects with numeric values for weighted calculations"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 24 Plan 02: Ring Leader Shared Types and Event Schemas Summary

**All Ring Leader domain types (16 interfaces/types, 10 constants) and 5 Zod event schemas with discriminated union exported from @claw/shared-types and @claw/event-schemas — zero TypeScript errors in both packages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T09:00:12Z
- **Completed:** 2026-03-02T09:01:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `ring-leader.ts` in @claw/shared-types with full Ring Leader domain model covering mission briefs, task graphs, population manifests, run state, synthesis, and fitness scoring
- Created `ring-leader-events.ts` in @claw/event-schemas with 5 Zod event schemas (status change, intelligence routing, reallocation, reanchoring, budget degradation) plus a discriminated union and inferred TypeScript types
- Both packages pass `tsc --noEmit` with zero errors and zero breaking changes to existing consumers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Ring Leader shared types in @claw/shared-types** - `46696f4` (feat)
2. **Task 2: Create Ring Leader Zod event schemas in @claw/event-schemas** - `87e3361` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `packages/shared-types/src/ring-leader.ts` - All Ring Leader domain types: RingLeaderMissionBrief, TaskGraph, TaskGraphNode, PopulationManifest, SoulSelectionEntry, RingLeaderRunState, TaskState, RingLeaderSynthesis, TaskSummary, RingLeaderFitnessScore, CoordinationScore, SoulSelectionScore plus status/tier enums and all threshold/weight constants
- `packages/shared-types/src/index.ts` - Added `export * from './ring-leader'` barrel export
- `packages/event-schemas/src/ring-leader-events.ts` - 5 Zod event schemas with discriminated union and inferred types
- `packages/event-schemas/src/index.ts` - Added `export * from './ring-leader-events'` barrel export

## Decisions Made

- Used `import type` for UUID and Cents from common.ts to keep the shared-types package free of any runtime imports
- Matched existing Zod v4 syntax (`z.uuid()`, `z.iso.datetime()`, `z.discriminatedUnion`) exactly as used in `soul-lifecycle-events.ts`
- Exported all numerical constants (COORDINATION_WEIGHTS, FITNESS_CATEGORY_WEIGHTS, RING_LEADER_PROMOTION_THRESHOLDS, BUDGET_HARD_STOP_THRESHOLD, DRIFT_REANCHORING_THRESHOLD, MIN_AGENTS_PER_TASK, SOUL_SEARCH_SIMILARITY_THRESHOLD, SOUL_DIFFERENTIATION_THRESHOLD) to prevent magic numbers in downstream business logic phases

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — `npx tsc` was not available in the pnpm workspace; used `pnpm --filter @claw/<package> exec tsc --noEmit` instead. Both packages compiled cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Ring Leader types are importable from @claw/shared-types: `RingLeaderMissionBrief`, `PopulationManifest`, `SoulSelectionEntry`, `RingLeaderSynthesis`, `RingLeaderFitnessScore`
- All Ring Leader event schemas are importable from @claw/event-schemas: `ringLeaderEventSchema`, individual event schemas, and inferred TypeScript types
- Phases 25-32 can import these types without any additional setup

---
*Phase: 24-ring-leader-schema-and-shared-types*
*Completed: 2026-03-02*

## Self-Check: PASSED

- packages/shared-types/src/ring-leader.ts: FOUND
- packages/event-schemas/src/ring-leader-events.ts: FOUND
- .planning/phases/24-ring-leader-schema-and-shared-types/24-02-SUMMARY.md: FOUND
- commit 46696f4 (Task 1): FOUND
- commit 87e3361 (Task 2): FOUND
