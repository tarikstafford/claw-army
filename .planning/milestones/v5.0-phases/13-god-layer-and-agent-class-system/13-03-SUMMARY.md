---
phase: 13-god-layer-and-agent-class-system
plan: 03
subsystem: api
tags: [bullmq, drizzle-orm, postgres, god-layer, dna-store, category-benchmarks, negative-signal-register]

# Dependency graph
requires:
  - phase: 13-01
    provides: dna_store, category_benchmarks, negative_signal_register schema + @claw/db exports
  - phase: 11-01
    provides: council-queue pattern for queue definition
  - phase: 11-02
    provides: queueConnection from task-queue

provides:
  - GOD_LAYER_QUEUE_NAME, GodLayerJobData interface, godLayerQueue (soul-verdicts BullMQ queue)
  - writeVersionedDnaEntry: insert-only versioned DNA writer with MAX(version)+1 and isProvisional flag
  - detectAndTrackPioneer: pioneer event detection and category_benchmarks lifecycle management
  - writeNegativeSignal: negative signal writer with mutationBlacklist JSONB

affects:
  - 13-04 (God Layer worker imports and orchestrates all four modules)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Transaction-scoped domain functions: all modules accept tx (Drizzle transaction) not db, enabling atomic orchestration by God Layer worker
    - Transaction type alias pattern: type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] — avoids importing PgTransaction generics
    - Insert-only versioning: MAX(version)+1 computed inside transaction to guarantee uniqueness under concurrent writes (GODL-03)
    - Confidence threshold gating: GODL_CONFIDENCE_THRESHOLD exported as named constant for testability

key-files:
  created:
    - services/execution-service/src/queue/god-layer-queue.ts
    - services/execution-service/src/god-layer/dna-writer.ts
    - services/execution-service/src/god-layer/pioneer-tracker.ts
    - services/execution-service/src/god-layer/negative-register.ts
  modified: []

key-decisions:
  - "Transaction type alias (type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]) avoids importing PgTransaction generics from drizzle-orm/pg-core directly — cleaner and does not require explicit generic params"
  - "pioneer-tracker uses eq().where() then array index check for pioneer detection — single query pattern, no separate count query"
  - "MATURE_THRESHOLD=3 and THIN_DATA_CLEAR_THRESHOLD=5 extracted as named constants inside pioneer-tracker for clarity without over-exporting"
  - "negative-register blacklist object keys match research spec: failedDirectives, avoidMutationOps (not mutationOpsApplied), parentSoulId, reason"

patterns-established:
  - "Domain function pattern: each module exports one focused async function that accepts tx + typed params object, returns typed result"
  - "All four modules use tx (not db) for all DB operations — enforces transaction boundary at type level"

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 13 Plan 03: God Layer Queue and Support Modules Summary

**BullMQ soul-verdicts queue definition plus three transaction-scoped domain modules: versioned DNA writer (MAX(version)+1 insert-only), pioneer tracker (category_benchmarks lifecycle), and negative signal register writer (mutationBlacklist JSONB)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T03:21:08Z
- **Completed:** 2026-02-22T03:26:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `god-layer-queue.ts` mirroring council-queue pattern: GOD_LAYER_QUEUE_NAME='soul-verdicts', GodLayerJobData interface with verdictId/executionId/botId/soulId/taskCategory, godLayerQueue instance
- Created `dna-writer.ts`: writeVersionedDnaEntry computes MAX(version)+1 scoped to (objectiveCategory, soulId) inside tx, inserts full GODL-02 payload, sets isProvisional when weightedConfidenceScore < 0.50 (GODL-03, GODL-04)
- Created `pioneer-tracker.ts`: detectAndTrackPioneer handles pioneer event (first confirmed run) by inserting category_benchmarks row; on subsequent runs increments confirmedRunCount and updates benchmarkMature/standardPromotion (at 3) and thinDataFlag (cleared at 5); baselineCompositeScore never updated (GODL-06)
- Created `negative-register.ts`: writeNegativeSignal inserts negative_signal_register row with mutationBlacklist JSONB containing failedDirectives, avoidMutationOps, parentSoulId, and reason (GODL-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create god-layer-queue.ts and dna-writer.ts** - `e6b9cc9` (feat)
2. **Task 2: Create pioneer-tracker.ts and negative-register.ts** - `c501491` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/execution-service/src/queue/god-layer-queue.ts` - BullMQ soul-verdicts queue definition with GodLayerJobData interface
- `services/execution-service/src/god-layer/dna-writer.ts` - Versioned insert-only DNA writer with confidence threshold gating
- `services/execution-service/src/god-layer/pioneer-tracker.ts` - Pioneer event detection and category_benchmarks lifecycle management
- `services/execution-service/src/god-layer/negative-register.ts` - Negative signal writer with mutationBlacklist JSONB construction

## Decisions Made

- Transaction type alias `type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]` used in all three modules — avoids importing PgTransaction generic types directly from drizzle-orm/pg-core, cleaner and avoids explicit generic parameter noise
- Pioneer detection uses a single SELECT + array index check (existingRow === undefined) — no separate COUNT query needed
- MATURE_THRESHOLD=3 and THIN_DATA_CLEAR_THRESHOLD=5 defined as module-internal constants in pioneer-tracker — not over-exported since they are implementation details of the maturity logic
- mutationBlacklist key `avoidMutationOps` matches research spec (not `mutationOpsApplied` from the params field name)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt for all four files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four modules are ready for Plan 04 (God Layer worker) to import and orchestrate inside a single DB transaction
- God Layer worker imports: writeVersionedDnaEntry, detectAndTrackPioneer, writeNegativeSignal, computeClassTransition (from class-machine.ts)
- godLayerQueue is ready for the worker to create a BullMQ Worker against GOD_LAYER_QUEUE_NAME using workerConnection

---
*Phase: 13-god-layer-and-agent-class-system*
*Completed: 2026-02-22*
