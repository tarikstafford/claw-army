# Phase 8: Database Schema and Shared Types - Research

**Researched:** 2026-02-21
**Domain:** Drizzle ORM schema extensions, pgvector on Cloud SQL, TypeScript shared types, database seeding
**Confidence:** HIGH — all critical claims verified against official docs and the installed library version

---

## Summary

Phase 8 lays the persistent foundation for the entire v2.0 SOUL System. It is a pure schema and types phase — no runtime logic, no queues, no API routes. The output is: 4 new tables, additive columns on 3 existing tables, 2 new TypeScript types exported from `packages/shared-types`, and a seed script that populates the archetype library.

The current `packages/db` package runs drizzle-orm 0.45.1 with drizzle-kit 0.31.9. This version has native built-in support for pgvector column types (`vector`, `halfvec`, `sparsevec`, `bit`) exported directly from `drizzle-orm/pg-core` — no additional npm package is required. Cloud SQL for PostgreSQL supports pgvector (version 0.8.0+ on PostgreSQL 13+). The pgvector extension must be confirmed enabled with `CREATE EXTENSION IF NOT EXISTS vector` before the migration runs — this is the phase blocker noted in prior decisions.

The `decision_traces` table warrants careful design because DTRC-03 specifies a 90-day TTL archival policy before the table reaches 5M rows. The migration must include a schema comment documenting this policy. No TTL enforcement is automated in Phase 8 — just documentation in the schema. Phase 8 does not need soul embeddings for similarity search (that is Phase 9's SGEN-04 concern), but the `bot_souls` table should include an `embedding` column with a nullable vector type so Phase 9 can populate it without another migration.

The monorepo's internal packages strategy (source files as entrypoints, no build step) is already established and working. Adding `SoulDocument` and `VerdictType` to `packages/shared-types` follows the exact same pattern as existing types (`Bot`, `Execution`, `Task`, `BillingEvent`).

**Primary recommendation:** Run the pgvector confirmation check first. Then: (1) author the 4 new Drizzle schema files, (2) add additive columns to existing schema files, (3) generate and apply the migration, (4) add shared types to `packages/shared-types`, (5) write and run the seed script.

---

## Existing State Audit

### Currently Deployed Tables (migration 0002)

| Table | Key Columns Relevant to Phase 8 |
|-------|--------------------------------|
| `bots` | `id`, `execution_id`, `status`, `composite_score`, `tier` — needs `soul_id` additive column |
| `executions` | `id`, `status`, `objective` — needs `task_category` additive column |
| `dna_store` | `id`, `bot_id`, `execution_id`, `version`, `dna_payload` — needs `soul_id`, `parent_soul_ids`, `mutation_lineage` additive columns |

### Existing Schema File Locations

```
packages/db/src/schema/
├── bots.ts            # bots table + botStatusEnum
├── executions.ts      # executions table + executionStatusEnum
├── dna-store.ts       # dna_store table + DnaPayload interface
├── tasks.ts           # tasks table
├── billing-events.ts  # billing_events table
├── telemetry.ts       # telemetry table
├── tool-invocations.ts # tool_invocations table
└── index.ts           # re-exports all tables
```

### Existing Shared Types File Locations

```
packages/shared-types/src/
├── common.ts     # UUID, Cents, ISOTimestamp branded types
├── bot.ts        # Bot, BotStatus, BOT_STATUSES, NewBot
├── execution.ts  # Execution, ExecutionStatus, EXECUTION_STATUSES, NewExecution
├── task.ts       # Task, TaskStatus, TASK_STATUSES, NewTask
├── billing.ts    # BillingEvent, BillingEventType, PerformanceTier, DnaPayload
└── index.ts      # re-exports all
```

---

## Standard Stack

### Core (already in project — no new installs needed for schema/types work)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Schema definition, query builder, vector column types | Already installed; 0.45.1 includes `vector` type from `drizzle-orm/pg-core` |
| drizzle-kit | 0.31.9 | Migration generation (`drizzle-kit generate`) and application (`drizzle-kit migrate`) | Already installed; standard generate+migrate workflow |
| pg (node-postgres) | ^8.18.0 | PostgreSQL driver | Already installed |
| typescript | ^5.9.3 | Type checking | Already installed |

### Supporting (seed script only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.19.0 | Execute TypeScript seed scripts without a compile step | Run `tsx packages/db/src/seed/archetypes.ts` |
| dotenv | ^16.4.0 | Load DATABASE_URL for seed script | Already installed in `packages/db` |

### New installs: NONE required

The drizzle-orm 0.45.1 version installed in the project already exports `vector` from `drizzle-orm/pg-core`. Confirmed by inspecting:

```
packages/db/node_modules/drizzle-orm/pg-core/columns/index.d.ts
→ export * from "./vector_extension/vector.js";
→ export * from "./vector_extension/halfvec.js";
→ export * from "./vector_extension/sparsevec.js";
→ export * from "./vector_extension/bit.js";
```

---

## Architecture Patterns

### Recommended Structure for New Schema Files

```
packages/db/src/
├── schema/
│   ├── bots.ts              # MODIFY: add soul_id FK
│   ├── executions.ts        # MODIFY: add task_category column
│   ├── dna-store.ts         # MODIFY: add soul_id, parent_soul_ids, mutation_lineage columns
│   ├── bot-souls.ts         # NEW: bot_souls table (archetype library + per-bot souls)
│   ├── decision-traces.ts   # NEW: decision_traces table (90-day TTL policy documented)
│   ├── council-verdicts.ts  # NEW: council_verdicts table
│   ├── negative-signal-register.ts  # NEW: negative_signal_register table
│   └── index.ts             # MODIFY: add 4 new exports
├── seed/
│   └── archetypes.ts        # NEW: seed script for 6+ canonical archetype souls
└── client.ts                # no change needed
```

```
packages/shared-types/src/
├── common.ts     # no change
├── bot.ts        # no change (soul_id is a DB concern; shared type for Bot is already sufficient)
├── execution.ts  # no change
├── task.ts       # no change
├── billing.ts    # no change
├── soul.ts       # NEW: SoulDocument, VerdictType, SoulDimension, SoulArchetype
└── index.ts      # MODIFY: add export * from './soul'
```

### Pattern 1: New Table — `bot_souls`

**What:** Stores both archetype library records (static templates) and per-bot soul documents generated from them. Distinguished by `is_archetype` boolean.

**Key design decisions:**
- `soul_content` as `text` (the full SOUL.md markdown string)
- `content_hash` as `varchar(64)` (SHA-256 hex digest) for lineage tracing (SOUL-03)
- `generation` as `integer` starting at 1, incremented on each mutation (SOUL-03)
- `parent_soul_id` as nullable UUID FK to `bot_souls.id` for mutation lineage
- `embedding` as nullable `vector(1536)` — populated by Phase 9 when cosine similarity checks run (SGEN-04). Including the column now avoids a future migration.
- `archetype_name` as nullable `varchar(100)` — set for library archetypes, null for bot-specific souls
- `is_archetype` as `boolean` — true for the 6+ canonical templates seeded in this phase

```typescript
// Source: drizzle-orm/pg-core official docs + local column inspection
import {
  pgTable, uuid, text, varchar, integer, boolean, jsonb, timestamp, index, vector
} from 'drizzle-orm/pg-core';

export const botSouls = pgTable(
  'bot_souls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    isArchetype: boolean('is_archetype').notNull().default(false),
    archetypeName: varchar('archetype_name', { length: 100 }),
    botId: uuid('bot_id'),          // null for archetypes
    executionId: uuid('execution_id'), // null for archetypes
    taskCategory: varchar('task_category', { length: 255 }),
    soulContent: text('soul_content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    generation: integer('generation').notNull().default(1),
    parentSoulId: uuid('parent_soul_id'),  // self-reference, nullable
    dimensions: jsonb('dimensions').notNull(), // 7-dimension breakdown as JSONB
    constitutionDirectives: jsonb('constitution_directives').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }), // nullable; populated in Phase 9
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('bot_souls_is_archetype_idx').on(t.isArchetype),
    index('bot_souls_bot_id_idx').on(t.botId),
    index('bot_souls_task_category_idx').on(t.taskCategory),
    index('bot_souls_content_hash_idx').on(t.contentHash),
    index('bot_souls_parent_soul_id_idx').on(t.parentSoulId),
  ],
);
```

**Note on self-referencing FK:** Drizzle supports self-referencing FKs. Use `references(() => botSouls.id)` on `parentSoulId`. Since archetypes have no parent, this must be nullable.

### Pattern 2: New Table — `decision_traces`

**What:** Per-agent per-execution decision attribution records. Designed for high write volume and a 90-day archival policy.

**Key design decisions:**
- `decision_type` as `varchar(50)` (values: `tool_call`, `reasoning_branch`, `output_step`) — not an enum to allow future addition without migration
- `directive_referenced` as `text` (the soul directive text that drove this decision)
- `attribution_confidence` as `numeric(4,3)` (0.000–1.000)
- `outcome` as `varchar(50)` (values: `success`, `failure`, `partial`)
- TTL policy: documented in a PG COMMENT on the table; no automated cleanup in Phase 8
- 5M row threshold noted in schema comment

```typescript
// Source: drizzle-orm/pg-core docs
import {
  pgTable, uuid, varchar, text, numeric, timestamp, index
} from 'drizzle-orm/pg-core';

/**
 * Stores per-agent per-execution decision attribution records.
 *
 * TTL POLICY: Records older than 90 days are eligible for archival.
 * Archival is triggered before this table reaches 5,000,000 rows.
 * A scheduled Cloud Scheduler job or Drizzle-driven cleanup script handles archival.
 * Phase 8 documents this policy; Phase 10 implements the archival mechanism.
 */
export const decisionTraces = pgTable(
  'decision_traces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id').notNull(),
    soulId: uuid('soul_id'),  // nullable; FK to bot_souls when Phase 9 populates souls
    decisionId: uuid('decision_id').notNull(), // caller-generated, idempotent
    decisionType: varchar('decision_type', { length: 50 }).notNull(), // tool_call | reasoning_branch | output_step
    directiveReferenced: text('directive_referenced'),
    attributionConfidence: numeric('attribution_confidence', { precision: 4, scale: 3 }),
    outcome: varchar('outcome', { length: 50 }),
    metadata: jsonb('metadata'),
    decidedAt: timestamp('decided_at', { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('decision_traces_execution_id_idx').on(t.executionId),
    index('decision_traces_bot_id_idx').on(t.botId),
    index('decision_traces_soul_id_idx').on(t.soulId),
    index('decision_traces_decided_at_idx').on(t.decidedAt),  // needed for TTL archival queries
  ],
);
```

### Pattern 3: New Table — `council_verdicts`

**What:** One row per agent per execution per Council evaluation cycle. Stores the weighted verdict, three judge outputs, and human confirmation state.

**Key design decisions:**
- `verdict_type` as a pgEnum with 5 values: `Promote`, `Maintain`, `Monitor`, `Demote`, `Retire`
- `status` as a pgEnum: `pending`, `confirmed`, `rejected` — used for God Layer idempotency (GODL-01 requires atomic state transition)
- Three jsonb columns for individual judge outputs (one per judge) to preserve full outputs while enabling the weighted aggregate
- `requires_human_confirmation` boolean — true for `Promote` and `Retire` verdicts
- `confirmed_at` nullable timestamp — set when operator calls `POST /verdicts/:verdictId/confirm`
- `confirmed_by` nullable varchar — the user ID of the confirming operator

```typescript
import { pgTable, uuid, varchar, numeric, boolean, text, jsonb, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';

export const verdictTypeEnum = pgEnum('verdict_type', [
  'Promote', 'Maintain', 'Monitor', 'Demote', 'Retire',
]);

export const verdictStatusEnum = pgEnum('verdict_status', [
  'pending', 'confirmed', 'rejected',
]);

export const councilVerdicts = pgTable(
  'council_verdicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id').notNull(),
    soulId: uuid('soul_id'),
    verdictType: verdictTypeEnum('verdict_type').notNull(),
    status: verdictStatusEnum('status').notNull().default('pending'),
    weightedConfidenceScore: numeric('weighted_confidence_score', { precision: 4, scale: 3 }).notNull(),
    requiresHumanConfirmation: boolean('requires_human_confirmation').notNull().default(false),
    hasUnresolvedDevilsAdvocate: boolean('has_unresolved_devils_advocate').notNull().default(false),
    verdictSummary: text('verdict_summary').notNull(),
    performanceJudgeOutput: jsonb('performance_judge_output'),
    soulAnalystOutput: jsonb('soul_analyst_output'),
    devilsAdvocateOutput: jsonb('devils_advocate_output'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, precision: 3 }),
    confirmedBy: varchar('confirmed_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('council_verdicts_execution_id_idx').on(t.executionId),
    index('council_verdicts_bot_id_idx').on(t.botId),
    index('council_verdicts_verdict_type_idx').on(t.verdictType),
    index('council_verdicts_status_idx').on(t.status),
    index('council_verdicts_requires_human_idx').on(t.requiresHumanConfirmation),
  ],
);
```

### Pattern 4: New Table — `negative_signal_register`

**What:** Preserves souls from retired/catastrophically failed agents as negative signal for future mutation (GODL-05). The mutation algorithm in Phase 13 will query this to identify bad directive patterns.

**Key design decisions:**
- `soul_id` FK to `bot_souls` (the preserved soul document)
- `failure_type` as `varchar(50)`: `retirement`, `budget_overrun`, `guardrail_violation`, `quality_floor_breach`
- `directive_failure_summary` as `text` (human-readable)
- `mutation_blacklist` as `jsonb` (directive patterns to avoid — populated by God Layer in Phase 13)

```typescript
export const negativeSignalRegister = pgTable(
  'negative_signal_register',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    soulId: uuid('soul_id').notNull().references(() => botSouls.id),
    botId: uuid('bot_id').notNull(),
    executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'set null' }),
    failureType: varchar('failure_type', { length: 50 }).notNull(),
    directiveFailureSummary: text('directive_failure_summary'),
    mutationBlacklist: jsonb('mutation_blacklist'),  // populated in Phase 13
    registeredAt: timestamp('registered_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('negative_signal_soul_id_idx').on(t.soulId),
    index('negative_signal_failure_type_idx').on(t.failureType),
    index('negative_signal_registered_at_idx').on(t.registeredAt),
  ],
);
```

### Pattern 5: Additive Columns on Existing Tables

All new columns must be nullable (no default, or default provided) to avoid touching existing rows.

**`bots` table additions:**
- `soul_id: uuid('soul_id')` — nullable FK to `bot_souls.id`; set during soul dispatch (Phase 9)

**`executions` table additions:**
- `task_category: varchar('task_category', { length: 255 })` — nullable; derived from objective for soul seeding (Phase 9)

**`dna_store` table additions:**
- `soul_id: uuid('soul_id')` — nullable FK to `bot_souls.id`; links DNA capture to source soul
- `parent_soul_ids: uuid('parent_soul_ids').array()` — nullable; mutation lineage parent IDs (Phase 13)
- `mutation_lineage: jsonb('mutation_lineage')` — nullable; operations applied from parent (Phase 13)

### Pattern 6: pgvector Extension Confirmation (Pre-Migration Blocker)

Before running the migration, pgvector must be confirmed enabled on the Cloud SQL instance. This is a one-time manual step or can be included as the first statement in a custom migration file.

**Confirmation method:**
```bash
# SSH into claw-app-dev and run psql
gcloud compute ssh claw-app-dev --zone=us-central1-a \
  --command="psql \"\$DATABASE_URL\" -c \"SELECT name, installed_version FROM pg_available_extensions WHERE name = 'vector';\""
```

**Enable if not already active:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**In Drizzle migration:** The safest approach is to use a custom migration file (created with `--custom` flag to drizzle-kit generate) that includes `CREATE EXTENSION IF NOT EXISTS vector;` as the first statement before the table DDL. This makes the migration idempotent and self-documenting.

### Pattern 7: Archetype Seed Script

The 6+ canonical archetypes must be seeded as `is_archetype = true` rows in `bot_souls`. This is a one-time seed, not a migration — it should be a standalone script run after migration.

**Archetype definitions:**
The seed must include these 6 canonical archetypes:
1. **Cautious Verifier** — Risk-averse, validates before acting, prefers reversible actions
2. **Aggressive Executor** — Speed-first, accepts higher risk for throughput, optimistic about recovery
3. **Creative Synthesizer** — Novel approaches, cross-domain reasoning, tolerates ambiguity
4. **Structured Analyst** — Methodical, exhaustive analysis before action, documentation-heavy
5. **Collaborative Integrator** — Consensus-seeking, defers to other agents where possible, coordination-heavy
6. At least one variant (e.g., **Balanced Pragmatist** or **Adaptive Generalist**)

Each archetype soul must have:
- `soul_content`: Full SOUL.md markdown with all 7 behavioral dimensions
- `content_hash`: SHA-256 of `soul_content`
- `generation: 1` (initial)
- `dimensions`: JSONB with 7 fields matching `SoulDimension` type
- `constitution_directives`: JSONB array of inviolable directives
- `is_archetype: true`
- `archetype_name`: The archetype name string

**Seed script structure:**
```typescript
// packages/db/src/seed/archetypes.ts
import 'dotenv/config';
import { db } from '../client';
import { botSouls } from '../schema/bot-souls';
import { createHash } from 'node:crypto';

// Check if archetypes already exist before inserting (idempotent)
const existing = await db.select({ count: ... }).from(botSouls).where(eq(botSouls.isArchetype, true));
if (existing[0].count >= 6) {
  console.log('Archetypes already seeded, skipping');
  process.exit(0);
}

// Insert all 6+ archetypes...
```

**Run command:**
```bash
cd packages/db && npx tsx src/seed/archetypes.ts
```

### Pattern 8: SoulDocument and VerdictType Shared Types

Following the existing pattern in `packages/shared-types` — pure TypeScript interfaces with no Drizzle dependency.

```typescript
// packages/shared-types/src/soul.ts

/** The 7 behavioral dimensions of a SOUL document (SOUL-01) */
export interface SoulDimension {
  identityRole: string;          // dimension 1: who the agent is
  decisionPriorities: string;    // dimension 2: ranked order of decision drivers
  toolUsageDoctrine: string;     // dimension 3: how and when to use tools
  riskTolerance: string;         // dimension 4: appetite for reversible vs. irreversible actions
  communicationStyle: string;    // dimension 5: how the agent reports progress and asks for help
  recoveryBehavior: string;      // dimension 6: what to do when tasks fail
  ethicalHardStops: string;      // dimension 7: inviolable lines that are never mutated away
}

/**
 * Full SOUL document for a bot (SOUL-01, SOUL-03).
 * Mirrors bot_souls table but without Drizzle dependency.
 */
export interface SoulDocument {
  id: UUID;
  isArchetype: boolean;
  archetypeName: string | null;
  botId: UUID | null;
  executionId: UUID | null;
  taskCategory: string | null;
  soulContent: string;           // full SOUL.md markdown text
  contentHash: string;           // SHA-256 hex digest of soulContent (SOUL-03)
  generation: number;            // mutation generation counter, starts at 1 (SOUL-03)
  parentSoulId: UUID | null;     // immediate parent for lineage tracing (SOUL-03)
  dimensions: SoulDimension;     // 7 behavioral dimensions
  constitutionDirectives: string[]; // inviolable directives (SOUL-01)
  createdAt: ISOTimestamp;
}

/** The 5 verdict types the Council can issue (CNCL-06) */
export type VerdictType = 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';

/** Runtime-iterable array of all verdict types */
export const VERDICT_TYPES: readonly VerdictType[] = [
  'Promote', 'Maintain', 'Monitor', 'Demote', 'Retire',
] as const;

/** Archetype soul template (SOUL-04) */
export interface SoulArchetype {
  name: string;
  description: string;
  defaultDimensions: SoulDimension;
  defaultConstitutionDirectives: string[];
}
```

### Anti-Patterns to Avoid

- **Adding NOT NULL columns without defaults to existing tables:** Any new column on `bots`, `executions`, or `dna_store` that is NOT NULL without a default will fail the migration against the live Cloud SQL instance (existing rows have no value). All Phase 8 additive columns must be nullable or have a safe default.
- **Using `drizzle-kit push` instead of `generate + migrate`:** The live Cloud SQL instance is a production-grade database. Push is never used. Always generate a migration file, inspect it, then apply.
- **Running `drizzle-kit generate` without confirming pgvector extension first:** If pgvector is not enabled and the schema includes a `vector()` column, the migration will fail at `CREATE TABLE` time. The extension must be enabled before the migration runs.
- **Circular FK references between new tables:** `bot_souls.parent_soul_id` is a self-reference (allowed by Drizzle). `decision_traces.soul_id` and `bots.soul_id` reference `bot_souls` — acceptable. Avoid making `bot_souls` reference `bots` — this would create a circular dependency.
- **Storing embeddings in Phase 8:** The `embedding` column in `bot_souls` should be nullable and left unpopulated in Phase 8. Phase 9 populates it when souls are generated. Do not write embedding generation code in this phase.
- **Duplicating SoulDocument in both `@claw/db` and `@claw/shared-types`:** The pattern established in Phase 1 keeps pure TypeScript interfaces in `shared-types` and Drizzle-specific types (`$inferSelect`) in `@claw/db`. Follow this separation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 content hash for soul documents | Custom hashing function | `node:crypto` `createHash('sha256')` | Built-in, no deps, deterministic |
| Vector column definition | Raw SQL `customType` | `vector()` from `drizzle-orm/pg-core` | Already exported in drizzle-orm 0.45.1; native HNSW/IVFFlat index support |
| Migration with `CREATE EXTENSION` | Separate psql script | Custom Drizzle migration file (drizzle-kit generate --custom) | Keeps extension activation in migration history; idempotent with `IF NOT EXISTS` |
| Archetype seed idempotency | Manual INSERT with ON CONFLICT | Check count before insert OR use `ON CONFLICT DO NOTHING` | Prevents duplicate archetypes on re-runs |
| SoulDocument validation | Custom validator in shared-types | Zod schema (if runtime validation is needed) | `z.infer<typeof soulDocumentSchema>` gives type + runtime validation from one definition; but Phase 8 only needs the TypeScript type — Zod validation is optional |

---

## Common Pitfalls

### Pitfall 1: pgvector Extension Not Enabled

**What goes wrong:** Migration runs and fails at `CREATE TABLE bot_souls` because the `vector` type is not found in PostgreSQL.

**Why it happens:** pgvector requires `CREATE EXTENSION vector` before any `vector` column type can be used. This is a database-level extension, not a table-level concern.

**How to avoid:** Add `CREATE EXTENSION IF NOT EXISTS vector;` as the first statement in the migration. The safest path: create a custom migration file that runs the extension statement before the generated DDL.

**Verification step:** After migration, run `SELECT * FROM pg_extension WHERE extname = 'vector';` — must return a row.

**Warning signs:** Migration error: `ERROR: type "vector" does not exist`.

### Pitfall 2: Additive Column Break on Existing Rows

**What goes wrong:** Adding a `NOT NULL` column without a default to `bots`, `executions`, or `dna_store` fails the migration because existing rows have no value for the new column.

**Why it happens:** PostgreSQL enforces `NOT NULL` constraints at INSERT and at ALTER TABLE (unless a default is specified). Existing rows violate the constraint.

**How to avoid:** All Phase 8 additive columns on existing tables must be nullable (`soul_id uuid`, no `.notNull()`). Alternatively, provide a server default, but null is semantically correct here — existing bots pre-date the SOUL system and legitimately have no soul.

**Verification step:** After migration, `SELECT COUNT(*) FROM bots WHERE soul_id IS NULL` must equal the pre-migration bot count.

### Pitfall 3: drizzle-kit generate Sees Old Enums

**What goes wrong:** drizzle-kit generate tries to recreate the `bot_status` or `execution_status` enums because it detects drift between the schema file and the migration snapshot. This happens if the schema files are modified carelessly.

**Why it happens:** Drizzle-kit compares the current schema against the snapshot in `migrations/meta/`. If an existing enum or table definition is accidentally modified (not just additive columns added), the generator will try to alter or recreate the type.

**How to avoid:** When adding columns to existing schema files (`bots.ts`, `executions.ts`, `dna-store.ts`), only ADD new column definitions. Do not touch existing column definitions, enum values, or index definitions. Review the generated SQL before running migrate — it should contain only `ALTER TABLE ... ADD COLUMN` statements, no `ALTER TYPE` or `DROP TABLE`.

**Verification step:** The generated migration SQL should contain ZERO `DROP`, `ALTER TYPE`, or `RECREATE` statements.

### Pitfall 4: Self-Referencing FK in Drizzle

**What goes wrong:** `parent_soul_id` referencing `bot_souls.id` causes a TypeScript error at schema definition time because `botSouls` is referenced before it's defined.

**Why it happens:** If `references(() => botSouls.id)` is called in the column definition and `botSouls` is defined in the same expression, JavaScript hoisting issues can arise.

**How to avoid:** Drizzle handles self-referencing FKs correctly when using arrow-function lazy references (`references(() => botSouls.id)`). The table must be fully declared before the reference is evaluated (which it is, since the arrow function is called lazily). This is the standard pattern. If a TypeScript error appears, declare the `botSouls` table as `const botSouls = pgTable(...)` and ensure the `parentSoulId` column uses the lazy reference form.

### Pitfall 5: Seed Script Not Idempotent

**What goes wrong:** Running the archetype seed script twice inserts 12 archetype rows instead of 6.

**Why it happens:** Naive `db.insert().values([...])` without conflict handling will insert duplicates if run multiple times.

**How to avoid:** Check whether archetypes already exist before inserting, or use `db.insert(botSouls).values(archetypes).onConflictDoNothing()`. The recommended approach is a count check: if `is_archetype = true` count >= 6, exit early.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Drizzle vector Column Type (drizzle-orm 0.45.1)

```typescript
// Source: packages/db/node_modules/drizzle-orm/pg-core/columns/index.d.ts
// + https://orm.drizzle.team/docs/guides/vector-similarity-search
import { vector } from 'drizzle-orm/pg-core';

// In pgTable definition:
embedding: vector('embedding', { dimensions: 1536 }),  // nullable by default
```

### HNSW Index on vector Column

```typescript
// Source: https://orm.drizzle.team/docs/guides/vector-similarity-search
import { index } from 'drizzle-orm/pg-core';

// In pgTable index array:
index('bot_souls_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
```

### Adding Nullable FK Column to Existing Table

```typescript
// Pattern established in migration 0002 (bots.composite_score, bots.tier)
// Following the same additive-only pattern:
soulId: uuid('soul_id'),  // no .notNull() — nullable FK for existing rows
```

The generated SQL will be:
```sql
ALTER TABLE "bots" ADD COLUMN "soul_id" uuid;
```

### Custom Migration File with pgvector Extension

```bash
# Generate an empty custom migration file
cd packages/db && npx drizzle-kit generate --custom
# Name it: 0003_soul_system_foundation.sql
```

Then manually edit the generated file to prepend:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
```

### pgEnum for VerdictType (Drizzle)

```typescript
// Source: existing pattern in packages/db/src/schema/bots.ts (botStatusEnum)
import { pgEnum } from 'drizzle-orm/pg-core';

export const verdictTypeEnum = pgEnum('verdict_type', [
  'Promote', 'Maintain', 'Monitor', 'Demote', 'Retire',
]);

export const verdictStatusEnum = pgEnum('verdict_status', [
  'pending', 'confirmed', 'rejected',
]);
```

### Content Hash Computation (Node.js built-in)

```typescript
import { createHash } from 'node:crypto';

function computeSoulHash(soulContent: string): string {
  return createHash('sha256').update(soulContent, 'utf8').digest('hex');
}
```

### Archetype Seed Pattern (Idempotent)

```typescript
// packages/db/src/seed/archetypes.ts
import 'dotenv/config';
import { db } from '../client';
import { botSouls } from '../schema/bot-souls';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

function hash(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function seed() {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(botSouls)
    .where(eq(botSouls.isArchetype, true));

  if (count >= 6) {
    console.log('[seed] Archetypes already seeded:', count);
    process.exit(0);
  }

  const archetypes = [/* 6+ archetype objects */];
  await db.insert(botSouls).values(archetypes);
  console.log('[seed] Seeded', archetypes.length, 'archetypes');
}

seed().catch(console.error).finally(() => process.exit(0));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External `pgvector` npm package needed | `vector()` built into `drizzle-orm/pg-core` | drizzle-orm 0.31.0 (2024) | No additional package install; column type is first-class in Drizzle |
| Manual SHA-256 with external `crypto` package | `node:crypto` built-in | Node.js 15+ | No install needed for content hashing |

---

## Open Questions

1. **pgvector extension status on the live Cloud SQL instance**
   - What we know: Cloud SQL for PostgreSQL 13+ supports pgvector 0.8.0. Prior decisions flag this as a blocker for Phase 8.
   - What's unclear: Whether `CREATE EXTENSION vector` has already been run on the `claw-army` Cloud SQL instance.
   - Recommendation: Run the verification query as the first task in Phase 8 planning. If not enabled, include `CREATE EXTENSION IF NOT EXISTS vector;` in the custom migration file.
   - Verification command: `gcloud compute ssh claw-app-dev --zone=us-central1-a --command="psql \"\$DATABASE_URL\" -c \"SELECT name, installed_version FROM pg_available_extensions WHERE name = 'vector';\"`

2. **Embedding dimensions for soul similarity search**
   - What we know: Phase 9 (SGEN-04) uses cosine similarity for soul differentiation. The embedding must be populated during Phase 9 soul generation. The `embedding` column should be included in Phase 8 with nullable and correct dimensions.
   - What's unclear: Which embedding model will be used in Phase 9 (determines the dimensions value). OpenAI `text-embedding-3-small` uses 1536 dimensions; `text-embedding-3-large` supports up to 3072; Gemini `embedding-001` uses 768.
   - Recommendation: Use 1536 dimensions as the default for the Phase 8 column definition. This is the most common embedding size and works with all major providers at base quality. Phase 9 can clarify if a different model is chosen — but changing dimensions requires dropping and recreating the column, which is not additive. 1536 is the safest choice.

3. **SOUL.md markdown schema structure for the 7 dimensions**
   - What we know: SOUL-01 specifies 7 behavioral dimensions. The archetype seed needs to write real SOUL.md content for all 6+ archetypes.
   - What's unclear: Whether there is an existing SOUL.md format specification document (not found in the codebase).
   - Recommendation: Define the SOUL.md format as part of Phase 8's work — a markdown template with 7 H2 sections (## Identity and Role, ## Decision Priorities, etc.). The planner should create a task to define and document this format before writing archetype content.

4. **`bot_souls` population timing for bot-specific souls**
   - What we know: `bot_souls` rows are populated by Phase 9 (soul generation). Phase 8 only seeds archetypes.
   - What's unclear: Whether `bots.soul_id` FK should be included in Phase 8 migration or deferred to Phase 9.
   - Recommendation: Include `bots.soul_id` as a nullable additive column in Phase 8. This is an additive-only change (no existing row impact) and keeps the DB schema complete for Phase 8's stated goal: "all persistent structures for the SOUL System exist in the database."

---

## Sources

### Primary (HIGH confidence)

- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/node_modules/drizzle-orm/pg-core/columns/index.d.ts` — Confirms `vector`, `halfvec`, `sparsevec`, `bit` exported from drizzle-orm/pg-core in version 0.45.1 (directly inspected)
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.d.ts` — Confirms `vector(name, { dimensions: number })` API (directly inspected)
- https://orm.drizzle.team/docs/guides/vector-similarity-search — Full pgvector setup guide with drizzle-orm; HNSW index pattern
- https://orm.drizzle.team/docs/extensions/pg — Drizzle PostgreSQL extensions documentation
- https://docs.cloud.google.com/sql/docs/postgres/extensions — Cloud SQL pgvector support: PostgreSQL 13+ supports pgvector 0.8.0; `CREATE EXTENSION vector` is the activation command
- Existing schema files (directly read): `bots.ts`, `executions.ts`, `dna-store.ts`, `tasks.ts` — establishes patterns for pgTable, pgEnum, index, FK references, additive-only column migrations

### Secondary (MEDIUM confidence)

- `packages/db/migrations/meta/0002_snapshot.json` (directly read) — Complete list of all current table/column names; used for additive-column gap analysis
- `packages/db/migrations/0002_melted_black_widow.sql` (directly read) — Confirms the `ALTER TABLE ... ADD COLUMN` pattern for additive migrations
- `packages/shared-types/src/*.ts` (all read) — Establishes the pure-TypeScript-interface pattern for shared types

### Tertiary (LOW confidence — validate before acting)

- Embedding dimensions recommendation (1536): Derived from common practice for OpenAI text-embedding models. The actual model choice for Phase 9 is not yet specified. Flag for validation when Phase 9 research runs.

---

## Metadata

**Confidence breakdown:**
- Standard stack (Drizzle version, vector column API): HIGH — directly inspected installed node_modules
- Architecture patterns (new tables, additive columns): HIGH — based on official Drizzle docs and existing schema patterns
- pgvector on Cloud SQL: HIGH — official Cloud SQL extensions docs confirm support; activation command verified
- Archetype content (7 dimensions, constitution directives): MEDIUM — SOUL-01 specifies the structure; exact content is Phase 8 implementation work
- Embedding dimensions (1536): MEDIUM — common default; the actual Phase 9 model choice may differ

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days — Drizzle 0.45.x is stable; Cloud SQL pgvector support is GA)
