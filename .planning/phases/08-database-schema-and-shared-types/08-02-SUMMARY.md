---
phase: 08-database-schema-and-shared-types
plan: 02
subsystem: database
tags: [drizzle-orm, pgvector, postgresql, migration, seed, soul-system]

# Dependency graph
requires:
  - phase: 08-database-schema-and-shared-types plan 01
    provides: 4 new Drizzle schema files (bot_souls, decision_traces, council_verdicts, negative_signal_register) and additive nullable columns on bots/executions/dna_store

provides:
  - Drizzle migration 0003_soul_system_foundation.sql: DDL for 4 new tables, 2 new enums, additive nullable columns on 3 existing tables, pgvector extension activation, 17 CREATE INDEX statements, decision_traces TTL policy comment
  - packages/db/src/seed/archetypes.ts: idempotent seed script for 6 canonical archetype souls with full SOUL.md content, SHA-256 hashes, 7-dimension JSONB, and constitution directives

affects:
  - 09-soul-generation (reads bot_souls table, archetypes are the seed library for population)
  - 13-god-layer-mutation (reads negative_signal_register, uses mutation lineage)
  - 14-soul-ui (reads all soul tables seeded here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration renamed from drizzle-kit auto-name to human-readable 0003_soul_system_foundation.sql; journal tag updated accordingly"
    - "pgvector extension activation via CREATE EXTENSION IF NOT EXISTS vector prepended as first migration statement"
    - "Idempotent seed script pattern: count check before insert (SELECT count(*) WHERE is_archetype = true; skip if >= 6)"
    - "COMMENT ON TABLE used for TTL policy documentation directly in the database schema"

key-files:
  created:
    - packages/db/migrations/0003_soul_system_foundation.sql
    - packages/db/migrations/meta/0003_snapshot.json
    - packages/db/src/seed/archetypes.ts
  modified:
    - packages/db/migrations/meta/_journal.json

key-decisions:
  - "Migration file renamed from auto-generated 0003_solid_magdalene.sql to 0003_soul_system_foundation.sql; journal tag updated to match — drizzle-kit tracks by tag in journal, not by filesystem name"
  - "pgvector CREATE EXTENSION manually prepended as first statement rather than relying on drizzle-kit to generate it — drizzle-kit does not know to emit extension creation, so manual prepend is the correct approach"
  - "Seed script idempotency guard checks count >= 6 (not == 0) to tolerate partial states where some archetypes were inserted before a failure"
  - "Each archetype's constitutionDirectives is stored as both a JSONB array column and appears verbatim in the SOUL.md content under the Constitution section — single source of truth for the inviolable directives"
  - "Archetype SOUL.md content is complete markdown documents (not just field summaries) so Phase 9 can inject them directly as system prompt prefixes without further templating"

patterns-established:
  - "Pattern: Seed scripts import 'dotenv/config' as first line, then db and schema, then node:crypto for hashing — consistent seed preamble"
  - "Pattern: Archetype content defined as module-level const strings, dimensions as typed objects, directives as typed string arrays — all grouped per archetype before the seed() function"
  - "Pattern: COMMENT ON TABLE for TTL policies embeds the policy directly in the database so it is visible via psql \\d+ without consulting code"

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 8 Plan 02: Migration and Archetype Seed Summary

**Drizzle migration 0003_soul_system_foundation.sql with pgvector extension + 4 new SOUL System tables, and idempotent seed script seeding 6 canonical archetype souls (Cautious Verifier, Aggressive Executor, Creative Synthesizer, Structured Analyst, Collaborative Integrator, Balanced Pragmatist)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T07:09:11Z
- **Completed:** 2026-02-21T07:12:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Generated Drizzle migration from Phase 8 Plan 01 schema changes; prepended CREATE EXTENSION IF NOT EXISTS vector; renamed to 0003_soul_system_foundation.sql; added COMMENT ON TABLE for TTL policy; verified zero destructive statements
- Created idempotent seed script with 6 canonical archetype soul templates, each with full SOUL.md markdown, SHA-256 content hash, 7-dimension JSONB, and constitution directives array
- TypeScript compiles cleanly (zero errors) across all new code

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate Drizzle migration and prepend pgvector extension** - `95198f4` (feat)
2. **Task 2: Create idempotent archetype seed script with 6 canonical soul templates** - `ce20776` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/db/migrations/0003_soul_system_foundation.sql` - DDL for 4 new tables (bot_souls, council_verdicts, decision_traces, negative_signal_register), 2 new enums, additive nullable columns on bots/executions/dna_store, 17 indexes, pgvector extension, TTL comment
- `packages/db/migrations/meta/0003_snapshot.json` - Drizzle-kit schema snapshot for migration 0003
- `packages/db/migrations/meta/_journal.json` - Updated tag from 0003_solid_magdalene to 0003_soul_system_foundation
- `packages/db/src/seed/archetypes.ts` - Idempotent seed script for 6 canonical archetype souls

## Decisions Made

- Migration file renamed from drizzle-kit's auto-generated name `0003_solid_magdalene.sql` to `0003_soul_system_foundation.sql` with the journal tag updated to match. Drizzle-kit tracks migrations by tag in the `_journal.json`, so the rename is fully safe — the snapshot file (`0003_snapshot.json`) is indexed numerically and is unaffected.
- pgvector extension statement manually prepended as the first statement in the migration. Drizzle-kit does not know to emit `CREATE EXTENSION` statements — it only generates DDL for schema objects it manages. Manual prepend is the standard approach and is idempotent.
- Seed script idempotency guard uses `count >= 6` rather than `count == 0`. This tolerates partial seed states (e.g., if a previous run inserted 3 archetypes and then failed) — re-running after a partial failure would insert duplicates with an `== 0` guard but correctly skips with a `>= 6` guard.
- All 6 archetype SOUL.md documents are full markdown with all required sections. Phase 9 can inject the `soulContent` field directly as a system prompt prefix without additional templating.

## Deviations from Plan

None — plan executed exactly as written. The file rename (from drizzle-kit's auto-name to `0003_soul_system_foundation.sql`) was specified in the plan's Step 5 and is not a deviation.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The migration SQL file is ready but must be applied separately when pgvector is confirmed enabled on Cloud SQL (existing Phase 8 blocker in STATE.md).

```bash
# Apply when pgvector is confirmed:
# First verify pgvector is enabled: psql -c '\dx'
# Then apply: cd packages/db && npx drizzle-kit migrate

# Run seed after migration:
# cd packages/db && npx tsx src/seed/archetypes.ts
```

## Next Phase Readiness

- Migration SQL is ready to apply when Cloud SQL pgvector extension is confirmed enabled (existing STATE.md blocker)
- Seed script is ready to run immediately after migration applies
- Phase 9 (soul generation) can import from `@claw/db` schema and use `bot_souls` table; archetypes will be available as the initial population library after seed runs
- No additional schema work required before Phase 9

## Self-Check: PASSED

Files verified:
- packages/db/migrations/0003_soul_system_foundation.sql: FOUND
- packages/db/migrations/meta/0003_snapshot.json: FOUND
- packages/db/migrations/meta/_journal.json: FOUND (tag updated)
- packages/db/src/seed/archetypes.ts: FOUND

Commits verified:
- 95198f4: feat(08-02): generate Drizzle migration 0003 for SOUL System foundation
- ce20776: feat(08-02): create idempotent archetype seed script with 6 canonical soul templates

TypeScript compile: DB package — PASS (zero errors).
Migration validation: CREATE EXTENSION present, 4 CREATE TABLE, 2 CREATE TYPE, 5 ALTER TABLE ADD COLUMN, 17 CREATE INDEX, 1 COMMENT ON TABLE, 0 DROP statements.
Seed validation: 6 archetypes, idempotency guard present.

---
*Phase: 08-database-schema-and-shared-types*
*Completed: 2026-02-21*
