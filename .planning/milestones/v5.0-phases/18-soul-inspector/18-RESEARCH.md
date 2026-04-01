# Phase 18: Soul Inspector - Research

**Researched:** 2026-02-22
**Domain:** SvelteKit 2 / Svelte 5 frontend components, Fastify API extension, Drizzle ORM joins across bot_souls + council_verdicts + agent_classes
**Confidence:** HIGH — all conclusions derived from direct inspection of the installed codebase; no CONTEXT.md exists (no pre-locked decisions)

---

## Summary

Phase 18 builds two UI features: a Soul Inspector panel (drawer/modal) that shows the full SOUL.md content, lineage metadata, and council verdict for any bot, and a soul tier badge component integrated into every bot card context across the app.

The critical insight is that all necessary data already lives in the database — `bot_souls`, `council_verdicts`, and `agent_classes` — but **no existing API endpoint exposes soul data to the UI**. The `GET /bots/:botId/detail` endpoint does not return `soulId`, `soulContent`, `generation`, `parentSoulId`, `dimensions`, or `constitutionDirectives`. This means Phase 18 must build a new backend endpoint `GET /bots/:botId/soul` before the UI panel can be built.

The soul tier badge (Novice / Understudy / Artisan) maps directly to `agentClass` in the `LeaderboardEntry` type, which is already returned by `GET /executions/:id/leaderboard`. However, the monitoring view (`ExecutionBot` type from `GET /bots/by-execution/:executionId`) does NOT currently return agentClass — it returns only `status`, `tasksClaimed`, `tasksCompleted`, `tasksFailed`, `startedAt`, `errorMessage`. To display tier badges on bot cards in the live monitoring view, the monitoring endpoint must also be extended.

The leaderboard (`/report` page) already carries `agentClass` data and the bot detail page (`/executions/:id/bots/:botId`) already renders a `tier` badge (performance tier, not soul class). The soul tier badge component is distinct from the existing `tier` badge — it shows Novice/Understudy/Artisan (from `agent_classes.currentClass`) rather than High/Medium/Low (from `bots.tier`).

**Primary recommendation:** Build in four steps: (1) new `GET /bots/:botId/soul` API endpoint, (2) extend `GET /bots/by-execution/:executionId` to include `agentClass`, (3) build `SoulInspectorPanel` Svelte component, (4) build `SoulTierBadge` Svelte component and integrate into all 3 bot card contexts.

---

## Existing State Audit

### What Already Exists (Phase 1-17 output)

| Data | Table | Populated By | Accessible Via |
|------|-------|--------------|----------------|
| SOUL.md content (all 7 dimensions) | `bot_souls.soulContent` | Phase 9 soul-generator | No UI endpoint yet |
| Lineage: generation counter | `bot_souls.generation` | Phase 9 soul-generator | No UI endpoint yet |
| Lineage: parent soul reference | `bot_souls.parentSoulId` | Phase 9 soul-generator | No UI endpoint yet |
| Lineage: mutation operation | NOT STORED — not in schema | — | Does not exist in DB |
| Constitution directives | `bot_souls.constitutionDirectives` | Phase 9 soul-generator | No UI endpoint yet |
| 7 behavioral dimensions (parsed) | `bot_souls.dimensions` (JSONB) | Phase 9 soul-generator | No UI endpoint yet |
| Soul link to bot | `bots.soulId` (nullable UUID, no FK) | Phase 9 spawnBotsForExecution | No UI endpoint exposes it |
| Verdict type + confidence | `council_verdicts.verdictType`, `.weightedConfidenceScore` | Phase 11 council | Exposed via `GET /verdicts/:verdictId` only |
| Per-judge summaries | `council_verdicts.soulAnalystOutput`, `.performanceJudgeOutput`, `.devilsAdvocateOutput` | Phase 11 council | Exposed via `GET /verdicts/:verdictId` only |
| Council verdict link to soul | `council_verdicts.soulId` | Phase 11 | No cross-entity lookup endpoint |
| Agent class (Novice/Understudy/Artisan) | `agent_classes.currentClass` | Phase 13 god-layer | `GET /executions/:id/leaderboard` returns it as `agentClass` |
| Agent class on live monitoring | NOT RETURNED — `GET /bots/by-execution/:executionId` omits it | — | Missing from monitoring view |

### What the Phase Requires That Does NOT Exist

| Required | Where to Build | Why Missing |
|----------|---------------|-------------|
| `GET /bots/:botId/soul` | `bots.ts` | No endpoint exposes soul data at all |
| `agentClass` in `GET /bots/by-execution/:executionId` | `bots.ts` | Monitoring endpoint was built before God Layer; never updated |
| `SoulInspectorPanel.svelte` component | `services/ui/src/lib/components/` | New component |
| `SoulTierBadge.svelte` component | `services/ui/src/lib/components/` | New component |
| `getBotSoul()` API client function | `services/ui/src/lib/api.ts` | New function |
| `BotSoul` type on UI side | `services/ui/src/lib/types.ts` | New type |

### The "Mutation Operations Applied" Lineage Field

The phase description says "mutation operations applied" should be shown in lineage. **This field does NOT exist in the database schema.** `bot_souls` stores: `id`, `isArchetype`, `botId`, `executionId`, `taskCategory`, `soulContent`, `contentHash`, `generation`, `parentSoulId`, `dimensions`, `constitutionDirectives`, `embedding`, `humanReviewFlag`, `createdAt`. There is no `mutationOperation` column.

The soul-generator in `soul-generator.ts` picks an operation (substitution/amplification/attenuation/recombination/introduction) per soul at generation time but does NOT persist which operation was used. The planner must either:
1. Omit "mutation operations" from the inspector (show only generation counter + parent reference), OR
2. Derive it (impossible — not recorded), OR
3. Infer it heuristically from the soul content diff (not feasible)

**Recommendation:** The lineage section shows `generation` (integer), `parentSoulId` (or "Seed Soul" if null/archetype), `taskCategory`, and `isArchetype` flag. Omit "mutation operations applied" — it cannot be shown because it was never persisted. The planner should note this as an explicit scope reduction.

### Existing Bot Card Contexts (All Three)

| Context | File | Current Bot Card | Has agentClass? |
|---------|------|-----------------|-----------------|
| Live monitoring view | `executions/[id]/+page.svelte` | Bot cards in `.bots-list` grid | No — `ExecutionBot` type has no `agentClass` |
| Post-run leaderboard (dashboard) | `executions/[id]/report/+page.svelte` | Table rows in `LeaderboardEntry` | Yes — `entry.agentClass` is already in the data |
| Bot detail page | `executions/[id]/bots/[botId]/+page.svelte` | Status row with `.bot-status-row` | No `agentClass` — only `detail.bot.tier` (performance tier) |

Note: The phase description mentions "leaderboard" as one of the three bot card contexts. The leaderboard is in the report page (`/executions/:id/report`). This already has `agentClass` from the leaderboard API but does NOT currently display a tier badge in the table — it shows `agentClass` as text. The badge component will replace the text display.

---

## Standard Stack

### Core (all already installed — zero new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.51.3 | Reactive UI with runes; drawer/panel via conditional render | Already installed; all pages use runes API |
| @sveltejs/kit | 2.52.0 | File-based routing; component imports | Already installed |
| @sinclair/typebox | ^0.34.48 | TypeBox schemas for new API endpoint | Already installed in execution-service |
| drizzle-orm | 0.45.1 | JOIN across bot_souls, council_verdicts, agent_classes | Already installed in @claw/db |

### No New Installs Required

Zero new npm packages. The app uses no component library (Shadcn, Radix, etc.) — all UI is handrolled CSS. The soul inspector panel will follow this pattern: a CSS-only slide-in drawer using `position: fixed` and a backdrop overlay.

---

## Architecture Patterns

### Recommended File Structure

```
services/execution-service/src/routes/
└── bots.ts                        # MODIFY: add GET /:botId/soul endpoint + extend by-execution to include agentClass

services/ui/src/lib/
├── api.ts                         # MODIFY: add getBotSoul() function
├── types.ts                       # MODIFY: add BotSoul type, extend ExecutionBot with agentClass
└── components/
    ├── SoulInspectorPanel.svelte   # NEW: drawer/panel component
    └── SoulTierBadge.svelte        # NEW: badge component (Novice/Understudy/Artisan)

services/ui/src/routes/
├── executions/[id]/+page.svelte    # MODIFY: add SoulTierBadge to bot cards, wire inspector open
├── executions/[id]/report/+page.svelte  # MODIFY: add SoulTierBadge to leaderboard rows, wire inspector open
└── executions/[id]/bots/[botId]/+page.svelte  # MODIFY: add SoulTierBadge in bot-status-row + inspector
```

Note: The project currently has no `src/lib/components/` directory. Creating it is appropriate — the `SoulInspectorPanel` and `SoulTierBadge` components will be the first shared components in the project.

### Pattern 1: New `GET /bots/:botId/soul` Endpoint

**What:** Returns soul content, lineage metadata, and council verdict for a bot.

**Join chain:**
1. Look up `bots` WHERE `id = botId` → get `soulId`
2. JOIN `bot_souls` WHERE `id = bots.soulId` → get full soul data
3. JOIN `council_verdicts` WHERE `botId = :botId` (most recent, ordered by `createdAt DESC LIMIT 1`) → get verdict

**Note on verdict linkage:** `council_verdicts.botId` is the correct join key (not `soulId`). The verdict is per-bot, not per-soul. A soul may be shared across council runs but verdicts are issued to specific bots.

**Note on agentClass in soul endpoint:** The soul endpoint should also return the current agent class from `agent_classes` WHERE `botId = :botId`. This simplifies the inspector panel — it gets all data from one call.

**Example:**
```typescript
// Source: services/execution-service/src/routes/bots.ts (add new handler)
fastify.get('/:botId/soul', {
  schema: {
    params: Type.Object({ botId: Type.String({ format: 'uuid' }) }),
    response: {
      200: Type.Object({
        soulId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
        soulContent: Type.Union([Type.String(), Type.Null()]),
        generation: Type.Union([Type.Integer(), Type.Null()]),
        parentSoulId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
        isArchetype: Type.Union([Type.Boolean(), Type.Null()]),
        taskCategory: Type.Union([Type.String(), Type.Null()]),
        constitutionDirectives: Type.Union([Type.Array(Type.String()), Type.Null()]),
        dimensions: Type.Union([Type.Unknown(), Type.Null()]), // 7-dimension JSONB
        agentClass: Type.Union([
          Type.Literal('Novice'), Type.Literal('Understudy'),
          Type.Literal('Artisan'), Type.Literal('Retired'), Type.Null()
        ]),
        verdict: Type.Union([
          Type.Object({
            verdictType: Type.String(),
            weightedConfidenceScore: Type.Number(),
            verdictSummary: Type.String(),
            soulAnalystOutput: Type.Unknown(),
            performanceJudgeOutput: Type.Unknown(),
          }),
          Type.Null()
        ]),
      }),
      404: Type.Object({ error: Type.String() }),
    },
  },
}, async (request, reply) => {
  const { botId } = request.params;

  // 1. Get bot record to find soulId
  const [bot] = await db.select({ soulId: bots.soulId }).from(bots).where(eq(bots.id, botId));
  if (!bot) return reply.code(404).send({ error: 'Bot not found' });

  // 2. Get soul data if soulId exists
  let soul = null;
  if (bot.soulId) {
    const [soulRow] = await db.select().from(botSouls).where(eq(botSouls.id, bot.soulId));
    soul = soulRow ?? null;
  }

  // 3. Get most recent council verdict for this bot
  const [verdictRow] = await db
    .select({
      verdictType: councilVerdicts.verdictType,
      weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
      verdictSummary: councilVerdicts.verdictSummary,
      soulAnalystOutput: councilVerdicts.soulAnalystOutput,
      performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
    })
    .from(councilVerdicts)
    .where(eq(councilVerdicts.botId, botId))
    .orderBy(desc(councilVerdicts.createdAt))
    .limit(1);

  // 4. Get agent class (highest ranked across categories)
  const agentClassRows = await db
    .select({ currentClass: agentClasses.currentClass })
    .from(agentClasses)
    .where(eq(agentClasses.botId, botId));
  const CLASS_RANK = { Artisan: 3, Understudy: 2, Novice: 1, Retired: 0 };
  let bestClass = null;
  for (const row of agentClassRows) {
    if (!bestClass || (CLASS_RANK[row.currentClass] ?? -1) > (CLASS_RANK[bestClass] ?? -1)) {
      bestClass = row.currentClass;
    }
  }

  return reply.code(200).send({
    soulId: bot.soulId,
    soulContent: soul?.soulContent ?? null,
    generation: soul?.generation ?? null,
    parentSoulId: soul?.parentSoulId ?? null,
    isArchetype: soul?.isArchetype ?? null,
    taskCategory: soul?.taskCategory ?? null,
    constitutionDirectives: soul?.constitutionDirectives ?? null,
    dimensions: soul?.dimensions ?? null,
    agentClass: bestClass,
    verdict: verdictRow
      ? {
          verdictType: verdictRow.verdictType,
          weightedConfidenceScore: Number(verdictRow.weightedConfidenceScore),
          verdictSummary: verdictRow.verdictSummary,
          soulAnalystOutput: verdictRow.soulAnalystOutput,
          performanceJudgeOutput: verdictRow.performanceJudgeOutput,
        }
      : null,
  });
});
```

### Pattern 2: Extend `GET /bots/by-execution/:executionId` with agentClass

**What:** The monitoring endpoint returns `ExecutionBot[]` but omits `agentClass`. To display tier badges on live bot cards, add a batch `agentClasses` lookup after fetching bots.

**Implementation approach:** Mirror the pattern from `GET /executions/:id/leaderboard` — batch query `agentClasses` WHERE `botId IN (botIds)`, build a map, merge into result. The leaderboard already has this exact pattern (lines 419-443 in executions.ts).

**Response shape change:** Add `agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null` to each returned bot object.

### Pattern 3: SoulInspectorPanel Component

**What:** A slide-in drawer (right-side panel) that shows when `selectedBotId` is non-null. On open, fetches `GET /bots/:botId/soul` and renders the soul data.

**Drawer pattern (CSS-only, no library needed):**
```svelte
<!-- services/ui/src/lib/components/SoulInspectorPanel.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { getBotSoul } from '$lib/api';
  import type { BotSoul } from '$lib/types';

  let { botId, onClose }: { botId: string | null; onClose: () => void } = $props();

  let soul = $state<BotSoul | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!browser || !botId) { soul = null; return; }
    loading = true;
    error = null;
    getBotSoul(botId)
      .then(s => { soul = s; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });
</script>

{#if botId}
  <!-- Backdrop -->
  <div class="inspector-backdrop" onclick={onClose} role="presentation"></div>
  <!-- Panel -->
  <aside class="inspector-panel">
    <!-- header, content, soul sections -->
  </aside>
{/if}

<style>
  .inspector-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
  .inspector-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: min(480px, 100vw);
    background: var(--surface-1);
    border-left: 1px solid var(--border);
    z-index: 201;
    overflow-y: auto;
    padding: var(--s-6);
    animation: slideIn 0.2s ease-out;
  }
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
</style>
```

**SOUL.md content rendering:** `soulContent` is a markdown string. The app does not use a markdown renderer (no `marked`, `remark`, etc.). Render it as `<pre>` or use `white-space: pre-wrap` in a `<div>`. The 7 `dimensions` JSONB object provides pre-parsed sections — use these to render structured sections rather than raw markdown parsing.

### Pattern 4: SoulTierBadge Component

**What:** A tiny reusable badge showing Novice / Understudy / Artisan (or null → nothing rendered).

**Color scheme from existing leaderboard CSS (report/+page.svelte):**
```css
.class-novice    { color: #3b82f6; background: #eff6ff; border: 1px solid #bfdbfe; }
.class-understudy { color: #8b5cf6; background: #f5f3ff; border: 1px solid #ddd6fe; }
.class-artisan   { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
.class-retired   { color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; }
```

Note: The dark-mode pages (verdicts, layout) use CSS variables. The light-mode pages (executions, report, objectives) use hardcoded colors. Follow the same pattern as the page you're integrating into.

**Example:**
```svelte
<!-- services/ui/src/lib/components/SoulTierBadge.svelte -->
<script lang="ts">
  let { agentClass }: { agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null } = $props();
</script>

{#if agentClass}
  <span class="tier-badge tier-{agentClass.toLowerCase()}">{agentClass}</span>
{/if}

<style>
  .tier-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }
  .tier-novice    { color: #3b82f6; background: #eff6ff; border: 1px solid #bfdbfe; }
  .tier-understudy { color: #8b5cf6; background: #f5f3ff; border: 1px solid #ddd6fe; }
  .tier-artisan   { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
  .tier-retired   { color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; }
</style>
```

### Pattern 5: Inspector Wiring into Bot Cards

**What:** Each bot card needs a click handler that sets `selectedBotId` and opens the panel. The panel is rendered once at the page level (not inside each card).

**Example (monitoring view):**
```svelte
<!-- executions/[id]/+page.svelte — add to script -->
let selectedBotId = $state<string | null>(null);

<!-- In bot card: -->
<div
  class="bot-card ..."
  role="button"
  tabindex="0"
  onclick={() => selectedBotId = bot.id}
  onkeydown={(e) => e.key === 'Enter' && (selectedBotId = bot.id)}
>
  <!-- existing content -->
  <SoulTierBadge agentClass={bot.agentClass} />
</div>

<!-- After the bots-section, at page level: -->
<SoulInspectorPanel botId={selectedBotId} onClose={() => selectedBotId = null} />
```

**The monitoring bot card is currently an `<a>` tag** (links to `/executions/:id/bots/:botId`). It cannot be both a link AND trigger the inspector panel. Two options:
1. Change it to a `<div>` with role="button" and add the bot detail link inside the card (e.g., a "View Log" link).
2. Add an inspector button inside the card instead of making the whole card clickable.

**Recommendation:** Option 2 — keep the card as an `<a>` tag (preserving navigation to bot detail) and add a small "Inspect Soul" button inside the card. This avoids breaking existing navigation.

### Pattern 6: New Types for `types.ts`

```typescript
// Add to services/ui/src/lib/types.ts

export interface BotSoul {
  soulId: string | null;
  soulContent: string | null;
  generation: number | null;
  parentSoulId: string | null;
  isArchetype: boolean | null;
  taskCategory: string | null;
  constitutionDirectives: string[] | null;
  dimensions: {
    identityRole: string;
    decisionPriorities: string;
    toolUsageDoctrine: string;
    riskTolerance: string;
    communicationStyle: string;
    recoveryBehavior: string;
    ethicalHardStops: string;
  } | null;
  agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
  verdict: {
    verdictType: string;
    weightedConfidenceScore: number;
    verdictSummary: string;
    soulAnalystOutput: unknown;
    performanceJudgeOutput: unknown;
  } | null;
}

// Extend ExecutionBot to include agentClass:
export interface ExecutionBot {
  id: string;
  status: 'spawning' | 'idle' | 'working' | 'stopping' | 'stopped' | 'failed';
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  startedAt: string | null;
  errorMessage: string | null;
  agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null; // NEW
}
```

### Anti-Patterns to Avoid

- **Fetching soul on page load for every bot:** The soul inspector loads lazily on click. Never fetch soul data for all bots at once — it would be N+1 API calls on load.
- **Rendering markdown with innerHTML:** Do not use `{@html soulContent}` for XSS safety. Render the `dimensions` JSONB object as structured sections instead. If raw soulContent must be shown, use `<pre>` with `white-space: pre-wrap`.
- **Using CSS variables for light-mode pages:** The monitoring (`executions/[id]/+page.svelte`) and report pages use hardcoded colors (no CSS variables). Keep the SoulTierBadge and inspector using the same pattern as the host page.
- **Putting the SoulInspectorPanel inside each bot card loop:** Mount it once at the page level. Multiple instances in an `#each` loop waste resources and cause z-index conflicts.
- **Separate `getBotSoul` call per bot card on mount:** Only fetch on inspector open. The `$effect` in `SoulInspectorPanel` gates on `botId` being non-null.
- **Confusing `bots.tier` with `agentClass`:** `bots.tier` is the performance tier ("High"/"Medium"/"Low"), a scoring band. `agentClass` is the evolutionary class ("Novice"/"Understudy"/"Artisan"), the soul progression. They are different concepts. The phase requires displaying `agentClass` as the soul tier badge, not `bots.tier`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-in drawer / modal | Third-party modal library | CSS `position: fixed` + backdrop div | App uses no component library; all UI is handrolled CSS per existing pattern |
| Markdown rendering | `marked`, `remark`, MDSvelte | `dimensions` JSONB object (already parsed into 7 sections) | soul-generator already calls `parseDimensions()` and stores structured sections in DB |
| Agent class batch lookup | N+1 `agentClasses` queries per bot | Batch `inArray(agentClasses.botId, botIds)` + Map | Exact same pattern used in `GET /executions/:id/leaderboard` in executions.ts |
| Verdict lookup per bot | N+1 `councilVerdicts` queries | Single query in soul endpoint (verdict is per-botId, not per-execution) | One verdict per bot; one DB call in the `getBotSoul` endpoint |
| Tier badge CSS | Custom badge state management | `SoulTierBadge.svelte` component + class-based CSS | Reuse identical CSS already in `report/+page.svelte` for `.class-novice` etc. |
| Inspector state | Svelte store or context | `$state<string | null>(selectedBotId)` at page level | Svelte 5 runes: page-level `$state` is sufficient for single-panel use |

**Key insight:** The soul data is already stored — the entire phase is about surfacing it through a new API endpoint and composing two new UI components from existing patterns.

---

## Common Pitfalls

### Pitfall 1: `bots.soulId` May Be Null for Old Bots

**What goes wrong:** The `bots.soulId` column is nullable. Bots spawned before Phase 9 (or stub bots used in testing) may have `soulId = null`. The soul inspector opens but `GET /bots/:botId/soul` returns all-null soul data.

**Why it happens:** Phase 9 introduced soul generation. `bots.soulId` was added as a nullable FK with no backfill. Stub bot records in test environments may not have souls.

**How to avoid:** The API endpoint returns `200` with `soulId: null, soulContent: null` etc. (not a 404). The inspector panel must handle the null case gracefully: show "No soul data available for this bot" with a muted placeholder. Do not 404 — the bot exists even if it lacks a soul record.

**Warning signs:** Inspector opens and shows an empty panel or loading spinner stuck forever — indicates the endpoint returned 404 instead of 200 with nulls.

### Pitfall 2: `council_verdicts` Joined by `botId` Returns Multiple Rows

**What goes wrong:** A bot may have been evaluated by the council multiple times (e.g., if a run was retried or multiple executions ran). `WHERE botId = :botId` without LIMIT returns all verdicts.

**Why it happens:** The council evaluates bots per execution. `council_verdicts.botId` is not unique. A bot that participated in 3 executions may have 3 verdict rows.

**How to avoid:** Always use `.orderBy(desc(councilVerdicts.createdAt)).limit(1)` to get the most recent verdict. The inspector should show only the most recent council evaluation.

**Warning signs:** Soul inspector shows verdict data for the wrong execution, or TypeScript type error because query returns array but code expects single object.

### Pitfall 3: `agentClasses` Has Multiple Rows Per Bot (One Per taskCategory)

**What goes wrong:** `agent_classes` is keyed on `(botId, taskCategory)` UNIQUE — one row per bot per task category. A bot that worked across 2 categories has 2 rows. The soul inspector needs to show the "best" class.

**Why it happens:** The God Layer promotes bots per category. A bot can be Artisan in "web-research" but Novice in "code-generation".

**How to avoid:** Use the same `CLASS_RANK` precedence map from `executions.ts` (Artisan=3, Understudy=2, Novice=1, Retired=0). Take the row with the highest rank. This is consistent with how the leaderboard computes `agentClass`.

**Warning signs:** Soul inspector shows `Novice` for a bot that the leaderboard shows as `Artisan` — indicates all rows were returned and the wrong one was selected.

### Pitfall 4: Monitoring Bot Cards Are `<a>` Tags

**What goes wrong:** The monitoring view bot cards are `<a href="/executions/{executionId}/bots/{bot.id}">` anchor elements. Wrapping them in a button or adding `onclick` causes nested interactive element warnings (invalid HTML: `<a>` inside a `<button>`).

**Why it happens:** The monitoring cards were designed purely as navigation links.

**How to avoid:** Add a separate "Inspect Soul" button INSIDE the card body (sibling to `.bot-card-cta`), not wrapping the whole card. The button calls `onclick={(e) => { e.preventDefault(); selectedBotId = bot.id; }}`. The card's primary action (navigation) is preserved; the inspect action is secondary.

**Warning signs:** Clicking the card navigates away instead of opening the inspector; or browser console shows "interactive element inside interactive element" warning.

### Pitfall 5: SoulInspectorPanel Needs Scroll Trap / Focus Management

**What goes wrong:** When the drawer opens, pressing Tab cycles through the entire page behind the backdrop instead of being trapped in the panel.

**Why it happens:** Native HTML focus order ignores visual stacking context (z-index). The drawer is visually on top but focus is not trapped.

**How to avoid:** Add `focus()` to the panel container on open. For MVP, a simple `bind:this={panelRef}` + `$effect(() => { if (botId && panelRef) panelRef.focus(); })` with `tabindex="-1"` on the panel container is sufficient. Full focus trap (looping Tab within the panel) requires more work — defer for now.

**Recommendation for MVP:** Add `tabindex="-1"` on `.inspector-panel` and auto-focus on open. Add an "×" close button. Do not implement a full focus trap — this is not a hard requirement.

### Pitfall 6: Svelte 5 Component Props Syntax

**What goes wrong:** Using `export let` (Svelte 4 syntax) instead of `let { ... } = $props()` (Svelte 5 syntax) in the new components.

**Why it happens:** Training data and documentation may mix Svelte 4 and Svelte 5 patterns.

**How to avoid:** All new components must use `let { propName, ... }: { propName: Type } = $props()`. This matches the Svelte 5 runes API used everywhere in the project (confirmed: `+layout.svelte` uses `let { children, data } = $props()`).

**Warning signs:** Svelte compiler warning "export let is deprecated in Svelte 5; use $props() instead."

### Pitfall 7: `weightedConfidenceScore` Returns as String

**What goes wrong:** `council_verdicts.weightedConfidenceScore` is `numeric('weighted_confidence_score', { precision: 4, scale: 3 })`. PostgreSQL returns this as a string from the Node.js driver.

**Why it happens:** Same Drizzle/PG numeric string issue documented in Phase 17 research.

**How to avoid:** In the soul endpoint handler, cast: `weightedConfidenceScore: Number(verdictRow.weightedConfidenceScore)`. Already done in `verdicts.ts` (line 50 and 106).

**Warning signs:** Confidence score displayed as `"0.870"` (string) instead of `0.87` (number) in the inspector.

---

## Code Examples

Verified patterns from the existing codebase:

### Agent Class Batch Query + Rank Map (from executions.ts leaderboard handler)
```typescript
// Source: services/execution-service/src/routes/executions.ts (lines 404-443)
const CLASS_RANK: Record<string, number> = {
  Artisan: 3, Understudy: 2, Novice: 1, Retired: 0,
};
const agentClassRows = await db
  .select({ botId: agentClasses.botId, currentClass: agentClasses.currentClass })
  .from(agentClasses)
  .where(inArray(agentClasses.botId, botIds));

const agentClassMap = new Map<string, 'Novice' | 'Understudy' | 'Artisan' | 'Retired'>();
for (const row of agentClassRows) {
  const existing = agentClassMap.get(row.botId);
  if (!existing || (CLASS_RANK[row.currentClass] ?? -1) > (CLASS_RANK[existing] ?? -1)) {
    agentClassMap.set(row.botId, row.currentClass);
  }
}
```

### Most Recent Verdict Query (from verdicts.ts pattern, adapted)
```typescript
// Source: adapted from services/execution-service/src/routes/verdicts.ts
const [verdictRow] = await db
  .select({
    verdictType: councilVerdicts.verdictType,
    weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
    verdictSummary: councilVerdicts.verdictSummary,
    soulAnalystOutput: councilVerdicts.soulAnalystOutput,
    performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
  })
  .from(councilVerdicts)
  .where(eq(councilVerdicts.botId, botId))
  .orderBy(desc(councilVerdicts.createdAt))
  .limit(1);
```

### Svelte 5 Component with Props and $effect (from +layout.svelte pattern)
```svelte
<!-- Source: services/ui/src/routes/+layout.svelte (let { children, data } = $props()) -->
<script lang="ts">
  let { botId, onClose }: { botId: string | null; onClose: () => void } = $props();
  let data = $state<BotSoul | null>(null);
  let loading = $state(false);

  $effect(() => {
    if (!browser || !botId) { data = null; return; }
    loading = true;
    getBotSoul(botId)
      .then(s => { data = s; loading = false; })
      .catch(() => { loading = false; });
  });
</script>
```

### CSS Variable Usage (dark-mode pages) vs Hardcoded Colors (light-mode pages)
```css
/* Dark-mode pages (verdicts, layout) use CSS variables: */
background: var(--surface-1);      /* #121a2c */
color: var(--text-primary);        /* #e8edf5 */
border: 1px solid var(--border);   /* rgba(255,255,255,0.07) */

/* Light-mode pages (executions, report, objectives) use hardcoded: */
background: #fff;
color: #111827;
border: 1px solid #e5e7eb;

/* Source: services/ui/src/app.css (CSS variables), services/ui/src/routes/executions/[id]/+page.svelte (hardcoded) */
```

### Bot Card `<a>` Tag Pattern (from executions/[id]/+page.svelte)
```svelte
<!-- Source: services/ui/src/routes/executions/[id]/+page.svelte (lines 169-196) -->
{#each bots as bot (bot.id)}
  <a
    href="/executions/{executionId}/bots/{bot.id}"
    class="bot-card"
    class:bot-active={bot.status === 'working' || bot.status === 'idle' || bot.status === 'spawning'}
  >
    <div class="bot-card-top">
      <span class="bot-id">{bot.id.slice(0, 8)}</span>
      <span class="bot-status-pill bot-status-{bot.status}">{bot.status}</span>
    </div>
    <!-- add SoulTierBadge here -->
    <!-- add "Inspect Soul" button here -->
  </a>
{/each}
```

### Leaderboard Row Pattern with Class Badge (from report/+page.svelte)
```svelte
<!-- Source: services/ui/src/routes/executions/[id]/report/+page.svelte (lines 106-146) -->
{#each leaderboard as entry, i}
  <tr>
    <td>
      <span class="class-badge class-{entry.agentClass?.toLowerCase() ?? 'none'}">
        {entry.agentClass ?? '-'}
      </span>
    </td>
    <!-- Replace above with: <SoulTierBadge agentClass={entry.agentClass} /> -->
    <!-- Add "Inspect Soul" button in a new <td> -->
  </tr>
{/each}
```

### Numeric Cast Pattern (from verdicts.ts)
```typescript
// Source: services/execution-service/src/routes/verdicts.ts (line 50, 106)
weightedConfidenceScore: Number(row.weightedConfidenceScore),
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `export let` in Svelte components | `let { ... } = $props()` in Svelte 5 | New components must use runes props API |
| `onMount` for side effects | `$effect(() => { if (!browser) return; ... })` | All data fetching in new components uses $effect |
| `<slot>` in component templates | `{@render children()}` in layouts | Not needed for leaf components like inspector/badge |
| Component libraries (Shadcn, Radix, Headless UI) | Handrolled CSS | App has NO component library; all UI is custom CSS |

**Deprecated in this project:**
- `export let` prop syntax: replaced by `$props()` throughout
- Svelte stores (`writable`): replaced by `$state()` throughout

---

## Open Questions

1. **SOUL.md rendering: raw markdown or structured sections?**
   - What we know: `bot_souls.soulContent` is the raw SOUL.md markdown string. `bot_souls.dimensions` is a JSONB object with 7 pre-parsed section strings (identityRole, decisionPriorities, toolUsageDoctrine, riskTolerance, communicationStyle, recoveryBehavior, ethicalHardStops).
   - What's unclear: Should the inspector show raw SOUL.md text (one scrollable block) or parsed dimensions (accordion sections per dimension)?
   - Recommendation: Use the `dimensions` JSONB object to render 7 named sections. This is more readable and structured than raw markdown. The raw `soulContent` can be shown in a collapsible "Raw SOUL.md" section for power users. This avoids needing a markdown parser.

2. **Inspector trigger: button inside card vs. dedicated "Soul" icon**
   - What we know: Monitoring bot cards are `<a>` tags; the whole card is a navigation link. Adding onclick to the `<a>` would intercept navigation.
   - What's unclear: Best UX for "inspect soul without navigating to bot detail."
   - Recommendation: Add a small "Soul" link/button inside the card (sibling to `.bot-card-cta`). Use `onclick={(e) => { e.stopPropagation(); e.preventDefault(); selectedBotId = bot.id; }}` on the button to prevent the parent `<a>` from navigating. This is the cleanest approach.

3. **Mutation operations: what to show in lineage?**
   - What we know: `bot_souls` has no `mutationOperation` column. The soul-generator picks operations (substitution/amplification/attenuation/recombination/introduction) but does NOT persist them.
   - What's unclear: The phase description lists "mutation operations applied" as a lineage field.
   - Recommendation: Show generation counter, parent soul ID (abbreviated UUID or "Seed"), task category, and whether it's an archetype. Omit "mutation operations" with a note in PLAN.md that the schema doesn't store this. This is a scope reduction the planner should call out explicitly.

4. **Bot detail page inspector: duplicate of verdict data already on page?**
   - What we know: `executions/[id]/bots/[botId]/+page.svelte` does not show verdict or soul data. The soul inspector would add this.
   - What's unclear: Should the bot detail page have the inspector as a panel or inline sections?
   - Recommendation: Use the same inspector panel pattern (triggered by a "Inspect Soul" button in the `.bot-status-row`). Consistent UX across all bot card contexts.

---

## Plan Decomposition Recommendation

Phase 18 breaks naturally into two plans as already outlined in the phase description:

**Plan 18-01: Soul Inspector Panel**
- New `GET /bots/:botId/soul` endpoint in `bots.ts`
- New `BotSoul` type in `types.ts`
- New `getBotSoul()` function in `api.ts`
- New `SoulInspectorPanel.svelte` component
- Wire inspector panel into: monitoring view, report/leaderboard view, bot detail page
- Requirements: SOUL-01 (full SOUL.md display), SOUL-02 (lineage metadata), SOUL-03 (verdict outcome)

**Plan 18-02: Soul Tier Badge + Integration**
- Extend `GET /bots/by-execution/:executionId` to include `agentClass` in response + `ExecutionBot` type
- New `SoulTierBadge.svelte` component
- Integrate badge into: monitoring view bot cards, report leaderboard rows, bot detail page status row
- Requirement: SOUL-04 (tier badges throughout UI)

**Dependencies:** 18-01 and 18-02 are partially independent. The badge (18-02) only requires the monitoring endpoint change; it does not depend on the soul endpoint. The inspector (18-01) only requires the soul endpoint. Both can proceed in parallel, but the monitoring endpoint change in `bots.ts` should be done once (in 18-02 backend work) to avoid conflicts.

---

## Sources

### Primary (HIGH confidence — directly inspected)

- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/bot-souls.ts` — confirmed all bot_souls columns; confirmed `mutationOperation` does NOT exist
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/bots.ts` — confirmed `soulId` is nullable UUID, no explicit FK
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/council-verdicts.ts` — confirmed all verdict columns including per-judge JSONB outputs
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/agent-classes.ts` — confirmed `(botId, taskCategory)` unique, `currentClass` agentClassEnum
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/shared-types/src/soul.ts` — confirmed `SoulDimension` 7-field interface and `SoulDocument` shape
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/services/soul-generator.ts` — confirmed mutation operations are NOT persisted; `parseDimensions()` parses 7 sections from markdown
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/bots.ts` — confirmed `GET /bots/:botId/detail` does NOT return soulId/agentClass; `GET /bots/by-execution` does NOT return agentClass
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/executions.ts` (lines 353-511) — confirmed leaderboard batch agentClass pattern with CLASS_RANK map
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/verdicts.ts` — confirmed verdict API structure and numeric cast pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/lib/types.ts` — confirmed all existing types; confirmed `ExecutionBot` does NOT have `agentClass`; `LeaderboardEntry` does have `agentClass`
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/lib/api.ts` — confirmed no `getBotSoul` exists; confirmed `apiFetch` helper pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/executions/[id]/+page.svelte` — confirmed bot cards are `<a>` tags; confirmed Svelte 5 runes pattern; confirmed no agentClass displayed
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/executions/[id]/report/+page.svelte` — confirmed leaderboard `agentClass` displayed as raw text span; confirmed color classes match recommendation
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte` — confirmed bot detail page shows `bots.tier` (performance tier) not `agentClass`; no soul data displayed
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/+layout.svelte` — confirmed Svelte 5 `$props()` usage; confirmed dark-mode CSS variable theme
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/app.css` — confirmed CSS custom properties (--surface-1, --text-primary, --border, etc.)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/council/soul-analyst.ts` — confirmed per-judge output schema for soul analysis
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/ui/src/routes/verdicts/[verdictId]/+page.svelte` — confirmed how per-judge outputs are currently displayed in verdict detail page (reference pattern for soul inspector)

---

## Metadata

**Confidence breakdown:**
- Missing API endpoint (`GET /bots/:botId/soul`): HIGH — directly confirmed absence by inspecting bots.ts
- Mutation operations not in schema: HIGH — directly confirmed by reading bot-souls.ts; column does not exist
- Agent class precedence pattern: HIGH — exact code copied from executions.ts leaderboard handler
- CSS-only drawer pattern: HIGH — matches existing app convention (no component library)
- Svelte 5 runes in new components: HIGH — all existing pages use runes; `$props()`, `$state()`, `$effect()` confirmed
- ExecutionBot missing agentClass: HIGH — directly confirmed from types.ts and bots.ts response schema
- Numeric cast requirement: HIGH — confirmed from schema (numeric type) and existing verdict handler pattern

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — all stable dependencies; Drizzle 0.45, Svelte 5, SvelteKit 2 are stable)
