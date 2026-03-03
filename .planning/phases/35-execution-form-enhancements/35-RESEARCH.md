# Phase 35: Execution Form Enhancements - Research

**Researched:** 2026-03-03
**Domain:** SvelteKit form actions, Fastify TypeBox schemas, Drizzle ORM DB schema
**Confidence:** HIGH

## Summary

Phase 35 adds three new fields to the execution creation flow: campaign type (ad hoc / campaign), tool allowlist (multi-select), and runtime limit (minutes). The backend already has `allowedTools` and `runtimeLimitSeconds` columns in the DB and POST handler — the gap is that neither field is exposed in the form. Campaign type is currently derived in the route from `objectiveId` but is not stored as a DB column; the phase description says it must be stored, so a new `campaignType` column is needed on the `executions` table.

The frontend is a SvelteKit page at `services/ui/src/routes/new-execution/+page.svelte` with a `+page.server.ts` form action that POSTs JSON to `POST /executions`. The backend handler is in `services/execution-service/src/routes/executions.ts` with TypeBox schema validation; it passes fields to `createExecution()` in `services/execution-service/src/services/execution.service.ts`, which inserts to the DB using Drizzle ORM. The form already handles `llmProvider` (toggle buttons with hidden input) and `allowedDomains` (textarea), providing the exact UI patterns to replicate.

The work splits cleanly into two plans: (35-01) add the three fields to the SvelteKit form and server action; (35-02) accept and store the fields in the POST handler and DB. Because `allowedTools` and `runtimeLimitSeconds` already exist in the backend (but not the form), and `campaignType` does not yet exist anywhere in the DB, plan 35-02 requires a new migration.

**Primary recommendation:** Add `campaignType` column (varchar, nullable) to executions schema + migration; wire all three fields through form → server action → POST body → handler → DB insert. Use the existing `tool-toggle` button pattern (already used for llmProvider) for the tool allowlist multi-select.

## Current State Analysis

### What already exists (do not re-implement)

| Field | DB Column | POST handler schema | createExecution input | Form |
|-------|-----------|--------------------|-----------------------|------|
| `allowedTools` | `text('allowed_tools').array().notNull()` | `Type.Optional(Type.Array(Type.String()))` | `allowedTools: string[]` | **MISSING** |
| `runtimeLimitSeconds` | `integer('runtime_limit_seconds').notNull()` | `Type.Optional(Type.Integer({ minimum: 60 }))` | `runtimeLimitSeconds: number` | **MISSING** |
| `campaignType` | **NOT IN DB** | **NOT IN SCHEMA** | **NOT IN INPUT** | **MISSING** |

The `campaignType` value is currently derived at runtime in `executions.ts` line 141:
```typescript
const campaignType = objectiveId ? 'campaign' : 'ad_hoc';
```
and passed to `spawnRingLeader()` but never stored on the execution row.

### Files to modify

**Plan 35-01 (form + server action):**
- `services/ui/src/routes/new-execution/+page.svelte`
- `services/ui/src/routes/new-execution/+page.server.ts`

**Plan 35-02 (backend handler + DB):**
- `packages/db/src/schema/executions.ts`
- `packages/db/migrations/0014_add_campaign_type.sql` (new migration)
- `packages/db/migrations/meta/_journal.json` (update)
- `services/execution-service/src/services/execution.service.ts`
- `services/execution-service/src/routes/executions.ts`

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | project version | Form actions, `use:enhance`, `$state`, `$derived` | Already used in new-execution page |
| TypeBox (`@sinclair/typebox`) | project version | Runtime schema validation on Fastify routes | Already used throughout execution-service |
| Drizzle ORM | project version | DB schema definition and insert/select | Already used in all DB operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/type-provider-typebox` | project version | Typed Fastify plugins with TypeBox | Already used in executionsRoutes |

**Installation:** No new packages required.

## Architecture Patterns

### Pattern 1: SvelteKit Form with Hidden Input for Complex State (used by llmProvider)

The existing `llmProvider` field is a great template for `campaignType`:
- Use `$state` for the reactive value
- Render toggle buttons with `type="button"` and `onclick` handlers
- Hidden `<input type="hidden" name="campaignType" value={campaignType} />` submits the value

```typescript
// Source: services/ui/src/routes/new-execution/+page.svelte (existing llmProvider pattern)
let campaignType = $state<'ad_hoc' | 'campaign'>('ad_hoc');
// ...
<button type="button" class="tool-toggle" class:active={campaignType === 'ad_hoc'}
  onclick={() => campaignType = 'ad_hoc'}>
  ...
</button>
<input type="hidden" name="campaignType" value={campaignType} />
```

### Pattern 2: Multi-Select Tool Allowlist (same tool-toggle pattern, multi-select)

The `llmProvider` single-select uses the `.tool-toggle.active` CSS class (already styled). For `allowedTools` multi-select:
- Use `$state<Set<string>>` or `$state<string[]>` for selected tools
- Each tool is a toggle button; clicking adds/removes from set
- Submit as hidden inputs (one per selected tool) or a comma-separated hidden input that the server action splits

**Recommended approach:** Multiple `<input type="hidden" name="allowedTools" value={tool} />` rendered in an `{#each selectedTools as tool}` block. SvelteKit's `formData.getAll('allowedTools')` reads all values.

```svelte
<!-- Pattern for multi-select hidden inputs -->
{#each [...selectedTools] as tool}
  <input type="hidden" name="allowedTools" value={tool} />
{/each}
```

```typescript
// Server action
const allowedTools = formData.getAll('allowedTools') as string[];
```

### Pattern 3: Server Action formData Parsing (existing pattern)

```typescript
// Source: services/ui/src/routes/new-execution/+page.server.ts
const maxBots = Number(formData.get('maxBots') ?? 3);
const runtimeLimitMinutes = Number(formData.get('runtimeLimitMinutes') ?? 60);
const runtimeLimitSeconds = runtimeLimitMinutes * 60; // convert for backend
```

### Pattern 4: TypeBox Schema Extension (existing pattern)

```typescript
// Source: services/execution-service/src/routes/executions.ts
body: Type.Object({
  // existing fields...
  campaignType: Type.Optional(Type.Union([Type.Literal('ad_hoc'), Type.Literal('campaign')])),
  // allowedTools and runtimeLimitSeconds already exist in schema — no change needed
}),
```

### Pattern 5: Drizzle Column Addition with Nullable (existing migration pattern)

Migration 0013 pattern (idempotent `ADD COLUMN IF NOT EXISTS`):
```sql
-- packages/db/migrations/0014_add_campaign_type.sql
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "campaign_type" varchar(20);
```

Schema definition:
```typescript
// packages/db/src/schema/executions.ts
campaignType: varchar('campaign_type', { length: 20 }), // nullable; 'ad_hoc' | 'campaign'
```

### Anti-Patterns to Avoid

- **Don't add a DB enum for campaignType:** Phase 33 decision precedent — "llmProvider validated at app level only (not DB enum) to avoid migration churn." Apply the same principle to campaignType: varchar column, app-level validation only.
- **Don't add `runtimeLimitSeconds` to POST schema:** It already exists in the TypeBox schema and `createExecution` input. Only the form is missing it.
- **Don't change allowedTools POST schema:** It already exists in TypeBox schema. Only the form is missing it.
- **Don't use `formData.get('allowedTools')` for multi-value:** Use `formData.getAll('allowedTools')` — `get()` returns only the first value.
- **Don't hard-code tool names in the form:** The form should define a constant array of available tool names and render them dynamically (same pattern as `LLM_PROVIDERS` constant in the existing form).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-value form fields | Custom JSON-in-hidden-input | `formData.getAll()` | Native FormData API, works with `use:enhance` |
| TypeBox schema validation | Manual validation in handler | Existing TypeBox schema extension | Already wired, just add new fields |
| DB migration | Drizzle `generate` command | Hand-written SQL with `IF NOT EXISTS` | Project pattern (migrations 0008-0013 are all hand-written for idempotency) |

## Common Pitfalls

### Pitfall 1: campaignType Derivation vs. Form Input Conflict

**What goes wrong:** The route currently derives `campaignType` from `objectiveId` at line 141. If the form also sends `campaignType`, there will be two sources of truth. The form's value should take precedence since FORM-01 says "user can select campaign type."

**How to avoid:** In `executions.ts`, use the form-supplied `campaignType` value when present; fall back to the `objectiveId`-derived value only if `campaignType` is not provided. Or, since users will set it explicitly, store the form value directly and remove the inline derivation (keep passing the stored value to `spawnRingLeader`).

**Recommended approach:** Accept `campaignType` from the form body; if not supplied, fall back to `objectiveId ? 'campaign' : 'ad_hoc'`. Store it on the execution row. Pass `execution.campaignType` (not re-derived) to `spawnRingLeader`.

### Pitfall 2: runtimeLimitMinutes vs. runtimeLimitSeconds Mismatch

**What goes wrong:** The form collects minutes (user-friendly), but the backend stores seconds. The conversion must happen in the server action, not the frontend component.

**How to avoid:** Form field named `runtimeLimitMinutes`; server action reads it and multiplies by 60 before sending `runtimeLimitSeconds` to the execution service.

### Pitfall 3: allowedTools Default Handling

**What goes wrong:** `allowedTools` is `notNull()` in the DB schema (line 20: `text('allowed_tools').array().notNull()`). The current POST handler defaults to `[]` when not supplied (line 73: `allowedTools = []`). If the form sends zero selected tools (all tools allowed / no restriction), the empty array is correct and must be passed through.

**How to avoid:** The server action must always send `allowedTools` in the POST body, even as an empty array `[]`. The TypeBox schema already has it as `Type.Optional` — if not present in body, the handler defaults to `[]`.

### Pitfall 4: campaignType Column Not in GET Response Schema

**What goes wrong:** After adding `campaignType` to the DB, if the GET `/executions/:id` response schema in `executions.ts` is not updated, the field is silently dropped from API responses. TypeBox strips unrecognized fields by default in Fastify.

**How to avoid:** Add `campaignType` to the GET response schema in `executions.ts` alongside the DB schema addition.

### Pitfall 5: _journal.json Must Be Updated with New Migration

**What goes wrong:** The project's `_journal.json` must list the new migration or Drizzle won't apply it. Migrations 0008–0010 were not in `_journal.json` (per project memory) and had to be applied manually.

**How to avoid:** Add entry for `0014_add_campaign_type.sql` to `packages/db/migrations/meta/_journal.json` AND manually apply the SQL to the running DB (the standard approach in this project).

## Code Examples

### Available Tools Constant (for form)

```typescript
// Source: services/ui/src/routes/new-execution/+page.svelte (pattern: LLM_PROVIDERS constant)
const AVAILABLE_TOOLS: { id: string; label: string; description: string }[] = [
  { id: 'bash', label: 'Bash', description: 'Execute shell commands' },
  { id: 'file_read', label: 'File Read', description: 'Read files from the filesystem' },
  { id: 'file_write', label: 'File Write', description: 'Write files to the filesystem' },
  { id: 'web_search', label: 'Web Search', description: 'Search the web' },
  { id: 'web_fetch', label: 'Web Fetch', description: 'Fetch content from URLs' },
  // extend as needed; empty selectedTools = no restriction (all tools allowed)
];
```

Note: The actual canonical tool names should match what `planObjectiveAsTaskGraph` and `validatePreFlight` expect. Review `services/execution-service/src/services/planner.service.ts` and `preflight-validator.ts` before finalizing tool IDs.

### Server Action Extension

```typescript
// Source: services/ui/src/routes/new-execution/+page.server.ts (extend existing)
const allowedTools = formData.getAll('allowedTools') as string[];
const runtimeLimitMinutes = Number(formData.get('runtimeLimitMinutes') ?? 60);
const runtimeLimitSeconds = runtimeLimitMinutes * 60;
const campaignType = (formData.get('campaignType') as string | null) ?? 'ad_hoc';

// Include in POST body:
body: JSON.stringify({
  objective,
  maxBots,
  budgetCapCents,
  llmProvider,
  allowedDomains,
  allowedTools,
  runtimeLimitSeconds,
  campaignType,
  ...(objectiveId ? { objectiveId } : {}),
}),
```

### TypeBox Schema Extension (POST /executions)

```typescript
// Source: services/execution-service/src/routes/executions.ts
body: Type.Object({
  // existing fields (no change needed for allowedTools or runtimeLimitSeconds — already present)
  campaignType: Type.Optional(
    Type.Union([Type.Literal('ad_hoc'), Type.Literal('campaign')])
  ),
}),
```

### CreateExecutionInput Extension

```typescript
// Source: services/execution-service/src/services/execution.service.ts
export interface CreateExecutionInput {
  // existing fields...
  campaignType?: string; // 'ad_hoc' | 'campaign'
}

// In db.insert().values():
campaignType: input.campaignType ?? null,
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Derive campaignType from objectiveId at runtime | Accept from form + store in DB | User choice overrides convention; stored for reporting/filtering |
| allowedTools/runtimeLimitSeconds backend-only | Exposed in form | User can configure per-execution; fields complete the form-to-DB contract |

## Open Questions

1. **What tool names should populate the AVAILABLE_TOOLS list?**
   - What we know: `allowedTools` is a free-form string array; `planObjectiveAsTaskGraph` and `validatePreFlight` use it
   - What's unclear: Whether there's a canonical enum of tool names in the codebase
   - Recommendation: Read `services/execution-service/src/services/planner.service.ts` and `preflight-validator.ts` before implementing to confirm tool ID strings. If no canonical list exists, use descriptive names and document that the list is configurable.

2. **Should campaignType be stored on executions or remain a ring_leader_runs concern only?**
   - What we know: FORM-01 says "submits the value to the backend" and success criteria says "stores" — so yes, store it
   - What's unclear: Nothing; the phase spec is clear
   - Recommendation: Add `campaign_type varchar(20)` nullable column to executions table, store form value there

3. **Should the default for runtimeLimitMinutes be 60 (1 hour) to match the existing backend default of 3600 seconds?**
   - What we know: In `executions.ts` line 118: `runtimeLimitSeconds: runtimeLimitSeconds ?? 3600` (1 hour default)
   - Recommendation: Yes — default the form input to `60` minutes to match the existing backend default

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `services/ui/src/routes/new-execution/+page.svelte` — existing form patterns
- Direct code inspection: `services/ui/src/routes/new-execution/+page.server.ts` — existing server action
- Direct code inspection: `services/execution-service/src/routes/executions.ts` — POST handler with TypeBox schema
- Direct code inspection: `services/execution-service/src/services/execution.service.ts` — createExecution service
- Direct code inspection: `packages/db/src/schema/executions.ts` — DB schema (all columns verified)
- Direct code inspection: `packages/db/migrations/0013_add_llm_provider_allowed_domains.sql` — migration pattern

### Secondary (MEDIUM confidence)
- Project memory: "llmProvider validated at app level only (not DB enum)" — applies same principle to campaignType
- Project memory: "Migrations 0008–0010 are NOT in _journal.json — apply them manually via psql" — same manual apply needed for 0014

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — all patterns verified from actual codebase; no assumptions
- Pitfalls: HIGH — derived from direct code inspection of live files

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase; only invalidated by schema changes)
