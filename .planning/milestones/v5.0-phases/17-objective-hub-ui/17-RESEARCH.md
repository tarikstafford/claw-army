# Phase 17: Objective Hub UI - Research

**Researched:** 2026-02-22
**Domain:** SvelteKit 2 / Svelte 5 frontend pages, Fastify API extensions, SSE reuse for live status
**Confidence:** HIGH — all conclusions derived from direct inspection of the installed codebase; no locked user decisions

---

## Summary

Phase 17 builds two UI routes on top of the fully-implemented Phase 16 backend: `/objectives` (list page) and `/objectives/:id` (detail page). The list page is a straightforward data-fetch-and-render pattern matching the existing `/billing` page. The detail page is the complex one: it requires three API calls on load (objective, executions by objective, aggregate stats), an optional SSE connection when a run is active (reusing `connectSSE`), and a DNA evolution summary derived from `agent_classes` records.

The critical insight is what API endpoints do NOT yet exist. Phase 16 built `GET /objectives` (list with aggregation) and `GET /objectives/:id` (single objective), but the detail page requires two additional backend endpoints: `GET /objectives/:id/executions` (list all runs for an objective) and `GET /objectives/:id/stats` (aggregate stats + DNA evolution summary). Both of these fit naturally into the existing `objectives.ts` route file using the same Drizzle correlated-subquery pattern already proven in Phase 16.

The live status panel (HUB-03) reuses the existing `connectSSE` function from `src/lib/sse.ts` — the SSE stream at `GET /executions/:id/events` already emits `execution_status_changed`, `billing_event`, and activity events. The UI needs only to identify the active run's ID from the executions list, then connect SSE to that execution's event stream. No new SSE infrastructure is needed.

**Primary recommendation:** Build two new backend endpoints in `objectives.ts` first (17-01: backend API additions), then build the two UI routes (17-02: list page, 17-03: detail page). The SSE live status is scoped to the detail page and can reuse existing infrastructure entirely.

---

## Existing State Audit

### What Phase 16 Built (Already Working)

| Endpoint | Returns | Used By |
|----------|---------|---------|
| `GET /objectives` | Array of ObjectiveWithAggregation (includes `lastRunStatus`, `runCount`, `totalSpendCents`, `bestBotClass`) | `/objectives` list page |
| `GET /objectives/:id` | Single Objective (base fields, no aggregation) | Pre-fill on new-execution; NOT sufficient for detail page |
| `POST /objectives` | Created Objective | Out of scope for Phase 17 |
| `PATCH /objectives/:id` | Updated Objective | Out of scope for Phase 17 |
| `DELETE /objectives/:id` | `{ success: true }` | Out of scope for Phase 17 |

### What Phase 17 Needs That Does NOT Exist

| Needed | Where | Why Not Yet Built |
|--------|-------|-------------------|
| `GET /objectives/:id/executions` | `objectives.ts` | HUB-01: list all runs for an objective with date, status, cost, bot count, avg composite score, link to run detail |
| `GET /objectives/:id/stats` | `objectives.ts` | HUB-02 + HUB-04: aggregate stats (total spend, total tasks, total bot-hours, class distribution trend) + DNA evolution summary |

### Existing SSE Infrastructure

The `connectSSE(executionId, callback)` function in `src/lib/sse.ts` connects to `GET /executions/:id/events` and emits typed events including:
- `execution_status_changed` — used to update execution state reactively
- `billing_event` — carries `amountCents` for real-time budget burn display
- `task_claimed`, `task_completed`, `bot_started`, `bot_stopped`, `guardrail_triggered`

For HUB-03 (live status inline), the detail page needs to:
1. Detect if any run in the executions list has status `running`
2. Identify that run's `executionId`
3. Call `connectSSE(activeRunId, handler)` to receive live events
4. Display active bot count (from `getExecutionMetrics(activeRunId)`) + last 5 activity events from the SSE stream

No new SSE endpoints are needed. The existing `connectSSE` and `getExecutionMetrics` API functions are sufficient.

### Existing UI Patterns

The project uses Svelte 5 (v5.51.3) with SvelteKit 2.52.0 and the Svelte 5 runes API:
- `$state<T>()` for reactive state (not `let x = writable()`)
- `$derived()` for computed values
- `$effect()` for side effects (replaces `onMount`)/SSE connection lifecycle
- `{@render children()}` in layouts (not `<slot>`)
- `browser` check from `$app/environment` required before all fetch/SSE calls

All existing pages are client-rendered (no server-side `load` functions in route files). The `+layout.server.ts` loads the session server-side, but individual pages use `$effect(() => { if (!browser) return; fetch... })`.

---

## Standard Stack

### Core (all already installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.51.3 | Reactive UI with runes | Already installed; all pages use runes API |
| @sveltejs/kit | 2.52.0 | File-based routing, SSR/CSR hybrid | Already installed; routes follow `+page.svelte` convention |
| @sinclair/typebox | ^0.34.48 | TypeBox schemas for new API endpoints | Already installed in execution-service |
| drizzle-orm | 0.45.1 | New DB queries in objectives.ts extension | Already installed in @claw/db |

### No New Installs Required

Zero new npm packages. All UI framework features, API client patterns, SSE, CSS design tokens, and Drizzle patterns are already present.

---

## Architecture Patterns

### Recommended File Structure

```
services/execution-service/src/routes/
└── objectives.ts           # MODIFY: add 2 new GET endpoints

services/ui/src/lib/
├── api.ts                  # MODIFY: add getObjectives(), getObjective(), getObjectiveExecutions(), getObjectiveStats()
└── types.ts                # MODIFY: add ObjectiveListItem, ObjectiveRun, ObjectiveStats interfaces

services/ui/src/routes/
├── objectives/
│   ├── +page.svelte        # NEW: /objectives list page
│   └── [id]/
│       └── +page.svelte    # NEW: /objectives/:id detail page
```

### Pattern 1: Objectives List Page (`/objectives`)

**What:** Fetches `GET /objectives` (already returns aggregated data), renders as a card grid or table. Each row shows name, `lastRunStatus` (badge), `runCount`, `totalSpendCents` (formatted), `bestBotClass` (badge), and a link to `/objectives/:id`.

**When to use:** Matches the `/billing` page pattern — single fetch on mount, no SSE, no polling.

**Example (from billing/+page.svelte pattern):**
```typescript
// services/ui/src/routes/objectives/+page.svelte
import { browser } from '$app/environment';
import { getObjectives } from '$lib/api';
import type { ObjectiveListItem } from '$lib/types';

let objectives = $state<ObjectiveListItem[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

$effect(() => {
  if (!browser) return;
  getObjectives()
    .then(data => { objectives = data; loading = false; })
    .catch(err => { error = (err as Error).message; loading = false; });
});
```

### Pattern 2: Objective Detail Page (`/objectives/:id`)

**What:** Multi-section page that loads objective metadata, all runs (executions), and aggregate stats. Conditionally establishes SSE connection if an active run exists.

**Data loading sequence:**
1. `getObjective(id)` — objective name/description for page header
2. `getObjectiveExecutions(id)` — list of all runs (HUB-01)
3. `getObjectiveStats(id)` — aggregate stats + DNA evolution (HUB-02 + HUB-04)
4. If any run has status `running` → `getExecutionMetrics(activeRunId)` + `connectSSE(activeRunId, handler)` (HUB-03)

**Example (from executions/[id]/+page.svelte pattern):**
```typescript
// services/ui/src/routes/objectives/[id]/+page.svelte
import { page } from '$app/state';
import { browser } from '$app/environment';
import { getObjective, getObjectiveExecutions, getObjectiveStats, getExecutionMetrics } from '$lib/api';
import { connectSSE } from '$lib/sse';
import type { Objective, ObjectiveRun, ObjectiveStats, ExecutionMetrics, ActivityEvent } from '$lib/types';

const objectiveId = $derived(page.params.id ?? '');

let objective = $state<Objective | null>(null);
let runs = $state<ObjectiveRun[]>([]);
let stats = $state<ObjectiveStats | null>(null);
let activeRunId = $derived(runs.find(r => r.status === 'running')?.id ?? null);
let liveMetrics = $state<ExecutionMetrics | null>(null);
let activityFeed = $state<ActivityEvent[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

// Load objective + runs + stats
$effect(() => {
  if (!browser) return;
  Promise.all([
    getObjective(objectiveId),
    getObjectiveExecutions(objectiveId),
    getObjectiveStats(objectiveId),
  ])
    .then(([obj, r, s]) => { objective = obj; runs = r; stats = s; loading = false; })
    .catch(err => { error = (err as Error).message; loading = false; });
});

// SSE for live status (HUB-03) — only when an active run exists
$effect(() => {
  if (!browser || !activeRunId) return;
  // Poll metrics every 5s for live budget burn
  getExecutionMetrics(activeRunId).then(m => { liveMetrics = m; }).catch(() => {});
  const interval = setInterval(() => {
    getExecutionMetrics(activeRunId!).then(m => { liveMetrics = m; }).catch(() => {});
  }, 5000);

  // SSE for activity events (last 5)
  const cleanup = connectSSE(activeRunId, (event) => {
    activityFeed = [event, ...activityFeed].slice(0, 5);
  });
  return () => { clearInterval(interval); cleanup?.(); };
});
```

### Pattern 3: New Backend Endpoints in `objectives.ts`

**What:** Two new GET handlers added to the existing `objectivesRoutes` plugin.

#### `GET /objectives/:id/executions` — HUB-01

Returns all executions linked to the objective, ordered newest-first. Each row includes: `id`, `status`, `createdAt`, `totalCostCents` (from billing_events JOIN), `botCount` (from bots COUNT), `avgCompositeScore` (from bots AVG).

```typescript
// Source: objectives.ts (extend existing plugin)
fastify.get('/:id/executions', {
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    response: {
      200: Type.Array(Type.Object({
        id: Type.String({ format: 'uuid' }),
        status: Type.Union([...execution status literals]),
        objective: Type.String(),
        createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
        totalCostCents: Type.Integer(),
        botCount: Type.Integer(),
        avgCompositeScore: Type.Union([Type.Number(), Type.Null()]),
      })),
      404: Type.Object({ error: Type.String() }),
    },
  },
}, async (request, reply) => {
  const { id } = request.params;
  // Verify objective exists
  const [obj] = await db.select({ id: objectives.id }).from(objectives).where(eq(objectives.id, id));
  if (!obj) return reply.code(404).send({ error: 'Objective not found' });

  const rows = await db
    .select({
      id: executions.id,
      status: executions.status,
      objective: executions.objective,
      createdAt: executions.createdAt,
      totalCostCents: sql<number>`(
        SELECT CAST(COALESCE(SUM(be.amount_cents), 0) AS int)
        FROM billing_events be
        WHERE be.execution_id = ${executions.id}
          AND be.event_type = 'tool_invoked'
      )`,
      botCount: sql<number>`(
        SELECT CAST(COUNT(*) AS int)
        FROM bots b
        WHERE b.execution_id = ${executions.id}
      )`,
      avgCompositeScore: sql<number | null>`(
        SELECT AVG(b.composite_score)
        FROM bots b
        WHERE b.execution_id = ${executions.id}
          AND b.composite_score IS NOT NULL
      )`,
    })
    .from(executions)
    .where(eq(executions.objectiveId, id))
    .orderBy(sql`${executions.createdAt} DESC`);

  return reply.code(200).send(rows);
});
```

#### `GET /objectives/:id/stats` — HUB-02 + HUB-04

Returns aggregate stats across all runs for the objective: `totalSpendCents`, `totalTasksCompleted`, `totalBotHours`, `classTrendSummary` (human-readable string like "0 → 3 Artisans over 5 runs"), `classTransitions` (structured breakdown of Novice/Understudy/Artisan counts across all runs).

**DNA evolution data source:** The `agent_classes` table records the current class (`currentClass`) and promotion timing (`lastTransitionAt`, `artisanGraduationAt`) per bot per task category. To count class transitions across all runs for an objective, join: `agent_classes` → `bots` → `executions` WHERE `executions.objective_id = :id`. Count bots that are NOT Novice (i.e., have been promoted at least once: Understudy or Artisan).

```typescript
fastify.get('/:id/stats', {
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    response: {
      200: Type.Object({
        totalSpendCents: Type.Integer(),
        totalTasksCompleted: Type.Integer(),
        totalBotHours: Type.Number(),
        runCount: Type.Integer(),
        classBreakdown: Type.Object({
          novice: Type.Integer(),
          understudy: Type.Integer(),
          artisan: Type.Integer(),
          retired: Type.Integer(),
        }),
        classTrendSummary: Type.String(), // e.g. "0 → 3 Artisans over 5 runs"
      }),
      404: Type.Object({ error: Type.String() }),
    },
  },
}, async (request, reply) => {
  // ... queries below
});
```

**Agent class transition query pattern:**
```sql
-- Count current class distribution across all bots in all executions for this objective
SELECT ac.current_class, COUNT(*) as count
FROM agent_classes ac
JOIN bots b ON b.id = ac.bot_id
JOIN executions e ON e.id = b.execution_id
WHERE e.objective_id = $1
GROUP BY ac.current_class
```

Note: `agent_classes` has `lastTransitionAt` and `artisanGraduationAt` timestamps. For the DNA evolution summary (HUB-04), the count of Artisan-class bots across all runs approximates the Novice → Artisan transition count. The current approach is to count bots at `Artisan` class level (which implies at least two promotions occurred: Novice → Understudy → Artisan). A transition count (Novice→Understudy, Understudy→Artisan) could be derived from comparing class levels, but the schema does not store a transition history log — it only stores the CURRENT class. The readable "0 → 3 Artisans over 5 runs" summary is therefore a count of current Artisan-class bots, not a historical trace.

### Pattern 4: New API Client Functions in `api.ts`

```typescript
// src/lib/api.ts — add these 4 functions

export interface ObjectiveListItem {
  id: string;
  name: string;
  description: string | null;
  lastRunStatus: string | null;
  runCount: number;
  totalSpendCents: number;
  bestBotClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
  createdAt: string;
  updatedAt: string;
}

export async function getObjectives(): Promise<ObjectiveListItem[]> {
  return apiFetch(`${BASE}/objectives`);
}

export async function getObjective(id: string): Promise<Objective> {
  return apiFetch(`${BASE}/objectives/${id}`);
}

export async function getObjectiveExecutions(id: string): Promise<ObjectiveRun[]> {
  return apiFetch(`${BASE}/objectives/${id}/executions`);
}

export async function getObjectiveStats(id: string): Promise<ObjectiveStats> {
  return apiFetch(`${BASE}/objectives/${id}/stats`);
}
```

### Pattern 5: Navigation Integration

The nav in `+layout.svelte` must be updated to add an "Objectives" link alongside "Guide", "Verdicts", and "Billing". The nav is already using `<a href="/guide" class="nav-link">` pattern.

### Anti-Patterns to Avoid

- **SSE on the list page:** The `/objectives` list page shows `lastRunStatus` from the API response, which is a snapshot. Do not add SSE/polling to the list page — it adds complexity without meaningful value. Stale data on the list is acceptable; only the detail page needs live updates.
- **Loading all executions detail data on list page:** The list page must not call `getObjectiveExecutions` per row — that would be N+1 HTTP requests. The aggregations already in `GET /objectives` response are sufficient.
- **Building DNA evolution from `dna_store` table:** The `dna_store` table records bot DNA captures, not class transitions. Class state lives in `agent_classes`. Do not confuse the two. The DNA evolution summary comes from `agent_classes` JOIN `bots` JOIN `executions`.
- **Using `onMount` instead of `$effect`:** The project uses Svelte 5 runes. `onMount` is the Svelte 4 pattern. Use `$effect(() => { if (!browser) return; ... })`.
- **Forgetting `browser` check in `$effect`:** All API calls must be guarded with `if (!browser) return`. Without this guard, SvelteKit attempts to run client-side fetch during SSR and throws.
- **Connecting SSE before verifying active run:** The detail page must derive `activeRunId` from the executions list AFTER it loads. Do not hardcode or connect SSE to the objective ID directly — SSE is scoped to individual execution IDs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Activity feed SSE | New SSE endpoint for objective events | `connectSSE(activeRunId, handler)` from `$lib/sse.ts` | Already connects to `/executions/:id/events` which emits all needed event types |
| Live budget counter | WebSocket or custom push mechanism | `getExecutionMetrics(activeRunId)` on 5-second poll | Matches existing execution detail page pattern; Redis-backed, already implemented |
| Status badge styling | Custom badge components | CSS class names matching `status-{status}` pattern from billing/+page.svelte | Already defined and consistent across the app |
| Aggregate SQL | JS-layer post-processing of raw rows | Drizzle `sql<T>` correlated subqueries in handler | Established pattern in `billing.ts` and `objectives.ts`; keeps aggregation in DB |
| Routing | Custom SPA router | SvelteKit file-based routing: `routes/objectives/+page.svelte`, `routes/objectives/[id]/+page.svelte` | Zero config, matches all existing routes |
| Navigation link | Dynamic menu construction | Direct `<a href="/objectives" class="nav-link">` in `+layout.svelte` | Matches existing nav pattern |

**Key insight:** Every building block already exists. This phase is composition, not invention.

---

## Common Pitfalls

### Pitfall 1: `avgCompositeScore` Returns String, Not Number

**What goes wrong:** Drizzle returns PostgreSQL `NUMERIC/DECIMAL` columns as strings. `bots.compositeScore` is `numeric('composite_score', { precision: 5, scale: 2 })`. `AVG(b.composite_score)` also returns a string from PostgreSQL.

**Why it happens:** Node postgres drivers return `numeric`/`decimal` columns as strings to avoid float precision loss. Drizzle passes this through.

**How to avoid:** In the handler, cast: `sql<number | null>\`CAST(AVG(b.composite_score) AS float)\`` or parse in the frontend. The leaderboard handler in `executions.ts` already does `Number(hoursRow.value)` for the same reason — follow that pattern.

**Warning signs:** `avgCompositeScore` appears as `"7.50"` (string) in JSON response instead of `7.5` (number). TypeBox response schema mismatch will cause Fastify to omit or corrupt the field.

### Pitfall 2: `$effect` Infinite Re-run on `runs` State Update

**What goes wrong:** The `$effect` that monitors `activeRunId` (derived from `runs`) can cause infinite loops if it triggers a state update that re-derives `activeRunId`.

**Why it happens:** If `runs` is updated inside the `$effect` that reads `activeRunId`, Svelte re-runs the effect. The metrics poll (`liveMetrics = m`) doesn't affect `runs`, so this is safe. But if an SSE event handler updates `runs`, it creates a loop.

**How to avoid:** The SSE handler must only update `activityFeed` and `liveMetrics` — never `runs`. If `execution_status_changed` arrives and the detail page wants to reflect the new status, update a separate `activeRunStatus` state variable, not the `runs` array.

### Pitfall 3: Stale `activeRunId` After Run Completes

**What goes wrong:** The SSE connection stays open after the active run completes. The `$effect` cleanup function is not called because `activeRunId` doesn't change immediately (it's derived from `runs`, which was loaded once at page mount).

**Why it happens:** `runs` is fetched once. When the active run completes (SSE event `execution_status_changed` with `toStatus: 'completed'`), `runs` still shows `status: 'running'` because the initial load data is stale.

**How to avoid:** When `execution_status_changed` arrives with `toStatus` being a terminal status (`completed`/`failed`/`stopped`), update a local `activeRunTerminated` flag. Use that flag to conditionally disconnect SSE. OR re-fetch `getObjectiveExecutions(objectiveId)` after the terminal event to refresh the runs list.

**Recommended approach:** Handle `execution_status_changed` in the SSE callback: if `event.toStatus` is terminal, set `activeRunId = null` explicitly (as separate `$state`) to trigger the `$effect` cleanup.

### Pitfall 4: `GET /objectives/:id/executions` Route Shadowed by `GET /objectives/:id`

**What goes wrong:** Fastify may misroute `GET /objectives/:id/executions` because `:id` is greedy. If `executions` is interpreted as the `:id` param, the handler for `GET /objectives/:id` would receive `executions` as the id value (which would fail UUID validation and return 400).

**Why it happens:** Fastify uses a Radix tree router — it correctly distinguishes static path segments from dynamic params. `/:id/executions` is a more specific route than `/:id` when the third segment is the literal string `executions`.

**How to avoid:** Register `GET /:id/executions` and `GET /:id/stats` BEFORE `GET /:id` in the plugin, or verify that Fastify's routing handles this correctly (it does — static segments take precedence over params in Fastify's router). Verify with a quick runtime test.

**Confidence:** HIGH — Fastify's find-my-way router correctly handles this case. Static literal segments always take priority over dynamic params.

### Pitfall 5: HUB-04 DNA "Transitions" Are Not Recorded Historically

**What goes wrong:** The UI implies showing how many Novice → Understudy → Artisan transitions occurred. But `agent_classes` only stores the CURRENT class, not a history of transitions.

**Why it happens:** The schema was designed to track current state, not history. `lastTransitionAt` records WHEN the last transition occurred, but not from what class or for which run.

**How to avoid:** The requirement says "how many Novice → Understudy → Artisan class transitions have occurred" — interpret this as current class distribution, not historical counts. Report: X bots currently at Artisan (implying at least 2 promotions), Y bots at Understudy (1 promotion), Z bots remaining Novice. The `classTrendSummary` string "0 → 3 Artisans over 5 runs" is assembled from current class counts across all runs, not from a transition log.

**Warning signs:** If the planner attempts to build a transition count from a non-existent `class_transition_history` table, it will fail. Use `agent_classes.currentClass` counts only.

### Pitfall 6: `totalBotHours` in Stats Endpoint

**What goes wrong:** Bot-hours are stored in the `telemetry` table (one row per bot per run with `metric_name = 'bot_hours'`). The aggregate for an objective requires summing across all executions.

**Why it happens:** The `telemetry` table is linked to `executions` via `executionId` (and `botId`). Getting total bot-hours for an objective requires: `SUM(telemetry.metricValue) WHERE telemetry.metricName = 'bot_hours' AND telemetry.executionId IN (SELECT id FROM executions WHERE objective_id = :id)`.

**How to avoid:** Use a subquery or JOIN in the stats endpoint:
```sql
SELECT CAST(COALESCE(SUM(t.metric_value), 0) AS float)
FROM telemetry t
JOIN executions e ON e.id = t.execution_id
WHERE e.objective_id = $1
  AND t.metric_name = 'bot_hours'
```

**Warning signs:** Stats endpoint returns `totalBotHours: 0` for all objectives even when runs have completed — indicates missing JOIN to executions.

### Pitfall 7: TypeScript — `page.params` Type Safety

**What goes wrong:** `page.params.id` may be `undefined` in TypeScript even when the route guarantees `:id` exists.

**Why it happens:** `page.params` is typed as `Record<string, string>` by default. SvelteKit generates `$types.ts` to make params type-safe, but the existing pages use `page.params.id ?? ''` defensively.

**How to avoid:** Follow the existing pattern: `const objectiveId = $derived(page.params.id ?? '');`. This is what `executions/[id]/+page.svelte` does.

---

## Code Examples

Verified patterns from the existing codebase:

### Svelte 5 Runes Data Fetch Pattern (from billing/+page.svelte)
```typescript
// Source: services/ui/src/routes/billing/+page.svelte
let history = $state<BillingHistoryEntry[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

$effect(() => {
  if (!browser) return;
  getBillingHistory()
    .then(h => { history = h; loading = false; })
    .catch(err => { error = (err as Error).message; loading = false; });
});
```

### SSE Connection Lifecycle (from executions/[id]/+page.svelte)
```typescript
// Source: services/ui/src/routes/executions/[id]/+page.svelte
$effect(() => {
  if (!browser) return;
  const isTerminal = execution?.status === 'completed' ||
    execution?.status === 'failed' ||
    execution?.status === 'stopped';
  if (isTerminal) return;

  const cleanup = connectSSE(executionId, (event) => {
    activityFeed = [event, ...activityFeed].slice(0, 100);
    if (event.type === 'execution_status_changed' && event['toStatus']) {
      execution = execution
        ? { ...execution, status: event['toStatus'] as Execution['status'] }
        : execution;
    }
  });

  return cleanup ?? undefined;
});
```

### Polling Metrics Every 5 Seconds (from executions/[id]/+page.svelte)
```typescript
// Source: services/ui/src/routes/executions/[id]/+page.svelte
const interval = setInterval(() => {
  getExecutionMetrics(executionId).then(m => { metrics = m; }).catch(() => {});
}, 5000);

return () => clearInterval(interval);
```

### Drizzle Correlated Subquery with CAST (from objectives.ts)
```typescript
// Source: services/execution-service/src/routes/objectives.ts
runCount: sql<number>`(
  SELECT CAST(COUNT(*) AS int)
  FROM ${executions} e
  WHERE e.objective_id = ${objectives.id}
)`,
```

### Status Badge CSS Pattern (from billing/+page.svelte)
```css
/* Source: services/ui/src/routes/billing/+page.svelte */
.status { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
.status-completed { color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; }
.status-running { color: #0066cc; background: #eff6ff; border: 1px solid #bfdbfe; }
.status-failed { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }
.status-stopped { color: #ca8a04; background: #fefce8; border: 1px solid #fde68a; }
```

### Nav Link Pattern (from +layout.svelte)
```svelte
<!-- Source: services/ui/src/routes/+layout.svelte -->
<a href="/guide" class="nav-link">Guide</a>
<a href="/verdicts" class="nav-link">Verdicts</a>
<a href="/billing" class="nav-link">Billing</a>
<!-- Phase 17 adds: -->
<a href="/objectives" class="nav-link">Objectives</a>
```

### API Fetch Helper (from api.ts)
```typescript
// Source: services/ui/src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} — ${url}`);
  }
  return res.json() as Promise<T>;
}
```

---

## New Types Required

These types must be added to `services/ui/src/lib/types.ts`:

```typescript
// ObjectiveListItem — returned by GET /objectives (already from API, needs TS type on UI side)
export interface ObjectiveListItem {
  id: string;
  name: string;
  description: string | null;
  defaultMaxBots: number;
  defaultBudgetCapCents: number | null;
  defaultRuntimeLimitSeconds: number | null;
  defaultAllowedTools: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Aggregations
  lastRunStatus: string | null;
  runCount: number;
  totalSpendCents: number;
  bestBotClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
}

// ObjectiveRun — returned by GET /objectives/:id/executions (NEW endpoint)
export interface ObjectiveRun {
  id: string;
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  objective: string;   // the text objective description for the run
  createdAt: string;
  totalCostCents: number;
  botCount: number;
  avgCompositeScore: number | null;
}

// ObjectiveStats — returned by GET /objectives/:id/stats (NEW endpoint)
export interface ObjectiveStats {
  totalSpendCents: number;
  totalTasksCompleted: number;
  totalBotHours: number;
  runCount: number;
  classBreakdown: {
    novice: number;
    understudy: number;
    artisan: number;
    retired: number;
  };
  classTrendSummary: string;  // e.g. "3 Artisans, 2 Understudies, 5 Novices across 10 runs"
}
```

---

## Plan Decomposition Recommendation

Phase 17 breaks naturally into three plans:

**Plan 17-01: Backend API Extensions**
- Add `GET /objectives/:id/executions` to `objectives.ts`
- Add `GET /objectives/:id/stats` to `objectives.ts`
- Add types to `types.ts` (UI types file)
- Add API client functions to `api.ts`
- No new npm packages, no schema changes

**Plan 17-02: Objectives List Page**
- Create `services/ui/src/routes/objectives/+page.svelte`
- Update `+layout.svelte` nav to include Objectives link
- Displays: objective name, last run status badge, run count, total spend, best class
- Clicking any row navigates to `/objectives/:id`
- Empty state when no objectives exist

**Plan 17-03: Objective Detail Page**
- Create `services/ui/src/routes/objectives/[id]/+page.svelte`
- Section 1: Objective header (name, description, created date)
- Section 2: Runs table (HUB-01) — all executions with date, status, cost, bots, avg score, link to `/executions/:id`
- Section 3: Aggregate stats panel (HUB-02) — total spend, tasks, bot-hours, class breakdown
- Section 4: Live status inline (HUB-03) — conditional, shown only when `activeRunId` exists
- Section 5: DNA evolution summary (HUB-04) — readable class distribution text

**Dependencies:** 17-01 must complete before 17-02 and 17-03 (API must exist). 17-02 and 17-03 can be built in parallel (they are independent pages).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Svelte 4: `let x = writable()`, `onMount` | Svelte 5: `$state<T>()`, `$effect()`, `$derived()` | Phase 17 must use runes API — all existing pages do |
| `<slot>` in layouts | `{@render children()}` | Already in `+layout.svelte`; new pages use `{@render children()}` |
| Named slots | Snippets + `{@render}` | Not needed for these pages; document for awareness |

---

## Open Questions

1. **`totalTasksCompleted` in stats — which table?**
   - What we know: Tasks are in the `tasks` table with `status: 'completed'`. The stats endpoint needs to count completed tasks across all executions for the objective.
   - What's unclear: Whether `tasks.executionId` provides a direct path or if it needs the executions FK join. It does — `tasks.executionId` directly references `executions.id`, so: `COUNT(*) FROM tasks WHERE status = 'completed' AND executionId IN (SELECT id FROM executions WHERE objective_id = :id)`.
   - Recommendation: Use a correlated subquery or JOIN. The `billing.ts` and `objectives.ts` patterns use correlated subqueries — follow that.

2. **DNA evolution trend display: per-run breakdown vs. aggregate total**
   - What we know: HUB-04 says "how many Novice → Understudy → Artisan class transitions have occurred across all runs." The `agent_classes` table stores current class, not history.
   - What's unclear: Whether the UI should show total counts (3 Artisans total) or a per-run progression ("Run 1: 0 Artisans → Run 5: 3 Artisans").
   - Recommendation: Per-run breakdown requires fetching agent_classes per execution, which is expensive. Build total counts for the stats endpoint. The summary string "0 → 3 Artisans over 5 runs" can be formed from `classBreakdown.artisan` and `runCount`. The planner should pick total counts as the implementation.

3. **`Objective` type on UI side — overlap with `ObjectiveListItem`**
   - What we know: `GET /objectives` returns `ObjectiveListItem` (with aggregations). `GET /objectives/:id` returns the base `Objective` (no aggregations). The detail page loads the base `Objective` for the header. `ObjectiveListItem` extends the base.
   - What's unclear: Whether to define two separate interfaces or one with optional aggregation fields.
   - Recommendation: Define `Objective` (base, no aggregations) and `ObjectiveListItem extends Objective` with aggregation fields added. This is clean TypeScript and matches the API contract.

---

## Sources

### Primary (HIGH confidence — directly inspected)

- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/objectives.ts` — confirmed all 5 endpoints, TypeBox schemas, correlated subquery pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/lib/api.ts` — confirmed `apiFetch` pattern, all existing API functions
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/lib/sse.ts` — confirmed `connectSSE`, `connectBotLogs`, `connectLifecycleSSE` implementations
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/lib/types.ts` — confirmed all existing TypeScript interfaces
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/executions/[id]/+page.svelte` — confirmed Svelte 5 runes pattern, SSE lifecycle, metrics polling
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/billing/+page.svelte` — confirmed list page pattern with stats grid
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/+layout.svelte` — confirmed nav link pattern, design tokens, CSS variables
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/app.css` — confirmed all CSS custom properties (--signal, --surface-1, --text-primary, etc.)
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/agent-classes.ts` — confirmed `agentClassEnum`, `currentClass`, `lastTransitionAt`, `artisanGraduationAt` columns
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/executions.ts` — confirmed `objectiveId` FK column is present (Phase 16-01 complete)
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/objectives.ts` — confirmed table schema
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/package.json` — confirmed svelte@5.51.3, @sveltejs/kit@2.52.0
- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/phases/16-named-objectives-data-model/16-02-SUMMARY.md` — confirmed Phase 16 API is complete
- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/phases/16-named-objectives-data-model/16-03-SUMMARY.md` — confirmed objectiveId FK wiring is complete

---

## Metadata

**Confidence breakdown:**
- Standard stack (Svelte 5, SvelteKit 2, no new packages): HIGH — directly inspected package.json and all installed versions
- Architecture patterns (runes API, SSE reuse, API client pattern): HIGH — derived from running existing page code
- New backend endpoints (correlated subqueries in objectives.ts): HIGH — same query pattern already used in Phase 16
- DNA evolution approach (current class counts, not history): HIGH — directly inspected `agent_classes` schema; no transition history table exists
- Pitfalls (composite score type coercion, SSE cleanup, Fastify route ordering): MEDIUM-HIGH — derived from existing code patterns and known Drizzle/PostgreSQL behavior

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — Svelte 5, SvelteKit 2, Drizzle 0.45 are stable; no fast-moving dependencies for this phase)
