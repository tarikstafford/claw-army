# Phase 14: UI Extensions - Research

**Researched:** 2026-02-22
**Domain:** SvelteKit frontend extension, Fastify SSE events, Army Builder pre-execution UX, leaderboard augmentation
**Confidence:** HIGH

---

## Summary

Phase 14 extends the existing SvelteKit UI across four distinct surfaces: (1) the post-run leaderboard, (2) the verdicts notification and confirmation panel, (3) a global SSE lifecycle notification stream, and (4) the Army Builder (new-execution page). All backend data is already in the database — `agent_classes` table has `currentClass`, `isPioneer`, and `lastTransitionAt`; `council_verdicts` has the full verdict context for UIEX-02. The leaderboard endpoint (`GET /executions/:id/leaderboard`) currently returns `compositeScore`, `tier`, `tasksCompleted`, `tasksFailed`, and `botHours` — it does NOT yet return `agentClass` (from `agent_classes`), `councilVerdict`, or `isPioneer`. These must be joined in the backend.

The SSE infrastructure (`@fastify/sse` plugin, Pub/Sub subscriptions per connection, `$lib/sse.ts` client) already works for per-execution events. UIEX-03 requires a **global** SSE stream for soul lifecycle events (promotion, demotion, retirement, pioneer) that is not scoped to a single execution. A new SSE endpoint (`GET /events/lifecycle`) subscribing to a new or existing Pub/Sub topic is required, alongside a new publisher function in `publisher.ts` and a new event type in `@claw/event-schemas`.

The Army Builder (UIEX-04 and UIEX-05) is the most complex addition. It requires: (a) task-category extraction from the objective text (LLM call or regex heuristic), (b) a backend query of `agent_classes` grouped by `taskCategory` and `currentClass` to show library depth, (c) budget-tier math (full / 75% / minimum-viable at 3 Novices per task category), and (d) a submission block when the minimum viable cost exceeds `budgetCapCents`. The existing new-execution form uses a SvelteKit form action (`+page.server.ts`) — adding Army Builder analysis means adding either a new API endpoint called from the client or enriching the server load function with pre-computed analysis.

**Primary recommendation:** Five focused plans. (1) Extend the leaderboard backend + frontend. (2) Add verdict SSE notifications to the existing verdicts inbox. (3) Add the global soul lifecycle SSE stream. (4) Build the Army Builder analysis backend endpoint. (5) Wire Army Builder analysis into the new-execution frontend with budget-block enforcement.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svelte` | `^5.51.3` (installed) | All UI components | Project standard; uses Svelte 5 runes (`$state`, `$derived`, `$effect`) |
| `@sveltejs/kit` | `^2.52.0` (installed) | Page routing and server actions | Project standard |
| `fastify` | `^5.7.4` (installed) | New SSE and Army Builder API endpoints | Project standard — all routes use Fastify plugins |
| `@fastify/sse` | installed | SSE reply object with `reply.sse.send()` | Already registered in `app.ts` |
| `@fastify/type-provider-typebox` | `^6.1.0` (installed) | TypeBox schema on new endpoints | Project standard |
| `@claw/db` | `workspace:*` (installed) | `agentClasses`, `councilVerdicts`, `bots`, `botSouls`, `categoryBenchmarks` queries | Project ORM package |
| `drizzle-orm` | `^0.45.1` (installed) | `eq`, `and`, `inArray`, `sql`, `desc` for new queries | Project ORM |
| `@google-cloud/pubsub` | installed | New lifecycle topic subscriptions for global SSE | Already used in `sse.ts` and `publisher.ts` |
| `zod` | installed | New soul lifecycle event schemas in `@claw/event-schemas` | Already used for all other event schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `$lib/api.ts` (existing) | local | Add new API helper functions | Follow existing `apiFetch` pattern |
| `$lib/sse.ts` (existing) | local | Add new `connectLifecycleSSE()` function | Follow `connectSSE` pattern |
| `$lib/types.ts` (existing) | local | Add `LeaderboardEntryExtended`, `LifecycleEvent`, `ArmyBuilderAnalysis` types | Follow existing interface pattern |
| `ai` SDK + model (existing) | installed | Task category extraction via LLM call | `planObjective` uses `generateText` from `ai` SDK |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `GET /events/lifecycle` SSE endpoint | Polling `/verdicts/pending` for lifecycle events | SSE is already established; polling adds latency and is weaker for real-time narration |
| LLM-based category extraction for Army Builder | Regex/keyword heuristics | LLM produces accurate categories but adds latency; heuristics are fast but brittle. Given planner.service.ts already does LLM calls, LLM is the established pattern |
| Server-side Army Builder analysis in page load | Client-side analysis on textarea change | Server-side keeps LLM key secure; client-side would need a separate API call anyway |
| New `army-builder-analysis` Fastify route | Embed analysis in POST /executions | Separation of concerns: analysis is pre-flight, not execution creation |

---

## Architecture Patterns

### Recommended Project Structure

```
services/execution-service/src/
├── routes/
│   ├── sse.ts                    MODIFY: add GET /events/lifecycle global stream
│   ├── executions.ts             MODIFY: extend /leaderboard to join agent_classes + council_verdicts
│   └── army-builder.ts           CREATE: GET /army-builder/analysis?objective=...
├── events/
│   └── publisher.ts              MODIFY: add publishSoulLifecycleEvent()

packages/event-schemas/src/
├── soul-lifecycle-events.ts      CREATE: soul_promoted, soul_demoted, soul_retired, pioneer_detected schemas
└── index.ts                      MODIFY: export new schemas

services/ui/src/
├── lib/
│   ├── api.ts                    MODIFY: add getLeaderboardExtended, getArmyBuilderAnalysis
│   ├── sse.ts                    MODIFY: add connectLifecycleSSE()
│   └── types.ts                  MODIFY: add LeaderboardEntryExtended, LifecycleNotification, ArmyBuilderAnalysis
├── routes/
│   ├── executions/[id]/report/+page.svelte  MODIFY: add agentClass badge, verdict summary, pioneer flag to leaderboard
│   ├── verdicts/+page.svelte                MODIFY: add lifecycle notification toast/banner via SSE
│   ├── new-execution/+page.svelte           MODIFY: add Army Builder panel, budget tiers, block-on-minimum
│   └── new-execution/+page.server.ts        MODIFY: fetch army-builder analysis in load, pass to page
```

### Pattern 1: Backend Leaderboard Extension (UIEX-01)

**What:** Join `bots` with `agent_classes` and most recent `council_verdicts` per bot to extend the leaderboard response.

**Current leaderboard query** (in `executions.ts`, lines 368-409) fetches `bots.id`, `bots.compositeScore`, `bots.tier` then does N+1 queries for task counts and bot-hours. The `tier` column in `bots` is a legacy `varchar(10)` (High/Medium/Low performance tier) — it is different from `agent_classes.currentClass` (Novice/Understudy/Artisan).

**New response fields needed:**
- `agentClass`: `'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null` — from `agent_classes.currentClass` for the bot's primary task category
- `isPioneer`: `boolean` — from `agent_classes.isPioneer`
- `verdictSummary`: `string | null` — from `council_verdicts.verdictSummary` for the most recent verdict for this bot
- `verdictType`: `'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire' | null`

**Query approach:**

```typescript
// Source: Drizzle ORM join pattern (project standard)
// For each bot, get agent_classes for primary task category and most recent verdict
const agentClassRows = await db
  .select({
    botId: agentClasses.botId,
    currentClass: agentClasses.currentClass,
    isPioneer: agentClasses.isPioneer,
    taskCategory: agentClasses.taskCategory,
  })
  .from(agentClasses)
  .where(inArray(agentClasses.botId, botIds));

const verdictRows = await db
  .select({
    botId: councilVerdicts.botId,
    verdictType: councilVerdicts.verdictType,
    verdictSummary: councilVerdicts.verdictSummary,
    createdAt: councilVerdicts.createdAt,
  })
  .from(councilVerdicts)
  .where(and(
    inArray(councilVerdicts.botId, botIds),
    eq(councilVerdicts.executionId, id),
  ))
  .orderBy(desc(councilVerdicts.createdAt));
```

A bot can have multiple `agent_classes` rows (one per task category). For the leaderboard, use the row with the highest-ranked class (Artisan > Understudy > Novice) or the one with `isPioneer = true`. The leaderboard already tolerates null values via `Type.Union([Type.String(), Type.Null()])`.

### Pattern 2: Global Soul Lifecycle SSE (UIEX-03)

**What:** A new Pub/Sub topic `soul-lifecycle` and SSE endpoint `GET /events/lifecycle` (not scoped to an execution) that forwards promotion, demotion, retirement, and pioneer events.

**Hook point in god-layer-worker.ts:**
```typescript
// In god-layer-worker.ts, post-transaction side effects (currently only console.log):
if (artisanGraduated) {
  console.log('[god-layer] Artisan graduation:', { botId, category: effectiveCategory });
  // Phase 14 hook: publishSoulLifecycleEvent({ type: 'soul_promoted', ... })
}
if (isPioneer) {
  console.log('[god-layer] Pioneer event:', { botId, category: effectiveCategory });
  // Phase 14 hook: publishSoulLifecycleEvent({ type: 'pioneer_detected', ... })
}
```

The god-layer-worker already has `transitionType` and `artisanGraduated` variables populated post-transaction, making this a targeted addition of a `publishSoulLifecycleEvent()` call at the marked deferral point.

**New SSE route in sse.ts:**
```typescript
// GET /events/lifecycle — global soul lifecycle events (not execution-scoped)
fastify.get('/lifecycle', {
  sse: true,
  schema: { ... },
}, async (request, reply) => {
  const connId = randomUUID().slice(0, 8);
  const subName = `sse-lifecycle-${connId}`;
  await pubsub.topic(SOUL_LIFECYCLE_TOPIC).createSubscription(subName);
  const sub = pubsub.subscription(subName);

  const handler = async (message) => {
    const payload = JSON.parse(message.data.toString());
    if (reply.sse.isConnected) {
      await reply.sse.send({ event: payload.type, data: JSON.stringify(payload) });
    }
    message.ack();
  };

  sub.on('message', handler);
  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    sub.removeAllListeners();
    await sub.close();
    await sub.delete().catch(() => {});
  };
  reply.sse.onClose(cleanup);
  request.raw.on('close', cleanup);
});
```

**Registration in app.ts:** Add `sseRoutes` already uses prefix `/executions`. Lifecycle events need a different prefix — register under `/events` or add it inside `sseRoutes` at `/lifecycle` path with a different route (the current prefix is `/executions`, so the full path would be `/executions/lifecycle`). Better: create a separate `lifecycleSseRoutes` plugin registered at `/events`.

### Pattern 3: Army Builder Analysis (UIEX-04 and UIEX-05)

**What:** A new endpoint `GET /army-builder/analysis` that accepts `?objective=...&budgetCapCents=...` and returns:
- Detected task categories from objective
- Available agent class mix per category (queried from `agent_classes` + `botSouls` + `dnaStore`)
- Library depth (count of distinct Artisan/Understudy/Novice bots per category in DNA library)
- Budget tier breakdown: full, 75%, minimum-viable (3 Novices per category)
- `blocked: boolean` and `blockReason: string | null`

**Category detection:** Reuse the existing `planObjective` LLM call pattern from `planner.service.ts`. The Army Builder analysis can call the planner and extract unique categories from the task descriptions by asking the LLM to also return category labels. Alternatively, query `agent_classes.taskCategory` distinct values to see what categories the library already covers, then match objective keywords.

**Library depth query:**
```typescript
// Count agent_classes rows by category and class for a holistic library depth view
const libraryDepth = await db
  .select({
    taskCategory: agentClasses.taskCategory,
    currentClass: agentClasses.currentClass,
    count: sql<number>`cast(count(*) as int)`,
  })
  .from(agentClasses)
  .where(
    inArray(agentClasses.taskCategory, detectedCategories),
  )
  .groupBy(agentClasses.taskCategory, agentClasses.currentClass);
```

**Budget tier math:**
- `agentsPerCategory = 3` (minimum viable per UIEX-05)
- `totalCategories = detectedCategories.length`
- `minimumViableAgents = agentsPerCategory * totalCategories` (all Novices)
- `costPerAgentCents` = a constant or derived from `budgetCapCents / maxBots` guidance
- For Army Builder purposes, expose tier breakdowns as agent counts, not dollar amounts (since per-agent runtime cost is variable). The tiers should be: full = max bots across all categories, 75% = 0.75 * max bots, minimum-viable = 3 Novices per category.

**Submission block logic (UIEX-05):**
- Block when `minimumViableAgents > maxBots` (budget constraint applied via bot count)
- Since budget is in cents, block when `budgetCapCents < minimumViableCostCents` where `minimumViableCostCents` is estimated per-run cost
- The existing execution endpoint already enforces `minimum: 3` on `maxBots` — Army Builder should show this at form level before POST

### Pattern 4: Frontend Leaderboard Badge Component

**What:** In `services/ui/src/routes/executions/[id]/report/+page.svelte`, add badge rendering for `agentClass` (Novice/Understudy/Artisan), `isPioneer` flag, and `verdictSummary`.

**Current leaderboard table** (lines 88-126) already has a `tier` badge pattern (`.tier-high`, `.tier-medium`, `.tier-low`). New badges follow the same pattern:

```svelte
<!-- Agent class badge -->
<span class="class-badge class-{entry.agentClass?.toLowerCase() ?? 'none'}">
  {entry.agentClass ?? '-'}
</span>
{#if entry.isPioneer}
  <span class="pioneer-badge" title="Pioneer — first in category">P</span>
{/if}
```

The `tier` column (existing `bots.tier`) uses performance tier values (High/Medium/Low) and can stay in the table. The new `agentClass` (Novice/Understudy/Artisan) is a separate column to the right of it. The requirement states "no existing leaderboard data is removed or rearranged" — add columns to the right of `Bot-Hours`.

### Pattern 5: Verdicts Inbox Notification (UIEX-02)

**What:** The existing `/verdicts` page already polls `getPendingVerdicts()` every 15 seconds and shows verdict cards. UIEX-02 requires a "confirmation panel that surfaces at least one concrete evidence item before confirm/reject controls are available" — this is already implemented in `/verdicts/[verdictId]/+page.svelte` via `evidenceLoaded` flag.

The UIEX-02 requirement for "notifications in the UI" means adding a toast or banner component on the `/verdicts` page that appears when new verdicts arrive (via SSE or re-poll detection). The existing 15-second polling already causes the count to update — the "notification" is a count badge or banner that highlights when new verdicts appear.

**Approach:** Add a `previousCount` state variable. When `verdicts.length > previousCount`, show a toast notification. No new backend is needed; this is a pure frontend pattern change.

### Anti-Patterns to Avoid

- **Adding `agentClass` to `bots` table:** The `bots.tier` column is the performance tier (High/Medium/Low), not the evolutionary class. `agent_classes.currentClass` is the correct source. Do not add a `agentClass` column to `bots` — it is already normalized in `agent_classes`.
- **Reusing the per-execution SSE endpoint for lifecycle events:** The `/executions/:id/events` endpoint filters by `executionId`. Lifecycle events are not execution-scoped (a bot's promotion persists beyond its execution). Use a separate `/events/lifecycle` endpoint.
- **Silently reducing agent count in Army Builder:** UIEX-05 explicitly forbids silent reduction. The UI must block submission with a plain explanation, not reduce `maxBots` silently.
- **LLM call on every keystroke for category detection:** Category detection should be triggered on form submit (pre-launch analysis) or on a debounced blur event, not on every character typed. The `planner.service.ts` pattern calls LLM in `setImmediate` after the POST — Army Builder analysis should be a separate pre-flight fetch.
- **Embedding Army Builder analysis in POST /executions response:** Separating the analysis (GET) from execution creation (POST) allows operators to inspect and adjust without committing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast/notification component | Custom notification system | Svelte 5 `$state` + simple `div.toast` with CSS transition | Project uses no UI component library; inline CSS is the established pattern |
| Category extraction NLP | Custom regex keyword matcher | LLM call via existing `planner.service.ts` pattern (`generateText`) | LLM is already the established decomposition tool; regex is brittle |
| SSE reconnection logic | Custom EventSource reconnect | Native `EventSource` auto-reconnects on 503/connection close | Browser EventSource handles reconnection natively |
| Budget tier calculation | Complex financial modeling | Simple integer math on agent counts × estimated hourly rate | Phase 14 scope is UI display; deep financial modeling is out of scope |

**Key insight:** All data already exists in the database. The work is primarily about joining and presenting it correctly, not building new backend systems.

---

## Common Pitfalls

### Pitfall 1: bots.tier vs agent_classes.currentClass confusion
**What goes wrong:** Using `bots.tier` (performance tier: High/Medium/Low) as the agent class tier badge.
**Why it happens:** `tier` column exists on `bots` table and is already returned by leaderboard endpoint.
**How to avoid:** The new `agentClass` field must be sourced from `agent_classes.currentClass` (Novice/Understudy/Artisan). They are different systems. The leaderboard endpoint needs a new JOIN to `agent_classes`.
**Warning signs:** Badge shows "High" or "Low" instead of "Novice" or "Artisan".

### Pitfall 2: Multiple agent_classes rows per bot
**What goes wrong:** A bot can have one `agent_classes` row per task category. The leaderboard JOIN produces multiple rows per bot.
**Why it happens:** `agent_classes` has a unique constraint on `(bot_id, task_category)`, not on `bot_id` alone.
**How to avoid:** In the backend, group by `botId` and pick the primary class row. Use the highest-ranked class (Artisan > Understudy > Novice) or the row with `isPioneer = true` as the display class. Use a subquery or `DISTINCT ON (bot_id)` ordering by class rank.
**Warning signs:** Leaderboard shows duplicate bot rows.

### Pitfall 3: Global SSE endpoint path conflict with per-execution SSE
**What goes wrong:** Registering `/events/lifecycle` under the `/executions` prefix collides with the pattern `/:id/events` — Fastify may route `/events/lifecycle` as `id=events`, `path=lifecycle`.
**Why it happens:** The existing `sseRoutes` plugin is registered at prefix `/executions`, making the new route `/executions/events/lifecycle` — an ambiguous path given `:id/events`.
**How to avoid:** Register the lifecycle SSE under a new prefix `/events` (not `/executions`). Add a new Fastify plugin `lifecycleSseRoutes` registered at `/events` in `app.ts`. The frontend SSE client connects to `/api/events/lifecycle`.
**Warning signs:** Fastify logs a route registration warning; 404 or wrong-route handling on lifecycle SSE calls.

### Pitfall 4: Pub/Sub topic creation for soul-lifecycle
**What goes wrong:** `publisher.ts` publishes to `soul-lifecycle` topic but the topic doesn't exist in GCP, causing silent publish failures (the `publish` helper catches all errors and logs rather than throws).
**Why it happens:** The `publisher.ts` pattern catches all publish errors silently. The emulator auto-creates topics, but production GCP does not.
**How to avoid:** Add `SOUL_LIFECYCLE_TOPIC` to the list of topics that must be provisioned (Terraform or manual GCP console). The existing topics (`bot-lifecycle`, `execution-lifecycle`, `task-lifecycle`, etc.) serve as the reference. Document the new topic name in CLAUDE.md or the deployment checklist.
**Warning signs:** SSE lifecycle stream receives no events; GCP console shows no messages on the topic.

### Pitfall 5: Army Builder analysis latency blocking form submission
**What goes wrong:** Calling the `/army-builder/analysis` endpoint inline with the form `load` function makes every page load wait for an LLM call.
**Why it happens:** `+page.server.ts` load is synchronous with page navigation.
**How to avoid:** The Army Builder analysis should be triggered client-side after the objective textarea blurs (debounced) or when the user clicks a "Analyze" button — not in the `load` function. The `+page.server.ts` load function should remain fast (no LLM call). A client-side `$effect` watching `objective` (with debounce) that calls `getArmyBuilderAnalysis()` from `$lib/api.ts` is the correct approach.
**Warning signs:** New-execution page takes 2-5 seconds to load because of the LLM call in server load.

### Pitfall 6: evidenceLoaded flag race in verdict detail page
**What goes wrong:** Phase 12 already enforces that action buttons are not in the DOM until `evidenceLoaded = true` (set after `getVerdict()` resolves). UIEX-02 says the confirmation panel must "surface at least one concrete evidence item" — this is already implemented. Duplicating this logic risks breaking the Phase 12 guarantee.
**Why it happens:** Misreading UIEX-02 as requiring new evidence gating when the gate already exists.
**How to avoid:** UIEX-02 for Phase 14 only requires adding a notification mechanism on the `/verdicts` list page (badge/toast for new verdicts). The confirmation panel detail page at `/verdicts/[verdictId]` is already correct per Phase 12. Do not modify the `evidenceLoaded` guard.
**Warning signs:** Action buttons appear before evidence section renders.

### Pitfall 7: Army Builder "blocks submission" vs form validation
**What goes wrong:** Using HTML `required` or TypeBox `minimum` to block submission silently reduces agent count or gives a generic validation message.
**Why it happens:** Existing `maxBots` input already has `min="1"` and `max="20"` range constraints.
**How to avoid:** The block must be an explicit application-level check in the form action (`+page.server.ts`) and/or a client-side reactive block. The error message must be plain English: e.g., "Your budget supports a minimum of 3 agents per task category (X categories detected), requiring at least Y agents. Increase your bot count or budget to proceed." The existing execution service already returns a human-readable error for `maxBots < 3` — follow that pattern.
**Warning signs:** Submission silently succeeds with fewer than 3 agents per task category.

---

## Code Examples

Verified patterns from the codebase:

### Existing leaderboard endpoint (to extend)
```typescript
// Source: services/execution-service/src/routes/executions.ts lines 341-409
// Current response: botId, compositeScore, tier (performance tier), tasksCompleted, tasksFailed, botHours
// UIEX-01 requires: + agentClass, isPioneer, verdictSummary, verdictType
fastify.get('/:id/leaderboard', { ... }, async (request, reply) => {
  // existing bot rows query
  const botRows = await db
    .select({ botId: bots.id, compositeScore: bots.compositeScore, tier: bots.tier })
    .from(bots).where(eq(bots.executionId, id))
    .orderBy(sql`${bots.compositeScore} DESC NULLS LAST`);
  // NEW: batch query agent_classes for all bot IDs
  // NEW: batch query most recent council_verdicts per bot for this execution
});
```

### Existing SSE pattern (to mirror for lifecycle stream)
```typescript
// Source: services/execution-service/src/routes/sse.ts
// Per-connection Pub/Sub subscription with cleanup — mirror for /events/lifecycle
const cleanup = async () => {
  if (cleanedUp) return;
  cleanedUp = true;
  subs.forEach((sub) => sub.removeAllListeners());
  await Promise.allSettled(subs.map((sub) => sub.close()));
  await Promise.allSettled(subs.map((sub) => sub.delete().catch(() => {})));
};
reply.sse.onClose(cleanup);
request.raw.on('close', cleanup);
```

### Existing client SSE pattern (to mirror for lifecycle)
```typescript
// Source: services/ui/src/lib/sse.ts
export function connectLifecycleSSE(
  onEvent: (event: LifecycleNotification) => void,
  onError?: (err: Event) => void,
): (() => void) | null {
  if (!browser) return null;
  const es = new EventSource(`${BASE}/events/lifecycle`);
  for (const type of LIFECYCLE_EVENT_TYPES) {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        onEvent({ ...payload, type } as LifecycleNotification);
      } catch { /* ignore */ }
    });
  }
  if (onError) es.onerror = onError;
  return () => es.close();
}
```

### Publisher function pattern (to mirror for soul lifecycle)
```typescript
// Source: services/execution-service/src/events/publisher.ts
// All publishers follow: validate with Zod schema, serialize, publish to topic, catch silently
export async function publishSoulLifecycleEvent(event: SoulLifecycleEvent): Promise<void> {
  await publish(SOUL_LIFECYCLE_TOPIC, soulLifecycleEventSchema, event);
}
```

### Svelte 5 client-side Army Builder analysis pattern
```svelte
<!-- Source: services/ui/src/routes/new-execution/+page.svelte pattern -->
<!-- Add to new-execution page — reactive analysis on objective blur -->
let armyAnalysis = $state<ArmyBuilderAnalysis | null>(null);
let analysisLoading = $state(false);

async function analyzeObjective() {
  if (!objective.trim()) return;
  analysisLoading = true;
  try {
    armyAnalysis = await getArmyBuilderAnalysis(objective, maxBots, budgetCapDollars * 100);
  } catch { armyAnalysis = null; }
  finally { analysisLoading = false; }
}
```

### Existing event schema pattern (to mirror for soul lifecycle)
```typescript
// Source: packages/event-schemas/src/bot-events.ts
import { z } from 'zod';

export const soulPromotedEventSchema = z.object({
  type: z.literal('soul_promoted'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  fromClass: z.enum(['Novice', 'Understudy']),
  toClass: z.enum(['Understudy', 'Artisan']),
  description: z.string(), // human-readable, e.g. "Agent X has been promoted to Understudy..."
  timestamp: z.iso.datetime(),
});
```

---

## What's Already Built (Phase 12/13 Handoff)

This is critical context for the planner:

| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Leaderboard endpoint | EXISTS — partial | `executions.ts` L341-409 | Returns `compositeScore`, `tier` (perf), `tasksCompleted`, `tasksFailed`, `botHours`. Missing: `agentClass`, `isPioneer`, `verdictSummary` |
| Leaderboard UI | EXISTS — partial | `executions/[id]/report/+page.svelte` | Renders tier badges (High/Medium/Low), not agent class badges |
| Verdicts inbox | EXISTS | `verdicts/+page.svelte` | Polls every 15s. Missing: notification toast for new verdicts |
| Verdict detail + confirmation panel | EXISTS — complete | `verdicts/[verdictId]/+page.svelte` | `evidenceLoaded` flag, time-on-screen, reject labeling all done (Phase 12) |
| Per-execution SSE | EXISTS | `sse.ts`, `$lib/sse.ts` | Works for execution lifecycle events. Missing: global soul lifecycle topic |
| God Layer worker | EXISTS | `god-layer-worker.ts` | `artisanGraduated` and `isPioneer` already detected post-transaction; only `console.log` currently (marked "Phase 14 deferred") |
| `agent_classes` schema | EXISTS | `packages/db/src/schema/agent-classes.ts` | Has `currentClass`, `isPioneer`, `lastTransitionAt`, `taskCategory` per bot |
| `council_verdicts` schema | EXISTS | `packages/db/src/schema/council-verdicts.ts` | Has `verdictSummary`, `verdictType`, `status`, `botId`, `executionId` |
| Army Builder (new-execution) | EXISTS — basic | `new-execution/+page.svelte` | Has objective textarea, maxBots slider, budgetCap input. Missing: Army Builder analysis panel, category display, budget tiers, submission block |
| Event schemas | EXISTS — partial | `packages/event-schemas/src/` | Has bot, execution, guardrail, billing events. Missing: soul lifecycle events |
| SSE route registration | EXISTS | `app.ts` | `sseRoutes` at `/executions` prefix. Missing: lifecycle SSE route at `/events` prefix |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bots.tier` = performance tier (High/Medium/Low) | Separate `agent_classes.currentClass` = evolutionary tier (Novice/Understudy/Artisan) | Phase 13 | Leaderboard must JOIN `agent_classes`, not use `bots.tier` for the new badges |
| No soul lifecycle events in SSE | `god-layer-worker.ts` marks deferred publish point | Phase 13 | Add `publishSoulLifecycleEvent()` at the marked deferral point |
| No pre-execution Army Builder analysis | Army Builder is new in Phase 14 | Phase 14 | New endpoint + frontend panel required |

**Deprecated/outdated:**
- `bots.tier` (varchar 10): still present for performance tier display, but NOT the agent class system. Keep it in the leaderboard but add separate `agentClass` column.

---

## Open Questions

1. **Category extraction method for Army Builder**
   - What we know: `planner.service.ts` uses an LLM to decompose objective into tasks. The planner doesn't return categories.
   - What's unclear: Should Army Builder call the planner to get tasks then extract categories from task descriptions, or add a separate "categorize" LLM prompt?
   - Recommendation: Add a separate prompt in the army-builder endpoint that asks the LLM to return both task decomposition AND category labels in a single call. Reuse the same `generateText` + model resolution pattern. Keep it as a separate endpoint from the planner to maintain single responsibility.

2. **Cost-per-agent estimate for budget tier math**
   - What we know: Budget is in cents; execution runtime is variable; bots don't have a fixed hourly rate in the schema.
   - What's unclear: How to translate budget tiers into meaningful cost estimates without a fixed rate.
   - Recommendation: For Phase 14, express tiers in agent counts rather than dollar amounts. The budget-block check uses `maxBots` vs `minimumViableAgents = 3 * categoryCount`. Show the user "minimum viable: N bots (3 per category)" rather than a dollar amount.

3. **Soul lifecycle notification placement in UI**
   - What we know: UIEX-03 says "notifications to connected users" and the requirement mentions "lifecycle event notifications" with human-readable descriptions.
   - What's unclear: Whether these notifications are a persistent feed, a toast, or appended to the existing activity feed.
   - Recommendation: Use a persistent notification toast that auto-dismisses after 8 seconds. Show in the global layout (`+layout.svelte`) so it appears on all pages. Store last 5 lifecycle events in `$state` for a "recent events" mini-feed accessible from a bell icon in the nav.

4. **Library depth rationale for Army Builder (UIEX-04)**
   - What we know: `agent_classes` + `dna_store` have per-category, per-class bot counts.
   - What's unclear: "Library depth rationale" — is this the count of distinct agents per class per category, or something more complex?
   - Recommendation: Show counts of active agents per category per class from `agent_classes`: "4 Novices, 2 Understudies, 1 Artisan in lead-generation tasks". This gives operators a concrete picture of the available pool.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `services/execution-service/src/routes/sse.ts` — per-connection Pub/Sub SSE pattern
- Codebase: `services/execution-service/src/routes/executions.ts` lines 341-409 — leaderboard endpoint
- Codebase: `services/execution-service/src/queue/god-layer-worker.ts` lines 436-442 — Phase 14 deferral comment
- Codebase: `packages/db/src/schema/agent-classes.ts` — `currentClass`, `isPioneer` columns
- Codebase: `packages/db/src/schema/council-verdicts.ts` — `verdictSummary`, `verdictType`, `status`
- Codebase: `services/ui/src/lib/sse.ts` — `connectSSE()` client pattern
- Codebase: `services/ui/src/routes/executions/[id]/report/+page.svelte` — existing leaderboard table
- Codebase: `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` — existing confirmation panel
- Codebase: `services/ui/src/routes/new-execution/+page.svelte` — existing Army Builder form
- Codebase: `packages/event-schemas/src/bot-events.ts` — Zod event schema pattern
- Codebase: `services/execution-service/src/events/publisher.ts` — publish function pattern
- Codebase: `services/execution-service/src/app.ts` — route registration pattern

### Secondary (MEDIUM confidence)
- Phase 12 decisions: `evidenceLoaded` flag pattern, reject button label, calibration warning colors
- Phase 13 summary: `artisanGraduated` and `isPioneer` are available post-transaction in god-layer-worker

### Tertiary (LOW confidence)
- Army Builder LLM category extraction: inferred from `planner.service.ts` pattern; exact prompt design is discretionary
- Budget tier UI layout: Phase 14 is the first Army Builder implementation; no prior codebase pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; patterns verified in existing codebase
- Architecture: HIGH — SSE pattern, publisher pattern, Svelte 5 runes, Drizzle ORM queries all verified from existing files
- Pitfalls: HIGH — `bots.tier` vs `agent_classes.currentClass` distinction verified from schema; SSE path collision verified from app.ts registration; `evidenceLoaded` guard verified from Phase 12 files
- Army Builder analysis: MEDIUM — LLM call pattern is proven; category extraction prompt design and budget tier UX are new territory

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable stack, 30-day window)
