# Phase 38: Objective DNA Evolution Timeline - Research

**Researched:** 2026-03-03
**Domain:** Backend SQL query + SvelteKit UI timeline component
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Timeline visual style**
- Vertical event list with left-side connecting line and event nodes
- Line stays neutral (var(--border)); individual nodes are color-coded: green for promotion, red for retirement, amber for demotion, neutral for monitor/maintain
- Class transitions displayed with existing tier badges and arrow: [Novice] → [Understudy]
- Timeline sits BELOW the existing DNA Evolution summary section (keep the aggregate class counts + trend summary as a quick glance)

**Event scope**
- Show ALL council verdicts — not just class transitions. Includes: Promote, Demote, Retire, Monitor, Maintain verdicts + pioneer detection events
- Flat chronological list, newest first (most recent events at top)
- Filter chips above timeline: All, Promotions, Demotions, Retirements, Pioneers, Monitor/Maintain — starts with "All" selected
- No grouping by run — run number shown per event but events are a flat list

**Entry detail level**
- Rich default view per entry: task category, class transition with tier badges + arrow, run number (linked to /executions/:id), date, verdict type label, weighted confidence score, composite fitness score, 1-line verdict summary snippet
- Entries are expandable — click to reveal: full verdict summary, individual council judge scores (Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15%), mutation lineage if applicable
- Pioneer events get a distinct visual treatment (pioneer badge/marker)

**Pagination**
- Show latest 20 events initially, "Load more" button to fetch older events
- Newest first ordering — "Load more" loads progressively older events
- Offset-based or cursor-based pagination left to Claude's discretion

**Empty state**
- Zero runs: muted message + CTA — "No evolution history yet. Launch your first run to start building soul intelligence." with link to launch button
- Runs with no transitions: Monitor/Maintain verdicts appear naturally in timeline (all verdicts included)
- Timeline renders correctly with success criteria empty state requirement

### Claude's Discretion
- Exact spacing, padding, and typography within Akasa design system
- Loading skeleton while timeline data fetches
- "Load more" implementation details (offset-based vs cursor-based)
- Exact filter chip styling and interaction micro-details
- Pioneer event node color choice (suggest purple/violet to differentiate from transition colors)
- Expanded view layout within each timeline entry

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OBJ-04 | Objective detail page shows DNA evolution timeline — which souls promoted/retired across runs | New `GET /objectives/:id/timeline` backend endpoint + new Section 6 in `+page.svelte` below existing DNA Evolution summary |
</phase_requirements>

---

## Summary

Phase 38 adds a DNA evolution timeline to the existing objective detail page. All data is already in the database — no schema changes are required. The work splits cleanly into two plans: (1) a backend SQL query endpoint at `GET /objectives/:id/timeline` that joins `council_verdicts` → `bots` → `executions` → `category_benchmarks` and returns paginated, filterable timeline events; (2) a SvelteKit UI section added below the existing DNA Evolution summary in `+page.svelte` that renders the vertical timeline with filter chips, expandable entries, and load-more pagination.

The critical join complexity lies in determining the "class transition" for each verdict event. The `council_verdicts` table records a `verdictType` (Promote/Demote/Retire/Monitor/Maintain) but does NOT store the before/after class state. The `agent_classes` table tracks `currentClass` and `lastTransitionAt` but only stores the *current* state — it does not have a transition history log. To reconstruct `fromClass → toClass`, the backend must derive class transitions from the verdict type and the bot's current agent class state at query time, or emit the transition directly from the `dnaPayload.agentClassAtWrite` field on `dna_store` rows. Pioneer events are identified via `agent_classes.isPioneer = true` joined to the bot, cross-referenced with `category_benchmarks` which stores the `pioneerBotId`.

**Primary recommendation:** Use `council_verdicts` as the primary table for the timeline, enriched with `agent_classes.currentClass` (best available class), `agent_classes.isPioneer`, `bots.compositeScore`, and `category_benchmarks` for pioneer origin data. Derive `fromClass` from `dnaPayload.agentClassAtWrite` on the associated `dna_store` row where available.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Already in project | SQL query builder for the backend endpoint | All existing routes use Drizzle; consistent with established pattern |
| `@sinclair/typebox` | Already in project | TypeBox schema validation for endpoint response | Every Fastify route uses TypeBox; required for type-safe serialization |
| `@fastify/type-provider-typebox` | Already in project | Fastify TypeBox integration | Project standard |
| SvelteKit `$state` / `$effect` / `$derived` | SvelteKit 2.x | Reactive UI for filter chips, load-more, expandable entries | All existing pages use Svelte 5 runes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` `sql`, `inArray`, `and`, `eq`, `desc`, `asc`, `offset`, `limit` | Already in project | Pagination, filtering, multi-join queries | Used throughout existing routes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Offset-based pagination | Cursor-based | Cursor is more robust under inserts; offset is simpler and sufficient since timeline is append-only (verdicts never deleted) |
| Raw `sql` template for the full join | Drizzle `.from().innerJoin()` chain | Raw SQL is more readable for complex multi-table joins like this one; existing precedent in `objectives.ts` stats endpoint uses `sql` raw queries for cross-table joins |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

The timeline endpoint is added as a new route handler inside the existing `objectivesRoutes` plugin. No new files needed for the backend.

```
services/execution-service/src/routes/objectives.ts   ← add GET /:id/timeline handler
services/ui/src/
  lib/
    api.ts          ← add getObjectiveTimeline() function
    types.ts        ← add ObjectiveTimelineEvent, ObjectiveTimeline types
  routes/objectives/[id]/
    +page.svelte    ← add Section 6: DNA Evolution Timeline below Section 5
```

### Pattern 1: Backend Endpoint Route Structure

**What:** New `GET /:id/timeline` handler in the existing `objectivesRoutes` plugin.
**When to use:** Same pattern as `GET /:id/stats` and `GET /:id/executions` that already exist.

```typescript
// In services/execution-service/src/routes/objectives.ts
// After the existing GET /:id/stats handler

fastify.get('/:id/timeline', {
  schema: {
    params: Type.Object({
      id: Type.String({ format: 'uuid' }),
    }),
    querystring: Type.Object({
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
      offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      filter: Type.Optional(Type.String()), // 'all' | 'promote' | 'demote' | 'retire' | 'pioneer' | 'monitor_maintain'
    }),
    response: {
      200: Type.Object({
        events: Type.Array(TimelineEventSchema),
        total: Type.Integer(),
        hasMore: Type.Boolean(),
      }),
      404: Type.Object({ error: Type.String() }),
    },
  },
}, async (request, reply) => {
  // ...
});
```

### Pattern 2: SQL Join for Timeline Events

**What:** Join `council_verdicts` → `bots` → `executions` → `agent_classes` + `category_benchmarks` using raw SQL to retrieve all verdict events scoped to an objective's runs, newest first.

**Important data model constraints discovered:**
- `council_verdicts` has `executionId` (direct FK) and `botId` (no FK to bots table — logical reference only)
- `agent_classes` has `botId` and `taskCategory` — unique per (botId, taskCategory) pair — and stores `currentClass`, `isPioneer`, `lastTransitionAt`
- `agent_classes` does NOT store transition history — only current class
- `dna_store` has `dnaPayload.agentClassAtWrite` (the class at time of DNA write, post-verdict) — this is the closest proxy for `toClass`
- `category_benchmarks` has `pioneerBotId` — cross-reference to determine if a bot was a pioneer in its category

**The fromClass/toClass derivation problem:**
The database does not store a class transition log. Options:
1. **Derive from dna_store.dnaPayload.agentClassAtWrite**: The `agentClassAtWrite` field was written to `dna_store.dnaPayload` during God Layer processing. This is `toClass` after the verdict. `fromClass` can be inferred from verdict type + `toClass` (e.g., if `toClass=Understudy` and verdictType=`Promote`, then `fromClass=Novice`).
2. **Use agent_classes.currentClass as best-effort**: The current class is the result of all verdicts processed to date. For display, showing the current class with the verdict type is sufficient context.

**Recommended approach:** Query `council_verdicts` as the base, LEFT JOIN `dna_store` on `(botId, executionId)` to get `agentClassAtWrite` and `compositeScore`, LEFT JOIN `agent_classes` on `botId` + `taskCategory` to get `isPioneer`, LEFT JOIN `category_benchmarks` on `taskCategory` to check if bot is a pioneer originator. Derive `fromClass` and `toClass` in application code.

```typescript
// Pioneer detection: a bot is a pioneer if agent_classes.isPioneer = true
// Pioneer execution: category_benchmarks.pioneerExecutionId = executionId

// Core query (simplified illustration)
const rows = await db
  .select({
    verdictId: councilVerdicts.id,
    botId: councilVerdicts.botId,
    executionId: councilVerdicts.executionId,
    verdictType: councilVerdicts.verdictType,
    weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
    verdictSummary: councilVerdicts.verdictSummary,
    performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
    soulAnalystOutput: councilVerdicts.soulAnalystOutput,
    devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
    createdAt: councilVerdicts.createdAt,
    // From bots join
    botCompositeScore: bots.compositeScore,
    // From executions join (for run number proxy — executions don't have a run number column)
    // executions are ordered by createdAt; run number is position in objective's execution history
    // Derive run number in application code using sorted list of execution IDs
    executionCreatedAt: executions.createdAt,
    // From agent_classes join — task category is in agent_classes, not council_verdicts
    taskCategory: agentClasses.taskCategory,
    currentClass: agentClasses.currentClass,
    isPioneer: agentClasses.isPioneer,
    // From dna_store join (agentClassAtWrite = class after verdict)
    agentClassAtWrite: sql<string | null>`ds.dna_payload->>'agentClassAtWrite'`,
    compositeScoreFromDna: sql<number | null>`CAST(ds.dna_payload->>'compositeFitnessScore' AS float)`,
    mutationLineageOps: sql<string[] | null>`ds.mutation_lineage`,
    parentSoulIds: dnaStore.parentSoulIds,
  })
  .from(councilVerdicts)
  .innerJoin(bots, eq(bots.id, councilVerdicts.botId))
  .innerJoin(executions, eq(executions.id, councilVerdicts.executionId))
  .leftJoin(agentClasses, and(
    eq(agentClasses.botId, councilVerdicts.botId),
    // NOTE: agent_classes has one row per (botId, taskCategory) — task category unknown from verdict alone
    // Use first match or join on execution's taskCategory
    eq(agentClasses.taskCategory, executions.taskCategory)
  ))
  .leftJoin(sql`dna_store ds`, sql`ds.bot_id = ${councilVerdicts.botId} AND ds.execution_id = ${councilVerdicts.executionId}`)
  .where(eq(executions.objectiveId, objectiveId))
  .orderBy(desc(councilVerdicts.createdAt))
  .limit(limit)
  .offset(offset);
```

**CRITICAL DISCOVERY — taskCategory join:** `council_verdicts` does NOT have a `taskCategory` column. The `agent_classes` table has `taskCategory`, but a bot can have multiple agent_classes rows (one per task category). The join `agent_classes ON botId AND taskCategory = executions.taskCategory` uses `executions.taskCategory` as the pivot — this field exists on `executions` table as `task_category varchar(255)`. This is the correct join path.

**Alternative if `executions.taskCategory` is NULL:** Fall back to selecting the highest-ranked agent_class row per botId (same pattern as leaderboard). Use a correlated subquery or `DISTINCT ON (botId)` with ORDER BY class rank.

### Pattern 3: Run Number Derivation

`executions` has no sequential `runNumber` column. To display "Run #3", the backend must compute the position of an execution within the objective's execution history. Two approaches:

1. **Application-side**: Fetch all execution IDs for the objective (ordered by `createdAt ASC`), build a position map, apply to results. Works for small run counts (<100).
2. **SQL `ROW_NUMBER()`**: Use a window function to compute run number inline.

```sql
-- Window function approach (use via drizzle sql tag)
ROW_NUMBER() OVER (
  PARTITION BY e.objective_id
  ORDER BY e.created_at ASC
) AS run_number
```

**Recommendation:** Window function in the SQL query for correctness and efficiency.

### Pattern 4: Pioneer Event Generation

Pioneer detection events are NOT stored as `council_verdicts` rows — they are a separate concept. `agent_classes.isPioneer = true` marks a pioneer bot, and `category_benchmarks` stores `pioneerBotId` and `pioneerExecutionId`. Pioneer events should be synthesized alongside verdict events:

- For each verdict row where `agent_classes.isPioneer = true` AND the verdict's `executionId` matches `category_benchmarks.pioneerExecutionId` for that bot's task category: emit a `pioneer` event type in addition to the verdict event.
- OR: emit pioneer events as a separate query against `category_benchmarks` joined to `executions` on `objectiveId`, returning one event per pioneer detected in this objective's runs.

**Recommendation:** Use a UNION approach — one query for council_verdicts (all verdict types), one query for pioneer detection events from category_benchmarks. Merge and sort in application code before pagination. This avoids complex in-SQL CASE logic.

### Pattern 5: Frontend Client-Side Filter (No Re-Fetch)

Since the backend paginates by `offset`, filter chips can work client-side on the loaded batch (no re-fetch per filter change). "Load more" fetches the next page with the same filter applied on the backend via `?filter=` param.

**Recommended:** Filter on backend (pass `?filter=promote|demote|retire|pioneer|monitor_maintain`) so that load-more with an active filter returns only matching events. This prevents loading 20 events where 18 are filtered out client-side.

### Pattern 6: Expandable Rows (Svelte 5)

Use `$state` boolean per entry, toggled on click. No animation library needed — CSS `max-height` transition or `{#if expanded}` block suffices.

```svelte
let expandedIds = $state<Set<string>>(new Set());

function toggleExpanded(id: string) {
  const next = new Set(expandedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds = next;
}
```

### Anti-Patterns to Avoid

- **N+1 queries per event**: Do not fetch judge outputs in separate queries per event. The main timeline query should include `performanceJudgeOutput`, `soulAnalystOutput`, `devilsAdvocateOutput` columns directly (they are already on `council_verdicts`).
- **Client-side re-fetch on filter change**: Avoid if backend filter param is supported — prevents wasted requests.
- **Importing from `$types`**: The project uses explicit `App.Locals` type annotation in server files, not `$types` imports (established in Phases 36-37). Do NOT use `import type { PageLoad } from './$types'` in any new server files.
- **`$derived` from mutable arrays that trigger re-runs**: The existing page avoids this (see `activeRunId` comment in `+page.svelte`). Timeline data should be `$state`, loaded once then appended on load-more.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| fromClass inference | Custom logic decoder | Map from (verdictType + toClass) | 5 verdict types × 4 class states = deterministic mapping |
| Run number | Sequential scan in app | SQL `ROW_NUMBER() OVER (PARTITION BY objective_id ORDER BY created_at)` | Correct even under concurrent inserts |
| JSONB field access | JavaScript deserialization after fetch | `sql\`dna_payload->>'agentClassAtWrite'\`` | Pushes extraction to Postgres, avoids sending full JSONB payload |
| Tier badge components | New badge markup | Reuse existing `.class-badge .class-artisan/.class-understudy/.class-novice/.class-retired` CSS classes already defined in `+page.svelte` | Consistency, zero new CSS tokens |

---

## Common Pitfalls

### Pitfall 1: agent_classes taskCategory Join Ambiguity

**What goes wrong:** A single bot can have multiple rows in `agent_classes` (one per task category it has participated in). Joining on just `botId` returns duplicate verdict rows.

**Why it happens:** `agent_classes` has a unique constraint on `(botId, taskCategory)` — many rows per bot. Without filtering on `taskCategory`, the join fans out.

**How to avoid:** Join `agent_classes ON (botId, taskCategory)` where `taskCategory` comes from `executions.taskCategory`. If `executions.taskCategory` is NULL for some runs, use `DISTINCT ON (council_verdicts.id)` or a correlated subquery to get the most relevant agent_class row.

**Warning signs:** Timeline returns duplicate events for the same verdict ID.

### Pitfall 2: dna_store JSONB agentClassAtWrite May Be NULL

**What goes wrong:** `dnaPayload.agentClassAtWrite` was added in GODL-02. Older `dna_store` rows may not have this field. `dna_payload->>'agentClassAtWrite'` returns NULL for older records.

**Why it happens:** The `DnaPayload` interface marks this field as `optional`. Legacy runs pre-GODL-02 lack it.

**How to avoid:** Handle NULL `agentClassAtWrite` in the response — either omit the class transition display or derive from `verdictType` + `currentClass` as fallback. The `fromClass` derivation should use: `toClass = agentClassAtWrite ?? currentClass`, then derive `fromClass` from `verdictType + toClass` using the progression map: Promote: Novice→Understudy, Understudy→Artisan; Demote: reverse; Retire: any→Retired.

**Warning signs:** All timeline entries show class transition as null or identical fromClass/toClass.

### Pitfall 3: Pioneer Events are Not council_verdicts Rows

**What goes wrong:** Querying only `council_verdicts` misses pioneer detection events entirely.

**Why it happens:** Pioneer detection is recorded in `category_benchmarks` (one row per category with `pioneerBotId`, `pioneerExecutionId`), and flagged in `agent_classes.isPioneer`. There is no `council_verdicts` row of type "Pioneer".

**How to avoid:** The backend must emit pioneer events separately. Query `category_benchmarks` joined to `executions` on `(pioneerExecutionId = executions.id AND executions.objectiveId = ?)` to find pioneer events within this objective's history. Merge with verdict events in application code, sort by date, then paginate.

**Warning signs:** Filter chip "Pioneers" returns no results even when `agent_classes.isPioneer = true` rows exist for this objective.

### Pitfall 4: Offset Pagination Skips Events Under Concurrent Insert

**What goes wrong:** A new verdict is inserted between "page 1" and the user clicking "Load more" — offset shifts, causing an event to be missed.

**Why it happens:** Standard SQL OFFSET is not stable under inserts.

**How to avoid:** This is acceptable for this use case — timelines are append-only for completed runs. The scenario (verdict insertion while user views timeline) is unlikely in practice (verdicts are bulk-created at end of run). Document as known limitation.

### Pitfall 5: TypeBox `Type.Unknown()` for JSONB Judge Outputs

**What goes wrong:** Using `Type.Unknown()` for `performanceJudgeOutput`, `soulAnalystOutput`, `devilsAdvocateOutput` causes Fastify to skip serialization — fine for reads, but TypeBox infers `unknown` in the TS type, requiring casts in the frontend.

**Why it happens:** Existing verdict routes use `Type.Unknown()` for JSONB columns (see `verdicts.ts`).

**How to avoid:** Use typed sub-schemas for judge outputs matching the `VerdictDetail` interface in `types.ts` if full type safety is needed in the expanded view. Or accept `Type.Unknown()` and cast in Svelte — matches precedent.

---

## Code Examples

### fromClass/toClass Derivation Logic

```typescript
// Source: derived from agent_classes schema + verdictType enum
type AgentClass = 'Novice' | 'Understudy' | 'Artisan' | 'Retired';

function deriveClassTransition(
  verdictType: string,
  agentClassAtWrite: string | null,
  currentClass: string | null,
): { fromClass: AgentClass | null; toClass: AgentClass | null } {
  const toClass = (agentClassAtWrite ?? currentClass) as AgentClass | null;
  if (!toClass) return { fromClass: null, toClass: null };

  const PROMOTION_CHAIN: AgentClass[] = ['Novice', 'Understudy', 'Artisan'];

  let fromClass: AgentClass | null = null;

  if (verdictType === 'Promote') {
    const idx = PROMOTION_CHAIN.indexOf(toClass as AgentClass);
    fromClass = idx > 0 ? PROMOTION_CHAIN[idx - 1] : null;
  } else if (verdictType === 'Demote') {
    const idx = PROMOTION_CHAIN.indexOf(toClass as AgentClass);
    fromClass = idx < PROMOTION_CHAIN.length - 1 ? PROMOTION_CHAIN[idx + 1] : null;
  } else if (verdictType === 'Retire') {
    // toClass = Retired, fromClass unknown — show as "→ Retired" only
    fromClass = null;
  } else {
    // Monitor / Maintain — no class change; fromClass = toClass
    fromClass = toClass;
  }

  return { fromClass, toClass };
}
```

### TypeBox Response Schema for Timeline Event

```typescript
// Source: based on council_verdicts schema + agent_classes schema + category_benchmarks schema
const TimelineEventSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),           // verdictId or 'pioneer-{benchmarkId}'
  eventType: Type.Union([
    Type.Literal('Promote'),
    Type.Literal('Demote'),
    Type.Literal('Retire'),
    Type.Literal('Monitor'),
    Type.Literal('Maintain'),
    Type.Literal('Pioneer'),
  ]),
  botId: Type.String({ format: 'uuid' }),
  executionId: Type.String({ format: 'uuid' }),
  runNumber: Type.Integer(),
  taskCategory: Type.Union([Type.String(), Type.Null()]),
  fromClass: Type.Union([Type.String(), Type.Null()]),
  toClass: Type.Union([Type.String(), Type.Null()]),
  weightedConfidenceScore: Type.Union([Type.Number(), Type.Null()]),
  compositeScore: Type.Union([Type.Number(), Type.Null()]),
  verdictSummary: Type.Union([Type.String(), Type.Null()]),
  performanceJudgeOutput: Type.Unknown(),
  soulAnalystOutput: Type.Unknown(),
  devilsAdvocateOutput: Type.Unknown(),
  hasMutationLineage: Type.Boolean(),
  isPioneer: Type.Boolean(),
  occurredAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
});

const TimelineResponseSchema = Type.Object({
  events: Type.Array(TimelineEventSchema),
  total: Type.Integer(),
  hasMore: Type.Boolean(),
});
```

### Frontend API Client Function

```typescript
// To add in services/ui/src/lib/api.ts

export interface ObjectiveTimelineEvent {
  id: string;
  eventType: 'Promote' | 'Demote' | 'Retire' | 'Monitor' | 'Maintain' | 'Pioneer';
  botId: string;
  executionId: string;
  runNumber: number;
  taskCategory: string | null;
  fromClass: string | null;
  toClass: string | null;
  weightedConfidenceScore: number | null;
  compositeScore: number | null;
  verdictSummary: string | null;
  performanceJudgeOutput: unknown;
  soulAnalystOutput: unknown;
  devilsAdvocateOutput: unknown;
  hasMutationLineage: boolean;
  isPioneer: boolean;
  occurredAt: string;
}

export interface ObjectiveTimeline {
  events: ObjectiveTimelineEvent[];
  total: number;
  hasMore: boolean;
}

export async function getObjectiveTimeline(
  id: string,
  params: { limit?: number; offset?: number; filter?: string } = {},
): Promise<ObjectiveTimeline> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  if (params.filter) query.set('filter', params.filter);
  const qs = query.toString();
  return apiFetch(`${BASE}/objectives/${id}/timeline${qs ? `?${qs}` : ''}`);
}
```

### Svelte Timeline Section (Sketch)

```svelte
<!-- Section 6: DNA Evolution Timeline — added below Section 5 in +page.svelte -->
<section class="section">
  <h2>Evolution Timeline</h2>

  <!-- Filter chips -->
  <div class="filter-chips">
    {#each FILTER_OPTIONS as opt}
      <button
        class="filter-chip"
        class:active={activeFilter === opt.value}
        onclick={() => { activeFilter = opt.value; loadTimeline(true); }}
      >{opt.label}</button>
    {/each}
  </div>

  {#if timelineLoading && timeline.length === 0}
    <!-- Loading skeleton -->
    <div class="timeline-skeleton">
      {#each [1,2,3] as _}
        <div class="skeleton-row"></div>
      {/each}
    </div>
  {:else if timeline.length === 0}
    <!-- Empty state -->
    <div class="timeline-empty">
      <p>No evolution history yet. Launch your first run to start building soul intelligence.</p>
      <a href="/new-execution?objectiveId={objectiveId}" class="btn-launch-small">Launch a run</a>
    </div>
  {:else}
    <div class="timeline">
      {#each timeline as event}
        <div class="timeline-item">
          <div class="timeline-node node-{nodeColor(event.eventType)}" role="presentation"></div>
          <div class="timeline-content">
            <!-- Default (collapsed) view -->
            <div class="timeline-header" onclick={() => toggleExpanded(event.id)}>
              <!-- Task category, class transition, verdict type, run#, date, scores -->
            </div>
            <!-- Expanded view -->
            {#if expandedIds.has(event.id)}
              <div class="timeline-expanded">
                <!-- Full summary, judge scores, mutation lineage -->
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if hasMore}
      <button class="btn-load-more" onclick={loadMore} disabled={timelineLoading}>
        {timelineLoading ? 'Loading...' : 'Load more'}
      </button>
    {/if}
  {/if}
</section>
```

### Node Color Mapping

```typescript
function nodeColor(eventType: string): string {
  switch (eventType) {
    case 'Promote':  return 'green';   // var(--teal) — matches "positive" semantic
    case 'Retire':   return 'red';     // var(--rose)
    case 'Demote':   return 'amber';   // var(--amber)
    case 'Pioneer':  return 'violet';  // var(--violet-bright) — distinct from transitions
    default:         return 'neutral'; // var(--border-mid)
  }
}
```

Note: The project has `--teal` for positive/promotion (used in class-understudy badge), `--rose` for retirement, `--amber` for demotions, `--violet-bright` for pioneer (Claude's discretion). No separate `--green` token exists in Akasa — use `--teal` for "green" promotion nodes.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom migration for timeline data | No schema change needed — all data already in DB | N/A | No migration, no downtime |
| Separate `+page.server.ts` for server load | All data fetched client-side via `apiFetch` calls in `$effect` | Established Phase 36-37 | Timeline follows same client-side fetch pattern |
| `$types` import in server files | Explicit `App.Locals` annotation | Phase 36-37 decision | No server file needed here; if one were added, use explicit type |

---

## Open Questions

1. **executions.taskCategory NULL handling**
   - What we know: `executions.taskCategory` is nullable (varchar nullable, populated in "Phase 9 for soul seeding")
   - What's unclear: How many executions in practice have NULL `taskCategory`? If many, the JOIN to `agent_classes` on `taskCategory` will produce no results for those rows
   - Recommendation: Add a fallback — if `executions.taskCategory` IS NULL, still return the verdict event with `taskCategory: null` in the response. The UI renders "Unknown category" or omits the field.

2. **Total count for pagination**
   - What we know: Backend needs to return `total` so the UI knows `hasMore`. Computing exact count requires a separate `COUNT(*)` query or `COUNT(*) OVER ()` window function.
   - What's unclear: Whether to run a separate count query or use `COUNT(*) OVER ()` (which adds overhead per row)
   - Recommendation: Run a separate `SELECT COUNT(*)` query for the filtered result set. It runs fast on indexed columns (`executionId` is indexed on `council_verdicts`).

3. **Pioneer UNION query performance**
   - What we know: Pioneer events come from a separate `category_benchmarks` table with no index on `pioneerExecutionId`
   - What's unclear: Performance when category_benchmarks has many rows
   - Recommendation: Add a comment in the code; table is expected to have at most O(100) rows (one per task category). No performance concern.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `packages/db/src/schema/council-verdicts.ts` — confirmed schema fields, verdict_type enum values
- Direct codebase inspection: `packages/db/src/schema/agent-classes.ts` — confirmed `isPioneer`, `taskCategory`, `currentClass`, NO transition history
- Direct codebase inspection: `packages/db/src/schema/dna-store.ts` — confirmed `DnaPayload.agentClassAtWrite` (optional field, GODL-02)
- Direct codebase inspection: `packages/db/src/schema/category-benchmarks.ts` — confirmed `pioneerBotId`, `pioneerExecutionId`
- Direct codebase inspection: `packages/db/src/schema/executions.ts` — confirmed `taskCategory` nullable field, `objectiveId` FK
- Direct codebase inspection: `services/execution-service/src/routes/objectives.ts` — confirmed existing route pattern, correlated subquery + raw SQL join patterns
- Direct codebase inspection: `services/ui/src/routes/objectives/[id]/+page.svelte` — confirmed existing CSS token usage, section structure, class badge CSS classes

### Secondary (MEDIUM confidence)

- Pattern inference from `services/execution-service/src/routes/verdicts.ts` — established `Type.Unknown()` for JSONB columns
- Pattern inference from `services/execution-service/src/routes/bots.ts` — established batch query + in-memory map pattern for enrichment joins

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — data model fully inspected, join paths confirmed from schema files
- Pitfalls: HIGH — all discovered from actual schema analysis (not speculation)
- fromClass derivation: MEDIUM — `agentClassAtWrite` is optional in DnaPayload; fallback logic needed

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable schema; no planned changes to council_verdicts or agent_classes)
