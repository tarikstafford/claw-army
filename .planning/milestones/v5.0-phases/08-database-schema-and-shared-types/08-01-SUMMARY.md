---
phase: 08-database-schema-and-shared-types
plan: 01
subsystem: database
tags: [drizzle-orm, pgvector, postgresql, typescript, shared-types, soul-system]

# Dependency graph
requires:
  - phase: 07-google-auth-gate
    provides: completed v1.1 baseline; v2.0 schema builds on existing tables (bots, executions, dna_store)

provides:
  - bot_souls table (archetype library + per-bot souls, self-ref FK, vector(1536) embedding column)
  - decision_traces table (execution attribution, 90-day TTL policy documented)
  - council_verdicts table (verdict_type/status enums, 3 judge JSONB columns, confirmation fields)
  - negative_signal_register table (failure preservation for mutation avoidance)
  - Additive nullable columns on bots (soul_id), executions (task_category), dna_store (soul_id, parent_soul_ids, mutation_lineage)
  - SoulDimension, SoulDocument, VerdictType, VERDICT_TYPES, SoulArchetype types in @claw/shared-types
affects:
  - 09-soul-generation (reads bot_souls, writes soul documents)
  - 10-decision-tracing (writes decision_traces)
  - 11-council-evaluation (writes council_verdicts)
  - 12-confirmation-gate (reads/updates council_verdicts)
  - 13-god-layer-mutation (reads negative_signal_register, updates soul lineage)
  - 14-soul-ui (reads all soul tables)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnyPgColumn import from drizzle-orm/pg-core for self-referencing FK tables (breaks circular type inference)"
    - "Lazy arrow function references(() => table.id) for FK definitions"
    - "Nullable additive columns on existing tables (no notNull, no default) for safe migrations"
    - "Pure TypeScript interfaces in shared-types with no Drizzle dependency"

key-files:
  created:
    - packages/db/src/schema/bot-souls.ts
    - packages/db/src/schema/decision-traces.ts
    - packages/db/src/schema/council-verdicts.ts
    - packages/db/src/schema/negative-signal-register.ts
    - packages/shared-types/src/soul.ts
  modified:
    - packages/db/src/schema/bots.ts
    - packages/db/src/schema/executions.ts
    - packages/db/src/schema/dna-store.ts
    - packages/db/src/schema/index.ts
    - packages/shared-types/src/index.ts

key-decisions:
  - "AnyPgColumn import pattern used for bot_souls self-referencing parentSoulId FK to avoid TypeScript implicit-any error on circular initializer"
  - "council_verdicts.soulId left as bare uuid() with no explicit FK ref (bot_souls imported separately; avoids cross-file dependency in this schema file)"
  - "All additive columns on bots/executions/dna_store are nullable with no defaults — safe for existing rows pre-dating the SOUL system"
  - "varchar import added to executions.ts alongside the new taskCategory column"
  - "decision_traces TTL policy (90 days / 5M row threshold) documented as JSDoc block in schema file; enforcement deferred to Phase 10"

patterns-established:
  - "Pattern: AnyPgColumn for self-referencing FK — import type { AnyPgColumn } from 'drizzle-orm/pg-core' and use references((): AnyPgColumn => table.id)"
  - "Pattern: SOUL System tables use jsonb for structured payloads (dimensions, constitutionDirectives, judgeOutputs, mutationBlacklist)"
  - "Pattern: Shared domain types live in @claw/shared-types with no Drizzle imports; Drizzle inference types ($inferSelect) stay in @claw/db"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 8 Plan 01: Database Schema and Shared Types Summary

**4 new Drizzle schema tables (bot_souls, decision_traces, council_verdicts, negative_signal_register) with vector(1536) embedding, self-ref FK via AnyPgColumn, and 5 SOUL System shared types exported from @claw/shared-types**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T07:03:23Z
- **Completed:** 2026-02-21T07:06:16Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Created 4 new schema files with all columns, indexes, FK references, and $inferSelect/$inferInsert types
- Added additive nullable soul-system columns to 3 existing tables (bots, executions, dna_store) and updated barrel to export 11 tables
- Created SoulDimension, SoulDocument, VerdictType, VERDICT_TYPES, SoulArchetype in packages/shared-types/src/soul.ts with barrel re-export; both packages compile with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 4 new Drizzle schema files for SOUL System tables** - `8937e34` (feat)
2. **Task 2: Add nullable soul-system columns to 3 existing tables and update barrel exports** - `900e925` (feat)
3. **Task 3: Create SoulDocument and VerdictType shared types** - `5e2e2c5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/db/src/schema/bot-souls.ts` - bot_souls table: is_archetype, soul_content, content_hash, generation, parentSoulId self-ref FK (AnyPgColumn), embedding vector(1536), dimensions/constitutionDirectives JSONB
- `packages/db/src/schema/decision-traces.ts` - decision_traces table with execution_id FK cascade, soul_id FK, attribution_confidence numeric(4,3), 90-day TTL / 5M row threshold JSDoc
- `packages/db/src/schema/council-verdicts.ts` - council_verdicts table with verdictTypeEnum (Promote/Maintain/Monitor/Demote/Retire), verdictStatusEnum (pending/confirmed/rejected), 3 judge JSONB columns, confirmation fields
- `packages/db/src/schema/negative-signal-register.ts` - negative_signal_register table with soul_id FK, failure_type, mutation_blacklist JSONB
- `packages/db/src/schema/bots.ts` - additive: soul_id uuid nullable
- `packages/db/src/schema/executions.ts` - additive: task_category varchar(255) nullable; added varchar import
- `packages/db/src/schema/dna-store.ts` - additive: soul_id, parent_soul_ids uuid[], mutation_lineage jsonb (all nullable)
- `packages/db/src/schema/index.ts` - barrel now exports 11 tables (added 4 new SOUL System tables)
- `packages/shared-types/src/soul.ts` - SoulDimension, SoulDocument, VerdictType, VERDICT_TYPES, SoulArchetype
- `packages/shared-types/src/index.ts` - barrel re-exports soul.ts

## Decisions Made

- Used `AnyPgColumn` import from `drizzle-orm/pg-core` for the self-referencing `parentSoulId` FK in bot-souls.ts. Without this, TypeScript reports TS7022 (implicit any) on the `botSouls` initializer because it references itself. The `references((): AnyPgColumn => botSouls.id)` pattern breaks the circular inference correctly.
- Left `council_verdicts.soulId` as a bare `uuid('soul_id')` without an explicit Drizzle FK reference. Importing `botSouls` into `council-verdicts.ts` is not required for the schema to function and would add an unnecessary cross-file dependency in this file.
- All additive columns on existing tables are nullable with no defaults. This is the only safe choice for a live Cloud SQL instance with existing rows that pre-date the SOUL system.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript circular type inference on bot_souls self-referencing FK**
- **Found during:** Task 1 (Create 4 new Drizzle schema files)
- **Issue:** `parentSoulId: uuid('parent_soul_id').references(() => botSouls.id)` caused TS7022 ("'botSouls' implicitly has type 'any'") and TS7024 because TypeScript cannot infer the return type of the lazy FK arrow function when the table is referenced in its own initializer
- **Fix:** Changed to `references((): AnyPgColumn => botSouls.id)` with explicit `AnyPgColumn` return type annotation imported from `drizzle-orm/pg-core`. This is the documented Drizzle pattern for self-referencing tables.
- **Files modified:** packages/db/src/schema/bot-souls.ts
- **Verification:** `tsc --noEmit` on packages/db passes with zero errors
- **Committed in:** 8937e34 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Required fix — the self-referencing FK pattern without explicit return type annotation does not compile under strict TypeScript. No scope creep.

## Issues Encountered

None beyond the self-referencing FK TypeScript error documented above.

## User Setup Required

None - no external service configuration required for schema definition. The migration itself (drizzle-kit generate + migrate) is a separate phase step that requires pgvector extension confirmation first (see Phase 8 blocker in STATE.md).

## Next Phase Readiness

- All persistent structures for the SOUL System are defined in code
- Phase 9 (soul generation) can immediately import from `@claw/db` schema and `@claw/shared-types`
- Migration must be generated and applied before Phase 9 runtime code runs: `cd packages/db && npx drizzle-kit generate && npx drizzle-kit migrate`
- pgvector extension must be confirmed enabled on Cloud SQL before migration (existing blocker in STATE.md)

## Self-Check: PASSED

Files verified:
- packages/db/src/schema/bot-souls.ts: FOUND
- packages/db/src/schema/decision-traces.ts: FOUND
- packages/db/src/schema/council-verdicts.ts: FOUND
- packages/db/src/schema/negative-signal-register.ts: FOUND
- packages/shared-types/src/soul.ts: FOUND

Commits verified:
- 8937e34: feat(08-01): create 4 new Drizzle schema files
- 900e925: feat(08-01): add nullable soul-system columns
- 5e2e2c5: feat(08-01): create SoulDocument, VerdictType shared types

TypeScript compile: DB package — PASS. Shared-types package — PASS.

---
*Phase: 08-database-schema-and-shared-types*
*Completed: 2026-02-21*
