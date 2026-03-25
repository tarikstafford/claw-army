# Phase 8: Evolution Dashboard — Research

**Researched:** 2026-03-25
**Domain:** SvelteKit UI + Express API routes — data-intensive visualization of evolutionary state stored across five Drizzle schema tables
**Confidence:** HIGH

## Summary

Phase 8 delivers the Evolution Dashboard: a Back Office-world SvelteKit section under `/evolution` (or an evolution tab wired into the nav) that surfaces fleet class distribution, per-bot timeline, depth-1 lineage tree, experiment ledger, category benchmarks, and pending human-confirmation flows. All backing data is already in the database (agent_classes, council_verdicts, bot_souls, category_benchmarks, dna_store) from Phase 5's God Layer. The only work is (a) new Express API routes on the akasa-server to aggregate and serve this data and (b) new SvelteKit pages + components to render it.

The lineage tree (DASH-03) requires `d3-hierarchy` — specifically `d3.tree()` layout — rendered declaratively as SVG inside a Svelte component using `$derived.by()` for layout computation. This is the only third-party addition. Everything else is pure CSS + Svelte 5 runes + existing design tokens.

DASH-08 mandates Back Office world as the default for the evolution section. This follows the exact same pattern as Phase 7's `/tools` section: a `+layout.svelte` with `onMount(() => { setMode('back-office'); ... })` that captures and restores the previous mode on unmount.

**Primary recommendation:** Build three new Express API routes (fleet overview, bot timeline, benchmarks) + one PATCH route already exists for confirm/reject. Render everything with existing design-system components plus one new `LineageTree.svelte` SVG component using `d3-hierarchy`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit v2 + Svelte 5 | ^2.52.0 / ^5.51.3 | Page routing, SSR data loading, reactive UI | Project standard (Phase 4 complete) |
| Drizzle ORM | ^0.45.1 | Database queries for all evolution tables | Project standard |
| Express Router | (bundled in akasa-server) | New API routes for evolution dashboard data | Project standard pattern (all Phases 5-7) |

### New Addition

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-hierarchy | ^3.1.2 | Tree layout computation for lineage visualization | DASH-03 only — lineage tree nodes + links |

### Verified Versions

```bash
# d3-hierarchy current version (confirmed 2026-03-25):
npm view d3-hierarchy version   # → 3.1.2
```

### Not Adding

| Avoided | Reason |
|---------|--------|
| Full `d3` bundle | 300KB for layout that only needs hierarchy (~45KB) |
| Chart.js / Recharts | Abstract away the layout; lineage needs custom SVG not a chart type |
| Tailwind | Conflicts with existing pure CSS token system |

### Installation

```bash
# In the ui package:
cd /path/to/claw-army && pnpm --filter @claw/ui add d3-hierarchy
pnpm --filter @claw/ui add -D @types/d3-hierarchy
```

---

## Architecture Patterns

### Route Structure

```
services/
├── akasa-server/src/routes/
│   └── evolution.ts              # NEW — fleet overview, timeline, benchmarks
│
└── ui/src/
    ├── routes/(app)/evolution/
    │   ├── +layout.svelte        # NEW — Back Office mode lock (same pattern as /tools)
    │   ├── +page.server.ts       # NEW — fleet overview SSR load
    │   ├── +page.svelte          # NEW — fleet overview (DASH-01)
    │   ├── [botId]/
    │   │   ├── +page.server.ts   # NEW — per-bot timeline + lineage SSR load
    │   │   └── +page.svelte      # NEW — timeline (DASH-02) + lineage tree (DASH-03) + ledger (DASH-04)
    │   └── benchmarks/
    │       ├── +page.server.ts   # NEW — category benchmarks SSR load
    │       └── +page.svelte      # NEW — benchmarks (DASH-05) + pioneer treatments (DASH-07)
    │
    └── lib/
        ├── api.ts                # EXTEND — add evolution fetch helpers
        └── components/evolution/
            ├── FleetOverview.svelte     # NEW — class distribution grid + score trend
            ├── BotTimeline.svelte       # NEW — chronological event list
            ├── LineageTree.svelte       # NEW — d3-hierarchy SVG tree
            ├── ExperimentLedger.svelte  # NEW — run-by-run table per bot
            ├── BenchmarkCard.svelte     # NEW — per-category benchmark row
            └── VerdictConfirm.svelte    # NEW — pending verdict approve/reject widget
```

### Pattern 1: Back Office Mode Lock (layout)

Established in Phase 7 `/tools` section. Use verbatim:

```svelte
<!-- services/ui/src/routes/(app)/evolution/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setMode, getMode, type AkasaMode } from '$lib/mode';

  let { children } = $props();
  let previousMode: AkasaMode | null = $state(null);

  onMount(() => {
    previousMode = getMode();
    setMode('back-office');
    return () => {
      if (previousMode && previousMode !== 'back-office') {
        setMode(previousMode);
      }
    };
  });
</script>
```

### Pattern 2: SSR Load with Promise.allSettled

Established in Phase 7. Use for parallel fetches where partial failure is acceptable:

```typescript
// services/ui/src/routes/(app)/evolution/+page.server.ts
export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const [fleetRes, pendingRes] = await Promise.allSettled([
    fetch('/api/akasa/evolution/fleet'),
    fetch('/api/akasa/evolution/pending'),
  ]);

  const fleet = fleetRes.status === 'fulfilled' && fleetRes.value.ok
    ? await fleetRes.value.json()
    : null;
  const pendingVerdicts = pendingRes.status === 'fulfilled' && pendingRes.value.ok
    ? await pendingRes.value.json()
    : [];

  return { fleet, pendingVerdicts };
};
```

### Pattern 3: d3-hierarchy Lineage Tree in Svelte 5

Layout computation happens in `$derived.by()`. Rendering is declarative SVG in the template. No D3 DOM manipulation.

```svelte
<!-- services/ui/src/lib/components/evolution/LineageTree.svelte -->
<script lang="ts">
  import { hierarchy, tree } from 'd3-hierarchy';

  interface SoulNode {
    id: string;
    label: string;
    generation: number;
    isArchetype: boolean;
    isPioneer?: boolean;
    children?: SoulNode[];
  }

  let { root }: { root: SoulNode } = $props();

  const WIDTH = 480;
  const HEIGHT = 240;
  const NODE_R = 10;

  const layout = $derived.by(() => {
    const h = hierarchy(root);
    const t = tree<SoulNode>().size([WIDTH - 40, HEIGHT - 60]);
    t(h);
    return h;
  });

  const nodes = $derived(layout.descendants());
  const links = $derived(layout.links());
</script>

<svg width={WIDTH} height={HEIGHT} class="lineage-tree" role="img" aria-label="Soul lineage tree">
  <g transform="translate(20,30)">
    {#each links as link (link.target.data.id)}
      <line
        x1={link.source.x ?? 0}
        y1={link.source.y ?? 0}
        x2={link.target.x ?? 0}
        y2={link.target.y ?? 0}
        class="tree-link"
      />
    {/each}
    {#each nodes as node (node.data.id)}
      <g
        class="tree-node"
        class:pioneer={node.data.isPioneer}
        class:archetype={node.data.isArchetype}
        transform="translate({node.x},{node.y})"
        role="button"
        tabindex="0"
      >
        <circle r={NODE_R} />
        <text dy="1.4em" text-anchor="middle" class="node-label">
          {node.data.label}
        </text>
      </g>
    {/each}
  </g>
</svg>

<style>
  .lineage-tree { overflow: visible; }

  .tree-link {
    stroke: var(--bo-border);
    stroke-width: 1px;
  }

  .tree-node circle {
    fill: var(--bo-card);
    stroke: var(--bo-vb);
    stroke-width: 1.5px;
    cursor: pointer;
    transition: stroke 0.15s;
  }

  .tree-node:hover circle,
  .tree-node:focus circle {
    stroke: var(--bo-violet);
  }

  .tree-node.archetype circle {
    stroke: var(--bo-amber);
  }

  .tree-node.pioneer circle {
    stroke: var(--bo-amber);
    fill: rgba(251, 191, 36, 0.15);
  }

  .node-label {
    font-family: var(--font-label);
    font-size: 6px;
    fill: var(--bo-caption);
  }
</style>
```

### Pattern 4: New Express Routes for Evolution Data

All existing evolution routes follow the pattern in `services/akasa-server/src/routes/`. The new `evolution.ts` route file needs to be registered in `services/akasa-server/src/routes/index.ts`.

```typescript
// services/akasa-server/src/routes/evolution.ts
import { Router } from 'express';
import { db, agentClasses, councilVerdicts, botSouls, categoryBenchmarks } from '@claw/db';
import { eq, desc, and } from 'drizzle-orm';

export function evolutionDashboardRouter(): Router {
  const router = Router();

  // GET /api/akasa/evolution/fleet — class distribution + pending verdict count
  router.get('/fleet', async (_req, res, next) => { ... });

  // GET /api/akasa/evolution/bots/:botId/timeline — chronological events
  router.get('/bots/:botId/timeline', async (req, res, next) => { ... });

  // GET /api/akasa/evolution/bots/:botId/lineage — soul ancestry chain
  router.get('/bots/:botId/lineage', async (req, res, next) => { ... });

  // GET /api/akasa/evolution/bots/:botId/ledger — run-by-run experiment log
  router.get('/bots/:botId/ledger', async (req, res, next) => { ... });

  // GET /api/akasa/evolution/benchmarks — all category benchmarks
  router.get('/benchmarks', async (_req, res, next) => { ... });

  return router;
}
```

Mount in `index.ts`:
```typescript
akasaRouter.use('/akasa/evolution', evolutionDashboardRouter());
// Note: evolutionTriggerRouter() is already mounted at /akasa/evolution
// The new router adds sub-paths that don't conflict (/fleet, /bots/*, /benchmarks)
```

**Conflict check:** `evolutionTriggerRouter()` only exposes `POST /trigger`. The new routes are all `GET` on different paths. No conflict.

### Pattern 5: Pending Verdict Confirmation

The confirm/reject API is already built (`PATCH /api/akasa/verdicts/:id/confirm` and `/reject`). The UI widget only needs to call these and handle optimistic state updates.

```svelte
<!-- VerdictConfirm.svelte — inline approve/reject controls -->
<script lang="ts">
  let { verdict, onaction } = $props();
  let loading = $state(false);

  async function confirm() {
    loading = true;
    try {
      const res = await fetch(`/api/akasa/verdicts/${verdict.id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBy: 'user' }),
      });
      if (res.ok) onaction('confirmed', verdict.id);
    } finally {
      loading = false;
    }
  }

  async function reject() {
    loading = true;
    try {
      const res = await fetch(`/api/akasa/verdicts/${verdict.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBy: 'user' }),
      });
      if (res.ok) onaction('rejected', verdict.id);
    } finally {
      loading = false;
    }
  }
</script>
```

### Anti-Patterns to Avoid

- **D3 DOM manipulation in Svelte:** Never call `d3.select(svgRef).append(...)`. Compute layout in `$derived.by()`, render declarative SVG.
- **Imperative `$effect()` for tree layout:** Layout is a pure function of data. Use `$derived.by()` not `$effect()` to avoid tracking issues.
- **Polling for pending verdicts:** Do not poll from the client. Load pending verdicts in `+page.server.ts` SSR and let user manually refresh. Real-time updates are out of scope for this phase.
- **Mixing `/api/akasa/evolution` paths with `evolutionTriggerRouter`:** The trigger router uses `POST /trigger`. New dashboard routes use `GET`. Mount both at the same prefix — Express dispatches by method + path.
- **Skipping `requiresHumanConfirmation` filter:** Only surface verdicts where `requiresHumanConfirmation = true AND status = 'pending'` as actionable. Auto-confirmed verdicts (Maintain, Monitor) should not appear.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree layout (nodes x,y) | Custom position arithmetic | `d3-hierarchy tree()` | Handles sibling spacing, overlapping nodes, variable depths; ~40 lines vs ~200 |
| Hierarchy link paths | Manual SVG path calculation | `d3-hierarchy` `.links()` | Source/target coordinates already on node objects after layout call |
| Class distribution count | Per-class COUNT() queries | Single Drizzle query with subquery or group | Avoid N+1: one JOIN query returns all classes; compute counts in JS |

**Key insight:** The lineage tree is the only visualization that needs a layout library. All other views (timeline, ledger, benchmarks) are tabular/list rendering where CSS grid + semantic HTML is sufficient.

---

## Data Model: What Each Dashboard View Reads

This is critical for the planner — each DASH requirement maps to specific tables:

### DASH-01: Fleet Overview
**Tables:** `agent_classes` (GROUP BY current_class → counts), `bots` (compositeScore for trend)
**Query approach:** Get all `agent_classes` rows grouped by `current_class`. Calculate counts per class in JS. For score trend: query `council_verdicts` ordered by `createdAt` to build a time series.

```typescript
// Fleet summary shape
interface FleetSummary {
  classCounts: {
    Novice: number;
    Understudy: number;
    Artisan: number;
    Retired: number;
  };
  totalBots: number;
  averageCompositeScore: number | null;
  pendingVerdictCount: number;
}
```

### DASH-02: Per-Bot Timeline
**Tables:** `council_verdicts` (verdicts with timestamps), `agent_classes` (class transitions), `dna_store` (DNA captures)
**Approach:** Fetch all three tables filtered by `botId`, merge into a unified event list sorted by timestamp. Each event has a `type: 'verdict' | 'class_transition' | 'dna_capture'`.

```typescript
interface TimelineEvent {
  id: string;
  type: 'verdict' | 'class_transition' | 'dna_capture';
  timestamp: string;
  summary: string;
  // type-specific detail fields
  verdictType?: string;
  status?: string;
  newClass?: string;
  previousClass?: string;
  compositeScore?: string;
}
```

### DASH-03: Lineage Tree
**Tables:** `bot_souls` (self-referencing via `parentSoulId`), `agent_classes` (for pioneer flag)
**Approach:** Walk soul ancestry chain starting from the bot's current `soulId`. Traverse `parentSoulId` recursively up to archetype root. Depth-1 spec means: show archetype → immediate parents → current. Limit to 3 levels for depth-1 display.

```typescript
interface SoulNode {
  id: string;
  label: string;          // archetypeName or first 12 chars of contentHash
  generation: number;
  isArchetype: boolean;
  isPioneer: boolean;
  children?: SoulNode[];
}
```

**Depth constraint:** REQUIREMENTS.md says "depth-1" — render archetype node, any intermediate mutation nodes, and current soul. For a typical bot this is 2-3 hops. The `generation` field on `bot_souls` tracks this.

### DASH-04: Experiment Ledger
**Tables:** `council_verdicts` (one row per run evaluation), `bot_souls` (for mutation info), `executions` (for run metadata)
**Join:** `council_verdicts JOIN executions ON council_verdicts.executionId = executions.id`
**Shape:**

```typescript
interface LedgerRow {
  executionId: string;
  executionDate: string;
  compositeScore: string;
  scoreDelta: string | null;      // computed: current - previous row's score
  verdictType: string;
  status: string;                  // confirmed / pending / rejected
  mutationApplied: boolean;        // whether a soul mutation was applied post-verdict
  keepDiscard: 'keep' | 'discard' | 'pending';
}
```

### DASH-05 + DASH-07: Category Benchmarks + Pioneer
**Tables:** `category_benchmarks`, `agent_classes` (for pioneer flag per bot), `bot_souls` (for pioneer soul name)
**Query:** All `category_benchmarks` rows, joined or enriched with soul name for display.

```typescript
interface BenchmarkRow {
  taskCategory: string;
  pioneerBotId: string;
  baselineCompositeScore: string;
  confirmedRunCount: number;
  thinDataFlag: boolean;
  benchmarkMature: boolean;
  isPioneer: boolean;             // true = this category has a confirmed pioneer
  pioneerAchievedAt: string;      // createdAt of the benchmark row
}
```

### DASH-06: Pending Verdicts
**Tables:** `council_verdicts WHERE requiresHumanConfirmation = true AND status = 'pending'`
**Also fetch:** `bot_souls` (soul name), `bots` (composite score)

---

## Common Pitfalls

### Pitfall 1: Mounting Two Routers at the Same Express Prefix
**What goes wrong:** `evolutionTriggerRouter()` is already mounted at `/akasa/evolution` in `routes/index.ts`. If the new `evolutionDashboardRouter()` is naively added as a second mount at the same prefix without method isolation, the first matching middleware wins.
**Why it happens:** Express `use()` matches by path prefix, not exact path + method. Both routers mount at `/akasa/evolution`.
**How to avoid:** The trigger router only has `POST /trigger`. The new dashboard router only has `GET` routes. They coexist. Verify by checking `evolutionTriggerRouter` — it only registers `router.post('/trigger', ...)`. The new routes are `GET /fleet`, `GET /bots/:botId/timeline`, etc. No path collision exists.
**Warning signs:** 404 on dashboard GET routes when only the trigger router is mounted.

### Pitfall 2: D3 SSR Crash
**What goes wrong:** Importing `d3-hierarchy` in a `+page.server.ts` or at module load time in Svelte causes Node.js import errors because `d3-hierarchy` v3 is ESM-only.
**Why it happens:** The `@claw/source` custom condition resolves workspace packages, but `d3-hierarchy` is a browser-and-Node ESM package that works in both — just ensure import is inside the component, not in `+page.server.ts`.
**How to avoid:** Import `d3-hierarchy` only inside Svelte component `<script>` blocks (client-side). The layout computation happens client-side after hydration. The raw soul ancestry data (array of nodes) is fetched server-side; D3 only computes x,y coordinates client-side.

### Pitfall 3: `agent_classes` Upsert vs. Insert Misread
**What goes wrong:** Querying `agent_classes` for current class by `botId` returns multiple rows per bot (one per class transition event). Selecting `currentClass` from any row returns the transition, not the latest state.
**Why it happens:** The `agent_classes` table is insert-only for transitions (God Layer inserts a new row per transition). It is NOT an upsert table.
**How to avoid:** Always query `ORDER BY updatedAt DESC LIMIT 1` to get the latest class. The schema has `index('agent_classes_bot_id_idx')` on `botId` to support this query efficiently. Verified in `god-layer-handler.ts` which does the same query.

### Pitfall 4: Score Delta Computation — NULL First Rows
**What goes wrong:** The first `council_verdicts` row for a bot has no prior row, so delta computation crashes on `undefined`.
**Why it happens:** The ledger requires `delta = current_score - previous_score`. The first row has no previous.
**How to avoid:** Sort verdict rows by `createdAt ASC`, iterate in JS, carry a `previousScore` variable initialized to `null`. When `previousScore === null`, render `—` for the delta.

### Pitfall 5: Pioneer Badge Rendering — Two Sources of Truth
**What goes wrong:** `isPioneer` lives on `agent_classes.isPioneer` (per-bot per-category) AND a `category_benchmarks` row is created when a pioneer is detected. For the benchmarks view (DASH-05), read from `category_benchmarks`. For the bot detail view (DASH-07), the pioneer badge should come from `agent_classes.isPioneer`.
**Why it happens:** These are two different views of the same fact — "who was first in category" vs "what bot achieved it."
**How to avoid:** Benchmark page reads `category_benchmarks`. Bot detail page reads `agent_classes.isPioneer` for the badge.

### Pitfall 6: Lineage Recursion Without Depth Guard
**What goes wrong:** Walking `parentSoulId` chain indefinitely causes N+1 queries or infinite loop if data is corrupted.
**Why it happens:** `bot_souls.parentSoulId` self-references — walking it naively requires one query per ancestor.
**How to avoid:** Fetch the lineage chain in a single CTE query up to depth 10 OR load the full `bot_souls` table for the relevant `botId` generation range and assemble the tree in JavaScript. Maximum practical depth is ~5 generations (soul generation field caps this). Add a hard limit of 10 hops in the traversal logic.

---

## Code Examples

### Fleet Overview Query

```typescript
// Source: packages/db/src/schema/agent-classes.ts + bots.ts
import { db, agentClasses, councilVerdicts } from '@claw/db';
import { sql, eq, count } from 'drizzle-orm';

// Class distribution — query agent_classes, get latest per bot
const classRows = await db
  .select({
    currentClass: agentClasses.currentClass,
    rowCount: count(),
  })
  .from(agentClasses)
  .groupBy(agentClasses.currentClass);

// Pending human-confirmation verdicts
const pendingRows = await db
  .select({ id: councilVerdicts.id })
  .from(councilVerdicts)
  .where(
    and(
      eq(councilVerdicts.requiresHumanConfirmation, true),
      eq(councilVerdicts.status, 'pending'),
    )
  );
```

### Soul Lineage Walk (Server-side)

```typescript
// Source: packages/db/src/schema/bot-souls.ts
import { db, botSouls } from '@claw/db';
import { eq } from 'drizzle-orm';

async function walkLineage(soulId: string, maxDepth = 10): Promise<SoulNode[]> {
  const chain: SoulNode[] = [];
  let currentId: string | null = soulId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const rows = await db
      .select({
        id: botSouls.id,
        parentSoulId: botSouls.parentSoulId,
        isArchetype: botSouls.isArchetype,
        archetypeName: botSouls.archetypeName,
        generation: botSouls.generation,
        contentHash: botSouls.contentHash,
      })
      .from(botSouls)
      .where(eq(botSouls.id, currentId))
      .limit(1);

    const soul = rows[0];
    if (!soul) break;

    chain.push({
      id: soul.id,
      label: soul.archetypeName ?? soul.contentHash.slice(0, 8),
      generation: soul.generation,
      isArchetype: soul.isArchetype,
      isPioneer: false, // enriched separately from agent_classes
    });

    currentId = soul.parentSoulId;
    depth++;
  }

  return chain.reverse(); // root first
}
```

---

## NavBar Extension

The NavBar in `services/ui/src/lib/components/NavBar.svelte` currently has tabs: INDRA, OFFICE, CHAT, SANCTUM, TOOLS. Phase 8 needs an EVOLUTION tab entry added (route: `/evolution`). This requires a small edit to the `tabs` array and the `ActiveTab` type union.

---

## API Endpoint Map

All new routes mount under `/api/akasa/evolution/` (prefix already used by trigger router):

| Method | Path | Purpose | DASH req |
|--------|------|---------|----------|
| GET | `/api/akasa/evolution/fleet` | Class counts, avg score, pending count | DASH-01 |
| GET | `/api/akasa/evolution/bots/:botId/timeline` | Chronological event list | DASH-02 |
| GET | `/api/akasa/evolution/bots/:botId/lineage` | Soul ancestry chain | DASH-03 |
| GET | `/api/akasa/evolution/bots/:botId/ledger` | Run-by-run experiment log | DASH-04 |
| GET | `/api/akasa/evolution/benchmarks` | All category benchmarks | DASH-05 |
| GET | `/api/akasa/evolution/pending` | Pending human-confirmation verdicts | DASH-06 |
| PATCH | `/api/akasa/verdicts/:id/confirm` | **ALREADY EXISTS** — God Layer confirm | DASH-06 |
| PATCH | `/api/akasa/verdicts/:id/reject` | **ALREADY EXISTS** — reject verdict | DASH-06 |

The SvelteKit proxy at `/api/[...path]` already forwards to akasa-server, so no proxy configuration changes are needed.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies beyond `d3-hierarchy` which is a pure JS package requiring only `npm install`. No services, CLIs, or runtimes are required beyond the existing dev stack.

---

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in config.json (key absent = enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard per CLAUDE.md) |
| Config file | `services/akasa-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @claw/execution-service exec vitest run` |
| Full suite command | `pnpm --filter @claw/execution-service exec vitest run` |

Note: The akasa-server tests live at `services/akasa-server/src/__tests__/`. Existing test files: `council.test.ts`, `god-layer.test.ts`, `evolution-trigger.test.ts`, `soul-injection.test.ts`, `souls.test.ts`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Fleet overview API returns class counts | unit | vitest run `__tests__/evolution-dashboard.test.ts` | ❌ Wave 0 |
| DASH-02 | Timeline endpoint returns merged events by botId | unit | vitest run `__tests__/evolution-dashboard.test.ts` | ❌ Wave 0 |
| DASH-03 | Lineage walk respects depth limit, builds tree | unit | vitest run `__tests__/evolution-dashboard.test.ts` | ❌ Wave 0 |
| DASH-04 | Ledger rows have score delta computed correctly | unit | vitest run `__tests__/evolution-dashboard.test.ts` | ❌ Wave 0 |
| DASH-05 | Benchmarks endpoint returns maturity + thin-data flags | unit | vitest run `__tests__/evolution-dashboard.test.ts` | ❌ Wave 0 |
| DASH-06 | Pending verdicts filter: requiresHumanConfirmation=true AND status=pending | unit | vitest run `__tests__/evolution-dashboard.test.ts` | ❌ Wave 0 |
| DASH-07 | Pioneer amber treatment present in BenchmarkCard | manual | visual inspect in browser | — |
| DASH-08 | Evolution layout locks to back-office mode on mount | manual | visual inspect in browser | — |

### Sampling Rate

- **Per task commit:** `pnpm --filter @claw/akasa-server exec vitest run`
- **Per wave merge:** `pnpm --filter @claw/akasa-server exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/akasa-server/src/__tests__/evolution-dashboard.test.ts` — covers DASH-01 through DASH-06 route handlers with mocked DB

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Fleet overview showing agent count by class (Novice/Understudy/Artisan/Retired), composite score trends | Query `agent_classes` GROUP BY class + `council_verdicts` for trend. New `GET /fleet` route. |
| DASH-02 | Per-agent evolution timeline — every council verdict, class transition, mutation event, DNA capture shown chronologically | Query three tables (council_verdicts, agent_classes, dna_store) by botId, merge + sort in JS. New `GET /bots/:botId/timeline` route. |
| DASH-03 | Lineage tree visualization (depth-1) — archetype origin → mutations → current soul form, clickable nodes | Walk `bot_souls.parentSoulId` chain server-side. Render with `d3-hierarchy tree()` + declarative SVG in `LineageTree.svelte`. |
| DASH-04 | Experiment ledger per agent — composite score, score delta, mutation applied, verdict, keep/discard outcome | Query `council_verdicts JOIN executions`, compute delta in JS. New `GET /bots/:botId/ledger` route. |
| DASH-05 | Category benchmarks view — pioneer baselines, benchmark maturity (3+ confirmed runs), thin-data flags, current best score | Query `category_benchmarks` table. New `GET /benchmarks` route. |
| DASH-06 | Pending confirmation notifications — Promote/Retire verdicts surfaced with evidence and inline approve/reject controls | Query pending verdicts (`requiresHumanConfirmation=true AND status='pending'`). Confirm/reject routes already built. New `VerdictConfirm.svelte` widget. |
| DASH-07 | Pioneer designation visual treatment — amber/gold, permanent badge, "First in [category]" with date | CSS using `--bo-amber` for pioneer nodes in `LineageTree.svelte` and pioneer row styling in `BenchmarkCard.svelte`. |
| DASH-08 | Evolution Dashboard defaults to Director's Cut (Back Office) world | Same `+layout.svelte` pattern as Phase 7 `/tools` — `onMount(() => setMode('back-office'))`. |
</phase_requirements>

---

## Sources

### Primary (HIGH confidence)

- Codebase audit: `packages/db/src/schema/` — all table schemas verified 2026-03-25
- Codebase audit: `services/akasa-server/src/routes/` — all existing API routes verified
- Codebase audit: `services/ui/src/routes/(app)/tools/` — Phase 7 patterns verified
- Codebase audit: `services/ui/src/lib/mode.ts` — Back Office mode lock pattern verified
- npm registry: `d3-hierarchy@3.1.2` — confirmed current version 2026-03-25

### Secondary (MEDIUM confidence)

- CLAUDE.md `## Summary: Net New for v6.0` section — d3-hierarchy ^3 recommended as standard for lineage tree
- `tasks/prd-akasa-mvp.md` US-009 acceptance criteria — product requirements
- `.planning/REQUIREMENTS.md` DASH-01 through DASH-08 — verified requirement text

### Tertiary (LOW confidence)

None — all findings based on direct codebase inspection or official package registry.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — d3-hierarchy version verified against npm registry; all other libraries are project-existing
- Architecture: HIGH — patterns lifted verbatim from Phase 7 codebase; table schemas directly inspected
- Pitfalls: HIGH — `agent_classes` insert-only pattern verified in `god-layer-handler.ts`; D3 SSR issue is known ESM pattern; lineage recursion depth handled by generation field

**Research date:** 2026-03-25
**Valid until:** 2026-05-25 (stable libraries, no fast-moving dependencies)
