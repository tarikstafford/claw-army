# Phase 5: Evolution Routes - Research

**Researched:** 2026-03-24
**Domain:** Akasa evolution system (soul, council, god layer, DNA capture) mounted on Paperclip's Express server with heartbeat lifecycle hook
**Confidence:** HIGH (codebase-grounded; findings verified against actual source files in both repos)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVO-01 | Soul system routes mounted on Paperclip's Express server — CRUD for bot_souls, soul generation, mutation engine | `akasaRouter` in `services/akasa-server/src/routes/index.ts` is the mount point. All soul logic already exists in `services/execution-service/src/services/soul-generator.ts` and routes in `routes/souls.ts` — both need to be migrated/re-implemented as Express routers |
| EVO-02 | Council evaluation routes — trigger 3-judge evaluation after heartbeat run completes, store verdicts | Council worker logic exists in `services/execution-service/src/queue/council-worker.ts`. Must be re-triggered by Paperclip heartbeat `run.succeeded` / `run.failed` completion. Routes for GET/POST verdicts exist in `routes/verdicts.ts` |
| EVO-03 | God Layer routes — class transitions, DNA capture, negative signal updates, triggered by confirmed verdicts | God Layer logic in `services/execution-service/src/queue/god-layer-worker.ts` and `src/god-layer/`. Routes for PATCH /verdicts/:id/confirm and PATCH /verdicts/:id/reject exist in `routes/verdicts.ts` |
| EVO-04 | Karpathy loop wired to Paperclip's heartbeat lifecycle — after each agent run: score → council → verdict → mutate/keep/discard → DNA capture | Heartbeat completion fires in `heartbeat.ts` within `executeRun()`. The `extraApiRouter` pattern cannot hook there. Need a post-run callback mechanism: either a live-events subscription or a `contextSnapshot` field the evolution service checks after run finishes |
| EVO-05 | Soul injection into Paperclip agent sessions — SOUL.md content injected as system prompt when heartbeat dispatches an agent | `agent.adapterConfig.systemPrompt` (for openai-compatible) or `agent.adapterConfig.instructionsFilePath` (for process-based adapters like claude_local) is where soul content goes. Need a route that sets these fields at agent creation or before wakeup |
| EVO-06 | Evolution event hooks — Paperclip emits events on heartbeat completion that trigger council evaluation pipeline | Paperclip's `publishLiveEvent()` (WebSocket) fires on run status change. The evolution trigger needs to subscribe to these or use a different mechanism — see research below |
</phase_requirements>

---

## Summary

Phase 5 wires the Akasa evolution engine (soul system, council evaluation, god layer, DNA capture) onto Paperclip's existing infrastructure. The challenge is architectural: the previous iteration built these as Fastify/BullMQ components inside `services/execution-service`, but v6.0 uses Paperclip's Express server as the primary backend. The work breaks into three parts:

**Part 1 (Routes):** Port soul CRUD, council verdict routes, and god layer confirm/reject routes from the old Fastify service to Express routers mounted via `akasaRouter` in `services/akasa-server/src/routes/index.ts`. The existing LLM logic (judge prompts, soul generator, god layer state machine) can be reused with minor adapter changes.

**Part 2 (Heartbeat Hook):** The critical architectural decision is how council evaluation gets triggered after a heartbeat run completes. Paperclip's `heartbeat.ts` does NOT provide an extension point hook — it's a closed service. The correct approach is a **Paperclip live-events subscriber**: subscribe to `heartbeat.run.log` events (or watch `heartbeat_runs.status` with polling) from outside the server. The cleaner and more reliable approach is polling — after a run transitions to `succeeded`/`failed`, the evolution service queries Paperclip's DB directly (shared DB) and enqueues council jobs. This is simpler than adding a WebSocket subscriber.

**Part 3 (Soul Injection):** Injecting a SOUL.md as the agent's system prompt requires setting `adapterConfig.systemPrompt` (for openai-compatible adapters) or writing the soul content to a file and setting `adapterConfig.instructionsFilePath` (for local process adapters like claude_local). The `PATCH /api/companies/:companyId/agents/:agentId` endpoint in Paperclip's Express server updates `adapterConfig`, so the evolution service can call its own API to inject soul content before agent dispatch.

**Primary recommendation:** Mount evolution routes under `/api/akasa/` using the existing `akasaRouter`. Use the shared Drizzle DB (`@claw/db`) to query Akasa tables directly (already coexistent in same Postgres DB). Trigger the council pipeline via a polling loop that watches `heartbeat_runs` table for newly completed runs that have an associated Akasa `bot` record.

---

## Standard Stack

### Core (already in the project — no new installs for akasa-server)

| Library | Version | Purpose | Already Used In |
|---------|---------|---------|----------------|
| express | ^5.1.0 | Route mounting via akasaRouter | `services/akasa-server/` |
| drizzle-orm | 0.45.1 | Query both @claw/db tables and @paperclipai/db tables | `packages/db/src/client.ts` |
| ai (Vercel AI SDK) | ^6.0.90 | Council judge LLM calls (generateObject), soul generation | `services/execution-service/` |
| @ai-sdk/anthropic | ^3.0.45 | Council judges — Anthropic models | execution-service |
| @ai-sdk/openai | ^3.0.29 | Soul mutation, embeddings | execution-service |
| node:crypto | built-in | SHA-256 soul content hash, timing-safe compare | execution-service |
| zod | ^4.3.6 | Event schema validation | existing |

### New Dependencies for akasa-server

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| @ai-sdk/anthropic | ^3.0.45 | Council judges LLM calls | Same as execution-service |
| @ai-sdk/openai | ^3.0.29 | Soul mutation, embeddings | Same as execution-service |
| ai | ^6.0.90 | generateObject, generateText, embedMany | Same as execution-service |
| ioredis | ^5.9.3 | God layer Redis lock for DNA versioning | Same as execution-service |

**Version verification (confirmed from execution-service/package.json):** All versions listed are pinned in the existing workspace.

**Installation:**
```bash
pnpm --filter @claw/akasa-server add \
  "@ai-sdk/anthropic@^3.0.45" \
  "@ai-sdk/openai@^3.0.29" \
  "ai@^6.0.90" \
  "ioredis@^5.9.3" \
  "@claw/db@workspace:*" \
  "@claw/shared-types@workspace:*" \
  "drizzle-orm@0.45.1"
```

---

## Architecture Patterns

### The Mount Point: akasaRouter

The entire evolution route surface mounts through `services/akasa-server/src/routes/index.ts`. Currently it only has the health endpoint. All new routes use `/akasa/` prefix to avoid collisions with Paperclip's existing `/api/` routes.

```
services/akasa-server/src/
├── index.ts                    # Existing — createApp + extraApiRouter injection
└── routes/
    ├── index.ts                # Existing — akasaRouter mount point
    ├── souls.ts                # NEW — soul CRUD + generation + mutation
    ├── council.ts              # NEW — verdict GET/confirm/reject
    ├── god-layer.ts            # NEW — class transitions, DNA, negative signals (called from council confirm)
    └── evolution-trigger.ts   # NEW — polling loop + council enqueue
```

And reusable modules (ported from execution-service):

```
services/akasa-server/src/
├── council/
│   ├── performance-judge.ts   # PORT from execution-service
│   ├── soul-analyst.ts        # PORT from execution-service
│   └── devils-advocate.ts     # PORT from execution-service
├── god-layer/
│   ├── class-machine.ts       # PORT from execution-service (pure function — trivial)
│   ├── dna-writer.ts          # PORT from execution-service
│   ├── negative-register.ts   # PORT from execution-service
│   └── pioneer-tracker.ts     # PORT from execution-service
└── services/
    └── soul-generator.ts      # PORT from execution-service
```

**Key insight:** The council, god-layer, and soul modules in `services/execution-service/src/` are well-structured, mostly pure functions with clear DB dependencies. They import from `@claw/db` (not from Fastify or BullMQ). They can be ported to `services/akasa-server/src/` with minimal changes — the primary change is removing BullMQ queue dependencies and making them directly callable async functions instead.

### Pattern 1: extraApiRouter for Evolution Routes

**What:** `app.ts` in Paperclip accepts `extraApiRouter?: import('express').Router` which is mounted at `/api` AFTER all Paperclip routes. Akasa currently passes `akasaRouter` here.

**Implementation:**
```typescript
// Source: paperclip/server/src/app.ts lines 228-230
if (opts.extraApiRouter) {
  app.use("/api", opts.extraApiRouter);
}
```

**Convention:** All Akasa routes must use `/akasa/` prefix: `/api/akasa/souls`, `/api/akasa/verdicts`, `/api/akasa/evolution/trigger`. This prevents collisions with Paperclip's own route prefixes (`/companies`, `/agents`, `/issues`, etc.).

**Auth:** The `actorMiddleware` runs on ALL routes including the extraApiRouter mount. `req.actor` is populated. For Akasa routes, check `req.actor.type === 'board'` for user authentication (same pattern as Paperclip routes).

### Pattern 2: Shared DB Access

**What:** Akasa tables (`bot_souls`, `council_verdicts`, `agent_classes`, etc.) live in the same Postgres database as Paperclip tables. Both are accessible from akasa-server.

**The two DB clients:**
- `@claw/db` — Akasa tables via `packages/db/src/client.ts` — singleton `db` exported, uses `DATABASE_URL`
- `@paperclipai/db` — Paperclip tables (`heartbeat_runs`, `agents`, etc.) via `createDb(config.databaseUrl)`

In `akasa-server/src/index.ts`, the Paperclip `db` instance is already created: `const db = createDb(config.databaseUrl)`. The Akasa `db` singleton (`@claw/db`) initializes from `process.env.DATABASE_URL` which is the same connection string. Both clients can coexist in one process because they use separate connection pools to the same database.

**Paperclip DB schema imports:**
```typescript
// To query heartbeat_runs from akasa-server:
import { heartbeatRuns, agents } from '@paperclipai/db';
```

### Pattern 3: Heartbeat Completion Trigger (EVO-04, EVO-06)

**The problem:** Paperclip's `heartbeat.ts` is a closed service — no extension hook for post-run callbacks. The `extraApiRouter` only adds HTTP routes; it cannot intercept internal service events.

**Verified approach: polling the shared DB**

After a heartbeat run completes (status transitions to `succeeded`/`failed`), the Akasa evolution trigger queries `heartbeat_runs` directly for runs that:
1. Have `status IN ('succeeded', 'failed')`
2. Have `finishedAt` within the last N minutes (sliding window)
3. Correspond to an agent that has an associated Akasa `bot` record (via `agent.id` ↔ `bots` relationship)
4. Do NOT already have a `council_verdicts` row for the run

**Why polling instead of WebSocket subscription:**
- Paperclip's `publishLiveEvent()` sends to WebSocket clients (the browser/SvelteKit) — not to server-side subscribers
- Adding a WebSocket client inside akasa-server to listen to its own WebSocket server is circular and fragile
- Polling the shared DB is simpler, more reliable, and gives idempotency for free

**Polling interval:** Every 60 seconds is sufficient. Council evaluation is a post-run async process, not time-critical.

**Trigger function signature:**
```typescript
// services/akasa-server/src/routes/evolution-trigger.ts
export async function checkAndTriggerCouncilEvaluations(
  paperclipDb: Db,         // @paperclipai/db instance
  akasaDb: Database,       // @claw/db instance
): Promise<{ triggered: number }>;
```

### Pattern 4: Soul Injection (EVO-05)

**How Paperclip adapters receive the system prompt:**

For `claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `cursor` adapters: the soul content should be written to a file and `adapterConfig.instructionsFilePath` set to the absolute path. Paperclip reads this file at run time.

For `openai_compatible` adapter (the one most likely used in dev): `adapterConfig.systemPrompt` is a direct string field read at line 45 of `openai-compatible/execute.ts`.

**Source:** `paperclip/server/src/routes/agents.ts` lines 48-55 confirm `instructionsFilePath` is the standard key for process-based adapters.

**Injection strategy:** Before an agent runs (or on agent creation), write the soul content to a temp file and PATCH `adapterConfig.instructionsFilePath` via the Paperclip API:

```
PATCH /api/companies/:companyId/agents/:agentId
Body: { adapterConfig: { instructionsFilePath: "/tmp/souls/{soulId}.md" } }
```

Alternatively, for `openai_compatible`:
```
PATCH /api/companies/:companyId/agents/:agentId
Body: { adapterConfig: { systemPrompt: "<full SOUL.md content>" } }
```

**The contextSnapshot approach:** Paperclip also supports injecting context via `contextSnapshot` fields when waking an agent. However, this is less reliable as the adapter must explicitly read these fields. The `adapterConfig` path is the standard, adapter-agnostic approach.

**Recommended:** For MVP, write soul content to a well-known directory (`~/.akasa/souls/{soulId}.md`) and set `instructionsFilePath`. This is the intended pattern for local adapters.

### Pattern 5: Express Router vs Fastify

The existing evolution code uses Fastify-specific patterns:
- `FastifyPluginAsyncTypebox` route handlers
- TypeBox schemas for request/response validation
- `fastify.log` for logging

**Porting to Express:**
```typescript
// Old Fastify pattern:
export const soulsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/:id', { schema: { ... } }, async (request, reply) => { ... });
};

// New Express pattern:
export function soulsRouter(): Router {
  const router = Router();
  router.get('/:id', async (req, res, next) => {
    try {
      // handler logic
    } catch (err) {
      next(err);
    }
  });
  return router;
}
```

**Validation:** Use `zod.parse()` or manual validation at route entry — no TypeBox needed. Paperclip's own routes use manual validation. The `validate` middleware exists at `paperclip/server/src/middleware/validate.ts` if needed.

**Error responses:** Use `res.status(404).json({ error: 'Not found' })` — same as Paperclip's own route handlers.

### Anti-Patterns to Avoid

- **Mounting BullMQ workers in akasa-server:** The old execution-service used BullMQ queues for council and god-layer. In akasa-server, run these as direct async calls triggered from the polling loop — no queue needed at this scale. BullMQ adds Redis dependency and complexity not justified for single-tenant.
- **Using `@claw/db`'s singleton `db` export without DATABASE_URL:** The Akasa DB client initializes from `process.env.DATABASE_URL`. Ensure this is set in akasa-server's dev environment (same as `config.databaseUrl`).
- **Patching Paperclip source files:** Evolution hooks must NOT modify `paperclip/server/src/services/heartbeat.ts`. Use the polling approach instead.
- **Prefixing routes without `/akasa/`:** Paperclip's `extraApiRouter` mounts at `/api` — any route without a distinguishing prefix could collide. Always use `/akasa/` prefix.
- **Importing from execution-service:** The old code in `services/execution-service/` still exists but is not connected in v6.0. Do NOT import from it — port the needed modules into `services/akasa-server/src/`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Council LLM calls | Custom Claude API client | Existing judge modules from execution-service | `council/performance-judge.ts`, `soul-analyst.ts`, `devils-advocate.ts` already use Vercel AI SDK correctly |
| Soul mutation | New LLM mutation logic | `services/soul-generator.ts` already implements full mutation engine | 300-line tested implementation with embedding similarity deduplication |
| Class state machine | Custom transition logic | `god-layer/class-machine.ts` — pure function, zero deps | Already handles all 5 CLAS rules correctly |
| DNA versioning | Custom version increment | `god-layer/dna-writer.ts` — existing pattern with MAX(version)+1 | Already handles concurrent write safety |
| Soul content hashing | Custom hash | `createHash('sha256')` already used in soul-generator | SHA-256 used consistently, `contentHash` column already populated |
| Verdict confirmation | Custom god layer trigger | Port `god-layer-worker.ts` logic as a direct async function | All class transition logic tested in execution-service |

---

## Runtime State Inventory

This phase involves no rename/refactor. However, there are critical runtime considerations:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Akasa tables (`bot_souls`, `council_verdicts`, etc.) in the shared DB — populated by old execution-service if any runs happened | No migration needed — tables are empty in v6.0 fresh install; if pre-existing data exists, it's still valid schema |
| Live service config | `services/execution-service` is no longer the primary backend — its routes are not mounted in v6.0 | Code edit only — do NOT delete execution-service yet (it has reference logic); just don't import from it in akasa-server |
| OS-registered state | None found for evolution routes specifically | None |
| Secrets/env vars | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL` needed for council LLM calls and god-layer locks | Ensure akasa-server's env has these |
| Build artifacts | `services/execution-service` still present — will NOT be called in v6.0 | None required; leave as reference |

---

## Common Pitfalls

### Pitfall 1: Missing @claw/db in akasa-server dependencies

**What goes wrong:** `akasa-server/package.json` currently has only `express` as a dependency. Importing `@claw/db` will fail at runtime without adding it.

**Why it happens:** The service was created as a thin shim in Phase 1 with minimal dependencies.

**How to avoid:** Add `@claw/db`, `@claw/shared-types`, and LLM SDK packages to `akasa-server/package.json` before implementing routes.

**Warning signs:** `Cannot find module '@claw/db'` at startup.

### Pitfall 2: Paperclip DB vs Akasa DB confusion

**What goes wrong:** `heartbeat_runs` is in Paperclip's DB schema (`@paperclipai/db`). `council_verdicts` is in Akasa's DB schema (`@claw/db`). Both are in the same physical database, but accessed via different Drizzle instances with different schema objects.

**Why it happens:** Phase 1 established dual-schema coexistence in one Postgres DB with separate migration journals. The Drizzle instances use different schema maps.

**How to avoid:** Always import table references from the correct package:
```typescript
import { heartbeatRuns, agents } from '@paperclipai/db'; // Paperclip tables
import { councilVerdicts, botSouls, db } from '@claw/db'; // Akasa tables
```

For cross-schema joins (if needed), use the raw SQL `sql` template tag with explicit table names.

### Pitfall 3: Evolution trigger for wrong heartbeat runs

**What goes wrong:** Not all Paperclip heartbeat runs correspond to Akasa evolution bots. Generic Paperclip agents (not associated with an Akasa `bots` record) should not trigger council evaluation.

**Why it happens:** Paperclip manages heartbeat runs for all agents regardless of whether they're in Akasa's fleet.

**How to avoid:** The polling loop must join `heartbeat_runs` with Akasa's `bots` table on `agents.id`. Only trigger council evaluation for runs where `bots.executionId` is populated (i.e., the agent was spawned by Akasa).

**Linking mechanism:** When an Akasa execution spawns a Paperclip agent, the `bots.containerId` or `bots.id` should be linked to `agents.id`. In v6.0, this linkage needs to be established — likely via `contextSnapshot.akasaBotId` set in the wakeup request.

**WARNING (LOW confidence):** The exact linking mechanism between Paperclip agents and Akasa bots is not yet established in the codebase. Phase 5 likely needs a `bots.paperclipAgentId` column or equivalent to make the EVO-04 trigger work. This is a gap that needs to be resolved during planning.

### Pitfall 4: Soul injection timing

**What goes wrong:** If soul content is injected via `PATCH agent adapterConfig` after a wakeup request is already enqueued, the agent runs with the old (or default) system prompt.

**Why it happens:** Paperclip's heartbeat scheduler picks up queued runs and dispatches them. If the PATCH happens after dispatch, the run already has the old config.

**How to avoid:** Inject soul content into `adapterConfig` at agent creation time or immediately after agent hire — before any wakeup requests are issued. For a fresh execution, this means: create agent → set soul → then wake agent.

### Pitfall 5: Devil's Advocate must use different LLM provider

**What goes wrong:** The three council judges must use different providers for integrity. If all three use Anthropic, the devil's advocate requirement from CLAUDE.md is violated.

**Why it happens:** Simplifying by using the same SDK for all judges.

**How to avoid:** The existing `council/devils-advocate.ts` in execution-service uses `@ai-sdk/google` (Gemini) for the Devil's Advocate. Preserve this pattern when porting.

**From CLAUDE.md:** "Council integrity: Devil's Advocate must always use a different LLM provider family than Performance Judge."

### Pitfall 6: Missing Akasa migrations for pgvector

**What goes wrong:** `bot_souls.embedding` is a `vector(1536)` column. This requires the pgvector extension. If running against a fresh Postgres without pgvector, soul generation (which calls `embedMany`) will fail when attempting to write embeddings.

**How to avoid:** Confirm pgvector is installed: `SELECT * FROM pg_extension WHERE extname = 'vector'`. Soul generation should not fail if embedding is null — make embedding writes optional/non-blocking.

### Pitfall 7: Council worker removal confusion

**What goes wrong:** The old `services/execution-service/src/queue/council-worker.ts` and `god-layer-worker.ts` start BullMQ workers at `main.ts`. In v6.0, if execution-service is still accidentally started alongside akasa-server, both try to process council jobs.

**How to avoid:** In v6.0, `services/execution-service` should NOT be started as part of `pnpm dev`. Only `akasa-server` and the `ui` run. Verify by checking `package.json` scripts at the root level.

---

## Code Examples

### Express Router Pattern for Evolution Routes

```typescript
// Source: paperclip/server/src/routes/agents.ts (Paperclip's Express pattern)
import { Router } from 'express';
import { db } from '@claw/db';               // Akasa DB
import { botSouls } from '@claw/db';
import { eq } from 'drizzle-orm';

export function soulsRouter(): Router {
  const router = Router();

  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const rows = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.id, id))
        .limit(1);
      if (!rows[0]) {
        res.status(404).json({ error: 'Soul not found' });
        return;
      }
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

### Mount Pattern in akasaRouter

```typescript
// services/akasa-server/src/routes/index.ts
import { Router } from 'express';
import { soulsRouter } from './souls.js';
import { councilRouter } from './council.js';
import { evolutionTriggerRouter } from './evolution-trigger.js';

const akasaRouter = Router();

akasaRouter.get('/akasa/health', (_req, res) => {
  res.json({ status: 'ok', service: 'akasa', timestamp: new Date().toISOString() });
});

akasaRouter.use('/akasa/souls', soulsRouter());
akasaRouter.use('/akasa/verdicts', councilRouter());
akasaRouter.use('/akasa/evolution', evolutionTriggerRouter());

export { akasaRouter };
```

### Heartbeat Completion Polling Pattern

```typescript
// services/akasa-server/src/routes/evolution-trigger.ts
import { heartbeatRuns, agents } from '@paperclipai/db';
import { councilVerdicts, bots, db as akasaDb } from '@claw/db';
import type { Db as PaperclipDb } from '@paperclipai/db';
import { eq, and, inArray, isNull, gt } from 'drizzle-orm';
import { runCouncilEvaluation } from '../council/council-runner.js';

const POLLING_WINDOW_MINUTES = 5;

export async function checkAndTriggerCouncilEvaluations(
  paperclipDb: PaperclipDb,
): Promise<{ triggered: number }> {
  const cutoff = new Date(Date.now() - POLLING_WINDOW_MINUTES * 60 * 1000);

  // Find recently completed heartbeat runs for Akasa-managed agents
  // that don't yet have a council verdict
  const completedRuns = await paperclipDb
    .select({ runId: heartbeatRuns.id, agentId: heartbeatRuns.agentId })
    .from(heartbeatRuns)
    .where(
      and(
        inArray(heartbeatRuns.status, ['succeeded', 'failed']),
        gt(heartbeatRuns.finishedAt, cutoff),
      )
    );

  // ... cross-reference with Akasa bots table to find runs that need council
  let triggered = 0;
  for (const run of completedRuns) {
    // Check if this agent has a corresponding Akasa bot record
    // (via bots.paperclipAgentId — new column needed per Pitfall 3)
    // If yes and no verdict exists: trigger council
    // runCouncilEvaluation(run).catch(console.error);
    triggered++;
  }
  return { triggered };
}
```

### Soul Content Injection via Paperclip API

```typescript
// Inject soul before agent dispatch — call this from an Akasa route handler
async function injectSoulIntoAgent(
  agentId: string,
  companyId: string,
  soulContent: string,
  soulId: string,
): Promise<void> {
  const soulPath = `/tmp/akasa-souls/${soulId}.md`;
  await writeFile(soulPath, soulContent, 'utf8');

  // PATCH the agent's adapterConfig via Paperclip's own API
  // (akasa-server runs as part of the same process, so it can call internal routes
  // OR update the DB directly via paperclipDb)
  await paperclipDb
    .update(agents)
    .set({
      adapterConfig: {
        // merge with existing config
        instructionsFilePath: soulPath,
      },
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));
}
```

### Ported Council Judge Call Pattern

```typescript
// Source: services/execution-service/src/queue/council-worker.ts (for reference)
// Port to: services/akasa-server/src/council/council-runner.ts
import { runPerformanceJudge } from './performance-judge.js';
import { runSoulAnalyst } from './soul-analyst.js';
import { runDevilsAdvocate } from './devils-advocate.js';
import { db, councilVerdicts } from '@claw/db';

export async function runCouncilForBot(
  executionId: string,
  botId: string,
  soulId: string | null,
): Promise<void> {
  // Assemble context (same pattern as council-worker.ts)
  const ctx = await assembleCouncilContext(executionId, botId, soulId);

  const [pjOutput, saOutput, daOutput] = await Promise.allSettled([
    runPerformanceJudge(ctx),
    runSoulAnalyst(ctx),
    runDevilsAdvocate(ctx),
  ]);

  // Compute weighted verdict, store in council_verdicts
  // (port existing logic from council-worker.ts lines 100-250)
  await db.insert(councilVerdicts).values({ ... });
}
```

---

## Open Questions

1. **How are Paperclip agents linked to Akasa bots? (UNRESOLVED — BLOCKS EVO-04)**
   - What we know: `bots` table has no `paperclipAgentId` column. In old v5.0 architecture, Akasa spawned bots directly on GCE VMs, not via Paperclip. In v6.0, Paperclip agents ARE the bots.
   - What's unclear: Which field(s) will establish the Akasa bot ↔ Paperclip agent relationship? Options: (a) add `bots.paperclipAgentId` FK, (b) use `bots.containerId` for the Paperclip agent ID, (c) pass `akasaBotId` in heartbeat `contextSnapshot`.
   - Recommendation: Add `bots.paperclipAgentId` column in a new Akasa migration. This is the cleanest FK relationship. The planner must include this schema change in Plan 01 before any heartbeat polling can work.

2. **Does v6.0 still use the Akasa `executions` table or is it replaced by Paperclip's agent/issue model? (MEDIUM uncertainty)**
   - What we know: Akasa's `executions` table (separate from Paperclip's `heartbeat_runs`) still exists in the schema. Council verdicts reference `execution_id`. The council evaluation context (`CouncilContext`) needs `executionId`.
   - What's unclear: In v6.0, does an Akasa "execution" still map to a Paperclip issue or project? Or does it map to individual heartbeat runs?
   - Recommendation: Keep the `executions` table as the Akasa-level concept (an objective run) and map individual heartbeat runs to it. A single Akasa execution may spawn multiple Paperclip agents (multiple heartbeat run cycles). Council evaluates each agent's runs per execution.

3. **How does soul mutation get triggered in the Karpathy loop? (EVO-04)**
   - What we know: Mutation happens in `soul-generator.ts`'s `generateMutatedSouls()` function, triggered after the god layer writes DNA. The trigger point in old v5.0 was via GodLayerWorker.
   - What's unclear: In v6.0, mutation should fire after a council verdict is confirmed (Promote/Maintain with good score). This is an extension to the god-layer flow.
   - Recommendation: Call soul mutation from inside the God Layer verdict-confirm handler. New souls are inserted into `bot_souls` and their `instructionsFilePath` is set on future agent dispatches.

4. **What happens to BullMQ in akasa-server? (RESOLVED)**
   - What we know: `ioredis` is needed for the god-layer Redis lock. But BullMQ queues are not needed — council evaluation runs as a direct async call, not a queued job.
   - Resolution: Add `ioredis` to akasa-server deps for the Redis lock only. No BullMQ dependency needed.

5. **Is the `decision_traces` table still used in v6.0? (LOW)**
   - What we know: The council evaluation context (`CouncilContext`) includes `decisionTraces` from `decision_traces` table. In v5.0, the bot-worker wrote decision traces during task execution.
   - What's unclear: In v6.0 with Paperclip adapters, who writes decision traces? The Paperclip process adapters (claude_local, etc.) don't know about Akasa's `decision_traces` table.
   - Recommendation: For v6.0 MVP, decision traces can be empty. Council should still work without them — the judge prompts degrade gracefully to token counts and outcome data from `heartbeat_runs.usageJson`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Akasa + Paperclip DB | ✓ | Cloud SQL at 10.101.0.3 | docker-compose.dev.yml for local |
| Redis | God layer category lock (ioredis) | Verify at runtime | — | Disable Redis lock in dev; use in-memory mutex |
| ANTHROPIC_API_KEY | Performance Judge + Soul Analyst LLM calls | ✓ (configured in env) | — | Cannot mock in production |
| OPENAI_API_KEY | Soul mutation embeddings, Devil's Advocate | ✓ (configured in env) | — | Cannot mock in production |
| pgvector extension | Soul embeddings in bot_souls | Must be installed manually | — | Make embedding writes non-fatal |

**Missing dependencies with no fallback:**
- ANTHROPIC_API_KEY / OPENAI_API_KEY — required for council evaluation. No fallback in production. Dev can use stub responses.

**Missing dependencies with fallback:**
- Redis for God Layer lock — if unavailable, use `async-mutex` (npm) as in-process fallback for single-tenant deployment.
- pgvector — make `embedding` writes skip silently if extension not available.

---

## Validation Architecture

Tests are in `services/execution-service/src/__tests__/` — these are the reference tests. For akasa-server, new unit tests are needed for the ported council/god-layer modules.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `services/akasa-server/vitest.config.ts` (does not exist yet — Wave 0 gap) |
| Quick run command | `pnpm --filter @claw/akasa-server exec vitest run` |
| Full suite command | `pnpm --filter @claw/akasa-server exec vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVO-01 | Soul CRUD routes return correct data | unit | `vitest run src/__tests__/souls.test.ts` | ❌ Wave 0 |
| EVO-02 | Council evaluation produces 3 verdicts in DB | integration (mock LLM) | `vitest run src/__tests__/council.test.ts` | ❌ Wave 0 |
| EVO-03 | God Layer confirm writes class transition + DNA | unit | `vitest run src/__tests__/god-layer.test.ts` | ❌ Wave 0 |
| EVO-04 | Polling loop finds completed runs and triggers council | unit (mock DB) | `vitest run src/__tests__/evolution-trigger.test.ts` | ❌ Wave 0 |
| EVO-05 | Soul content appears in agent adapterConfig | unit | `vitest run src/__tests__/soul-injection.test.ts` | ❌ Wave 0 |
| EVO-06 | Polling loop enqueues council job for completed heartbeat run | unit | part of EVO-04 test | ❌ Wave 0 |

The `class-machine.ts` pure function has a reference test pattern in execution-service that can be ported directly.

### Wave 0 Gaps
- [ ] `services/akasa-server/vitest.config.ts` — test configuration
- [ ] `services/akasa-server/src/__tests__/council.test.ts` — REQ EVO-02
- [ ] `services/akasa-server/src/__tests__/god-layer.test.ts` — REQ EVO-03
- [ ] `services/akasa-server/src/__tests__/souls.test.ts` — REQ EVO-01

---

## Sources

### Primary (HIGH confidence — verified against actual source files)

- `services/akasa-server/src/index.ts` — confirmed extraApiRouter injection pattern; `akasaRouter` already wired
- `services/akasa-server/src/routes/index.ts` — confirmed current state (health endpoint only); is the extension point
- `paperclip/server/src/app.ts` lines 228-230 — `extraApiRouter` mount verified at `/api`
- `paperclip/server/src/services/heartbeat.ts` — confirmed no extension hook in `executeRun()`; verified `finishedAt` set at completion; verified `publishLiveEvent()` goes to WebSocket clients only
- `paperclip/server/src/adapters/openai-compatible/execute.ts` line 45 — `config.systemPrompt` confirmed
- `paperclip/server/src/routes/agents.ts` lines 48-55 — `instructionsFilePath` confirmed for process adapters
- `packages/db/src/schema/bot-souls.ts` — full schema verified; `soulContent` text, `dimensions` jsonb, `embedding` vector(1536)
- `packages/db/src/schema/council-verdicts.ts` — full schema verified; `verdictType` enum, `godLayerProcessedAt` idempotency column
- `packages/db/src/schema/agent-classes.ts` — full schema verified; `currentClass` enum, progression counters
- `packages/db/src/schema/dna-store.ts` — `DnaPayload` interface verified; unique constraint on `(objectiveCategory, soulId, version)`
- `packages/db/src/schema/bots.ts` — no `paperclipAgentId` column confirmed (gap for EVO-04)
- `services/execution-service/src/council/performance-judge.ts` — portability confirmed; imports only `ai`, `@ai-sdk/anthropic`, `zod`
- `services/execution-service/src/god-layer/class-machine.ts` — pure function confirmed; zero DB deps
- `services/execution-service/src/queue/council-worker.ts` — import list verified; BullMQ-specific parts are isolated
- `services/execution-service/src/services/soul-generator.ts` — full mutation engine verified; imports `ai`, `@ai-sdk/openai`, `@claw/db`
- `services/akasa-server/package.json` — confirmed missing `@claw/db` and LLM SDK deps

### Secondary (MEDIUM confidence)

- `packages/db/drizzle.config.ts` — `__akasa_migrations` table confirmed; isolation from Paperclip's `__drizzle_migrations` confirmed
- `services/execution-service/package.json` — dep versions cross-referenced for akasa-server additions
- STATE.md — Phase 1 decisions confirm shared DB, Paperclip Express as primary backend, akasaRouter pattern

---

## Metadata

**Confidence breakdown:**
- Route mounting (EVO-01 routes): HIGH — `extraApiRouter` and `akasaRouter` patterns verified in source
- Heartbeat completion trigger (EVO-04, EVO-06): HIGH for polling approach; MEDIUM for the agent↔bot linkage (no `paperclipAgentId` column yet)
- Soul injection (EVO-05): HIGH — `instructionsFilePath` and `systemPrompt` patterns verified in adapter source
- Council/God Layer port: HIGH — modules are mostly pure functions with only `@claw/db` and Vercel AI SDK dependencies
- Missing `bots.paperclipAgentId` gap: HIGH confidence this is a gap; LOW confidence on exact resolution approach

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days — Paperclip server architecture is stable; adapter config patterns unlikely to change)
