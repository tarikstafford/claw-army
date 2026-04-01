# Phase 36: Pre-Flight Manifest Review - Research

**Researched:** 2026-03-03
**Domain:** SvelteKit routing, Fastify execution status state machine, pre-flight gate pattern
**Confidence:** HIGH

## Summary

Phase 36 inserts a human confirmation gate between form submission and bot spawning. Currently, `POST /executions` creates the execution record, spawns the Ring Leader, assembles the population manifest, and immediately fires `assemblePopulation()` (which calls `spawnAgentsForRun()`) — all without any user review. The phase requires the user to review the populated manifest before bots are actually spawned.

The key challenge is that the manifest assembly is inherently async (LLM calls to classify tasks, search the soul library, generate pioneers). The user cannot review the manifest instantly — there is a waiting period while assembly runs. The pre-flight gate must therefore have a "pending" state (`pre_flight`) where the execution row exists and assembly is in progress, a "ready to confirm" state when the manifest is complete, and a confirm/cancel action that either proceeds to `queued` → `running` or cancels the execution.

The cleanest approach: add a `pre_flight` value to the `execution_status` enum (or use a dedicated `pre_flight_status` column on the `ring_leader_runs` table), hold the execution at `pre_flight` status after `POST /executions`, complete the population assembly, then require a `POST /executions/:id/confirm` before transitioning to `queued` and proceeding with bot spawning. The UI redirects to `/executions/:id/pre-flight` after form submission, polls until the manifest is assembled, then presents confirm/cancel actions.

**Primary recommendation:** Add a `pre_flight` status to the `execution_status` enum on the `executions` table. POST /executions creates the row with status `pre_flight` (not `queued`), assembles the manifest without spawning bots, then exposes `POST /executions/:id/confirm` (transition `pre_flight` → `queued`, then fire bot spawn) and `POST /executions/:id/cancel` (transition `pre_flight` → `stopped`). UI routes to `/executions/:id/pre-flight` with polling until the Ring Leader run has a non-null `populationManifest`.

## Current State Analysis

### The existing flow (what must change)

```
POST /executions
  ├── planObjectiveAsTaskGraph()        ← synchronous LLM call
  ├── validatePreFlight()               ← synchronous validation
  ├── createExecution()                 ← DB insert, status='queued'
  ├── reply.status(201).send(result)    ← returns {executionId, status:'queued'}
  └── setImmediate(async () => {
        spawnRingLeader()               ← creates ring_leader_runs row, calls assemblePopulation()
        transitionExecution(queued → running)
        publishExecutionStatusChanged()
      })
```

**UI redirect:** `/executions/${executionId}` — the execution dashboard (status monitoring page).

### What needs to change

1. `POST /executions` must hold the execution at `pre_flight` instead of `queued`/`running`
2. `assemblePopulation()` must complete WITHOUT calling `spawnAgentsForRun()` — just populate the manifest
3. A new `POST /executions/:id/confirm` endpoint transitions `pre_flight` → `queued` and triggers bot spawning
4. A new `POST /executions/:id/cancel` endpoint transitions `pre_flight` → `stopped`
5. UI redirects to `/executions/:id/pre-flight` instead of `/executions/:id`
6. New SvelteKit route `/executions/[id]/pre-flight/+page.svelte` polls for manifest readiness, renders the manifest, and presents confirm/cancel

### Files that need modification

**Backend (plan 36-01):**
- `packages/db/src/schema/executions.ts` — add `pre_flight` to `executionStatusEnum`
- New migration file for the enum addition
- `packages/db/migrations/meta/_journal.json` — update journal
- `services/execution-service/src/services/assemble-population.ts` — stop calling `spawnAgentsForRun()` at the end; return after persisting manifests
- `services/execution-service/src/routes/executions.ts` — add `POST /:id/confirm` and `POST /:id/cancel` endpoints; change initial status to `pre_flight`
- `services/execution-service/src/services/execution.service.ts` — minor: `transitionExecution` already handles arbitrary status pairs; `createExecution()` must accept/use `pre_flight` as initial status
- `packages/shared-types/src/execution.ts` — add `pre_flight` to `ExecutionStatus` type

**Frontend (plan 36-02):**
- `services/ui/src/routes/new-execution/+page.server.ts` — redirect to `/executions/${executionId}/pre-flight` instead of `/executions/${executionId}`
- New route: `services/ui/src/routes/executions/[id]/pre-flight/+page.svelte`
- New route server: `services/ui/src/routes/executions/[id]/pre-flight/+page.server.ts` (load function with auth check)
- `services/ui/src/lib/api.ts` — add `confirmExecution()` and `cancelExecution()` functions
- `services/ui/src/lib/types.ts` — add `pre_flight` to `Execution.status` union

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | project version | Routing, `$state`, `$derived`, `$effect` for reactive polling | Already used throughout UI |
| Drizzle ORM pgEnum | project version | Enum extension for DB status column | Already used for executionStatusEnum |
| TypeBox (`@sinclair/typebox`) | project version | Runtime route schema validation | Already used in all execution routes |
| `@fastify/type-provider-typebox` | project version | Typed Fastify plugins | Already used in executionsRoutes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `$app/navigation` goto | SvelteKit | Client-side redirect after confirm/cancel | Used in new-execution page already |

**Installation:** No new packages required.

## Architecture Patterns

### Pattern 1: SvelteKit polling with `$effect` + `setInterval`

The existing `/executions/[id]/+page.svelte` polls `getRingLeaderState()` and `getExecutionBots()` every 5 seconds using `$effect` + `setInterval`. The pre-flight page uses the same pattern to poll `getRingLeaderManifest()` until `manifests.length > 0` (non-empty manifest = assembly complete).

```typescript
// Source: services/ui/src/routes/executions/[id]/+page.svelte (existing polling pattern)
$effect(() => {
  if (!browser) return;
  getRingLeaderManifest(executionId).then(m => { manifest = m; }).catch(() => {});
  const interval = setInterval(() => {
    getRingLeaderManifest(executionId).then(m => { manifest = m; }).catch(() => {});
  }, 3000);
  return () => clearInterval(interval);
});
```

Stop polling when `manifest.manifests.length > 0 || manifest.status === 'failed'`.

### Pattern 2: Fastify status-guarded endpoint

The existing `POST /:id/stop` endpoint does `await transitionExecution(id, 'running', 'stopped')`. The confirm/cancel endpoints follow the same pattern using `pre_flight` as the `fromStatus`:

```typescript
// Pattern from: services/execution-service/src/routes/executions.ts (existing stop endpoint)
fastify.post('/:id/confirm', { schema: { ... } }, async (request, reply) => {
  const { id } = request.params;
  const execution = await getExecution(id);
  if (!execution) return reply.code(404).send({ error: 'Execution not found' });
  if (execution.status !== 'pre_flight') {
    return reply.code(409).send({ error: 'Execution is not in pre_flight status' });
  }
  // Transition to queued
  const transitioned = await transitionExecution(id, 'pre_flight', 'queued');
  if (!transitioned) return reply.code(409).send({ error: 'Transition conflict' });

  // Fire bot spawning
  setImmediate(async () => {
    // Get the ring leader run, call spawnAgentsForRun()
  });
  return reply.code(200).send({ success: true });
});
```

### Pattern 3: Enum extension in Drizzle ORM + PostgreSQL

Adding a value to a PostgreSQL enum requires `ALTER TYPE`. Drizzle migrations use raw SQL for enum changes:

```sql
-- packages/db/migrations/00NN_add_pre_flight_status.sql
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'pre_flight';
```

The Drizzle schema file (`packages/db/src/schema/executions.ts`) must also be updated to add `'pre_flight'` to the `pgEnum` array:

```typescript
// Source: packages/db/src/schema/executions.ts
export const executionStatusEnum = pgEnum('execution_status', [
  'pre_flight',  // NEW: waiting for user confirmation after manifest assembly
  'queued',
  'running',
  'paused',
  'stopped',
  'completed',
  'failed',
]);
```

CRITICAL: `ALTER TYPE ... ADD VALUE` cannot be run inside a transaction in PostgreSQL. The migration must use `-- drizzle-kit: no-transaction` or run the ALTER outside a transaction block.

### Pattern 4: separating assemblePopulation from spawnAgentsForRun

Currently `assemble-population.ts` calls `spawnAgentsForRun()` at the end (Step 9). For pre-flight, this call must be removed from `assemblePopulation()`. The spawn must happen only when the user confirms.

The cleanest approach: `assemblePopulation()` ends after persisting `populationManifest` to DB (existing Step 8). It does NOT call `spawnAgentsForRun()`. The `POST /:id/confirm` handler fetches the Ring Leader run, reads `populationManifest` and `missionBrief`, and calls `spawnAgentsForRun()` directly.

```typescript
// services/execution-service/src/routes/executions.ts — confirm handler
setImmediate(async () => {
  const [runRow] = await db.select().from(ringLeaderRuns).where(eq(ringLeaderRuns.executionId, id));
  if (!runRow || !runRow.populationManifest) {
    // manifest not ready (shouldn't happen if pre_flight→queued gate works)
    fastify.log.error({ id }, 'Confirm called but manifest not yet assembled');
    return;
  }
  await spawnAgentsForRun({
    ringLeaderRunId: runRow.id,
    executionId: id,
    missionBrief: runRow.missionBrief as RingLeaderMissionBrief,
    manifests: runRow.populationManifest as PopulationManifest[],
  });
});
```

### Pattern 5: Pre-flight page route structure

The pre-flight review page is a new SvelteKit route alongside `/executions/[id]/`:

```
services/ui/src/routes/
├── executions/
│   └── [id]/
│       ├── +page.svelte              ← existing execution dashboard
│       ├── pre-flight/
│       │   ├── +page.server.ts       ← load: auth check, redirect if not pre_flight
│       │   └── +page.svelte          ← manifest review UI with confirm/cancel
│       ├── bots/
│       │   └── [botId]/+page.svelte
│       └── report/+page.svelte
```

The `+page.server.ts` load function checks auth (consistent with other routes) and may optionally redirect if the execution status is not `pre_flight` (e.g., if user lands here after already confirming).

### Anti-Patterns to Avoid

- **Polling indefinitely:** Stop polling when the manifests are loaded OR when the Ring Leader run status is `'failed'`. Infinite polling wastes resources and creates confusing UX if assembly failed.
- **Confirming before manifest is ready:** The confirm button must be disabled until `manifests.length > 0`. The UI must guard against submitting confirm while still assembling.
- **Allowing confirm on non-pre_flight executions:** The `POST /:id/confirm` handler must check `execution.status === 'pre_flight'` before proceeding and return 409 if not.
- **Removing assemble-population tests:** Existing tests import `assemblePopulation` — removing the `spawnAgentsForRun()` call changes the observable behavior tested. Update tests accordingly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic confirm UI | Custom race-condition handler | `use:enhance` with loading state | SvelteKit enhance handles in-flight state already |
| Polling termination | Custom observable/event system | `$effect` + `setInterval` with reactive stop condition | Already established pattern in the codebase |
| Enum migration | Hand-written ALTER outside Drizzle | `ALTER TYPE ... ADD VALUE IF NOT EXISTS` in raw SQL migration | This is the standard PostgreSQL/Drizzle pattern |
| Status guard | Separate authorization middleware | `transitionExecution(id, 'pre_flight', 'queued')` returns false if wrong status | The atomic UPDATE...WHERE pattern already handles races |

## Common Pitfalls

### Pitfall 1: PostgreSQL enum ADD VALUE in transaction
**What goes wrong:** `ALTER TYPE execution_status ADD VALUE 'pre_flight'` fails with "ALTER TYPE ... ADD VALUE cannot run inside a transaction block" if the migration runner wraps it in a transaction.
**Why it happens:** Drizzle Kit migrations run inside transactions by default; PostgreSQL does not allow enum value additions inside transactions.
**How to avoid:** Use `IF NOT EXISTS` and mark the migration to run outside a transaction. In the raw SQL migration file, check whether Drizzle Kit supports a `-- disable-transaction` annotation (similar to other ORMs). If not, apply the enum migration manually via psql and mark it in `_journal.json` as applied (consistent with how migrations 0008-0010 were handled in this project — see MEMORY.md).
**Warning signs:** Migration failure message mentioning "transaction block" or "enum value already committed."

### Pitfall 2: Confirm fires before manifest ready
**What goes wrong:** User hits confirm before `populationManifest` is fully written to the DB (ring_leader_runs status is still `assembling`). The confirm handler calls `spawnAgentsForRun` with an empty or null manifest.
**Why it happens:** Assembly is async; the confirm endpoint must check that the manifest exists before spawning.
**How to avoid:** In `POST /:id/confirm`, after fetching the ring leader run, check `runRow.populationManifest != null && Array.isArray(runRow.populationManifest) && runRow.populationManifest.length > 0`. Return 409 if not ready. Additionally, disable the confirm button in the UI until `manifest.manifests.length > 0`.
**Warning signs:** Empty manifests array or null passed to spawnAgentsForRun.

### Pitfall 3: Ring Leader run transitions assembling → spawning before confirm
**What goes wrong:** `assemblePopulation()` currently transitions the Ring Leader run status from `assembling` to `spawning` in Step 8. Without bot spawning, this transition is misleading — `spawning` implies agents are being launched.
**Why it happens:** The status enum was designed assuming immediate spawning after assembly.
**How to avoid:** Either keep `spawning` status (and accept it means "ready to spawn, waiting for confirmation") OR update the Ring Leader status to a new intermediate state like `assembled` after manifest persistence. The simplest approach: leave the ring_leader_runs status as `spawning` (it means "population determined, ready for spawn") but make the UI text say "Manifest ready — confirm to deploy" instead of literally showing "spawning."
**Warning signs:** Users confused by seeing "spawning" status before they confirm.

### Pitfall 4: Cancel leaves orphaned ring_leader_runs row
**What goes wrong:** `POST /:id/cancel` transitions the execution to `stopped` but leaves the `ring_leader_runs` row with status `assembling` or `spawning`.
**Why it happens:** Cancel only updates the `executions` table; the Ring Leader run row is not updated.
**How to avoid:** In the cancel handler, also update the ring_leader_runs row status to `failed` (consistent with how the stop logic marks bots as stopped in the existing `POST /:id/stop` handler).
**Warning signs:** Admin dashboard shows orphaned ring_leader_runs rows with `assembling` status for stopped executions.

### Pitfall 5: TypeBox schema for GET /executions/:id omits pre_flight status
**What goes wrong:** The `GET /executions/:id` route schema has a strict union of statuses that does not include `pre_flight`. Fastify serialization will strip or error on the new status value.
**Why it happens:** TypeBox response schemas are explicit unions; new enum values must be added manually.
**How to avoid:** Add `Type.Literal('pre_flight')` to the response schema status union in `GET /executions/:id`, `GET /executions/all`, and any other endpoint that returns an execution status.
**Warning signs:** `GET /executions/:id` returns `status: undefined` or serialization error for pre_flight executions.

## Code Examples

Verified patterns from existing codebase:

### Enum extension (PostgreSQL + Drizzle)
```sql
-- packages/db/migrations/00NN_add_pre_flight_status.sql
-- Note: must run outside a transaction block in PostgreSQL
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'pre_flight' BEFORE 'queued';
```

```typescript
// packages/db/src/schema/executions.ts — updated enum
export const executionStatusEnum = pgEnum('execution_status', [
  'pre_flight',
  'queued',
  'running',
  'paused',
  'stopped',
  'completed',
  'failed',
]);
```

### New confirm endpoint (Fastify pattern)
```typescript
// services/execution-service/src/routes/executions.ts
fastify.post('/:id/confirm', {
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    response: {
      200: Type.Object({ success: Type.Boolean() }),
      404: Type.Object({ error: Type.String() }),
      409: Type.Object({ error: Type.String() }),
    },
  },
  preHandler: [verifyAuthOrInternalKey],
}, async (request, reply) => {
  const { id } = request.params;
  const execution = await getExecution(id);
  if (!execution) return reply.code(404).send({ error: 'Execution not found' });
  if (execution.status !== 'pre_flight') {
    return reply.code(409).send({ error: 'Execution is not awaiting pre-flight confirmation' });
  }
  const transitioned = await transitionExecution(id, 'pre_flight', 'queued');
  if (!transitioned) return reply.code(409).send({ error: 'Status transition conflict' });

  reply.code(200).send({ success: true });

  setImmediate(async () => {
    const [runRow] = await db.select().from(ringLeaderRuns)
      .where(eq(ringLeaderRuns.executionId, id));
    if (!runRow?.populationManifest) {
      fastify.log.error({ id }, 'Confirm: Ring Leader run or manifest not found');
      return;
    }
    await transitionExecution(id, 'queued', 'running');
    await publishExecutionStatusChanged({ ... });
    spawnAgentsForRun({
      ringLeaderRunId: runRow.id,
      executionId: id,
      missionBrief: runRow.missionBrief as RingLeaderMissionBrief,
      manifests: runRow.populationManifest as PopulationManifest[],
    }).catch(err => fastify.log.error({ err, id }, 'Agent spawn failed after confirm'));
  });
});
```

### SvelteKit pre-flight route polling
```typescript
// services/ui/src/routes/executions/[id]/pre-flight/+page.svelte
let manifest = $state<RingLeaderManifestResponse | null>(null);
let assemblyComplete = $derived(
  manifest != null && manifest.manifests.length > 0
);
let assemblyFailed = $derived(manifest?.status === 'failed');

$effect(() => {
  if (!browser || assemblyComplete || assemblyFailed) return;
  const poll = () => {
    getRingLeaderManifest(executionId).then(m => { manifest = m; }).catch(() => {});
  };
  poll();
  const interval = setInterval(poll, 3000);
  return () => clearInterval(interval);
});
```

### Manifest table rendering (Akasa design system patterns)
The existing `/executions/[id]/+page.svelte` already renders the population manifest in a Ring Leader section. The pre-flight page should present the same data using the same CSS variables (`--bg-card`, `--border`, `--font-mono`, `--violet-bright`, `--teal`, etc.) already established in the codebase.

Look at `SoulTierBadge.svelte` for the existing `agentClass` badge rendering:
```
services/ui/src/lib/components/SoulTierBadge.svelte
```

### API additions
```typescript
// services/ui/src/lib/api.ts
export async function confirmExecution(id: string): Promise<{ success: boolean }> {
  return apiFetch(`${BASE}/executions/${id}/confirm`, { method: 'POST' });
}

export async function cancelExecution(id: string): Promise<{ success: boolean }> {
  return apiFetch(`${BASE}/executions/${id}/cancel`, { method: 'POST' });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Immediate spawn after assembly | Spawn gated on user confirm | Phase 36 | Bots don't spawn until user reviews manifest |
| `execution.status` starts at `queued` | Starts at `pre_flight` | Phase 36 | New status in enum; UI must handle it |
| UI redirects to `/executions/:id` | Redirects to `/executions/:id/pre-flight` | Phase 36 | New route needed |
| `assemblePopulation` calls `spawnAgentsForRun` | `assemblePopulation` only assembles manifest | Phase 36 | Test changes required |

## Open Questions

1. **PostgreSQL enum migration transaction constraint**
   - What we know: Drizzle Kit wraps migrations in transactions; `ALTER TYPE ADD VALUE` cannot run inside a transaction in PostgreSQL.
   - What's unclear: Whether Drizzle Kit has a `-- disable-transaction` or `--no-transaction` annotation for individual migration files. This project has a history of applying migrations 0008-0010 manually due to similar issues.
   - Recommendation: Author the enum migration SQL but apply it manually via `psql` (as done for 0008-0010). Register it in `_journal.json`. Document in plan.

2. **Ring Leader run status during pre-flight waiting period**
   - What we know: After `assemblePopulation()` completes, the ring_leader_runs row status becomes `spawning`. This is set before the user confirms.
   - What's unclear: Whether the UI should show "spawning" before confirm, or if a new ring_leader_runs status like `assembled` should be introduced.
   - Recommendation: Avoid adding another enum value in ring_leader_runs for Phase 36. Keep `spawning` as the ring_leader_runs status (it means "population assembled, ready to spawn"). The UI pre-flight page ignores the ring_leader_runs status for its conditional rendering — it just checks `manifests.length > 0`.

3. **What happens if user closes the tab during pre-flight assembly?**
   - What we know: The execution row sits at `pre_flight` indefinitely until confirmed or cancelled. There is no timeout.
   - What's unclear: Should pre_flight executions auto-cancel after some timeout?
   - Recommendation: Out of scope for Phase 36. The admin `/executions/all` page can be used to manually stop stale pre_flight executions. Add a note in the plan.

4. **Auth on confirm/cancel endpoints**
   - What we know: The existing `POST /executions` has auth via `verifyAuthToken` + internal API key bypass. The `POST /:id/stop` has NO auth in the current code (it's treated as admin-only in the UI).
   - What's unclear: Should confirm/cancel require the auth token?
   - Recommendation: Yes — confirm/cancel are user-facing actions (not admin). Apply the same `preHandler` auth pattern as `POST /executions`.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `services/execution-service/src/routes/executions.ts` — execution route patterns, stop/transition patterns
- Direct code inspection of `services/execution-service/src/services/assemble-population.ts` — exact point where `spawnAgentsForRun()` is called (Step 9)
- Direct code inspection of `services/execution-service/src/services/ring-leader-spawner.ts` — how `assemblePopulation` is called fire-and-forget
- Direct code inspection of `packages/db/src/schema/executions.ts` — executionStatusEnum definition
- Direct code inspection of `packages/db/src/schema/ring-leader-runs.ts` — ringLeaderStatusEnum, populationManifest column
- Direct code inspection of `services/ui/src/routes/executions/[id]/+page.svelte` — polling patterns, manifest rendering
- Direct code inspection of `services/ui/src/lib/api.ts` — `getRingLeaderManifest()` already exists
- Direct code inspection of `services/ui/src/lib/types.ts` — `RingLeaderManifestResponse`, `PopulationManifest` types already defined
- Direct code inspection of `services/execution-service/src/routes/ring-leader.ts` — `GET /ring-leader/runs/by-execution/:executionId` already returns manifests

### Secondary (MEDIUM confidence)
- PostgreSQL documentation pattern: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` cannot run in a transaction — standard PostgreSQL behavior, verified by project MEMORY.md noting migrations 0008-0010 were applied manually

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — same libraries as all prior phases, no new dependencies
- Architecture: HIGH — patterns directly verified from existing code; the pre_flight status approach is a clean extension of the existing state machine
- Pitfalls: HIGH for enum transaction issue (documented pattern in this project), HIGH for TypeBox schema gaps, MEDIUM for ring_leader_runs status ambiguity

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable patterns, 30-day validity)
