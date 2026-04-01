# Phase 19: Run View Enhancements - Research

**Researched:** 2026-02-22
**Domain:** SvelteKit UI — bot card live data, activity feed embedding, post-run dashboard, inline verdict confirmation
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

## Summary

Phase 19 enhances two views: the live run view (`/executions/[id]`) and the post-run report (`/executions/[id]/report`). It also requires embedding a live activity feed in the objective hub (`/objectives/[id]`). The work splits into two plans (19-01 and 19-02) as described.

The core challenge is **data availability**. Most of the data required by the requirements (current task description, tool call count, token burn rate, soul tier, pending verdicts per bot) is already available in the database but is not yet surfaced in the `GET /bots/by-execution/:executionId` API response or included in live SSE events. Every enhancement requires either (a) extending an existing API endpoint to return more fields, or (b) querying from the frontend via a new dedicated endpoint.

The second major challenge for RUN-04 is **component reuse**. The existing verdict confirmation UI lives at `/verdicts/[verdictId]/+page.svelte` — a standalone full-page route. Inlining it requires extracting its confirmation logic into a reusable Svelte component (the CONF-* component the requirement references) and using it in the run detail view without navigating away.

No new libraries are needed. Everything is built on the existing stack: Svelte 5 `$state`/`$effect`, the polling pattern from `executions/[id]`, the SSE connection pattern from `sse.ts`, and Drizzle ORM + Fastify on the backend.

**Primary recommendation:** Extend `GET /bots/by-execution/:executionId` to include `currentTaskDescription`, `toolCallCount`, and `tokenBurnRate` fields. Then in 19-01, consume those in the bot card component. For 19-02, add a `GET /executions/:id/pending-verdicts` endpoint returning bots-with-pending-verdicts in one query, and a soul tier distribution section to the report endpoint or a new `/executions/:id/soul-tier-distribution` endpoint.

---

## Standard Stack

### Core (no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | already installed | Reactive UI with `$state`/`$effect`/`$derived` | Project standard |
| SvelteKit | already installed | Routing, `+page.svelte` convention | Project standard |
| Drizzle ORM | already installed | DB queries in backend routes | Project standard |
| Fastify + TypeBox | already installed | Typed API endpoints | Project standard |
| BullMQ | already installed | Task queue (no changes needed) | Project standard |

### No new packages needed
All data required for Phase 19 is already in the database. No new data capture pipeline work is needed — only new API surface and UI components.

---

## Architecture Patterns

### Recommended project structure changes

```
services/ui/src/
├── lib/
│   ├── components/
│   │   ├── SoulTierBadge.svelte       # EXISTS — already reused in 18-02
│   │   ├── SoulInspectorPanel.svelte  # EXISTS
│   │   └── VerdictConfirmPanel.svelte # NEW — extracted from verdicts/[id]/+page.svelte
│   ├── api.ts                         # EXTEND — new getExecutionPendingVerdicts(), getSoulTierDistribution()
│   └── types.ts                       # EXTEND — new interfaces for new API responses
├── routes/
│   ├── executions/[id]/
│   │   └── +page.svelte               # MODIFY — bot card fields, activity feed accessible
│   ├── executions/[id]/report/
│   │   └── +page.svelte               # MODIFY — soul tier distribution panel, pending verdict highlights
│   └── objectives/[id]/
│       └── +page.svelte               # POSSIBLY MODIFY — activity feed already embedded, may need enrichment

services/execution-service/src/routes/
├── bots.ts                            # EXTEND /by-execution — add currentTaskDescription, toolCallCount, tokenBurnRate
└── executions.ts                      # ADD /executions/:id/pending-verdicts endpoint
                                       # or extend /executions/:id/report to include soul tier breakdown
```

### Pattern 1: Extending the bot card polling endpoint

The existing `/bots/by-execution/:executionId` endpoint is already called on a 5-second polling loop. The cleanest implementation for RUN-01 is to extend this endpoint's response to include:
- `currentTaskDescription: string | null` — joined from `tasks` table where `claimed_by_bot_id = bot.id AND status = 'claimed'`
- `toolCallCount: number` — COUNT from `tool_invocations` table where `bot_id = bot.id AND rejected = false`
- `tokenBurnRate: number` — total tokens / active minutes, computed per-bot from `tool_invocations.total_tokens` and `bots.started_at`

**Key insight:** `toolCallCount` and `tokenBurnRate` are already computable from existing tables (`tool_invocations`). The `currentTaskDescription` requires joining `tasks WHERE status = 'claimed' AND claimed_by_bot_id = bot.id`.

**Example backend pattern:**
```typescript
// In bots.ts — extend the GET /by-execution/:executionId query
// Add currentTaskDescription via a subquery or a batch lookup after the main bots query
const taskRows = await db
  .select({ claimedByBotId: tasks.claimedByBotId, description: tasks.description })
  .from(tasks)
  .where(and(eq(tasks.executionId, executionId), eq(tasks.status, 'claimed')));

const taskDescMap = new Map<string, string>();
for (const t of taskRows) {
  if (t.claimedByBotId) taskDescMap.set(t.claimedByBotId, t.description);
}
```

**Warning:** The `inArray` guard pattern is already established in Phase 18 (`botIds.length > 0` before `inArray`). Any new batch lookups MUST follow this pattern.

### Pattern 2: Soul tier distribution on the post-run report

The `/executions/:id/report` endpoint (`buildExecutionReport`) currently returns aggregate stats but no soul tier breakdown. For RUN-03, either:
- Extend the existing report endpoint to include `soulTierDistribution: { novice: number, understudy: number, artisan: number, retired: number }`
- Or query from the frontend directly via a new endpoint

**Preferred approach:** Extend the existing report endpoint. This keeps the report page's data fetching as a single `Promise.all([getExecutionReport(id), getLeaderboard(id)])` call — just add a field to the existing `ExecutionReport` type.

The data source is `agent_classes` table joined through `bots` where `bots.execution_id = executionId`. This is the same join pattern used in the leaderboard endpoint.

```typescript
// Add to buildExecutionReport or directly in /executions/:id/report handler
const soulTierRows = await db
  .select({ currentClass: agentClasses.currentClass, count: sql<number>`cast(count(*) as int)` })
  .from(agentClasses)
  .innerJoin(bots, eq(bots.id, agentClasses.botId))
  .where(eq(bots.executionId, executionId))
  .groupBy(agentClasses.currentClass);
```

### Pattern 3: Pending verdicts per execution (RUN-04)

The existing `/verdicts/pending` endpoint lists ALL pending verdicts across all executions. A new endpoint `GET /executions/:id/pending-verdicts` should return only verdicts for this execution, joined with enough bot info to render the inline confirmation panel.

**Return shape:**
```typescript
{
  verdictId: string;
  botId: string;
  verdictType: 'Promote' | 'Retire';
  weightedConfidenceScore: number;
  verdictSummary: string;
  hasUnresolvedDevilsAdvocate: boolean;
  // full evidence for inline panel — same as VerdictDetail
  devilsAdvocateOutput: unknown;
  performanceJudgeOutput: unknown;
  soulAnalystOutput: unknown;
}[]
```

This is a filter on the existing `GET /verdicts/pending` query, scoped by `executionId`.

### Pattern 4: VerdictConfirmPanel component (RUN-04)

The existing verdict detail page at `/verdicts/[verdictId]/+page.svelte` contains the full confirmation UI: evidence rendering, `doConfirm()`, `doReject()`, buttons, and `timeOnScreenMs` tracking. This must be extracted into a component.

**Component interface:**
```svelte
<!-- VerdictConfirmPanel.svelte -->
<script lang="ts">
  let {
    verdict,       // VerdictDetail
    userId,        // string
    onResolved,    // () => void — called after confirm/reject
    onClose,       // () => void — for dismissing the panel
  }: {
    verdict: VerdictDetail;
    userId: string;
    onResolved: () => void;
    onClose: () => void;
  } = $props();
</script>
```

The `timeOnScreenMs` tracking should start when the component mounts (using `$effect`) — same pattern as the existing verdict page uses `arrivedAt = Date.now()`.

The component reuses `confirmVerdict()` and `rejectVerdict()` from `$lib/api.ts` — no new API calls needed for the verdict actions themselves.

### Pattern 5: Activity feed on the objective hub (RUN-02)

The objective hub (`/objectives/[id]`) already has an embedded activity feed! Inspecting `objectives/[id]/+page.svelte` lines 136–151, there is already a live `activityFeed` state driven by SSE via `connectSSE()` in the `activeRunId` effect.

However, the current activity feed in the objective hub is minimal:
```svelte
<!-- Current: only shows type + time, not detail -->
<span class="activity-type">{event.type.replace(/_/g, ' ')}</span>
<span class="activity-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
```

The execution detail page has a richer activity feed with `formatEventDetail()`. RUN-02 says "accessible directly from the objective hub view without navigating away" — so the activity feed is already embedded, but may need enrichment to be genuinely useful without navigating to the run detail view.

**Interpretation:** RUN-02 requires making the existing embedded feed more useful — adding event detail formatting and a "View full run" link rather than requiring navigation.

### Pattern 6: Svelte 5 reactive patterns (critical)

Based on decisions [17-03]:
- Bot metrics that update in real time MUST use `$state`, NOT `$derived` that depends on the same state
- The polling `$effect` that fetches bots must match the pattern in `executions/[id]/+page.svelte`: fetch immediately, then interval
- SSE effect cleanup: `return () => { clearInterval(interval); cleanup?.(); }`
- The `activityFeed` LIFO slice pattern: `[event, ...activityFeed].slice(0, 5)` for the objective hub, `.slice(0, 100)` for the full run view

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token burn rate | Custom rate tracking | Compute from `tool_invocations.total_tokens` / elapsed minutes from `bots.started_at` | Data already captured |
| Soul tier distribution | New data capture | Query `agent_classes` table | Already populated by Phase 9/13 God Layer |
| Verdict confirmation | New confirmation logic | Extract existing logic from `/verdicts/[id]/+page.svelte` | Avoids duplicating CONF-* logic |
| Soul tier badge rendering | New badge HTML | Reuse `SoulTierBadge.svelte` | Already standardized in 18-02 |
| Class breakdown UI | New chart | Simple count display (same as objectives hub DNA Evolution section) | Phase 17 already has this pattern |

---

## Common Pitfalls

### Pitfall 1: inArray with empty array
**What goes wrong:** PostgreSQL rejects `WHERE x IN ()` — crashes the bot listing endpoint.
**Why it happens:** When an execution has no bots yet, `botIds` is an empty array.
**How to avoid:** Guard all `inArray` calls with `if (botIds.length > 0)` — already established in Phase 18-02.
**Warning signs:** Error: `syntax error at or near ")"` from PostgreSQL.

### Pitfall 2: Svelte 5 infinite re-run in SSE/polling effects
**What goes wrong:** Writing to `$state` inside an `$effect` that reads the same `$state` triggers infinite re-runs.
**Why it happens:** Svelte 5's fine-grained reactivity — effects re-run when their dependencies change.
**How to avoid:** Follow the [17-03] pattern: `activeRunId` is plain `$state`, not `$derived` from `runs`. Don't read bot state inside the effect that writes bot state.
**Warning signs:** Browser console shows repeated network requests; page becomes unresponsive.

### Pitfall 3: tokenBurnRate computed on every poll
**What goes wrong:** Token burn rate computed on the frontend from raw token counts may fluctuate wildly with each poll.
**Why it happens:** `totalTokens / elapsed_minutes` computed at different times gives different rates.
**How to avoid:** Compute token burn rate on the backend in the API endpoint (tokens in the last N minutes, or a rolling rate). Return it as a number.

### Pitfall 4: VerdictConfirmPanel timeOnScreenMs accuracy
**What goes wrong:** `timeOnScreenMs` is 0 or wrong if `arrivedAt` is set before verdict data loads.
**Why it happens:** Setting `arrivedAt = Date.now()` in the wrong place.
**How to avoid:** Set `arrivedAt` when the verdict data is rendered/displayed (when the panel becomes visible), not when the component mounts. This mirrors the existing verdict page which sets `arrivedAt = Date.now()` in the `$effect` that loads the verdict.

### Pitfall 5: Not guarding against bot with no active task
**What goes wrong:** `currentTaskDescription` is null for idle/spawning/stopped bots. If the bot card tries to display it unconditionally, it shows `null` or `undefined`.
**Why it happens:** A bot is only `working` when it has a claimed task.
**How to avoid:** Only render the task description field `{#if bot.currentTaskDescription}`.

### Pitfall 6: Activity feed on objective hub not scoped to current run
**What goes wrong:** The SSE connection is already scoped to `activeRunId`, so events from other runs don't appear. But if `activeRunId` clears when the run ends (it does, per [17-03]), the feed stops. For a completed run, there's no live feed.
**Why it happens:** SSE is only meaningful for live runs.
**How to avoid:** For completed runs, show a "View full activity log" link to `/executions/{id}` rather than an empty feed. The feed is live-only by design.

### Pitfall 7: Pending verdict panel must not navigate away on confirm/reject
**What goes wrong:** The existing verdict page uses `goto('/verdicts')` after confirm/reject. If the extracted component keeps this, it navigates away from the run detail page.
**Why it happens:** Copy-paste from the standalone page.
**How to avoid:** The `VerdictConfirmPanel` component must call `onResolved()` (a prop callback) instead of `goto()`. The parent page then refetches bots/verdicts to update the UI.

---

## Code Examples

### Current bot card polling (executions/[id]/+page.svelte — lines 29-48)
```typescript
// Source: /services/ui/src/routes/executions/[id]/+page.svelte
$effect(() => {
  if (!browser) return;
  const isTerminal = execution?.status === 'completed' || ...;

  getExecutionMetrics(executionId).then(m => { metrics = m; }).catch(() => {});
  getExecutionBots(executionId).then(b => { bots = b; }).catch(() => {});

  if (isTerminal) return;

  const interval = setInterval(() => {
    getExecutionMetrics(executionId).then(m => { metrics = m; }).catch(() => {});
    getExecutionBots(executionId).then(b => { bots = b; }).catch(() => {});
  }, 5000);

  return () => clearInterval(interval);
});
```

### Existing bot card rendering (executions/[id]/+page.svelte — lines 169-206)
```svelte
{#each bots as bot (bot.id)}
  <a href="/executions/{executionId}/bots/{bot.id}" class="bot-card" ...>
    <div class="bot-card-top">
      <span class="bot-id">{bot.id.slice(0, 8)}</span>
      <span class="bot-status-pill bot-status-{bot.status}">{bot.status}</span>
      <SoulTierBadge agentClass={bot.agentClass} />
      <button class="inspect-soul-btn" onclick={...}>Soul</button>
    </div>
    <div class="bot-card-stats">
      <span>{bot.tasksCompleted} done</span>
      ...
    </div>
  </a>
{/each}
```

For RUN-01, add fields like:
```svelte
{#if bot.currentTaskDescription}
  <div class="bot-task-desc">{bot.currentTaskDescription}</div>
{/if}
<div class="bot-live-stats">
  <span>{bot.toolCallCount ?? 0} tool calls</span>
  <span class="stat-sep">·</span>
  <span>{bot.tokenBurnRate?.toFixed(0) ?? '-'} tok/min</span>
</div>
```

### Existing /by-execution endpoint response type
The current `ExecutionBot` TypeScript interface (`types.ts` lines 127-136):
```typescript
export interface ExecutionBot {
  id: string;
  status: 'spawning' | 'idle' | 'working' | 'stopping' | 'stopped' | 'failed';
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  startedAt: string | null;
  errorMessage: string | null;
  agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
}
```

Extend to:
```typescript
export interface ExecutionBot {
  // ... existing fields ...
  currentTaskDescription: string | null;  // NEW
  toolCallCount: number;                   // NEW
  tokenBurnRate: number | null;            // NEW — tokens per minute, null if not enough data
}
```

### Pending verdict component lifecycle
The existing verdict page (verdicts/[verdictId]/+page.svelte) uses:
```typescript
let arrivedAt = $state(0);
$effect(() => {
  arrivedAt = Date.now();
  getVerdict(verdictId).then((v) => { verdict = v; evidenceLoaded = true; });
});

async function doConfirm() {
  const timeOnScreenMs = Date.now() - arrivedAt;
  await confirmVerdict(verdictId, { userId, timeOnScreenMs });
  goto('/verdicts'); // <-- this becomes onResolved() in the component
}
```

### Token burn rate computation (backend)
```typescript
// In GET /bots/by-execution/:executionId
// For each bot, compute token burn rate
const tokenRows = await db
  .select({
    botId: toolInvocations.botId,
    totalTokens: sql<number>`cast(coalesce(sum(${toolInvocations.totalTokens}), 0) as int)`,
  })
  .from(toolInvocations)
  .where(inArray(toolInvocations.botId, botIds))
  .groupBy(toolInvocations.botId);

// tokenBurnRate = totalTokens / activeMinutes
// activeMinutes from bot.startedAt to now (for live bots) or bot.stoppedAt
```

### Soul tier distribution on report page (new UI section)
```svelte
<!-- In report/+page.svelte -->
{#if report.soulTierDistribution}
  <section class="section">
    <h2>Soul Tier Distribution</h2>
    <div class="tier-distribution">
      <div class="tier-item">
        <SoulTierBadge agentClass="Artisan" />
        <span class="tier-count">{report.soulTierDistribution.artisan}</span>
      </div>
      <div class="tier-item">
        <SoulTierBadge agentClass="Understudy" />
        <span class="tier-count">{report.soulTierDistribution.understudy}</span>
      </div>
      <div class="tier-item">
        <SoulTierBadge agentClass="Novice" />
        <span class="tier-count">{report.soulTierDistribution.novice}</span>
      </div>
    </div>
  </section>
{/if}
```

---

## Data Gap Analysis

### What data is available for each requirement

**RUN-01: Bot cards with task description, tool call count, token burn rate, soul tier**
- Soul tier badge: ALREADY IN `ExecutionBot.agentClass` — done in Phase 18
- Current task description: NOT in `/by-execution` response — must join from `tasks` table
- Tool call count: NOT in `/by-execution` response — must count from `tool_invocations` table
- Token burn rate: NOT in `/by-execution` response — must compute from `tool_invocations.total_tokens` / elapsed time
- **Action required:** Extend `/bots/by-execution/:executionId` to include 3 new fields

**RUN-02: Activity feed accessible from objective hub**
- SSE activity feed: ALREADY EMBEDDED in `/objectives/[id]/+page.svelte` (the `live-section` block)
- However the existing feed shows only `event.type` and `event.timestamp`, not the detail
- `formatEventDetail()` from the execution detail page can be adapted for the hub
- **Action required:** Enrich the hub's activity feed to show event detail (not just type)

**RUN-03: Soul tier distribution on post-run report**
- Data exists in `agent_classes` table joined to `bots` by `execution_id`
- The `/executions/:id/report` endpoint (`report-builder.ts`) does NOT currently include this
- The `/executions/:id/leaderboard` endpoint already queries `agentClasses` in batch
- **Action required:** Add `soulTierDistribution` field to the report endpoint/type

**RUN-04: Pending verdict highlights with inline CONF-* panel**
- Pending verdicts queryable from `council_verdicts` WHERE `executionId = :id AND status = 'pending' AND verdictType IN ('Promote', 'Retire')`
- The existing `/verdicts/pending` endpoint does NOT filter by executionId
- The existing verdict detail page has all the confirmation UI
- **Action required:** New backend endpoint `/executions/:id/pending-verdicts`, extract `VerdictConfirmPanel.svelte` from the existing verdict detail page, highlight bots in the run detail view that have pending verdicts

---

## Open Questions

1. **Token burn rate definition**
   - What we know: `tool_invocations.total_tokens` is stored per invocation; `bots.started_at` is available
   - What's unclear: Should burn rate be (total lifetime tokens / lifetime minutes) or (tokens in last 5-minute window)? The latter is more meaningful as a "rate" but harder to compute without time-windowed queries
   - Recommendation: Use lifetime average for MVP (totalTokens / minutesSinceStart). Flag this as a known limitation.

2. **Where exactly should the activity feed link appear on the objective hub (RUN-02)?**
   - What we know: The activity feed is already embedded in the "Live Run" section of the objective hub
   - What's unclear: Does "accessible from the objective hub" mean the current embedded feed is sufficient, or does it require a dedicated link/panel to the full activity log?
   - Recommendation: Enrich the existing embedded feed with event detail + add a "View full activity" link to `/executions/{activeRunId}`. This satisfies "without navigating away" while providing an escape hatch for the full log.

3. **Report endpoint vs. separate endpoint for soul tier distribution (RUN-03)**
   - What we know: The report endpoint calls `buildExecutionReport()` from `report-builder.ts`
   - What's unclear: Should `soulTierDistribution` be added to `ExecutionReport` type and `buildExecutionReport()`, or be a separate API call?
   - Recommendation: Extend `ExecutionReport` type and `buildExecutionReport()`. Keeps the report page as a single data fetch.

4. **VerdictConfirmPanel placement in run detail view (RUN-04)**
   - What we know: The run detail page has bot cards in a grid; it already uses `SoulInspectorPanel` as a slide-in panel
   - What's unclear: Should the verdict panel be inline (expands the bot card) or a slide-in panel like `SoulInspectorPanel`?
   - Recommendation: Follow the `SoulInspectorPanel` pattern — a slide-in panel triggered by a "Verdict pending" button on the bot card. Reuse the existing backdrop/panel CSS structure.

---

## State of the Art

| Old Approach | Current Approach | Implication |
|--------------|------------------|-------------|
| Bot cards only show status + task counts | Phase 18 added soul tier badge | Phase 19 adds task context + metrics on top of Phase 18 |
| Verdict confirmation is a separate full-page route | Phase 12 built the standalone page | Phase 19 extracts it into an embeddable component |
| Activity feed exists only on execution detail page | Phase 17 added minimal feed to objective hub | Phase 19 enriches hub feed with detail |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/services/ui/src/routes/executions/[id]/+page.svelte` — existing bot card rendering, polling pattern, SSE pattern
- `/services/ui/src/routes/executions/[id]/report/+page.svelte` — report page, leaderboard rendering, SoulTierBadge usage
- `/services/ui/src/routes/objectives/[id]/+page.svelte` — objective hub, existing embedded activity feed
- `/services/ui/src/routes/verdicts/[verdictId]/+page.svelte` — full confirmation UI (CONF-* component source)
- `/services/ui/src/lib/types.ts` — ExecutionBot, VerdictDetail, ExecutionReport interfaces
- `/services/ui/src/lib/api.ts` — all existing API client functions
- `/services/ui/src/lib/sse.ts` — connectSSE, event types
- `/services/ui/src/lib/components/SoulTierBadge.svelte` — reusable badge component
- `/services/ui/src/lib/components/SoulInspectorPanel.svelte` — slide-in panel pattern to replicate
- `/services/execution-service/src/routes/bots.ts` — /by-execution endpoint, soul data queries
- `/services/execution-service/src/routes/verdicts.ts` — pending verdicts, confirm/reject logic
- `/services/execution-service/src/routes/executions.ts` — leaderboard query (batch agentClasses pattern)
- `/services/execution-service/src/routes/metrics.ts` — metrics endpoint
- `/packages/db/src/schema/bots.ts` — bots table schema (no currentTask field — must join tasks)
- `/packages/db/src/schema/tasks.ts` — tasks table (description, claimedByBotId, status)
- `/packages/db/src/schema/tool-invocations.ts` — totalTokens, botId
- `/packages/db/src/schema/council-verdicts.ts` — verdictType, status, executionId
- `/packages/event-schemas/src/execution-events.ts` — task_claimed event (has taskId + botId, NOT task description)
- `/services/execution-service/src/performance/metrics-computer.ts` — existing token/tool call computation logic

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, codebase is fully inspected
- Architecture: HIGH — all patterns verified against existing code
- Pitfalls: HIGH — derived from established decisions [17-03], [18-01], [18-02] and direct code inspection
- Data gaps: HIGH — confirmed by reading each relevant API endpoint and schema

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — stable codebase, no fast-moving dependencies)
