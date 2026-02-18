---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [drizzle-orm, postgresql, pnpm, monorepo, typescript, drizzle-kit, pg-enum, migrations]

# Dependency graph
requires: []
provides:
  - pnpm monorepo workspace with packages/* and services/* workspace paths
  - packages/db with Drizzle ORM schema for all 6 core tables
  - SQL migration 0000_misty_iron_fist.sql applied to local PostgreSQL
  - $inferSelect/$inferInsert TypeScript types for all 6 tables in strict mode
  - 4 pgEnum types (execution_status, task_status, bot_status, billing_event_type)
  - Drizzle client instance exported from packages/db
affects: [02-orchestration, 03-tool-gateway, 04-metering, 05-frontend, 06-dna]

# Tech tracking
tech-stack:
  added:
    - drizzle-orm@0.45.1 (schema definition, query builder, type inference)
    - drizzle-kit@0.31.9 (migration generation and application CLI)
    - pg@8.18.0 (node-postgres driver)
    - dotenv@16.4.0 (env var loading in drizzle.config.ts and client.ts)
    - tsx@4.19.0 (TypeScript execution for migration scripts)
    - typescript@5.9.3 (compiler with strict mode)
  patterns:
    - Internal packages strategy (main/types point to .ts source, not dist/)
    - Drizzle schema as single source of truth for all table types via $inferSelect/$inferInsert
    - Generate + migrate workflow (NOT push) for auditable SQL migrations
    - All monetary values as integer cents, never float
    - All timestamps with { withTimezone: true, precision: 3 } for sub-second TZ safety
    - UUID primary keys with defaultRandom() on all tables
    - pgEnum for all enumerated status columns
    - moduleResolution: Bundler with extensionless imports for drizzle-kit esbuild-register compatibility

key-files:
  created:
    - package.json (root monorepo with db:generate and db:migrate scripts)
    - pnpm-workspace.yaml (workspace definition: packages/*, services/*, scripts)
    - tsconfig.base.json (strict, ES2022, NodeNext module, Bundler condition, composite)
    - .npmrc (shamefully-hoist=false, strict-peer-dependencies=true)
    - .env.example (DATABASE_URL, REDIS_URL, GCP_PROJECT_ID, PUBSUB_EMULATOR_HOST)
    - packages/db/package.json (@claw/db with internal packages main/types pointing to .ts)
    - packages/db/tsconfig.json (ESNext+Bundler for drizzle-kit compatibility)
    - packages/db/drizzle.config.ts (schema glob, postgresql dialect, migrations output)
    - packages/db/src/client.ts (drizzle() with node-postgres adapter and schema)
    - packages/db/src/index.ts (re-exports db client + all schema types)
    - packages/db/src/schema/executions.ts (execution_status enum, 9 columns)
    - packages/db/src/schema/tasks.ts (task_status enum, lease semantics, 3 indexes)
    - packages/db/src/schema/bots.ts (bot_status enum, heartbeat, task counters)
    - packages/db/src/schema/billing-events.ts (billing_event_type enum, integer cents, jsonb metadata)
    - packages/db/src/schema/telemetry.ts (numeric(12,6) metric_value, FK to bots+executions)
    - packages/db/src/schema/dna-store.ts (DnaPayload interface, versioned jsonb, composite_score)
    - packages/db/src/schema/index.ts (barrel export of all 6 schema modules)
    - packages/db/migrations/0000_misty_iron_fist.sql (initial SQL migration, all 6 tables)
  modified: []

key-decisions:
  - "moduleResolution: Bundler (not NodeNext) in packages/db tsconfig to fix drizzle-kit esbuild-register incompatibility with .js extension ESM imports"
  - "Extensionless imports in schema files to work with drizzle-kit's CJS esbuild-register bundler"
  - "Integer cents for all monetary amounts (amountCents, budgetCapCents) per RESEARCH.md open question 3 resolution"
  - "numeric(12,6) for telemetry metric_value, numeric(5,2) for DNA composite_score - high precision without float"
  - "DnaPayload interface defined in dna-store.ts with all 6 fields from ROADMAP.md DNA requirements"

patterns-established:
  - "Drizzle schema: all tables use uuid PK + defaultRandom(), timestamps with TZ precision 3"
  - "Enum pattern: pgEnum exported alongside table + $inferSelect/$inferInsert types"
  - "Index pattern: FK columns always indexed; composite index for most common query patterns"
  - "Money pattern: always integer cents, never float/real in PostgreSQL"
  - "Monorepo pattern: internal packages strategy for zero-build-step type propagation"

# Metrics
duration: 7min
completed: 2026-02-18
---

# Phase 1 Plan 01: Data Foundation — Database Schema Summary

**pnpm monorepo with packages/db containing Drizzle ORM schema for 6 core tables (executions, tasks, bots, billing_events, telemetry, dna_store), SQL migration applied to local PostgreSQL, TypeScript strict-mode types via $inferSelect**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-18T07:26:28Z
- **Completed:** 2026-02-18T07:32:55Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- pnpm monorepo workspace initialized with packages/db package using internal packages strategy (main/types → .ts source files, eliminating Drizzle [IsDrizzleTable] brand type bug)
- 6 Drizzle schema files with correct column types, enums, indexes, and FK constraints — all inferred TypeScript types compile in strict mode with zero errors
- SQL migration 0000_misty_iron_fist.sql generated and applied to local PostgreSQL, all 6 tables verified with correct schema including FK constraints and 13 indexes

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize pnpm monorepo workspace and packages/db package** - `4dd8549` (feat)
2. **Task 2: Define all six Drizzle schema tables and generate initial migration** - `f2ef722` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `package.json` - Root monorepo with db:generate and db:migrate workspace scripts
- `pnpm-workspace.yaml` - Workspace definition: packages/*, services/*, scripts
- `tsconfig.base.json` - Strict TypeScript config with NodeNext module, composite, internal packages customConditions
- `.npmrc` - Strict pnpm settings (no phantom dependencies)
- `.env.example` - Template for DATABASE_URL, REDIS_URL, GCP_PROJECT_ID, PUBSUB_EMULATOR_HOST
- `.gitignore` - Excludes node_modules, dist, .env, tsbuildinfo
- `packages/db/package.json` - @claw/db with internal packages strategy (main/types → .ts)
- `packages/db/tsconfig.json` - ESNext+Bundler moduleResolution for drizzle-kit compatibility
- `packages/db/drizzle.config.ts` - Schema glob ./src/schema/**/*.ts, postgresql dialect, migrations output
- `packages/db/src/client.ts` - drizzle() with node-postgres adapter, DATABASE_URL, schema import
- `packages/db/src/index.ts` - Re-exports db client + all schema types
- `packages/db/src/schema/executions.ts` - execution_status enum, 9 columns, budgetCapCents (integer cents)
- `packages/db/src/schema/tasks.ts` - task_status enum, lease semantics (claimedByBotId, leaseExpiresAt), 3 indexes
- `packages/db/src/schema/bots.ts` - bot_status enum, heartbeat tracking, task counters (claimed/completed/failed)
- `packages/db/src/schema/billing-events.ts` - billing_event_type enum, integer cents, jsonb metadata, 3 indexes
- `packages/db/src/schema/telemetry.ts` - numeric(12,6) metric_value, FK to both executions and bots, 3 indexes
- `packages/db/src/schema/dna-store.ts` - DnaPayload interface, versioned jsonb, numeric(5,2) compositeScore, 4 indexes
- `packages/db/src/schema/index.ts` - Barrel export of all 6 schema modules
- `packages/db/migrations/0000_misty_iron_fist.sql` - Initial SQL migration with all tables, enums, FKs, indexes

## Decisions Made

- **moduleResolution: Bundler for packages/db**: drizzle-kit 0.31.9 uses esbuild-register (CJS mode) internally to load schema files. When package.json has `"type": "module"`, `.js` extension imports in TypeScript files fail because esbuild-register's `require()` can't find `executions.js` (only `executions.ts` exists). Switching to `module: ESNext` + `moduleResolution: Bundler` allows extensionless imports that drizzle-kit's bundler resolves correctly, while TypeScript still compiles cleanly. Downstream consumers use the internal packages strategy and resolve `.ts` source directly.
- **Integer cents for monetary values**: All monetary amounts (budgetCapCents, amountCents) stored as integer cents per RESEARCH.md open question 3 resolution. Avoids floating-point imprecision in PostgreSQL `real`/`float` columns.
- **numeric precision types**: `numeric(12,6)` for telemetry metric_value (tasks/min, tokens/task, etc.), `numeric(5,2)` for DNA composite_score (0-100 with 2 decimal places). Never float.
- **DnaPayload interface**: Defined with all 6 fields from ROADMAP requirements: systemPromptTemplate, toolCallSequence, argumentPatterns, retryStrategy, timingProfile, tokenDistribution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed drizzle-kit esbuild-register incompatibility with .js extension imports**
- **Found during:** Task 2 (running `pnpm --filter @claw/db generate`)
- **Issue:** drizzle-kit 0.31.9 uses esbuild-register to load `.ts` schema files via CJS `require()`. With `"type": "module"` in package.json, TypeScript NodeNext imports use `.js` extensions (e.g., `import { executions } from './executions.js'`). When esbuild-register's `require()` encounters `./executions.js`, it fails with `Cannot find module './executions.js'` because only `executions.ts` exists — esbuild-register doesn't remap `.js` → `.ts` in this mode.
- **Fix:** Changed packages/db/tsconfig.json from `module: NodeNext, moduleResolution: NodeNext` to `module: ESNext, moduleResolution: Bundler`. Updated all inter-schema imports to extensionless paths (e.g., `'./executions'` instead of `'./executions.js'`). Bundler moduleResolution allows extensionless imports in TypeScript while drizzle-kit's esbuild-register can resolve them. TypeScript compiles cleanly in strict mode.
- **Files modified:** packages/db/tsconfig.json, all 6 schema files, client.ts, index.ts, schema/index.ts
- **Verification:** `tsc --noEmit` exits 0; `pnpm --filter @claw/db generate` produces migration SQL; `pnpm --filter @claw/db migrate` applies cleanly
- **Committed in:** f2ef722 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — drizzle-kit esbuild-register ESM import resolution)
**Impact on plan:** Required deviation. Without this fix, drizzle-kit generate fails entirely. The ESNext+Bundler combination is a well-known workaround for drizzle-kit in monorepos with `"type": "module"`. The internal packages strategy still works correctly for downstream consumers. No scope creep.

## Issues Encountered

- Existing PostgreSQL container (`postgres-db-1`) already running on port 5432 with different credentials (`postgres:password`) than the plan's example (`postgres:postgres`). Created `.env` in packages/db with the correct credentials. The `.env` is gitignored so this is a local-only configuration. `.env.example` retains the canonical `postgres:postgres` example.

## User Setup Required

None — no external service configuration required beyond what's already running locally. The migration has been applied to the local PostgreSQL container.

## Next Phase Readiness

- All 6 tables are created and verified in local PostgreSQL
- packages/db exports `db` client and all TypeScript types — ready for import by services in Phase 2
- The internal packages strategy means no build step is needed for type resolution in downstream packages
- drizzle-kit generate+migrate workflow is established for future schema changes
- Watch: When services import from @claw/db, they should use the `@claw/source` custom condition (internal packages strategy) for source-level type resolution, avoiding the Drizzle [IsDrizzleTable] brand type bug

## Self-Check: PASSED

All 17 created files verified present on disk. Both task commits (4dd8549, f2ef722) verified in git log. TypeScript compiles with zero errors. All 6 tables present in PostgreSQL.

---
*Phase: 01-data-foundation*
*Completed: 2026-02-18*
