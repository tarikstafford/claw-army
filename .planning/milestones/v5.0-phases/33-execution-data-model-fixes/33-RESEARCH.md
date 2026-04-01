# Phase 33: Execution Data Model Fixes - Research

**Researched:** 2026-03-02
**Domain:** Drizzle ORM schema migration, Fastify route handling, proxy domain filtering
**Confidence:** HIGH

## Summary

Phase 33 adds two fields to the `executions` table — `llmProvider` (varchar, nullable) and `allowedDomains` (text array, nullable) — and wires the Tool Gateway proxy to enforce per-execution domain filtering from the DB rather than only from a global env var.

The codebase investigation reveals this is a **mostly pre-wired phase**. The POST /executions TypeBox schema already declares both fields as optional (lines 32-33 of `services/execution-service/src/routes/executions.ts`), and the UI form (`services/ui/src/routes/new-execution/+page.server.ts`) already parses and sends both fields to the execution service. What's missing: the DB columns, the `createExecution()` service passing the new fields to `db.insert()`, and the Tool Gateway proxy doing per-execution lookup instead of only reading `PROXY_DOMAIN_ALLOWLIST`.

The two plans already written (33-01, 33-02) are accurate. This research document confirms their assumptions and adds implementation-critical details for both plans.

**Primary recommendation:** Execute plan 33-01 first (schema + service wire-up), then 33-02 (proxy filtering). Both are low-risk, narrowly scoped changes to existing code paths.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 (pinned) | ORM + schema definition | Already used throughout; pinned version in packages/db/package.json |
| drizzle-kit | 0.31.9 (pinned) | Migration generation | Already used for all prior migrations |
| @sinclair/typebox | ^0.34.48 | Fastify request/response schema | Already used in execution-service routes |
| @fastify/type-provider-typebox | ^6.1.0 | TypeBox integration | Already registered in tool-gateway and execution-service |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm/pg-core | (included) | `text`, `varchar`, `pgTable` helpers | Column type definitions in executions.ts |
| node:http IncomingMessage | built-in | Header extraction in proxy | Reading X-Execution-Id from CONNECT/HTTP proxy requests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| varchar(50) for llmProvider | pgEnum | Enum requires migration to add new providers; varchar is forward-compatible |
| In-memory TTL cache | Redis | Redis adds network hop; execution allowedDomains is write-once, 60s in-memory TTL is correct |
| X-Execution-Id header | Source IP mapping | Source IP doesn't map reliably to executionId; header is explicit and bot-controlled |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/
├── src/schema/executions.ts        # Add llmProvider + allowedDomains columns
├── migrations/0013_add_llm_provider_allowed_domains.sql  # New migration
└── migrations/meta/_journal.json   # Add idx 13 entry

services/execution-service/src/
├── services/execution.service.ts   # Add fields to CreateExecutionInput + db.insert()
└── routes/executions.ts            # Destructure + pass new fields; update GET schema

services/tool-gateway/src/
├── services/domain-allowlist.ts    # NEW: per-execution domain lookup with TTL cache
└── routes/proxy.ts                 # Make handlers async, wire getExecutionAllowedDomains
```

### Pattern 1: Nullable Column Addition (Drizzle)
**What:** Adding nullable columns to an existing table preserves backward compatibility — no default required, existing rows get NULL.
**When to use:** All backward-compatible additions to existing tables in this codebase.
**Example:**
```typescript
// packages/db/src/schema/executions.ts — add after allowedTools
llmProvider: varchar('llm_provider', { length: 50 }),         // nullable, no default
allowedDomains: text('allowed_domains').array(),               // nullable text array
```
Note: In Drizzle ORM, a column defined without `.notNull()` is automatically nullable. The `$inferSelect` and `$inferInsert` types will reflect `string | null` and `string[] | null` respectively — no manual type changes needed.

### Pattern 2: Manual Migration SQL (IF NOT EXISTS idempotency)
**What:** Migrations 0008-0010 use `IF NOT EXISTS` for idempotency because they were not tracked in `_journal.json`. Migrations 0011+ are journal-tracked. For 0013, use both `IF NOT EXISTS` AND add to journal (belt-and-suspenders given prior migration history).
**Example:**
```sql
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "llm_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "allowed_domains" text[];
```

### Pattern 3: Journal Entry Format
**What:** The `_journal.json` only tracks migrations 0000-0012. The next entry must be idx 13. The `when` field is epoch milliseconds.
**Current last entry:**
```json
{
  "idx": 12,
  "version": "7",
  "when": 1772700000000,
  "tag": "0012_add_ring_leader_task_id",
  "breakpoints": true
}
```
**New entry to add:**
```json
{
  "idx": 13,
  "version": "7",
  "when": <current epoch ms>,
  "tag": "0013_add_llm_provider_allowed_domains",
  "breakpoints": true
}
```

### Pattern 4: createExecution() Input Extension
**What:** `CreateExecutionInput` interface in `execution.service.ts` is the single source of truth for what gets persisted. Add optional fields, default to null in `db.insert()` values.
**Example:**
```typescript
export interface CreateExecutionInput {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
  llmProvider?: string;        // NEW
  allowedDomains?: string[];   // NEW
  objectiveId?: string;
}

// In db.insert(executions).values({...}):
llmProvider: input.llmProvider ?? null,
allowedDomains: input.allowedDomains ?? null,
```

### Pattern 5: Async CONNECT Handler Pattern
**What:** The existing `handleConnect` is synchronous. Adding an async DB lookup requires it to become async. The Node.js `server.on('connect', ...)` callback does NOT await promises — the async handler must be wrapped.
**Critical:** Getting this wrong causes unhandled promise rejections that silently swallow errors.
**Correct pattern:**
```typescript
// Wrong: promise is not awaited, errors are silent
fastify.server.on('connect', handleConnect);

// Correct: wrap async handler, catch errors explicitly
fastify.server.on('connect', (req, socket, head) => {
  handleConnect(req, socket, head).catch((err) => {
    console.error('[proxy/connect] Unhandled error:', err);
    socket.destroy();
  });
});
```

### Pattern 6: Per-Execution Domain Lookup with TTL Cache
**What:** Tool Gateway already imports `@claw/db` for the `checkAllowlist` function in `services/allowlist.ts`. The new `domain-allowlist.ts` service follows the same pattern.
**Example:**
```typescript
import { db, executions } from '@claw/db';
import { eq } from 'drizzle-orm';

const cache = new Map<string, { domains: string[] | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getExecutionAllowedDomains(
  executionId: string,
): Promise<string[] | null> {
  const now = Date.now();
  const cached = cache.get(executionId);
  if (cached && cached.expiresAt > now) return cached.domains;

  const rows = await db
    .select({ allowedDomains: executions.allowedDomains })
    .from(executions)
    .where(eq(executions.id, executionId));

  const domains = rows[0]?.allowedDomains ?? null;
  cache.set(executionId, { domains, expiresAt: now + CACHE_TTL_MS });
  return domains;
}
```

### Anti-Patterns to Avoid
- **Synchronous DB call in CONNECT handler:** The CONNECT handler is called on the raw Node.js TCP server. Any exception not caught will crash the server process. Wrap async handlers.
- **Default allowedDomains to empty array:** An empty array `[]` in the proxy means "allow all" (zero-length allowlist = open). Null means "not set, use global fallback." These are semantically different; use null for "not set."
- **pgEnum for llmProvider:** Adding a new provider (e.g., Google) would require a new migration. Use varchar(50) and validate at the application layer.
- **Running drizzle-kit generate for manual migrations:** Migrations 0008-0012 were hand-written (not generated). Running `drizzle-kit generate` would create a snapshot mismatch because the DB schema the kit knows about (via snapshots in `meta/`) may not match what's been manually applied. Write migration 0013 by hand and update `_journal.json` manually — the same approach used for 0008-0012.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTL cache for execution metadata | Custom Redis cache | Simple `Map` with `expiresAt` field | allowedDomains is write-once; Redis adds network latency; in-memory cache is correct for this workload |
| Domain suffix matching | Custom regex | `hostname === allowed \|\| hostname.endsWith('.${allowed}')` | Existing pattern in proxy.ts; no library needed |
| TypeBox nullable union | Custom type | `Type.Union([Type.String(), Type.Null()])` | Existing pattern in execution routes |

**Key insight:** This phase is configuration data wiring, not algorithmic complexity. The patterns are already established in the codebase; the work is surgical application of those patterns to two new fields.

## Common Pitfalls

### Pitfall 1: Drizzle-kit generate vs. manual migration
**What goes wrong:** Developer runs `pnpm --filter @claw/db generate` which creates a snapshot-based migration. This may conflict with the hand-written migrations 0008-0012 that are not reflected in any snapshot (the snapshots only go up to 0006 in `meta/`).
**Why it happens:** drizzle-kit tracks schema via snapshots in `meta/`. The manual migrations after 0006 are not in the snapshot history.
**How to avoid:** Write migration 0013 SQL by hand. Update `_journal.json` manually. Do NOT run `drizzle-kit generate` for this migration.
**Warning signs:** Generated migration includes unexpected DROP/CREATE statements for tables that already exist.

### Pitfall 2: Passing undefined vs null to db.insert for nullable columns
**What goes wrong:** `db.insert(executions).values({ allowedDomains: undefined })` may be treated differently than `null` by Drizzle — it may omit the column rather than inserting NULL, which is fine. But explicit `?? null` is clearer and matches the existing pattern for `objectiveId`.
**How to avoid:** Use `input.allowedDomains ?? null` in the insert values.

### Pitfall 3: CONNECT handler fires before headers are fully parsed
**What goes wrong:** In CONNECT requests, `req.headers['x-execution-id']` may not be available in all Node.js versions because CONNECT doesn't have a body — only headers.
**Reality check:** HTTP CONNECT headers ARE available on `req.headers` in Node.js. The header extraction pattern is safe. The bot VM's HTTP library (e.g., curl, node fetch with HTTP_PROXY) must send `X-Execution-Id` in the CONNECT request headers — this is standard HTTP proxy behavior.
**Note:** The bot VM configuration to inject `X-Execution-Id` is explicitly deferred to Phase 35+ (per plan 33-02). For now, the header will be absent and the proxy falls back to the global allowlist. This is correct and safe.

### Pitfall 4: GET /executions/:id response schema must include new fields
**What goes wrong:** Adding columns to the DB and inserting them but forgetting to expose them in the GET /executions/:id TypeBox response schema. The TypeBox schema serializes the response — fields not in the schema are stripped.
**How to avoid:** Plan 33-01 already specifies updating the GET response schema. Verify this step is not skipped.

### Pitfall 5: allowedDomains text[] Drizzle type
**What goes wrong:** Drizzle's `.array()` on a text column creates `TEXT[]` in PostgreSQL. Querying this column returns `string[] | null` in TypeScript when the column is nullable. The proxy code receives this correctly — but TypeBox schema for the GET response needs `Type.Union([Type.Array(Type.String()), Type.Null()])` not just `Type.Array(Type.String())`.
**How to avoid:** Use the nullable union pattern matching other optional fields in the GET response schema.

## Code Examples

Verified patterns from the existing codebase:

### Existing allowedTools text array in Drizzle schema
```typescript
// Source: packages/db/src/schema/executions.ts (line 21)
allowedTools: text('allowed_tools').array().notNull(),
// NEW (nullable variant):
allowedDomains: text('allowed_domains').array(),  // no .notNull() = nullable
```

### Existing nullable column pattern in executions
```typescript
// Source: packages/db/src/schema/executions.ts (lines 22-23)
taskCategory: varchar('task_category', { length: 255 }),        // nullable varchar
objectiveId: uuid('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
// Pattern for llmProvider:
llmProvider: varchar('llm_provider', { length: 50 }),           // nullable varchar
```

### Existing db lookup pattern in tool-gateway (allowlist.ts)
```typescript
// Source: services/tool-gateway/src/services/allowlist.ts
const rows = await db
  .select({ allowedTools: executions.allowedTools })
  .from(executions)
  .where(eq(executions.id, executionId));
// Same pattern for domain-allowlist.ts:
const rows = await db
  .select({ allowedDomains: executions.allowedDomains })
  .from(executions)
  .where(eq(executions.id, executionId));
```

### Existing TypeBox nullable union pattern (GET response)
```typescript
// Source: services/execution-service/src/routes/executions.ts (line 244)
claimedByBotId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
// Pattern for new fields:
llmProvider: Type.Union([Type.String(), Type.Null()]),
allowedDomains: Type.Union([Type.Array(Type.String()), Type.Null()]),
```

### Existing isDomainAllowed function (to be refactored)
```typescript
// Source: services/tool-gateway/src/routes/proxy.ts (lines 40-45)
function isDomainAllowed(hostname: string): boolean {
  if (PROXY_DOMAIN_ALLOWLIST.length === 0) return true;
  return PROXY_DOMAIN_ALLOWLIST.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}
// Refactored to accept per-execution override:
function isDomainAllowed(hostname: string, perExecutionDomains?: string[] | null): boolean {
  const allowlist = perExecutionDomains ?? PROXY_DOMAIN_ALLOWLIST;
  if (allowlist.length === 0) return true;
  return allowlist.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global PROXY_DOMAIN_ALLOWLIST only | Per-execution allowedDomains with global fallback | Phase 33 | Each execution can have a scoped domain boundary |
| llmProvider as UI-only concept | llmProvider persisted on execution row | Phase 33 | Backend can route LLM calls per execution |

**Pre-existing (but not yet persisted):**
- The UI already collects `llmProvider` and `allowedDomains` from the user and sends them to the execution service (verified in `+page.server.ts` lines 30-32).
- The POST /executions TypeBox schema already declares both fields as `Type.Optional` (verified in `routes/executions.ts` lines 32-33).
- Both fields are NOT yet in `CreateExecutionInput` and NOT yet passed to `db.insert()` — this is the gap this phase closes.

## Open Questions

1. **X-Execution-Id header injection into bot VM HTTP proxy config**
   - What we know: Plan 33-02 explicitly defers this to "Phase 35+". The proxy handler gracefully falls back to global allowlist when the header is absent.
   - What's unclear: Which phase wires the GCE bot launcher to set `X-Execution-Id` in the `HTTP_PROXY` configuration (or passes it another way).
   - Recommendation: Track as a known gap. The domain-allowlist service will be in place and working once the header injection is wired. No blocker for Phase 33.

2. **Migration apply process for production**
   - What we know: Migrations 0008-0010 note they must be applied manually via psql. The journal now tracks 0011-0012.
   - What's unclear: Whether 0013 needs manual psql apply or can be applied via `drizzle-kit migrate`.
   - Recommendation: Given that snapshots only go to 0006, safest approach is manual psql: `psql -U postgres -d clawdb -f migrations/0013_add_llm_provider_allowed_domains.sql`. The `IF NOT EXISTS` guards make this safe to re-run.

3. **`llmProvider` validation — is the string format enforced?**
   - What we know: The UI sends `anthropic` or `openai`. The TypeBox schema accepts any `Type.String()`. The column is `varchar(50)`.
   - What's unclear: Whether the execution service should validate that `llmProvider` is one of the known values.
   - Recommendation: Out of scope for Phase 33 (phase goal is storage, not routing). Add validation when the value is actually used to route LLM calls.

## Sources

### Primary (HIGH confidence)
- Codebase: `packages/db/src/schema/executions.ts` — current schema, verified nullable column pattern
- Codebase: `packages/db/migrations/meta/_journal.json` — confirmed last entry is idx 12
- Codebase: `packages/db/migrations/0012_add_ring_leader_task_id.sql` — migration format reference
- Codebase: `services/execution-service/src/routes/executions.ts` — confirmed TypeBox schema already has both fields declared; GET response schema does NOT yet include them
- Codebase: `services/execution-service/src/services/execution.service.ts` — confirmed CreateExecutionInput lacks both fields; db.insert() does not pass them
- Codebase: `services/tool-gateway/src/routes/proxy.ts` — confirmed proxy is sync, reads only PROXY_DOMAIN_ALLOWLIST
- Codebase: `services/tool-gateway/src/services/allowlist.ts` — confirmed pattern for DB lookup in tool-gateway
- Codebase: `services/ui/src/routes/new-execution/+page.server.ts` — confirmed UI already sends both fields to execution service

### Secondary (MEDIUM confidence)
- Drizzle ORM docs (training knowledge): `.array()` on text column creates `TEXT[]`; nullable by omitting `.notNull()`; `$inferSelect` / `$inferInsert` reflect nullability correctly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions pinned
- Architecture: HIGH — patterns verified directly from existing codebase files
- Pitfalls: HIGH — drizzle-kit generate risk verified by checking meta/ snapshot history; other pitfalls verified from existing code

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable — no fast-moving dependencies involved)
