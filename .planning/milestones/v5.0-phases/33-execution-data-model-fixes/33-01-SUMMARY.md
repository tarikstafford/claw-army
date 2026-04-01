---
phase: 33-execution-data-model-fixes
plan: 01
subsystem: execution-data-model
tags: [schema, migration, drizzle, executions, llm-provider, allowed-domains]
dependency_graph:
  requires: []
  provides: [llmProvider-column, allowedDomains-column, migration-0013]
  affects: [executions-table, execution-service-api]
tech_stack:
  added: []
  patterns: [nullable-column, idempotent-migration, typebox-nullable-union]
key_files:
  created:
    - packages/db/migrations/0013_add_llm_provider_allowed_domains.sql
  modified:
    - packages/db/src/schema/executions.ts
    - packages/db/migrations/meta/_journal.json
    - services/execution-service/src/services/execution.service.ts
    - services/execution-service/src/routes/executions.ts
decisions:
  - llmProvider enforced at app level (not DB enum) to avoid migration churn when adding providers
  - allowedDomains null semantically distinct from [] — null means use global PROXY_DOMAIN_ALLOWLIST fallback
  - Used Type.Union([Type.String(), Type.Null()]) in GET response schema to match nullable column contract
metrics:
  duration: 2 minutes
  completed: 2026-03-02
  tasks_completed: 2
  files_changed: 5
---

# Phase 33 Plan 01: Execution Data Model Fixes Summary

**One-liner:** Nullable `llmProvider` (varchar50) and `allowedDomains` (text[]) columns added to executions table with idempotent migration 0013, wired through `createExecution()` service interface and exposed in GET `/executions/:id` response schema.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add llmProvider and allowedDomains to Drizzle schema and create migration | 0de432d | executions.ts, 0013 migration SQL, _journal.json |
| 2 | Wire llmProvider and allowedDomains through createExecution and route handler | 5693660 | execution.service.ts, routes/executions.ts |

## What Was Built

### Task 1: Schema and Migration

Added two nullable columns to the `executions` pgTable definition in `packages/db/src/schema/executions.ts`:

```typescript
llmProvider: varchar('llm_provider', { length: 50 }),
allowedDomains: text('allowed_domains').array(),
```

Created idempotent migration `0013_add_llm_provider_allowed_domains.sql`:

```sql
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "llm_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "allowed_domains" text[];
```

Registered entry idx 13 in `_journal.json` with tag `0013_add_llm_provider_allowed_domains`.

The `Execution` and `NewExecution` types automatically infer both new fields as `string | null` and `string[] | null` respectively — no manual type changes needed.

### Task 2: Service and Route Wiring

**`CreateExecutionInput` interface** (`execution.service.ts`) — two optional fields added:
```typescript
llmProvider?: string;
allowedDomains?: string[];
```

**`createExecution()` insert call** — both fields passed with `?? null` fallback:
```typescript
llmProvider: input.llmProvider ?? null,
allowedDomains: input.allowedDomains ?? null,
```

**POST `/executions` handler** — fields destructured from body and forwarded to service:
```typescript
const { ..., llmProvider, allowedDomains, ... } = request.body;
// ...
result = await createExecution({ ..., llmProvider, allowedDomains, ... });
```

**GET `/executions/:id` response schema** — nullable fields added after `allowedTools`:
```typescript
llmProvider: Type.Union([Type.String(), Type.Null()]),
allowedDomains: Type.Union([Type.Array(Type.String()), Type.Null()]),
```

POST TypeBox schema already had both fields as `Type.Optional` — no change required.

## Decisions Made

1. **llmProvider validation at app level only** — no DB enum or check constraint. Adding enum values (e.g., `gemini`) would require another migration. App-level enforcement (anthropic | openai) is sufficient and flexible.

2. **allowedDomains null vs empty array** — null means "fall back to global `PROXY_DOMAIN_ALLOWLIST`"; empty array `[]` means "allow all domains". This semantic distinction is preserved by storing explicit null rather than defaulting to `[]`.

3. **`Type.Union([..., Type.Null()])` for GET response** — matches the nullable column contract and follows the existing `claimedByBotId` pattern in the tasks response schema.

## Verification Results

- `packages/db`: `npx tsc --noEmit` — PASS (no errors)
- `services/execution-service`: `npx tsc --noEmit` — PASS (no errors)
- Migration 0013 SQL: 2 x `ADD COLUMN IF NOT EXISTS` statements — PASS
- `_journal.json`: idx 13 entry registered — PASS
- `llmProvider` in POST destructuring and `createExecution()` call — PASS
- `allowedDomains` in GET /:id response schema — PASS
- Backward compatibility: both fields `Type.Optional` in POST schema — PASS

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files found. All commits verified.

| Check | Result |
|-------|--------|
| packages/db/src/schema/executions.ts | FOUND |
| packages/db/migrations/0013_add_llm_provider_allowed_domains.sql | FOUND |
| packages/db/migrations/meta/_journal.json | FOUND |
| services/execution-service/src/services/execution.service.ts | FOUND |
| services/execution-service/src/routes/executions.ts | FOUND |
| Commit 0de432d | FOUND |
| Commit 5693660 | FOUND |
