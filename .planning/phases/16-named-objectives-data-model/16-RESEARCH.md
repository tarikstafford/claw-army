# Phase 16: Named Objectives Data Model - Research

**Researched:** 2026-02-22
**Domain:** Drizzle ORM schema extension, Fastify REST endpoints, aggregation queries, shared TypeScript types
**Confidence:** HIGH — all conclusions are grounded in direct inspection of the installed codebase, established schema patterns, and running code

---

## Summary

Phase 16 introduces the `objectives` table as a new first-class entity in the data model, linking zero or more executions to a named, user-defined objective record. The phase has three plan-level deliverables: (1) the DB schema + Drizzle migration, (2) the REST API layer for CRUD on objectives, and (3) linking executions to objectives with aggregation for the OBJ-03 list view.

The codebase already has all scaffolding this phase needs: Drizzle ORM 0.45.1 + drizzle-kit 0.31.9, Fastify 5 with `@fastify/type-provider-typebox` for type-safe routes, a stable migration history at `0008_add_error_message_to_bots.sql`, and a clean pattern for shared types in `packages/shared-types`. No new npm packages are required. The migration naming convention follows a sequential numeric prefix (`0009_...`). Manual migration files (not drizzle-kit generated) have been used throughout this project for additive schema changes and are the correct approach here too.

The most consequential design decision is how to link executions to objectives. The `executions` table currently has no `objective_id` FK. Adding a nullable `objective_id` column to `executions` is the correct approach — it is additive (no impact on existing rows), it enables a simple JOIN for aggregation queries, and it allows executions created outside the objectives flow to continue to work without change. The OBJ-03 aggregation (last-run status, run count, cumulative spend, best bot class) requires a correlated subquery or GROUP BY join across `executions`, `billing_events`, and `agent_classes` — a pattern already established in `billing.ts` and `executions.ts`.

**Primary recommendation:** Follow the existing additive migration pattern. Add `objectives` as a new table, add `objective_id` as a nullable FK on `executions`, implement five Fastify route handlers in a new `objectives.ts` route file, and write the aggregation query in the objectives list handler using the same correlated subquery pattern already used in `/billing/history`.

---

## Existing State Audit

### Currently Deployed Tables (migration 0008)

| Table | Relevant to Phase 16 |
|-------|----------------------|
| `executions` | Needs `objective_id` nullable FK added (additive migration `0009_...`) |
| `billing_events` | Used in OBJ-03 aggregation: `SUM(amount_cents)` WHERE `event_type = 'tool_invoked'` per objective |
| `agent_classes` | Used in OBJ-03 aggregation: MAX class rank per objective's executions |
| `bots` | Used indirectly (bots reference executions; not directly queried for OBJ-03) |

### Current Migration Sequence

```
packages/db/migrations/
├── 0000_misty_iron_fist.sql           # initial schema
├── 0001_cooing_squadron_supreme.sql   # additive
├── 0002_melted_black_widow.sql        # additive
├── 0003_soul_system_foundation.sql    # custom — 4 new tables
├── 0004_add_human_review_flag.sql     # additive column
├── 0005_decision_traces_unique_decision_id.sql
├── 0006_add_time_on_screen_ms.sql     # additive column
├── 0007_god_layer_schema.sql          # custom — 2 new tables + columns
├── 0008_add_error_message_to_bots.sql # additive column (Phase 15)
└── meta/
    └── _journal.json                  # 7 entries (idx 0–7, highest is 0007)
```

**Important:** The `_journal.json` only tracks migrations 0000–0007 (8 entries with idx 0–7). Migration `0008_add_error_message_to_bots.sql` exists on disk but is NOT yet in the journal — it was written manually by Phase 15 without running `drizzle-kit migrate`. This means the next Drizzle-managed migration must be aware that 0008 is the last applied migration from the project's perspective, even though it is not in the journal.

**Implication for Phase 16:** Migration files for this phase should be named `0009_objectives_table.sql` (or similar). Whether to use `IF NOT EXISTS` guards (as Phase 15 did with `0008`) or register via drizzle-kit is a planning decision — the established precedent in this project is manual migration files with `IF NOT EXISTS` guards for additive changes.

### Existing Schema File Locations

```
packages/db/src/schema/
├── executions.ts       # MODIFY: add objective_id nullable UUID column
├── objectives.ts       # NEW: objectives table
└── index.ts            # MODIFY: export objectives
```

```
packages/shared-types/src/
├── objective.ts        # NEW: Objective interface + NewObjective
└── index.ts            # MODIFY: export * from './objective'
```

### Existing Fastify Route Pattern

All routes use `FastifyPluginAsyncTypebox` from `@fastify/type-provider-typebox`, registered in `app.ts` with a prefix. Route files live in `services/execution-service/src/routes/`. The objective CRUD routes should follow the same pattern, registered as `objectivesRoutes` with prefix `/objectives`.

---

## Standard Stack

### Core (all already installed — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Schema definition, query builder | Already installed; the `pgTable`, `uuid`, `text`, `varchar`, `integer`, `boolean`, `timestamp`, `index` imports all apply |
| drizzle-kit | 0.31.9 | Migration generation and application | Already installed; `generate` + `migrate` workflow or manual SQL files |
| Fastify | ^5.7.4 | HTTP server + route plugin system | Already installed; `FastifyPluginAsyncTypebox` for typed routes |
| `@fastify/type-provider-typebox` | ^6.1.0 | TypeBox integration for request/response typing | Already installed; every route file uses it |
| `@sinclair/typebox` | ^0.34.48 | Runtime-safe JSON schema for Fastify body/response | Already installed |
| drizzle-orm `sql` template | built-in | Correlated subqueries for OBJ-03 aggregations | Already used in `billing.ts` and `executions.ts` |

### No New Installs

Zero new npm packages are required. All tools are already present in the project.

---

## Architecture Patterns

### Recommended Structure for New Files

```
packages/db/src/schema/
├── executions.ts        # MODIFY: add objectiveId nullable UUID column
├── objectives.ts        # NEW: objectives table definition
└── index.ts             # MODIFY: add export * from './objectives'

packages/db/migrations/
├── 0009_objectives_table.sql   # NEW: CREATE TABLE objectives
└── 0010_executions_objective_id.sql  # NEW: ALTER TABLE executions ADD COLUMN objective_id

packages/shared-types/src/
├── objective.ts          # NEW: Objective interface, NewObjective, ObjectiveStatus enum/const
└── index.ts              # MODIFY: add export * from './objective'

services/execution-service/src/routes/
└── objectives.ts         # NEW: FastifyPluginAsyncTypebox with 5 handlers

services/execution-service/src/app.ts
└── # MODIFY: import + register objectivesRoutes with prefix '/objectives'
```

### Pattern 1: `objectives` Table Design

**What:** A named, persistent objective record. Stores the user-defined name, description, default settings for executions (bot count, budget cap, runtime limit, tool allowlist), archive status, and timestamps.

**Key design decisions:**
- `name` as `varchar(255)` — user-supplied short name, required
- `description` as `text` — optional longer description, nullable
- `defaultMaxBots` as `integer` — default for pre-fill on launch; required (minimum 3 per existing execution validation)
- `defaultBudgetCapCents` as `integer` — nullable (0 = no cap, matching execution.service.ts behavior where `budgetCapCents ?? 0`)
- `defaultRuntimeLimitSeconds` as `integer` — nullable
- `defaultAllowedTools` as `text[]` — array column (matches `executions.allowedTools` type: `text('allowed_tools').array().notNull()`)
- `isArchived` as `boolean` with `.notNull().default(false)` — controls OBJ-04 hide behavior; archived objectives are hidden from the list but rows are preserved
- `createdAt` / `updatedAt` timestamps (standard pattern across all tables)

```typescript
// packages/db/src/schema/objectives.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const objectives = pgTable(
  'objectives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    defaultMaxBots: integer('default_max_bots').notNull().default(5),
    defaultBudgetCapCents: integer('default_budget_cap_cents'),
    defaultRuntimeLimitSeconds: integer('default_runtime_limit_seconds'),
    defaultAllowedTools: text('default_allowed_tools').array().notNull().default([]),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('objectives_is_archived_idx').on(t.isArchived),
    index('objectives_created_at_idx').on(t.createdAt),
  ],
);

export type Objective = typeof objectives.$inferSelect;
export type NewObjective = typeof objectives.$inferInsert;
```

**Note on `defaultAllowedTools` array default:** Drizzle ORM uses `.default([])` for empty array defaults on `text().array()` columns. The generated SQL should produce `DEFAULT ARRAY[]::text[]` or equivalent.

### Pattern 2: Additive `objective_id` Column on `executions`

**What:** A nullable UUID FK from `executions` to `objectives.id`. Null when an execution was launched outside the objectives flow.

```typescript
// Additive to packages/db/src/schema/executions.ts
import { objectives } from './objectives';

// Add inside pgTable column definitions:
objectiveId: uuid('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
```

**`onDelete: 'set null'`:** When an objective is deleted (OBJ-04 delete path), associated execution rows keep their data — only the `objective_id` FK is nulled. This preserves run history exactly as the requirement specifies.

**Note on circular imports:** `objectives.ts` must NOT import from `executions.ts`. The FK goes one way: `executions.objective_id → objectives.id`. The `objectives` schema file has no dependency on `executions`. The `executions.ts` file imports from `objectives.ts`. This avoids circular references.

### Pattern 3: REST API Route Handlers (Fastify + TypeBox)

Following `executionsRoutes` as the template. Five handlers:

```
POST   /objectives           — create new objective (OBJ-01)
GET    /objectives           — list all non-archived objectives with aggregations (OBJ-03)
GET    /objectives/:id       — get single objective (OBJ-02 detail for pre-fill)
DELETE /objectives/:id       — delete objective and set objective_id to null on executions (OBJ-04 delete)
PATCH  /objectives/:id       — update objective fields, including isArchived=true (OBJ-04 archive) or edit defaults
```

**Auth:** The existing routes apply `verifyAuthToken` pre-handler for POST mutations. The objectives routes should follow the same pattern for POST and DELETE, and potentially GET (since all existing routes are behind auth from the UI perspective).

**TypeBox schema for POST /objectives body:**
```typescript
Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.Optional(Type.String()),
  defaultMaxBots: Type.Integer({ minimum: 3, maximum: 20 }),
  defaultBudgetCapCents: Type.Optional(Type.Integer({ minimum: 0 })),
  defaultRuntimeLimitSeconds: Type.Optional(Type.Integer({ minimum: 60 })),
  defaultAllowedTools: Type.Optional(Type.Array(Type.String())),
})
```

**TypeBox schema for PATCH /objectives/:id body:**
```typescript
Type.Partial(Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.String(),
  defaultMaxBots: Type.Integer({ minimum: 3, maximum: 20 }),
  defaultBudgetCapCents: Type.Integer({ minimum: 0 }),
  defaultRuntimeLimitSeconds: Type.Integer({ minimum: 60 }),
  defaultAllowedTools: Type.Array(Type.String()),
  isArchived: Type.Boolean(),
}))
```

### Pattern 4: OBJ-03 Aggregation Query

**What:** The GET /objectives list must return each objective with last-run status, total run count, cumulative spend, and highest bot class achieved.

**How:** Use correlated subqueries (the established pattern from `billing.ts`):

```typescript
// services/execution-service/src/routes/objectives.ts
import { db, objectives, executions, billingEvents, agentClasses } from '@claw/db';
import { eq, sql } from 'drizzle-orm';

const rows = await db
  .select({
    id: objectives.id,
    name: objectives.name,
    description: objectives.description,
    defaultMaxBots: objectives.defaultMaxBots,
    defaultBudgetCapCents: objectives.defaultBudgetCapCents,
    defaultRuntimeLimitSeconds: objectives.defaultRuntimeLimitSeconds,
    defaultAllowedTools: objectives.defaultAllowedTools,
    isArchived: objectives.isArchived,
    createdAt: objectives.createdAt,
    updatedAt: objectives.updatedAt,
    // Last run status: most recent execution status
    lastRunStatus: sql<string | null>`(
      SELECT e.status FROM executions e
      WHERE e.objective_id = ${objectives.id}
      ORDER BY e.created_at DESC
      LIMIT 1
    )`,
    // Total run count
    runCount: sql<number>`(
      SELECT CAST(COUNT(*) AS int) FROM executions e
      WHERE e.objective_id = ${objectives.id}
    )`,
    // Cumulative spend: sum of billing_events amount_cents where event_type = 'tool_invoked'
    totalSpendCents: sql<number>`(
      SELECT CAST(COALESCE(SUM(be.amount_cents), 0) AS int)
      FROM billing_events be
      JOIN executions e ON e.id = be.execution_id
      WHERE e.objective_id = ${objectives.id}
        AND be.event_type = 'tool_invoked'
    )`,
    // Highest bot class achieved: MAX by rank (Artisan=3, Understudy=2, Novice=1, Retired=0)
    bestBotClass: sql<string | null>`(
      SELECT ac.current_class
      FROM agent_classes ac
      JOIN bots b ON b.id = ac.bot_id
      JOIN executions e ON e.id = b.execution_id
      WHERE e.objective_id = ${objectives.id}
      ORDER BY
        CASE ac.current_class
          WHEN 'Artisan' THEN 3
          WHEN 'Understudy' THEN 2
          WHEN 'Novice' THEN 1
          WHEN 'Retired' THEN 0
          ELSE -1
        END DESC
      LIMIT 1
    )`,
  })
  .from(objectives)
  .where(eq(objectives.isArchived, false))
  .orderBy(sql`${objectives.createdAt} DESC`);
```

**Note on correlated subqueries:** This pattern is already used in `billing.ts` and `executions.ts` (GET /all). For N objectives, each objective runs 4 correlated subqueries. For the expected scale (tens to hundreds of objectives), this is acceptable. A GROUP BY JOIN alternative could be used for optimization but adds complexity that is not needed at this scale.

### Pattern 5: OBJ-02 Launch-from-Objective Flow

**What:** When launching from a saved objective, the API endpoint at `POST /executions` already accepts all the fields. The launch-from-objective flow is primarily a UI concern (pre-fill form), but the API must accept an optional `objectiveId` in the POST body to link the new execution to the objective.

**How to implement in Plan 16-03:**
1. Add `objectiveId: Type.Optional(Type.String({ format: 'uuid' }))` to the POST /executions body schema
2. In the handler, after creating the execution, update the row to set `objectiveId` if provided — or include it in the initial insert
3. The cleanest approach: pass `objectiveId` directly into `createExecution()` and include it in the INSERT

**Note:** The `executions` schema `objective_id` column is a FK — passing an invalid UUID would cause a Postgres FK violation, which Fastify will surface as a 500. The handler should validate that the `objectiveId` exists before inserting (a `SELECT id FROM objectives WHERE id = $1 AND NOT is_archived` check).

### Pattern 6: DELETE vs. ARCHIVE Behavior

**OBJ-04 delete:** `DELETE FROM objectives WHERE id = $1`. The `objective_id` FK on `executions` uses `onDelete: 'set null'`, so associated execution rows retain all their data — only `objective_id` is nulled. This is transparent and non-destructive.

**OBJ-04 archive:** `UPDATE objectives SET is_archived = true WHERE id = $1`. The objective row stays. The GET /objectives list filters `WHERE is_archived = false` so archived objectives are hidden but all execution history remains queryable.

### Anti-Patterns to Avoid

- **Cascading delete on `executions.objective_id`:** Using `onDelete: 'cascade'` would destroy execution history when an objective is deleted — contradicts the requirement to preserve history. Use `onDelete: 'set null'`.
- **NOT NULL on `executions.objective_id`:** The column must be nullable. Existing executions have no objective, and users can always create executions without objectives.
- **Separate migration for the objectives table vs. the executions FK column:** The FK on `executions` depends on the `objectives` table existing. If split into two migration files, they must be applied in order. Alternatively, combine both DDL statements into a single migration file (`0009_objectives.sql`). The precedent in this codebase is one migration file per logical change — split is fine as long as ordering is respected.
- **Using `drizzle-kit push` instead of migration files:** Not done anywhere in this project. Always use `generate` then `migrate`, or write manual SQL files.
- **Putting aggregation logic in the schema layer:** All aggregation queries (correlated subqueries for OBJ-03) belong in the route handler or a service function, not in the Drizzle schema definition.
- **Adding objectives-related columns to `executions` table beyond `objective_id`:** The objective's settings are on the `objectives` table. The execution row stores the actual settings used for the run (which may differ from the objective's defaults because all fields are overridable). Do not denormalize by duplicating the objective name or description on the execution row.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request body validation | Manual type checks | TypeBox `Type.Object(...)` with Fastify's `schema.body` | Already the established pattern; provides both compile-time types and runtime validation |
| Correlated subquery aggregation | N+1 JS loops after fetching all rows | `sql\`(...)\`` template tag in `db.select()` | Drizzle's `sql` tag is already used for this exact pattern in `billing.ts` and `executions.ts` |
| UUID generation for objectives | Custom UUID v4 logic | `uuid('id').primaryKey().defaultRandom()` | PostgreSQL `gen_random_uuid()` via Drizzle's built-in |
| Response serialization | Manual JSON.stringify | Fastify's built-in serializer driven by TypeBox response schema | Already the established pattern |
| isArchived filter | Soft-delete library | Simple `eq(objectives.isArchived, false)` WHERE clause | Objectives are a simple entity; no library needed |

---

## Common Pitfalls

### Pitfall 1: Empty Array Default for `defaultAllowedTools`

**What goes wrong:** `text('default_allowed_tools').array().notNull().default([])` may generate SQL that Drizzle-kit cannot represent correctly, or the migration SQL requires `DEFAULT ARRAY[]::text[]` syntax which must be verified.

**Why it happens:** PostgreSQL array defaults require explicit casting (`ARRAY[]::text[]` not just `'{}'`). Drizzle ORM handles this, but a manually written migration must use the correct syntax.

**How to avoid:** In the manual SQL migration, use:
```sql
"default_allowed_tools" text[] NOT NULL DEFAULT ARRAY[]::text[]
```
Or if using the Drizzle-generated migration, verify the generated SQL before applying. Also note: when inserting a new objective with no `defaultAllowedTools`, the API should default to `[]` (empty array), matching the DB default — do not allow `undefined` to reach the INSERT.

**Warning signs:** Migration error `ERROR: syntax error at or near "[]"` — means the array default syntax was wrong.

### Pitfall 2: Circular Import Between `objectives.ts` and `executions.ts`

**What goes wrong:** TypeScript compilation fails with a circular reference error.

**Why it happens:** If `objectives.ts` imports from `executions.ts` (e.g., to define a back-reference) while `executions.ts` imports from `objectives.ts` for the FK, a circular dependency is created.

**How to avoid:** The dependency is strictly one-directional: `executions.ts` imports `objectives` to define the FK reference (`references(() => objectives.id)`). The `objectives.ts` file imports nothing from `executions.ts`. The `index.ts` exports both. No circular dependency exists as long as this direction is maintained.

**Warning signs:** TypeScript error `ReferenceError: Cannot access 'objectives' before initialization` or `Circular dependency detected`.

### Pitfall 3: Migration Out of Order with Phase 15's `0008` File

**What goes wrong:** Phase 15 wrote `0008_add_error_message_to_bots.sql` manually, but the `_journal.json` only goes up to index 7 (tag `0007_god_layer_schema`). If `drizzle-kit migrate` is run, it may try to apply 0008 again if it detects the journal doesn't match.

**Why it happens:** The `_journal.json` is the source of truth for which migrations have been applied. If 0008 was applied to the DB but the journal doesn't know, Drizzle may re-apply it (causing an error on the `IF NOT EXISTS` guard) or skip it unexpectedly.

**How to avoid:** Follow the same manual migration pattern as Phase 15 — write a plain SQL file with `IF NOT EXISTS` guards and apply it directly (e.g., `psql $DATABASE_URL < migrations/0009_objectives.sql`). Do not attempt to use `drizzle-kit migrate` unless the journal is first synchronized with the actual DB state.

**Warning signs:** `drizzle-kit migrate` reports unexpected migration count or attempts to apply `0008_add_error_message_to_bots.sql` again.

### Pitfall 4: `onDelete` Behavior for FK Cascades

**What goes wrong:** Deleting an objective hard-deletes all associated execution rows (with cascading through `billing_events`, `tasks`, `bots`, etc.).

**Why it happens:** If `onDelete: 'cascade'` is used on `executions.objective_id`, deleting an objective would cascade to delete all its executions, then cascade further to tasks, bots, billing events, etc. — destroying all run history.

**How to avoid:** Use `onDelete: 'set null'` on the `executions.objective_id` FK. This nulls the FK on execution rows when the objective is deleted, preserving all execution data. The requirement explicitly states: "delete objective (removes it from the list)" while "archived objectives hidden from list but history preserved" — delete removes the objective row, not the execution history.

### Pitfall 5: Best Bot Class Query Edge Cases

**What goes wrong:** The "highest bot class achieved" correlated subquery returns wrong results for objectives with no executions or executions with no agent class records.

**Why it happens:** If no executions exist for an objective, the subquery returns NULL. If executions exist but no bots were classified, it also returns NULL. The CASE-based ordering works correctly in both cases — NULL propagates through as "no class achieved."

**How to avoid:** The subquery already handles this by returning NULL when no rows match. The TypeBox response schema must define `bestBotClass` as a nullable string: `Type.Union([Type.String(), Type.Null()])`. In the shared-types `Objective` interface, type as `string | null`.

### Pitfall 6: PATCH Endpoint Must Not Allow Partial Updates to Corrupt Array Fields

**What goes wrong:** A PATCH with `{ "defaultAllowedTools": null }` sets the array column to null, violating the NOT NULL constraint.

**Why it happens:** `Type.Partial(...)` allows any field to be `undefined`, but if the client sends `null` for an array field, TypeBox may accept it and Drizzle will attempt to set it to null.

**How to avoid:** In the PATCH handler, only set columns that are explicitly provided in the body. Use a spread/pick pattern:
```typescript
const updates: Partial<typeof objectives.$inferInsert> = {};
if (body.name !== undefined) updates.name = body.name;
if (body.defaultAllowedTools !== undefined) updates.defaultAllowedTools = body.defaultAllowedTools;
// etc.
updates.updatedAt = new Date();
await db.update(objectives).set(updates).where(eq(objectives.id, id));
```

---

## Code Examples

Verified patterns from existing codebase:

### Drizzle Table with Array Column (matching existing executions.ts pattern)

```typescript
// Source: packages/db/src/schema/executions.ts (existing pattern)
allowedTools: text('allowed_tools').array().notNull(),
// Phase 16 applies same pattern for objectives:
defaultAllowedTools: text('default_allowed_tools').array().notNull().default([]),
```

### SQL Migration: New Table

```sql
-- packages/db/migrations/0009_objectives.sql
CREATE TABLE IF NOT EXISTS "objectives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "default_max_bots" integer NOT NULL DEFAULT 5,
  "default_budget_cap_cents" integer,
  "default_runtime_limit_seconds" integer,
  "default_allowed_tools" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "objectives_is_archived_idx" ON "objectives" USING btree ("is_archived");
CREATE INDEX IF NOT EXISTS "objectives_created_at_idx" ON "objectives" USING btree ("created_at");
```

### SQL Migration: Additive FK Column on Executions

```sql
-- packages/db/migrations/0010_executions_objective_id.sql
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "objective_id" uuid;
ALTER TABLE "executions" ADD CONSTRAINT "executions_objective_id_objectives_id_fk"
  FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE SET NULL;
```

**Note:** `ADD CONSTRAINT` is not idempotent by default. To make it idempotent in PostgreSQL, the migration must check before adding. Simplest safe approach for a fresh install: omit `IF NOT EXISTS` on `ADD CONSTRAINT` (since the `objectives` table is also being created fresh) and accept that re-running the migration will produce a harmless duplicate constraint error. Alternatively, use a DO block:
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'executions_objective_id_objectives_id_fk'
  ) THEN
    ALTER TABLE "executions" ADD CONSTRAINT "executions_objective_id_objectives_id_fk"
      FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE SET NULL;
  END IF;
END $$;
```

### Fastify Route Registration (from app.ts pattern)

```typescript
// services/execution-service/src/app.ts
import { objectivesRoutes } from './routes/objectives';
// ...
app.register(objectivesRoutes, { prefix: '/objectives' });
```

### TypeBox Response Schema for GET /objectives (OBJ-03 list item)

```typescript
// Source: pattern from billing.ts and executions.ts
const ObjectiveListItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  defaultMaxBots: Type.Integer(),
  defaultBudgetCapCents: Type.Union([Type.Integer(), Type.Null()]),
  defaultRuntimeLimitSeconds: Type.Union([Type.Integer(), Type.Null()]),
  defaultAllowedTools: Type.Array(Type.String()),
  isArchived: Type.Boolean(),
  createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  // Aggregated fields (OBJ-03)
  lastRunStatus: Type.Union([
    Type.Literal('queued'), Type.Literal('running'), Type.Literal('paused'),
    Type.Literal('stopped'), Type.Literal('completed'), Type.Literal('failed'),
    Type.Null(),
  ]),
  runCount: Type.Integer(),
  totalSpendCents: Type.Integer(),
  bestBotClass: Type.Union([
    Type.Literal('Novice'), Type.Literal('Understudy'),
    Type.Literal('Artisan'), Type.Literal('Retired'),
    Type.Null(),
  ]),
});
```

### Shared Types Pattern (matching existing shared-types files)

```typescript
// packages/shared-types/src/objective.ts
import type { UUID, Cents, ISOTimestamp } from './common';

export interface Objective {
  id: UUID;
  name: string;
  description: string | null;
  defaultMaxBots: number;
  defaultBudgetCapCents: Cents | null;
  defaultRuntimeLimitSeconds: number | null;
  defaultAllowedTools: string[];
  isArchived: boolean;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export type NewObjective = Omit<Objective, 'id' | 'isArchived' | 'createdAt' | 'updatedAt'>;
```

### PATCH Handler — Selective Update Pattern

```typescript
// Only update fields that are present in the body (from existing route patterns)
const updates: Record<string, unknown> = { updatedAt: new Date() };
if (body.name !== undefined) updates.name = body.name;
if (body.description !== undefined) updates.description = body.description;
if (body.isArchived !== undefined) updates.isArchived = body.isArchived;
// ... etc

const result = await db
  .update(objectives)
  .set(updates)
  .where(eq(objectives.id, id))
  .returning({ id: objectives.id });

if (result.length === 0) {
  return reply.code(404).send({ error: 'Objective not found' });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON schema for route validation | TypeBox `Type.Object(...)` with `@fastify/type-provider-typebox` | Established in Phase 1–2 of this project | No change needed — same pattern continues |
| Raw SQL migrations | Manual SQL files with `IF NOT EXISTS` guards, OR drizzle-kit generate | Established in Phase 3–4 of this project | Phase 16 follows the same manual pattern (avoids journal sync issues) |
| Correlated subqueries for aggregation | `sql` template tag in drizzle-orm `db.select()` columns | Established in Phase 5 billing routes | Same pattern continues |

---

## Open Questions

1. **Migration journal sync for `0008_add_error_message_to_bots.sql`**
   - What we know: Phase 15 wrote `0008_add_error_message_to_bots.sql` manually without running `drizzle-kit migrate`. The `_journal.json` max idx is 7.
   - What's unclear: Whether `0008` has been applied to the production/dev DB. If it has, the `IF NOT EXISTS` guard on `ALTER TABLE bots ADD COLUMN IF NOT EXISTS error_message TEXT` means re-running is safe.
   - Recommendation: The planner should note in Plan 16-01 that the migration file for this phase must use `IF NOT EXISTS` guards and be applied via direct `psql` (not `drizzle-kit migrate`) unless the journal is brought up to date first. This is consistent with how Phase 15 handled it.

2. **User identity / multi-tenancy scope for objectives**
   - What we know: The system is described as single-tenant MVP (per REQUIREMENTS.md "Out of Scope: Multi-tenant isolation"). The auth system uses JWT (`jose` package, `verifyAuthToken` function).
   - What's unclear: Should objectives be scoped to a user ID? If there are multiple authenticated users, their objectives would intermingle in the GET /objectives list unless filtered by user.
   - Recommendation: For the current single-tenant MVP, do NOT add a `userId` column to objectives. If the system is truly single-tenant, all objectives belong to "the user." If multi-user support is needed later, this is a one-column additive migration. The planner should flag this as a future-proofing decision rather than a blocking concern for Phase 16.

3. **`defaultAllowedTools` array — Drizzle default syntax verification**
   - What we know: The `executions` table uses `text('allowed_tools').array().notNull()` without a default. Objectives needs `DEFAULT ARRAY[]::text[]`.
   - What's unclear: Whether drizzle-orm 0.45.1 correctly generates `DEFAULT ARRAY[]::text[]` for `text().array().notNull().default([])` in a `drizzle-kit generate` context.
   - Recommendation: Write the migration SQL manually and explicitly use `DEFAULT ARRAY[]::text[]`. Do not rely on drizzle-kit to generate the correct array default syntax. Verify the column accepts an INSERT without specifying `defaultAllowedTools` (it should default to `{}`).

4. **Plan 16-02 vs. 16-03 split — `objectiveId` on executions**
   - What we know: Plans are: 16-01 (DB + shared-types), 16-02 (API endpoints), 16-03 (link executions + aggregation).
   - What's unclear: Whether adding `objectiveId` to the `executions` schema belongs in Plan 16-01 (alongside the `objectives` table migration) or Plan 16-03 (when the execution-objective link is implemented).
   - Recommendation: Include the `objective_id` column migration in Plan 16-01 (as part of the same schema foundation work), but defer the route handler changes (passing `objectiveId` through POST /executions) to Plan 16-03. This way the DB schema is complete before the API layer is built.

---

## Sources

### Primary (HIGH confidence — directly inspected)

- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/executions.ts` — Confirmed `allowedTools: text('allowed_tools').array().notNull()` pattern; `objectiveId` FK placement strategy
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/bots.ts` — Confirmed index + pgEnum + FK reference pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/billing-events.ts` — Confirmed `billingEventTypeEnum` and JOIN patterns
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/agent-classes.ts` — Confirmed `agentClassEnum` values: `'Novice', 'Understudy', 'Artisan', 'Retired'`; used in OBJ-03 best-class subquery
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/migrations/meta/_journal.json` — Confirmed journal only covers idx 0–7; `0008` is not in journal
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/migrations/0008_add_error_message_to_bots.sql` — Confirmed `IF NOT EXISTS` guard pattern; single-line manual migration
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/executions.ts` — Confirmed TypeBox route pattern, correlated subquery usage, `GET /executions/all` aggregation pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/billing.ts` — Confirmed correlated subquery pattern for aggregated list views (exactly the pattern needed for OBJ-03)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/app.ts` — Confirmed route registration pattern with prefix
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/shared-types/src/execution.ts` — Confirmed interface shape for mirroring DB schema without Drizzle dependency
- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/REQUIREMENTS.md` — Confirmed OBJ-01 through OBJ-04 requirements and single-tenant scope declaration
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/package.json` — Confirmed drizzle-orm 0.45.1, drizzle-kit 0.31.9 installed versions

### Secondary (MEDIUM confidence)

- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/phases/08-database-schema-and-shared-types/08-RESEARCH.md` — Prior research documenting `IF NOT EXISTS` migration pattern, additive column strategy, and array default concerns — directly applicable to Phase 16
- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/ROADMAP.md` — Phase 16 plan breakdown (16-01/16-02/16-03) and success criteria

---

## Metadata

**Confidence breakdown:**
- Standard stack (Drizzle version, Fastify pattern, TypeBox pattern): HIGH — directly inspected installed node_modules and all existing route files
- Architecture patterns (objectives table design, correlated subqueries, FK with onDelete: set null): HIGH — derived from existing working code patterns
- Migration approach (manual SQL, IF NOT EXISTS, journal sync issue): HIGH — directly inspected `_journal.json` and Phase 15 migration file
- OBJ-03 aggregation query (CASE-based class ranking): HIGH — `agent_classes` enum values confirmed; same CASE pattern used in `executions.ts` leaderboard handler
- Array default syntax (`ARRAY[]::text[]`): MEDIUM — correct PostgreSQL syntax but Drizzle ORM generation behavior not verified; manual SQL recommended

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — Drizzle 0.45.x and Fastify 5 are stable; no fast-moving dependencies)
