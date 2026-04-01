---
phase: 24-ring-leader-schema-and-shared-types
plan: 01
subsystem: database
tags: [drizzle, postgres, jsonb, migrations, ring-leader, schema]

# Dependency graph
requires:
  - phase: 23-soul-archetype-seeding
    provides: bot_souls table and executions table that ring_leader_runs FKs into
provides:
  - ring_leader_runs Drizzle table definition with status enum and all run state columns
  - ring_leader_fitness Drizzle table definition with scoring and audit columns
  - SQL migration 0011 ready to apply via psql
  - ringLeaderRunId nullable column on executions
affects: [25-ring-leader-agent, 26-mission-brief, 27-soul-assembly, 28-population-manifest, 29-coordination, 30-synthesis, 31-fitness-scoring, 32-ring-leader-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Logical FK pattern (uuid column with no explicit references) for circular-reference avoidance — matches bots.soulId and executions.taskCategory patterns
    - JSONB columns for polymorphic structured data (missionBrief, populationManifest, runState, synthesis, coordinationScore, soulSelectionScore)
    - pgEnum for state machine status columns
    - Hand-written SQL migrations with --> statement-breakpoint separators following 0003_soul_system_foundation.sql pattern

key-files:
  created:
    - packages/db/src/schema/ring-leader-runs.ts
    - packages/db/migrations/0011_ring_leader_schema.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/schema/executions.ts
    - packages/db/migrations/meta/_journal.json

key-decisions:
  - "No FK from executions.ring_leader_run_id back to ring_leader_runs to avoid circular FK (ring_leader_runs already FKs to executions)"
  - "No FK from ring_leader_runs.soul_id to bot_souls to avoid circular FK — same pattern as bots.soulId"
  - "ring_leader_fitness has a unique constraint on ring_leader_run_id enforcing one fitness record per run"
  - "JSONB used for missionBrief, populationManifest, runState, synthesis to support evolving schemas without migrations"
  - "composite_score stored as numeric(5,2) for deterministic ordering; dimensions kept as JSONB for flexibility"

patterns-established:
  - "Logical FK pattern: uuid column with comment noting intent, no Drizzle references() call"
  - "JSONB for domain documents: avoids premature schema rigidity for evolving Ring Leader types"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 24 Plan 01: Ring Leader Schema Summary

**Drizzle schema and SQL migration 0011 creating ring_leader_runs (status enum + JSONB mission/state/synthesis fields) and ring_leader_fitness (6-dimension scoring) tables, plus nullable ring_leader_run_id on executions**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T09:00:00Z
- **Completed:** 2026-03-02T09:01:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `ring_leader_runs` table with status enum (assembling → spawning → coordinating → synthesizing → completed/failed), FK to executions, logical soul_id, and JSONB columns for missionBrief, populationManifest, runState, synthesis
- Created `ring_leader_fitness` table with JSONB coordinationScore (4 dimensions) and soulSelectionScore (5 dimensions), numeric compositeScore, unique constraint (one fitness record per run), and audit fields
- Wrote idiomatic SQL migration 0011 following project conventions (statement-breakpoint separators, `public` schema qualifier, btree indexes), added journal entry, and updated schema index and executions.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ring-leader-runs Drizzle schema with two tables and status enum** - `5d40f7c` (feat)
2. **Task 2: Write SQL migration and update schema index + journal** - `976ad4f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/db/src/schema/ring-leader-runs.ts` - ringLeaderRuns and ringLeaderFitness Drizzle table definitions, ringLeaderStatusEnum, and all 4 inferred types
- `packages/db/migrations/0011_ring_leader_schema.sql` - Hand-written SQL migration creating both tables, adding ring_leader_run_id to executions, FKs, unique constraint, 5 indexes
- `packages/db/src/schema/index.ts` - Added `export * from './ring-leader-runs'`
- `packages/db/src/schema/executions.ts` - Added nullable `ringLeaderRunId` column (logical FK, no circular ref)
- `packages/db/migrations/meta/_journal.json` - Added idx 11 entry for 0011_ring_leader_schema (when: 1772600000000)

## Decisions Made

- No FK from `executions.ring_leader_run_id` back to `ring_leader_runs` — circular FK avoidance (ring_leader_runs already FKs to executions). Same pattern established in v3.0.
- No FK from `ring_leader_runs.soul_id` to `bot_souls` — matches `bots.soulId` logical reference pattern.
- JSONB for all Ring Leader domain documents (missionBrief, populationManifest, runState, synthesis, scoring breakdowns) to avoid schema churn as types evolve across phases 25-32.
- `composite_score` as `numeric(5,2)` for deterministic sorting; dimension breakdowns stay in JSONB for flexibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

Apply the migration when ready:
```bash
psql $DATABASE_URL -f packages/db/migrations/0011_ring_leader_schema.sql
```

## Next Phase Readiness

- All persistent storage for Ring Leader is ready: mission briefs, population manifests, run state, synthesis, and fitness scores
- Phase 25 (Ring Leader agent) can now create ring_leader_runs rows and update them as runs progress
- Migration 0011 is idempotent if run in a transaction; apply via psql before Phase 25 service code ships

---
*Phase: 24-ring-leader-schema-and-shared-types*
*Completed: 2026-03-02*

## Self-Check: PASSED

All files verified present. Both task commits confirmed in git log.
