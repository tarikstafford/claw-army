# Phase 39: Soul and DNA Visibility - Research

**Researched:** 2026-03-03
**Domain:** Read-only soul data exposure — backend query endpoints + SvelteKit UI routes
**Confidence:** HIGH

## Summary

Phase 39 is entirely read-only: all data already exists in the database from prior milestones. No schema changes, no migrations, no writes. The five sub-plans each need a backend GET endpoint registered in the Fastify execution-service and a corresponding SvelteKit page (or panel) in the UI.

The backend pattern is well-established: Drizzle ORM queries, TypeBox response schemas, Fastify plugin per concern. The frontend pattern is also established: SvelteKit `+page.svelte` (client-side fetch in `$effect`) or `+page.server.ts` (server-side load), with existing `api.ts` + `types.ts` extended for each new endpoint. SOUL-05 is the simplest sub-plan — the Ring Leader fitness breakdown already renders on the report page (`/executions/[id]/report/+page.svelte`) via the `synthesisData.fitness` block. The success criterion says "Execution post-run report shows the Ring Leader fitness detail panel" — this panel already exists and renders all 4+5 dimensions with score bars. The research concludes SOUL-05 requires only **verification** and possibly a UI refinement pass, not a new endpoint or route.

**Primary recommendation:** Build each SOUL plan as (1) a new Fastify route plugin file + registration in `app.ts`, (2) new API client function in `api.ts`, (3) new TypeScript interfaces in `types.ts`, and (4) a new SvelteKit route page. Follow the established pattern exactly — no new libraries needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SOUL-01 | User can browse the soul library — view all souls by task category with agent class, generation, fitness score | New GET `/souls` endpoint querying `bot_souls` + `agent_classes`; new `/souls` UI route with filter chips |
| SOUL-02 | User can view decision traces for a specific bot — directive references, attribution confidence, outcomes | New GET `/bots/:botId/decision-traces` endpoint querying `decision_traces` table; panel on bot detail page |
| SOUL-03 | User can view the negative signal register — failed/retired souls with failure type and directive failure summary | New GET `/negative-signals` endpoint querying `negative_signal_register`; new UI route |
| SOUL-04 | User can view category benchmarks — pioneer progress, baseline scores, benchmark maturity, thin data flags | New GET `/category-benchmarks` endpoint querying `category_benchmarks`; new UI route |
| SOUL-05 | Execution report shows Ring Leader fitness detail breakdown — coordination quality (4 dimensions) and soul selection quality (5 dimensions) individually scored | Already implemented in `/executions/[id]/report/+page.svelte` — needs verification only |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | ^5.7.4 | HTTP server for new backend routes | Project standard |
| @fastify/type-provider-typebox | ^6.1.0 | TypeBox schema validation on routes | Project standard |
| @sinclair/typebox | ^0.34.48 | Runtime type schemas for request/response | Project standard |
| drizzle-orm | ^0.45.1 | DB queries (select, join, where, orderBy) | Project standard |
| SvelteKit | ^2.52.0 | UI routing and pages | Project standard |
| Svelte | ^5.51.3 | Svelte 5 runes (`$state`, `$effect`, `$derived`) | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `$lib/api.ts` | project | API client fetch wrapper | All UI data fetching |
| `$lib/types.ts` | project | Shared TypeScript interfaces | New response types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New route files per feature | Adding to existing routes files | Separate files match project pattern (one file per concern) |
| `+page.server.ts` SSR load | Client-side `$effect` fetch | Project uses `$effect` pattern for data-heavy pages (report, objective detail); `+page.server.ts` used for form-action pages (objective detail uses both) |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
services/execution-service/src/routes/
  souls.ts               # SOUL-01 — soul library browser endpoint
  decision-traces.ts     # SOUL-02 — decision traces per bot (already exists? check below)
  negative-signals.ts    # SOUL-03 — negative signal register endpoint
  category-benchmarks.ts # SOUL-04 — category benchmarks endpoint

services/ui/src/routes/
  souls/
    +page.svelte         # SOUL-01 — soul library browser
  negative-signals/
    +page.svelte         # SOUL-03 — negative signal register
  category-benchmarks/
    +page.svelte         # SOUL-04 — category benchmarks page
```

SOUL-02 (decision traces) goes on the existing bot detail page:
```
services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
  # Add decision trace section — already has soul inspector
```

SOUL-05 is already implemented:
```
services/ui/src/routes/executions/[id]/report/+page.svelte
  # Ring Leader Fitness section already renders all 4+5 dimensions
  # Lines 201–330 contain coordinationScore + soulSelectionScore breakdown
```

### Pattern 1: Fastify Route Plugin (READ-ONLY)

All new backend endpoints follow this pattern exactly:

```typescript
// Source: services/execution-service/src/routes/objectives.ts (reference)
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, botSouls, agentClasses } from '@claw/db';
import { eq, desc } from 'drizzle-orm';

export const soulsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        category: Type.Optional(Type.String()),
        agentClass: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          souls: Type.Array(/* schema */),
          total: Type.Integer(),
          hasMore: Type.Boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    // Drizzle query
    return reply.code(200).send({ souls: [], total: 0, hasMore: false });
  });
};
```

Register in `app.ts`:
```typescript
import { soulsRoutes } from './routes/souls';
// ...
app.register(soulsRoutes, { prefix: '/souls' });
```

### Pattern 2: SvelteKit Client-Side Page

All new read-only UI routes follow the client-side `$effect` pattern (not `+page.server.ts`):

```svelte
<!-- Source: services/ui/src/routes/executions/[id]/report/+page.svelte (reference) -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { getSoulLibrary } from '$lib/api';
  import type { SoulLibraryResponse } from '$lib/types';

  let data = $state<SoulLibraryResponse | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeCategory = $state('');

  $effect(() => {
    if (!browser) return;
    loading = true;
    getSoulLibrary({ category: activeCategory || undefined })
      .then(d => { data = d; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });
</script>
```

### Pattern 3: API Client Function

```typescript
// Source: services/ui/src/lib/api.ts (reference)
// Add to api.ts for each SOUL plan:
export async function getSoulLibrary(
  params: { category?: string; agentClass?: string; limit?: number; offset?: number } = {}
): Promise<SoulLibraryResponse> {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.agentClass) query.set('agentClass', params.agentClass);
  const qs = query.toString();
  return apiFetch(`${BASE}/souls${qs ? `?${qs}` : ''}`);
}
```

### Pattern 4: Filter Chips (already established in Phase 38)

Phase 38 established the filter chip pattern in the objective detail page. SOUL-01 (soul library) should use the same pattern for category/class filtering. State management: filter change triggers backend reload (not client-side filter) — consistent with Phase 38 decision.

### Anti-Patterns to Avoid
- **Triggering SSR load for read-only data pages:** Use client-side `$effect` — these are data-heavy browseables, not form pages. The `+page.server.ts` pattern is for form actions (archive, create, edit).
- **Building pagination in-memory:** SOUL-01 (soul library) and SOUL-02 (decision traces) may have many rows. Use Drizzle `.limit()` and `.offset()` for real DB pagination.
- **N+1 queries for soul library:** JOIN `bot_souls` with `agent_classes` in a single query, not per-soul lookups. Use LEFT JOIN since agent class may not exist for archetypes.
- **Mutating Set state in-place (Svelte 5):** Phase 38 decision: use `new Set(existing)` copy when toggling expanded IDs. Mutation-in-place does not trigger Svelte 5 reactivity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination | Custom cursor/offset logic | Drizzle `.limit()` + `.offset()` + total count | Already established pattern in Phase 38 (objectives timeline) |
| Response schema | Ad-hoc type assertions | TypeBox schema on Fastify route | Fastify auto-validates with TypeBox provider |
| Category filter | Custom JS enum/list | DB `DISTINCT` query over `bot_souls.task_category` | Always reflects actual data |
| Auth guard | Custom cookie parsing | `verifyAuthToken()` (already in `lib/verify-auth-token.js`) | Only needed for mutating endpoints — read routes skip auth per project pattern |

**Key insight:** All 5 sub-plans are read-only. No auth guards required on GET endpoints (consistent with existing pattern — `/executions/:id/report`, `/ring-leader/...`, `/objectives/...` have no auth guards).

## Common Pitfalls

### Pitfall 1: SOUL-05 Already Done
**What goes wrong:** Building a new endpoint or route for the Ring Leader fitness breakdown.
**Why it happens:** The success criterion sounds like new work, but the fitness panel is already implemented.
**How to avoid:** Check `/executions/[id]/report/+page.svelte` lines 201–330 — the `synthesisData.fitness` block renders all 4 coordination dimensions (collectiveOutcome, driftPrevention, reallocationEffectiveness, budgetManagement) and all 5 soul selection dimensions (librarySearchQuality, differentiationEffectiveness, mutationDecisionQuality, pioneerHandling, selectionRetrospectiveQuality) with score bars, weights, and subtotals. The backend endpoint (`GET /ring-leader/runs/by-execution/:executionId/synthesis`) already returns `fitness` with full dimension breakdown. Plan 39-05 should be a verification task + any needed label/weight corrections, not a build task.
**Warning signs:** If 39-05 plan creates a new route file or new API function, it's duplicating existing work.

### Pitfall 2: Decision Traces Table May Be Empty in Development
**What goes wrong:** Backend returns 200 with empty array; UI shows "No decision traces" correctly, but it looks broken.
**Why it happens:** `decision_traces` is populated by bot execution via `POST` from bots, which requires real runs. In dev, there may be zero rows.
**How to avoid:** Design the UI to handle empty states gracefully. Show "No decision traces recorded for this bot" rather than a spinner or error.

### Pitfall 3: `bot_souls` Join With `agent_classes` Is 1:N
**What goes wrong:** Soul library query returns duplicate soul rows if a bot has agent_class rows for multiple task categories.
**Why it happens:** `agent_classes` has one row per (botId, taskCategory) pair. A soul linked to a bot with 3 task categories would appear 3 times in a naïve JOIN.
**How to avoid:** For soul library, use a LEFT JOIN and GROUP BY or pick the highest-ranked class per soul. Better: for SOUL-01 (soul library), query `bot_souls` directly and do a separate lookup for `agent_classes` if needed, or use a DISTINCT ON query. Archetypes (`isArchetype = true`) have no botId — include them without any agent class join.

### Pitfall 4: Negative Signal Register Has No Direct `agentClass` Column
**What goes wrong:** UI needs to show the soul's agent class but `negative_signal_register` only has `soulId` and `botId`, not a direct class field.
**Why it happens:** Agent class is in `agent_classes` table, not denormalized into the register.
**How to avoid:** JOIN `negative_signal_register` → `agent_classes` on `botId` for the class display. Or show soul tier via `bot_souls.dimensions` if class is not needed.

### Pitfall 5: Category Benchmarks `pioneer_soul_id` Is Nullable
**What goes wrong:** JOIN on `category_benchmarks.pioneerSoulId` fails for some rows.
**Why it happens:** `pioneer_soul_id` is explicitly nullable in the schema (see schema file).
**How to avoid:** Use LEFT JOIN on pioneer soul, not INNER JOIN.

### Pitfall 6: Route Registration Order in `app.ts`
**What goes wrong:** New routes shadow existing routes or conflict.
**Why it happens:** Fastify registers plugins in sequence; order matters for prefix matching.
**How to avoid:** Add new route registrations after existing ones in `app.ts`. Use clear distinct prefixes: `/souls`, `/negative-signals`, `/category-benchmarks`.

## Code Examples

### Soul Library Backend Query (Drizzle)

```typescript
// SOUL-01: Query bot_souls with optional category/class filter
// Source: services/execution-service/src/routes/objectives.ts (timeline pattern reference)
import { db, botSouls, agentClasses } from '@claw/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

// Step 1: Count total for pagination
const [{ total }] = await db
  .select({ total: sql<number>`cast(count(*) as int)` })
  .from(botSouls)
  .where(category ? eq(botSouls.taskCategory, category) : sql`1=1`);

// Step 2: Fetch paginated souls
const souls = await db
  .select({
    id: botSouls.id,
    taskCategory: botSouls.taskCategory,
    generation: botSouls.generation,
    isArchetype: botSouls.isArchetype,
    archetypeName: botSouls.archetypeName,
    createdAt: botSouls.createdAt,
    // agent class via subquery or separate batch
  })
  .from(botSouls)
  .where(category ? eq(botSouls.taskCategory, category) : sql`1=1`)
  .orderBy(desc(botSouls.createdAt))
  .limit(limit)
  .offset(offset);
```

### Decision Traces Query (scoped to botId)

```typescript
// SOUL-02: Fetch decision traces for a specific bot
import { db, decisionTraces } from '@claw/db';
import { eq, and, desc } from 'drizzle-orm';

const traces = await db
  .select({
    id: decisionTraces.id,
    decisionType: decisionTraces.decisionType,
    directiveReferenced: decisionTraces.directiveReferenced,
    attributionConfidence: decisionTraces.attributionConfidence,
    outcome: decisionTraces.outcome,
    decidedAt: decisionTraces.decidedAt,
  })
  .from(decisionTraces)
  .where(eq(decisionTraces.botId, botId))
  .orderBy(desc(decisionTraces.decidedAt))
  .limit(limit)
  .offset(offset);
```

### Negative Signal Register Query

```typescript
// SOUL-03: Fetch all negative signals (failed/retired souls)
import { db, negativeSignalRegister, botSouls } from '@claw/db';
import { eq, desc } from 'drizzle-orm';

const signals = await db
  .select({
    id: negativeSignalRegister.id,
    soulId: negativeSignalRegister.soulId,
    botId: negativeSignalRegister.botId,
    executionId: negativeSignalRegister.executionId,
    failureType: negativeSignalRegister.failureType,
    directiveFailureSummary: negativeSignalRegister.directiveFailureSummary,
    registeredAt: negativeSignalRegister.registeredAt,
    taskCategory: botSouls.taskCategory,
    generation: botSouls.generation,
  })
  .from(negativeSignalRegister)
  .leftJoin(botSouls, eq(botSouls.id, negativeSignalRegister.soulId))
  .orderBy(desc(negativeSignalRegister.registeredAt))
  .limit(limit)
  .offset(offset);
```

### Category Benchmarks Query

```typescript
// SOUL-04: Fetch all category benchmarks
import { db, categoryBenchmarks } from '@claw/db';
import { asc } from 'drizzle-orm';

const benchmarks = await db
  .select()
  .from(categoryBenchmarks)
  .orderBy(asc(categoryBenchmarks.taskCategory));
```

### SvelteKit Navigation — New Top-Level Pages

New pages appear in the left-nav or are linked from existing pages. Check how existing pages like `/verdicts` and `/objectives` are linked in the layout nav to determine where to add soul pages.

```svelte
<!-- Linking pattern — consistent with existing nav links -->
<a href="/souls">Soul Library</a>
<a href="/negative-signals">Negative Signals</a>
<a href="/category-benchmarks">Category Benchmarks</a>
```

### TypeBox Schemas for New Endpoints

```typescript
// SOUL-01 response schema pattern (mirrors Phase 38 timeline schema)
const SoulEntrySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  taskCategory: Type.Union([Type.String(), Type.Null()]),
  generation: Type.Integer(),
  isArchetype: Type.Boolean(),
  archetypeName: Type.Union([Type.String(), Type.Null()]),
  agentClass: Type.Union([
    Type.Literal('Novice'),
    Type.Literal('Understudy'),
    Type.Literal('Artisan'),
    Type.Literal('Retired'),
    Type.Null(),
  ]),
  createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
});

// SOUL-02 response schema (decision trace entry)
const DecisionTraceEntrySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  decisionType: Type.String(), // tool_call | reasoning_branch | output_step
  directiveReferenced: Type.Union([Type.String(), Type.Null()]),
  attributionConfidence: Type.Union([Type.Number(), Type.Null()]), // 0.000–1.000
  outcome: Type.Union([Type.String(), Type.Null()]), // success | failure | partial
  decidedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `$derived` for filter-triggered fetches | `$effect` with reload via function call | Established Phase 38 | Avoids infinite loop with filter-reactive effects |
| Mutation of Set in-place | `new Set(existing)` copy | Established Phase 38 | Required for Svelte 5 reactivity |
| Auth guards on all GET routes | Auth only on mutating routes | Established from early phases | All read-only GET endpoints have no `preHandler` auth |
| `import { $types }` in page.server.ts | Explicit `App.Locals` type annotation | Established Phase 36-02 | Avoids SvelteKit type generation dependency |

**Deprecated/outdated:**
- N/A — all patterns are current.

## Open Questions

1. **SOUL-01: Should the soul library show soul content text?**
   - What we know: `bot_souls.soulContent` is a potentially large `text` field.
   - What's unclear: Whether a list view should truncate/preview it or omit it entirely for performance.
   - Recommendation: Omit `soulContent` from list endpoint; show only metadata fields. If detail view is needed, add `GET /souls/:id` in a follow-up. The existing `SoulInspectorPanel` already handles per-bot soul detail.

2. **SOUL-01: fitness score — what field to show?**
   - What we know: `bot_souls` schema has `dimensions` (7-dimension JSONB) but no direct scalar fitness score column. Fitness scores are on `ring_leader_fitness` (scoped to run) and `bots.compositeScore` (scoped to bot-execution). Soul library doesn't have a per-soul lifetime fitness score in the DB schema as of current migrations.
   - What's unclear: Whether to derive a "fitness proxy" (e.g., generation as a proxy, or last known compositeScore from a join through bots table).
   - Recommendation: Show `generation` as the primary "fitness proxy" for the list (higher generation = more evolved). For actual score, do a best-effort JOIN to `bots.compositeScore` via `bot_souls.botId`. If botId is null (archetype), show generation only.

3. **SOUL-02: Decision traces are populated by real bot runs — dev data likely absent**
   - What we know: The table exists and has the right schema. Population happens during bot execution.
   - What's unclear: Whether any data exists in dev/staging.
   - Recommendation: Design empty state UI from the start. This is not a blocker.

4. **Navigation: Where do the new soul pages appear?**
   - What we know: The layout nav exists at `/services/ui/src/routes/+layout.svelte`.
   - What's unclear: Whether to add soul library, negative signals, and category benchmarks to the main nav or link them from the objectives or execution pages.
   - Recommendation: Add links to the main layout nav (consistent with `/verdicts`, `/billing`, `/objectives` links). Check `+layout.svelte` during planning.

## Sources

### Primary (HIGH confidence)
- `/packages/db/src/schema/bot-souls.ts` — BotSoul schema, all columns, nullable fields confirmed
- `/packages/db/src/schema/decision-traces.ts` — DecisionTrace schema, TTL policy, botId/soulId columns
- `/packages/db/src/schema/negative-signal-register.ts` — NegativeSignal schema, failureType enum values
- `/packages/db/src/schema/category-benchmarks.ts` — CategoryBenchmark schema, thinDataFlag, benchmarkMature
- `/packages/db/src/schema/ring-leader-runs.ts` — RingLeaderFitness schema, 4+5 dimension JSONB columns
- `/packages/db/src/schema/agent-classes.ts` — AgentClass schema, class enum, isPioneer, (botId, taskCategory) unique
- `/services/execution-service/src/routes/ring-leader.ts` — /synthesis endpoint already returns fitness breakdown with all dimensions
- `/services/ui/src/routes/executions/[id]/report/+page.svelte` lines 201–330 — Ring Leader Fitness section already implemented (SOUL-05 is done)
- `/services/execution-service/src/app.ts` — Route registration order, all registered prefixes
- `/services/ui/src/lib/api.ts` — All existing API functions; `getRingLeaderSynthesis()` already covers SOUL-05
- `/services/ui/src/lib/types.ts` — All existing TypeScript interfaces; `CoordinationScore` + `SoulSelectionScore` already defined
- `.planning/STATE.md` — Phase 38 decisions (filter chip → backend reload, Set copy for Svelte 5 reactivity)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — SOUL-01 through SOUL-05 requirement text confirms scope
- Pattern inference from existing routes (objectives.ts, bots.ts) — Drizzle query patterns for similar joins

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from package.json files and existing source
- Architecture: HIGH — patterns copied verbatim from existing working code in Phase 34–38
- Pitfalls: HIGH — SOUL-05 already-done finding verified by reading report page source; schema nullability verified from schema files
- Open questions: MEDIUM — fitness score for SOUL-01 is genuinely unclear from schema alone

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase, 30-day horizon reasonable)
