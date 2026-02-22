---
phase: 13-god-layer-and-agent-class-system
plan: 01
subsystem: database
tags: [drizzle, postgres, schema, migration, agent-classes, category-benchmarks, god-layer]

# Dependency graph
requires:
  - phase: 12-human-confirmation-gate
    provides: council_verdicts table with timeOnScreenMs column, migration 0006

provides:
  - agent_classes table + agentClassEnum (Novice/Understudy/Artisan/Retired) with UNIQUE(botId, taskCategory)
  - category_benchmarks table with pioneer fields and UNIQUE(taskCategory)
  - Extended DnaPayload interface with 11 GODL-02 optional fields (soulContent, agentClassAtWrite, councilConfidenceScores, etc.)
  - isProvisional boolean column on dna_store (GODL-04)
  - dna_store_category_soul_version_unique constraint (GODL-03)
  - godLayerProcessedAt nullable timestamp on council_verdicts (GODL-01 idempotency)
  - Migration 0007_god_layer_schema.sql DDL for all of the above
affects:
  - 13-02 (God Layer processor needs agent_classes + category_benchmarks)
  - 13-03 (Agent Class promoter reads/writes agent_classes)
  - 13-04 (DNA writer uses isProvisional + DnaPayload GODL-02 fields)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle unique() constraint added as third argument to pgTable alongside index() — consistent with established schema pattern"
    - "Nullable nullable timestamp columns (no .notNull(), no .default()) for audit/idempotency fields"

key-files:
  created:
    - packages/db/src/schema/agent-classes.ts
    - packages/db/src/schema/category-benchmarks.ts
    - packages/db/migrations/0007_god_layer_schema.sql
  modified:
    - packages/db/src/schema/dna-store.ts
    - packages/db/src/schema/council-verdicts.ts
    - packages/db/src/schema/index.ts
    - packages/db/migrations/meta/_journal.json

key-decisions:
  - "agentClassEnum uses pgEnum for type-safe agent class values; Drizzle unique() placed in table third-argument constraint array alongside index() declarations"
  - "DnaPayload GODL-02 fields all marked optional (?) since existing dna_store rows pre-date the God Layer and lack these fields — no backfill required"
  - "dna_store_category_soul_version_unique UNIQUE covers (objective_category, soul_id, version) — null soul_id rows are excluded from uniqueness by Postgres NULL semantics, which is intentional"
  - "godLayerProcessedAt is nullable with no default — set once when God Layer processes a verdict; NULL = unprocessed, non-NULL = idempotency guard"
  - "Migration 0007 manually written (not drizzle-kit generated) following established project pattern (0003–0006 all manually crafted/renamed)"

patterns-established:
  - "God Layer idempotency: nullable timestamp column set once on first processing; query pattern is WHERE godLayerProcessedAt IS NULL"
  - "Provisional DNA: isProvisional=true during speculative God Layer write; flip to false on council confirmation"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 13 Plan 01: God Layer + Agent Class Schema Foundation Summary

**Drizzle schema foundation for the God Layer: two new tables (agent_classes, category_benchmarks), extended DnaPayload with 11 GODL-02 fields, isProvisional + version-unique constraint on dna_store, godLayerProcessedAt idempotency column on council_verdicts, and migration 0007 SQL.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T03:15:58Z
- **Completed:** 2026-02-22T03:17:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `agent_classes` table with `agentClassEnum` (Novice/Understudy/Artisan/Retired) and composite UNIQUE constraint on (botId, taskCategory) for CLAS-01 prerequisite
- Created `category_benchmarks` table with pioneer fields (pioneerBotId, pioneerSoulId, pioneerExecutionId, baselineCompositeScore) for GODL-06 prerequisite
- Extended `DnaPayload` interface with 11 optional GODL-02 fields covering soul content, agent class at write, composite fitness scores, council verdict summary/confidence, human confirmation timestamp, and pioneer flag
- Added `isProvisional` boolean to `dna_store` (GODL-04) and `dna_store_category_soul_version_unique` constraint (GODL-03) to prevent duplicate version races
- Added `godLayerProcessedAt` nullable timestamp to `council_verdicts` as idempotency guard for GODL-01
- Wrote migration 0007_god_layer_schema.sql with all 7 DDL blocks and updated _journal.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema files — agent-classes, category-benchmarks, dna-store, council-verdicts, index** - `d7160ab` (feat)
2. **Task 2: Migration 0007_god_layer_schema.sql + _journal.json update** - `6c7e9a8` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `packages/db/src/schema/agent-classes.ts` — New: agentClassEnum + agentClasses table with UNIQUE(botId, taskCategory), AgentClass/NewAgentClass types
- `packages/db/src/schema/category-benchmarks.ts` — New: categoryBenchmarks table with pioneer fields, UNIQUE(taskCategory), CategoryBenchmark/NewCategoryBenchmark types
- `packages/db/src/schema/dna-store.ts` — Extended DnaPayload with 11 GODL-02 optional fields; added isProvisional column; added version unique constraint
- `packages/db/src/schema/council-verdicts.ts` — Added godLayerProcessedAt nullable timestamp after timeOnScreenMs
- `packages/db/src/schema/index.ts` — Added re-exports for agent-classes and category-benchmarks
- `packages/db/migrations/0007_god_layer_schema.sql` — New: DDL for CREATE TYPE, 2x CREATE TABLE, 3x ALTER TABLE, 2x CREATE INDEX
- `packages/db/migrations/meta/_journal.json` — Added idx:7 entry with tag 0007_god_layer_schema

## Decisions Made

- `agentClassEnum` uses `pgEnum` for type-safe agent class values; `unique()` placed in table third-argument constraint array alongside `index()` declarations — consistent with established Drizzle pattern in this codebase.
- All 11 `DnaPayload` GODL-02 fields are marked optional (`?`) since existing `dna_store` rows pre-date the God Layer and lack these fields — no backfill required.
- `dna_store_category_soul_version_unique` UNIQUE covers `(objective_category, soul_id, version)` — Postgres NULL semantics exclude rows where `soul_id IS NULL` from the uniqueness check, which is intentional (legacy rows without a soul are exempt).
- `godLayerProcessedAt` is nullable with no default — set once when the God Layer processes a verdict; NULL = unprocessed (query pattern: `WHERE godLayerProcessedAt IS NULL`).
- Migration 0007 manually written, following the established project convention of manual/renamed migrations (0003–0006 all manually crafted).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Migration must be applied to the Cloud SQL instance after pgvector is confirmed (existing Phase 8 blocker tracked in STATE.md).

## Next Phase Readiness

- All God Layer schema prerequisites (GODL-01 through GODL-04, GODL-06, CLAS-01) are satisfied and compile cleanly
- Plans 02–04 (God Layer processor, Agent Class promoter, DNA writer) can now compile against these schema types
- Migration 0007 is ready to apply via `cd packages/db && npx drizzle-kit migrate` once pgvector is confirmed on Cloud SQL

---
*Phase: 13-god-layer-and-agent-class-system*
*Completed: 2026-02-22*
