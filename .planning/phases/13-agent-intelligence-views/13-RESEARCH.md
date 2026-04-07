# Phase 13: Agent Intelligence Views - Research

**Researched:** 2026-04-07
**Domain:** SvelteKit UI extension + d3-hierarchy org map + Paperclip runtime API proxy
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Agent profile is NOT a separate route — it extends the existing `/evolution/[botId]` page with new sections
- **D-02:** Identity card sits at top of bot detail page (always visible): name, class badge, archetype origin, task category, pioneer status, composite score
- **D-03:** Below identity card, tabbed navigation: Profile (new), Timeline (existing BotTimeline), Lineage (existing LineageTree), Ledger (existing ExperimentLedger)
- **D-04:** Profile tab contains: soul dimensions radar chart, formatted SOUL.md viewer, constitution directives list, class progression timeline
- **D-05:** 7-axis radar/spider chart for soul dimensions (identityRole, decisionPriorities, toolUsageDoctrine, riskTolerance, communicationStyle, recoveryBehavior, ethicalHardStops)
- **D-06:** Dimensions are text strings, not numeric — radar chart needs a scoring heuristic. Claude's discretion on appropriate approach
- **D-07:** SOUL.md displayed as formatted markdown (use existing markdown rendering if available, or render dimension sections with headers)
- **D-08:** Org map lives at `/evolution/org` as a new tab in the evolution sub-nav
- **D-09:** Hierarchy structure: task category (root nodes) → agent class tier → individual agents (leaves)
- **D-10:** Uses d3-hierarchy tree layout following the LineageTree.svelte pattern ($derived.by() for layout, declarative SVG rendering)
- **D-11:** Nodes show: agent name (or truncated botId), class badge, composite score, status indicator
- **D-12:** Color-coded by class: Artisan (amber), Understudy (violet), Novice (muted), Retired (faint) — matching FleetOverview conventions
- **D-13:** Click on agent node navigates to `/evolution/{botId}`
- **D-14:** Timeline verdict events become expandable — clicking a verdict event in BotTimeline reveals judge outputs
- **D-15:** Use Accordion.svelte (existing component) for each judge section
- **D-16:** Judge outputs rendered as structured content — extract key fields if possible, fall back to formatted JSON
- **D-17:** Runtime status displayed as a compact status bar below the identity card on the bot detail page
- **D-18:** Data sourced from Paperclip API: GET `/agents/:id/runtime-state` via existing API proxy
- **D-19:** Shows: current session status, token consumption (input/output/cached), total cost, last heartbeat timestamp, last error (if any)
- **D-20:** Auto-refreshes on 30s polling interval (client-side setInterval with cleanup)
- **D-21:** Graceful degradation — if Paperclip runtime-state returns null/404, show "No runtime data" placeholder

### Claude's Discretion

- How to score/quantify text-based soul dimensions for the radar chart visualization (D-06)
- Exact layout proportions and spacing for the identity card
- Whether to show class progression as a horizontal stepper or vertical timeline
- Format of judge outputs (structured extraction vs. formatted JSON) based on actual JSONB shape

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-01 | Agent profile page — identity card (name, class, archetype origin, task category, pioneer status, composite score), 7-axis soul dimension visualization, formatted SOUL.md viewer, constitution directives list, class progression timeline | Existing `bot_souls` JSONB `dimensions` field has all 7 axes as text strings; `agentClasses` table has class + pioneer; `bots` table has compositeScore and soulId. New backend endpoint `GET /akasa/evolution/bots/:botId/profile` needed. |
| AGENT-02 | Fleet org map — interactive d3-hierarchy tree showing agent relationships and hierarchy, nodes display name/class/status/score, color-coded by agent class, click-through to agent profile | `GET /akasa/evolution/agents` already returns all agents with class/score/category. A new `GET /akasa/evolution/org` endpoint structures this as category → class → agent hierarchy for d3. LineageTree.svelte is the direct implementation template. |
| AGENT-03 | Council verdict detail — expandable verdict entries in evolution timeline showing all 3 judge outputs from stored JSONB | `councilVerdicts` table has `performanceJudgeOutput`, `soulAnalystOutput`, `devilsAdvocateOutput` as JSONB. Timeline endpoint currently omits these. Extend `GET /bots/:botId/timeline` to include verdict JSONB on verdict-type events. VerdictConfirm.svelte is the reference pattern. |
| AGENT-04 | Agent runtime status — token consumption, total cost, budget utilization, last heartbeat, last error — from Paperclip runtime state API | Paperclip `GET /api/agents/:id/runtime-state` confirmed to exist. Returns `agentRuntimeState` row: `totalInputTokens`, `totalOutputTokens`, `totalCachedInputTokens`, `totalCostCents`, `lastError`, `lastRunStatus`. Needs an Akasa passthrough endpoint + client-side polling. |
</phase_requirements>

## Summary

Phase 13 surfaces data that already fully exists across two sources — the Akasa DB (soul dimensions, class history, verdicts) and the Paperclip runtime state table — into user-facing views. This is a pure UI/API-extension phase with no new database tables.

The implementation has four distinct workstreams. (1) **Agent Profile**: extend the bot detail page with an identity card header, a tabbed layout below it, and a Profile tab containing a radar chart (needs a text-to-score heuristic), SOUL.md markdown viewer, and directives list. A new backend endpoint aggregates the soul + class data into one response. (2) **Fleet Org Map**: a new `/evolution/org` page using the existing `d3-hierarchy` + SVG pattern from LineageTree.svelte, fed by a new endpoint that structures agent data as category → class → agent trees. (3) **Council Verdict Detail**: the timeline endpoint extension — add JSONB judge fields to verdict events, then make verdict rows expandable in BotTimeline using Accordion.svelte. (4) **Runtime Status**: an Akasa passthrough route that proxies the Paperclip `GET /api/agents/:id/runtime-state` endpoint (which accesses the shared DB's `agent_runtime_state` table), displayed as a compact status bar with 30-second client-side polling.

**Primary recommendation:** Build in dependency order — backend endpoints first (profile, org, timeline extension, runtime proxy), then UI components (IdentityCard, ProfileTab, OrgMap, inline verdict expansion, RuntimeStatus bar). Each workstream is independent and can be parallelised across plans.

## Standard Stack

All technologies already present in the project. No new dependencies required.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `d3-hierarchy` | ^3 (installed) | Fleet org map tree layout | Used in LineageTree.svelte; `$derived.by()` + declarative SVG is established pattern |
| SvelteKit v2 + Svelte 5 runes | ^2.52.0 / ^5.51.3 | All UI components | Project standard |
| Drizzle ORM | ^0.45.1 | Backend DB queries | Project standard |
| Express Router | (via paperclip) | Backend API extension | Project standard — Akasa routes mount on Express |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` | built-in | — | Not needed this phase |
| `marked` or raw markdown | — | SOUL.md rendering | Check if already present; if not, render dimension sections as structured HTML headers instead |

**No new npm installs required for this phase.**

Check for existing markdown library:
```bash
grep -r "marked\|@markdown\|markdown-it" services/ui/package.json
```

If none found, render SOUL.md by splitting on dimension headers (## identityRole, etc.) and wrapping in `<section>` elements — avoids adding a dependency for one use case.

## Architecture Patterns

### Recommended Project Structure (new files)

```
services/akasa-server/src/routes/
  evolution-dashboard.ts          — Extend: add /bots/:botId/profile, /org, /bots/:botId/timeline (extended)
  evolution-runtime-proxy.ts      — NEW: passthrough to Paperclip runtime-state

services/ui/src/routes/(app)/evolution/
  org/
    +page.svelte                  — NEW: Fleet Org Map page
    +page.server.ts               — NEW: loader for org data
  [botId]/
    +page.svelte                  — EXTEND: identity card + tabbed layout
    +page.server.ts               — EXTEND: add profile + runtime fetches

services/ui/src/lib/components/evolution/
  IdentityCard.svelte             — NEW: name, class badge, archetype, category, pioneer, score
  ProfileTab.svelte               — NEW: soul dimensions radar + SOUL.md + directives + class progression
  SoulRadar.svelte                — NEW: 7-axis SVG radar chart (text-to-score heuristic)
  OrgMap.svelte                   — NEW: d3-hierarchy fleet topology
  RuntimeStatus.svelte            — NEW: compact status bar, 30s polling
  BotTimeline.svelte              — EXTEND: expandable verdict rows with Accordion
```

### Pattern 1: Text-to-Score Heuristic for Soul Dimensions Radar (Claude's Discretion — D-06)

**What:** Soul dimensions are free text, not numbers. The radar chart requires numeric axis values (0–1 scale).

**Recommended approach:** Use normalized text length with a soft cap as the signal. This is the simplest defensible heuristic — longer, more detailed dimension text correlates with richer behavioral specification. Use `Math.min(text.length / 500, 1)` to map characters to [0, 1] with saturation at 500 chars.

**Rationale:** Alternatives considered:
- Sentiment scoring (requires NLP library — overkill)
- Fixed keyword counting (brittle, dimension-specific)
- Always show maximum (loses differentiation between rich and sparse dimensions)
- Text length normalization — simple, stable, no dependency, visually meaningful (sparse dimensions show as shorter spokes, rich dimensions as longer)

**Example:**
```typescript
// Source: Claude's discretion — verified against SoulDimension interface
const DIMENSION_KEYS: (keyof SoulDimension)[] = [
  'identityRole',
  'decisionPriorities',
  'toolUsageDoctrine',
  'riskTolerance',
  'communicationStyle',
  'recoveryBehavior',
  'ethicalHardStops',
];

function scoreText(text: string): number {
  return Math.min(text.length / 500, 1);
}

// scores is number[] of length 7, values in [0, 1]
const scores = DIMENSION_KEYS.map((k) => scoreText(dimensions[k]));
```

### Pattern 2: SVG Radar Chart (no d3-shape needed)

**What:** Pure SVG polygon radar chart using trigonometry directly — no extra d3 imports needed.

**When to use:** 7 axes, fixed layout, Svelte 5 `$derived` for reactivity.

**Example:**
```typescript
// Source: standard SVG radar math — HIGH confidence
const CENTER = 80;
const RADIUS = 60;
const AXES = 7;

const points = $derived(
  scores.map((score, i) => {
    const angle = (i / AXES) * 2 * Math.PI - Math.PI / 2;
    const r = score * RADIUS;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  })
);

const polygonPoints = $derived(
  points.map((p) => `${p.x},${p.y}`).join(' ')
);
```

Render as `<polygon points={polygonPoints} />` inside a `<svg width="160" height="160">`. No d3-shape import required.

### Pattern 3: Fleet Org Map with d3-hierarchy (D-09, D-10)

**What:** Hierarchical data structured as `{ id, label, children }` nodes fed into `d3-hierarchy` `tree()` layout. Pattern is established in LineageTree.svelte.

**Hierarchy data shape needed:**
```typescript
// Source: codebase review + d3-hierarchy docs
interface OrgNode {
  id: string;
  label: string;
  type: 'category' | 'class_tier' | 'agent';
  // agent-only fields
  botId?: string;
  currentClass?: string;
  compositeScore?: string | null;
  status?: string;
  children?: OrgNode[];
}
```

**Key difference from LineageTree:** The org map is a wide tree (multiple children per node), not a linear chain. Use `tree().size([width, height])` — same as LineageTree but with larger dimensions (e.g., 900×400). Use `hierarchy.links()` rendered as SVG `<path d="M...">` curves for better aesthetics with branching trees.

**Click navigation:** `goto('/evolution/{botId}')` using `$app/navigation` on agent leaf nodes.

### Pattern 4: Extending BotTimeline for Expandable Verdicts (D-14, D-15)

**What:** BotTimeline currently renders verdict events as flat rows. Extend to show an expandable Accordion below each verdict row with the 3 judge outputs.

**Current TimelineEvent interface** (from `BotTimeline.svelte`) must be extended:
```typescript
interface TimelineEvent {
  id: string;
  type: 'verdict' | 'class_transition' | 'dna_capture';
  timestamp: string;
  summary: string;
  verdictType?: string;
  status?: string;
  newClass?: string;
  previousClass?: string;
  compositeScore?: string;
  // NEW fields for AGENT-03
  performanceJudgeOutput?: Record<string, unknown> | null;
  soulAnalystOutput?: Record<string, unknown> | null;
  devilsAdvocateOutput?: Record<string, unknown> | null;
}
```

The backend timeline endpoint must be extended to include these JSONB fields. The SELECT for verdict events already queries `councilVerdicts` — just add the three judge columns.

### Pattern 5: Runtime Status Polling (D-20, D-21)

**What:** Client-side `setInterval` with cleanup in Svelte 5 `onMount`.

**Pattern:**
```typescript
// Source: Svelte 5 + established project pattern
import { onMount } from 'svelte';

let runtimeState = $state<RuntimeState | null>(null);

onMount(() => {
  async function poll() {
    try {
      const res = await fetch(`/api/akasa/evolution/bots/${botId}/runtime`);
      if (res.ok) runtimeState = await res.json();
      // 404 / null → leave runtimeState null (graceful degradation)
    } catch { /* silent */ }
  }

  poll(); // immediate first fetch
  const interval = setInterval(poll, 30_000);
  return () => clearInterval(interval); // cleanup
});
```

### Pattern 6: Runtime Proxy Endpoint

**What:** Akasa needs to proxy `GET /api/agents/:paperclipAgentId/runtime-state` from Paperclip, but the Akasa bot detail page only knows the Akasa `botId`. The proxy must look up `bots.paperclipAgentId` first, then call the Paperclip endpoint.

**Note on auth:** The Paperclip `assertBoard(req)` check in the agents route requires a board session. Since Akasa's akasa-server and Paperclip share the same Express process (Approach B from Phase 1), the proxy can query the Drizzle DB directly without going through HTTP — it can simply SELECT from `agent_runtime_state` using the `paperclipAgentId` as the `agentId`.

**Preferred implementation:** Direct DB query in the new Akasa route (avoids internal HTTP hop):
```typescript
// In evolution-dashboard.ts or a new evolution-runtime-proxy.ts
// Source: codebase review — shared DB pattern confirmed in Phase 1 decisions
router.get('/bots/:botId/runtime', async (req, res, next) => {
  try {
    const { botId } = req.params;
    const botRow = await db
      .select({ paperclipAgentId: bots.paperclipAgentId })
      .from(bots)
      .where(eq(bots.id, botId))
      .limit(1);

    const paperclipAgentId = botRow[0]?.paperclipAgentId;
    if (!paperclipAgentId) {
      res.json(null);
      return;
    }

    // Import agentRuntimeState from paperclipDb — or use shared DB
    // Since Phase 1 established shared DB: use @paperclipai/db tables directly
    const { createDb } = await import('@paperclipai/db');
    // ... query agentRuntimeState table
  }
});
```

**Important:** The shared DB approach means the `agentRuntimeState` table from Paperclip's schema is accessible. However, the simpler pattern already established in Phase 5 (souls.ts `injectSoulIntoAgent`) uses `createDb(DATABASE_URL)` lazily. Use the same pattern.

### Anti-Patterns to Avoid

- **Full `d3` bundle for org map:** `d3-hierarchy` is already installed and sufficient. Never import from `d3` (full bundle).
- **`$effect()` for d3 layout:** Use `$derived.by()` as established in Phase 8-03. Effect-based layout causes stale renders on prop changes.
- **Cross-world tokens:** All evolution views use Back Office world (`--bo-*` tokens). The Accordion component uses `--card` and `--border` (Front Office defaults). When reusing Accordion in evolution context, ensure it visually fits — check if Back Office CSS overrides `--card` to `--bo-card`. If not, use inline style overrides.
- **Buffering runtime response:** The proxy should return null/404 gracefully — wrap in try/catch and always send a response.
- **Using `goto()` inside `$derived`:** The `goto()` call for org map node navigation must be in an event handler (onclick), not in derived state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree layout geometry | Custom tree positioning algorithm | `d3-hierarchy` tree() + hierarchy() | Already in project; handles variable-width subtrees, edge crossing prevention |
| SVG path curves for links | Manual bezier math | `d3-hierarchy` link generators | layout.links() gives source/target; can use standard SVG cubic bezier formula |
| Markdown parsing | Custom regex splitter | Render SOUL.md sections by splitting on `##` headers — no library needed | SOUL.md has predictable structure; full markdown parser is overkill for one field |

**Key insight:** This phase assembles existing capabilities — the hard work (d3 layout, Accordion, token system) is already done.

## Common Pitfalls

### Pitfall 1: Accordion.svelte Token Mismatch
**What goes wrong:** Accordion.svelte uses `--card` and `--border` (Front Office semantic aliases), not `--bo-card` and `--bo-border`. In Back Office world these may not resolve correctly.
**Why it happens:** Accordion was built as a generic component but most Back Office components use `--bo-*` tokens directly.
**How to avoid:** Check if `body.back-office` overrides `--card` to `--bo-card` in `app.css`. If yes, Accordion works fine. If not, pass `style="background: var(--bo-card)"` override or wrap in a container. Inspect `app.css` during implementation.
**Warning signs:** Accordion background is white/cream in the evolution (dark) context.

### Pitfall 2: Timeline Endpoint Returns Too Much Data
**What goes wrong:** Adding all 3 JSONB judge output fields to every timeline event bloats responses significantly (each JSONB can be several KB). The timeline is rendered for every page load of the bot detail.
**Why it happens:** Including JSONB in SELECT returns full content even when accordion is collapsed.
**How to avoid:** Option A — include the JSONB fields in the timeline response but only for verdict events (already the case since verdicts query joins councilVerdicts). Option B — add a separate `GET /bots/:botId/verdicts/:verdictId/detail` endpoint fetched on-demand when user expands. Given the current simple scale (few verdicts per bot), Option A is acceptable. Document this as a future optimization.
**Warning signs:** Timeline response > 50KB per bot.

### Pitfall 3: Paperclip Runtime State agentId vs botId
**What goes wrong:** `agent_runtime_state.agentId` is the Paperclip agent UUID, not the Akasa `bots.id`. Querying by Akasa botId will return nothing.
**Why it happens:** The two systems have separate ID spaces. `bots.paperclipAgentId` is the bridge.
**How to avoid:** Always resolve `bots.paperclipAgentId` from Akasa `botId` before querying `agentRuntimeState`. If `paperclipAgentId` is null (bot never dispatched to Paperclip), return null gracefully.
**Warning signs:** Runtime status always shows "No runtime data" even for active bots.

### Pitfall 4: Org Map Tab Navigation — FLEET Match Conflict
**What goes wrong:** Adding `/evolution/org` tab alongside FLEET/AGENTS/BENCHMARKS could break the existing tab active state logic if the exact/startsWith matching isn't updated.
**Why it happens:** FLEET uses exact match (`pathname === '/evolution'`), others use startsWith. The new ORG tab at `/evolution/org` would be caught by AGENTS' startsWith(`/evolution/agents`) — wait, no. But it won't match any existing tab, so it will be unactive. Need to add the ORG tab entry to `evolutionTabs` in `+layout.svelte`.
**How to avoid:** Add `{ href: '/evolution/org', label: 'ORG' }` to evolutionTabs. It uses startsWith like other non-FLEET tabs.
**Warning signs:** Active tab indicator doesn't appear when on `/evolution/org`.

### Pitfall 5: `+page.server.ts` Extending vs Replacing
**What goes wrong:** The existing `+page.server.ts` for `[botId]` returns `{ botId, timeline, lineage, ledger }`. Adding new fetches must use `Promise.allSettled` to avoid blocking page load if new endpoints fail.
**Why it happens:** If profile or runtime fetch fails and throws, the whole page load fails.
**How to avoid:** Use the established `Promise.allSettled` pattern for all new fetches. Destructure each result with the fallback-to-null pattern.

### Pitfall 6: d3-hierarchy Org Map with Disconnected Groups
**What goes wrong:** The hierarchy requires a single root. But org map has multiple task categories as "roots". d3-hierarchy needs one root node.
**Why it happens:** `hierarchy()` accepts a single root — multiple categories can't all be roots.
**How to avoid:** Add a virtual "fleet" root node as the top-level parent of all category nodes. Keep it invisible in the SVG (don't render its dot/label). This is standard practice for multi-root hierarchies with d3.
**Warning signs:** `hierarchy()` throws or only renders one category branch.

## Code Examples

Verified patterns from existing codebase:

### Existing d3-hierarchy Usage Pattern (from LineageTree.svelte)
```typescript
// Source: services/ui/src/lib/components/evolution/LineageTree.svelte
import { hierarchy, tree } from 'd3-hierarchy';

const layout = $derived.by(() => {
  const h = hierarchy(treeRoot);
  const t = tree<OrgNode>().size([WIDTH - 40, HEIGHT - 60]);
  t(h);
  return h;
});

const descendants = $derived(layout.descendants());
const links = $derived(layout.links());
```

### Existing Timeline Event Shape (from evolution-dashboard.ts)
```typescript
// Source: services/akasa-server/src/routes/evolution-dashboard.ts
// Verdict event shape — extend with judge JSONB fields:
{
  id: r.id,
  type: 'verdict' as const,
  timestamp: r.createdAt,
  summary: r.verdictSummary,
  verdictType: r.verdictType,
  status: r.status,
  compositeScore: r.weightedConfidenceScore,
  // ADD FOR AGENT-03:
  performanceJudgeOutput: r.performanceJudgeOutput,
  soulAnalystOutput: r.soulAnalystOutput,
  devilsAdvocateOutput: r.devilsAdvocateOutput,
}
```

### Existing Class Colors (from FleetOverview.svelte — use these, don't invent new ones)
```typescript
// Source: services/ui/src/lib/components/evolution/FleetOverview.svelte
const CLASS_COLORS: Record<string, string> = {
  Artisan: 'var(--bo-amber)',
  Understudy: 'var(--bo-vb)',
  Novice: 'var(--bo-muted)',
  Retired: 'var(--bo-faint)',
};
```

### Existing Accordion Component API (from Accordion.svelte)
```typescript
// Source: services/ui/src/lib/components/Accordion.svelte
// Props: label (string), sublabel? (string), meta? (string), color (string), open? (boolean), children (Snippet)
<Accordion
  label="PERFORMANCE JUDGE"
  color="var(--bo-violet)"
>
  {/* content */}
</Accordion>
```

### agentRuntimeState Schema (from Paperclip DB)
```typescript
// Source: paperclip/packages/db/src/schema/agent_runtime_state.ts
// Key fields returned by GET /agents/:id/runtime-state:
{
  agentId: uuid,
  companyId: uuid,
  adapterType: text,
  sessionId: text | null,       // current session
  lastRunStatus: text | null,   // last run outcome
  totalInputTokens: bigint,     // cumulative input tokens
  totalOutputTokens: bigint,    // cumulative output tokens
  totalCachedInputTokens: bigint, // cumulative cached tokens
  totalCostCents: bigint,       // total cost in cents
  lastError: text | null,       // last error message
  updatedAt: timestamp,         // serves as "last heartbeat"
}
```

### Bot Detail Page Loader Pattern (extend this)
```typescript
// Source: services/ui/src/routes/(app)/evolution/[botId]/+page.server.ts
const [timelineRes, lineageRes, ledgerRes] = await Promise.allSettled([
  fetch(`/api/akasa/evolution/bots/${botId}/timeline`),
  fetch(`/api/akasa/evolution/bots/${botId}/lineage`),
  fetch(`/api/akasa/evolution/bots/${botId}/ledger`),
]);
// Pattern: add profile fetch to this allSettled array
```

## Runtime State Inventory

This is not a rename/refactor phase — section omitted.

## Environment Availability

Step 2.6: SKIPPED — this phase is UI + API code changes only; no new external tool dependencies. All required capabilities (d3-hierarchy, SvelteKit, Drizzle, Express) are confirmed present in the existing project.

## Validation Architecture

No Vitest or Jest infrastructure exists in `services/ui`. No test scripts in `services/ui/package.json`. The UI is currently tested manually.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed in services/ui |
| Config file | None |
| Quick run command | N/A — no test runner |
| Full suite command | Manual browser verification |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Backend returns profile with soul dimensions + class + pioneer | manual-only | N/A | N/A |
| AGENT-02 | Org map renders correct hierarchy and node colors | manual-only | N/A | N/A |
| AGENT-03 | Verdict rows expand to show all 3 judge outputs | manual-only | N/A | N/A |
| AGENT-04 | Runtime status polls Paperclip state and displays tokens/cost | manual-only | N/A | N/A |

### Wave 0 Gaps
None required — no test infrastructure to establish. All phase validation is manual (load pages, verify rendered data matches DB).

Manual verification checklist the planner should include as acceptance criteria:
- Agent detail page loads with identity card above tab bar
- Profile tab shows all 7 dimension spokes in radar chart
- Soul.md viewer renders with formatted sections
- Constitution directives appear as a list
- Timeline verdict rows expand to show judge accordion sections with non-empty content
- Evolution sub-nav shows ORG tab and navigates to org map
- Org map shows at least one category node with child agent leaves
- Runtime status bar appears below identity card; shows "No runtime data" gracefully if agent has no Paperclip runtime state

## Backend API Contract

New endpoints to add to `evolution-dashboard.ts`:

### GET /akasa/evolution/bots/:botId/profile
Returns combined soul + class data for agent profile:
```json
{
  "botId": "uuid",
  "currentClass": "Novice | Understudy | Artisan | Retired",
  "isPioneer": false,
  "taskCategory": "string",
  "compositeScore": "0.82",
  "archetypeName": "string | null",
  "soulId": "uuid | null",
  "soulContent": "full SOUL.md text",
  "dimensions": { "identityRole": "...", ... },
  "constitutionDirectives": ["...", "..."],
  "generation": 3,
  "classHistory": [
    { "class": "Novice", "transitionAt": "iso", "category": "..." }
  ]
}
```

DB joins needed: `bots` LEFT JOIN `agentClasses` (by botId) LEFT JOIN `botSouls` (by bots.soulId).

### GET /akasa/evolution/org
Returns hierarchical data for org map:
```json
[
  {
    "id": "category:research",
    "label": "research",
    "type": "category",
    "children": [
      {
        "id": "class:research:Artisan",
        "label": "Artisan",
        "type": "class_tier",
        "children": [
          {
            "id": "agent:uuid",
            "label": "a1b2c3d4",
            "type": "agent",
            "botId": "uuid",
            "currentClass": "Artisan",
            "compositeScore": "0.91",
            "status": "idle"
          }
        ]
      }
    ]
  }
]
```

DB query: SELECT from `agentClasses` LEFT JOIN `bots` (for status + compositeScore). Group in application code.

### GET /akasa/evolution/bots/:botId/runtime
Proxies Paperclip runtime state. Uses shared DB — query `agentRuntimeState` directly after resolving `bots.paperclipAgentId`:
```json
{
  "sessionId": "string | null",
  "lastRunStatus": "string | null",
  "totalInputTokens": 12400,
  "totalOutputTokens": 3200,
  "totalCachedInputTokens": 800,
  "totalCostCents": 142,
  "lastError": "string | null",
  "updatedAt": "iso timestamp"
}
```
Returns `null` (with 200 status) when bot has no `paperclipAgentId` or no runtime state row.

### Extend existing GET /bots/:botId/timeline
Add `performanceJudgeOutput`, `soulAnalystOutput`, `devilsAdvocateOutput` to the verdict SELECT. These fields are already in the `councilVerdicts` table query — just expand the column list.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `services/akasa-server/src/routes/evolution-dashboard.ts` — timeline endpoint shape, existing query patterns
- Codebase direct inspection: `services/ui/src/lib/components/evolution/LineageTree.svelte` — d3-hierarchy `$derived.by()` pattern, node rendering
- Codebase direct inspection: `services/ui/src/lib/components/evolution/BotTimeline.svelte` — TimelineEvent interface, rendering
- Codebase direct inspection: `services/ui/src/lib/components/Accordion.svelte` — component API (label/color/sublabel/meta/children)
- Codebase direct inspection: `services/ui/src/lib/components/evolution/VerdictConfirm.svelte` — judge output accordion pattern (reference for D-16)
- Codebase direct inspection: `packages/db/src/schema/bot-souls.ts` — dimensions JSONB, constitutionDirectives JSONB, soulContent
- Codebase direct inspection: `packages/db/src/schema/council-verdicts.ts` — judge output JSONB columns confirmed present
- Codebase direct inspection: `packages/db/src/schema/agent-classes.ts` — class progression columns
- Codebase direct inspection: `packages/db/src/schema/bots.ts` — paperclipAgentId field confirmed
- Codebase direct inspection: `packages/shared-types/src/soul.ts` — SoulDimension interface, all 7 field names
- Codebase direct inspection: `paperclip/packages/db/src/schema/agent_runtime_state.ts` — runtime state schema confirmed
- Codebase direct inspection: `paperclip/server/src/routes/agents.ts` lines 703-715 — GET /agents/:id/runtime-state endpoint confirmed exists
- Codebase direct inspection: `services/ui/src/routes/api/[...path]/+server.ts` — catch-all proxy pattern confirmed (all /api/* proxied to backend)
- `.planning/STATE.md` Phase 8-03 decision — `$derived.by()` not `$effect()` for d3 layout

### Secondary (MEDIUM confidence)
- d3-hierarchy official docs (https://d3js.org/d3-hierarchy/tree) — tree() layout API for multi-root handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technologies present in codebase, verified by direct inspection
- Architecture: HIGH — patterns traced directly from existing working code
- Pitfalls: HIGH — verified from Phase 8-03 decisions (d3 layout), Phase 3 decisions (Accordion token scope), direct DB schema inspection
- Paperclip runtime endpoint: HIGH — confirmed by grepping paperclip source

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable stack — no fast-moving dependencies)
