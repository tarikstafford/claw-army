# Phase 6: UI Command Center - Research

**Researched:** 2026-02-18
**Domain:** Svelte 5 / SvelteKit 2 frontend, Fastify SSE endpoint, GCP Pub/Sub → SSE bridge, real-time dashboard
**Confidence:** HIGH (stack verified against npm registry; backend codebase read directly; patterns verified against official docs)

---

## Summary

Phase 6 adds a Svelte 5 / SvelteKit 2 frontend to a fully built backend. All the data needed already exists — the execution-service at port 3001 exposes every endpoint the UI needs: POST /executions, GET /executions/:id, GET /executions/:id/bots, GET /executions/:id/tasks, GET /executions/:id/report, GET /executions/:id/leaderboard. What is missing is: (1) a Pub/Sub → SSE bridge endpoint so the frontend can receive live events, (2) a per-bot detail endpoint, (3) a billing history endpoint, and (4) the SvelteKit SPA itself.

The event infrastructure uses GCP Pub/Sub (not Redis pub/sub as the roadmap label suggests — Redis is only used for BullMQ task queue and budget enforcement Lua scripts). The correct SSE bridge strategy is a new Fastify subscription on the existing Pub/Sub topics that forwards matching events to the SSE response stream. One GCP Pub/Sub subscription is created per SSE client connection, opened when the SSE connection opens and closed when it disconnects. This is viable at MVP scale (single-tenant, small concurrent user count). The in-process EventEmitter fan-out approach would be cleaner but requires a shared subscription per execution already running — the GCP Pub/Sub per-connection approach is simpler for MVP.

The Svelte frontend is a pure SPA (no SSR needed — single-tenant, no SEO requirements, backend is a separate Fastify service). Use SvelteKit 2 with `adapter-static` and `ssr = false` on the root layout. All state management uses Svelte 5 runes (`$state`, `$effect`, `$derived`). The `EventSource` browser API connects to the SSE endpoint. CORS must be enabled on the Fastify backend via `@fastify/cors`.

**Primary recommendation:** Add one new SSE route module to the execution-service (not a new service), scaffold a `services/ui` SvelteKit SPA that calls the execution-service directly, and add `@fastify/cors` + `@fastify/sse` to the execution-service.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | ^5.51.3 | Frontend framework | Project decision (user preference in PROJECT.md) |
| @sveltejs/kit | ^2.52.0 | SvelteKit routing, build tooling | Official Svelte meta-framework |
| @sveltejs/adapter-static | ^3.0.10 | SPA build output (no Node server) | Frontend calls Fastify directly; SSR not needed |
| vite | (bundled with SvelteKit) | Build + dev server | Bundled with SvelteKit |
| @fastify/sse | ^0.4.0 | SSE plugin for Fastify 5 | Official Fastify SSE plugin, peer deps `fastify ^5.x` |
| @fastify/cors | ^11.2.0 | CORS headers for browser requests | Official Fastify CORS plugin; required for browser → Fastify cross-origin requests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | ^5.9.3 | Type safety | Match monorepo version (consistent with other services) |
| @sveltejs/vite-plugin-svelte | (bundled with kit) | Vite Svelte transform | Auto-included via SvelteKit |
| @types/node | latest | Node type definitions | For build tooling in SvelteKit |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/sse | reply.raw manual SSE | reply.raw bypasses Fastify hooks (CORS, logging); @fastify/sse is simpler and correct |
| adapter-static | adapter-node | adapter-node requires running a Node SSR server; unnecessary overhead when there's no SSR |
| Svelte 5 runes + EventSource | sveltekit-sse library | sveltekit-sse is for SvelteKit SSE servers, not external backends; native EventSource is simpler |
| Per-connection Pub/Sub subscription | In-process EventEmitter fan-out | Fan-out needs a module-level subscription registry; per-connection is simpler for MVP |

**Installation (execution-service additions):**
```bash
pnpm --filter @claw/execution-service add @fastify/sse @fastify/cors
```

**Installation (new SvelteKit app):**
```bash
pnpm dlx sv create services/ui
# Choose: SvelteKit minimal, TypeScript
cd services/ui
pnpm add -D @sveltejs/adapter-static
```

---

## Architecture Patterns

### Recommended Project Structure

```
services/
├── execution-service/
│   └── src/
│       ├── app.ts                    (register @fastify/cors, @fastify/sse)
│       └── routes/
│           ├── executions.ts         (existing — add billing history query)
│           ├── sse.ts                (NEW — SSE bridge: subscribe Pub/Sub → forward to SSE)
│           └── bots.ts               (NEW — per-bot detail endpoint)
└── ui/                               (NEW — SvelteKit SPA)
    ├── src/
    │   ├── routes/
    │   │   ├── +layout.svelte        (app shell: nav)
    │   │   ├── +layout.js            (export const ssr = false)
    │   │   ├── +page.svelte          (redirect to /new-execution)
    │   │   ├── new-execution/
    │   │   │   └── +page.svelte      (06-02: New Execution form)
    │   │   ├── executions/
    │   │   │   ├── [id]/
    │   │   │   │   ├── +page.svelte  (06-03: Live Execution View)
    │   │   │   │   ├── report/
    │   │   │   │   │   └── +page.svelte (06-04: Post-Execution Dashboard)
    │   │   │   │   └── bots/
    │   │   │   │       └── [botId]/
    │   │   │   │           └── +page.svelte (06-05: Bot Detail View)
    │   │   └── billing/
    │   │       └── +page.svelte      (06-06: Usage & Billing)
    │   └── lib/
    │       ├── api.ts                (fetch wrappers for execution-service endpoints)
    │       └── sse.ts                (EventSource connection helper)
    ├── svelte.config.js
    ├── vite.config.ts
    └── package.json
```

### Pattern 1: GCP Pub/Sub → SSE Bridge (Fastify Route)

**What:** A new Fastify SSE route `GET /executions/:id/events` that opens a GCP Pub/Sub subscription, forwards matching events to the SSE stream, and closes the subscription when the client disconnects.

**When to use:** Any client that wants real-time events for a specific execution.

**Key implementation decisions:**
- Create a NEW Pub/Sub subscription per SSE connection using a unique subscription name (e.g., `sse-{executionId}-{uuid}`) — do NOT reuse billing-engine or guardrail-watchdog subscriptions
- Subscribe to MULTIPLE topics: `execution-lifecycle`, `task-lifecycle`, `bot-lifecycle`, `guardrail-events`
- Filter messages to only forward events where `executionId` matches the URL param
- When client disconnects (`reply.sse.onClose()`), call `subscription.close()` on all subscriptions AND optionally delete the temporary Pub/Sub subscriptions to avoid quota leakage

**Example:**
```typescript
// Source: @fastify/sse 0.4.0 API + @google-cloud/pubsub 5.2.3
import { PubSub } from '@google-cloud/pubsub';
import { randomUUID } from 'node:crypto';

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID ?? 'claw-local' });

fastify.get('/:id/events', { sse: true }, async (request, reply) => {
  const { id: executionId } = request.params;
  const connId = randomUUID();

  // Create a per-connection subscription on each topic we care about
  const topicNames = [
    process.env.EXECUTION_LIFECYCLE_TOPIC ?? 'execution-lifecycle',
    process.env.TASK_LIFECYCLE_TOPIC ?? 'task-lifecycle',
    process.env.BOT_LIFECYCLE_TOPIC ?? 'bot-lifecycle',
    process.env.GUARDRAIL_EVENTS_TOPIC ?? 'guardrail-events',
  ];

  const subscriptions = await Promise.all(
    topicNames.map(async (topicName) => {
      const subName = `sse-${executionId.slice(0, 8)}-${connId.slice(0, 8)}-${topicName}`;
      await pubsub.topic(topicName).createSubscription(subName);
      return pubsub.subscription(subName);
    })
  );

  // Forward matching events to SSE stream
  const handler = async (message: Message) => {
    try {
      const payload = JSON.parse(message.data.toString());
      if (payload.executionId !== executionId) {
        message.ack(); // not for this execution
        return;
      }
      if (reply.sse.isConnected) {
        await reply.sse.send({
          event: payload.type,
          data: JSON.stringify(payload),
        });
      }
      message.ack();
    } catch {
      message.nack();
    }
  };

  subscriptions.forEach(sub => sub.on('message', handler));

  // Cleanup on client disconnect
  reply.sse.onClose(async () => {
    subscriptions.forEach(sub => sub.removeAllListeners());
    await Promise.allSettled(subscriptions.map(sub => sub.close()));
    // Optionally delete temporary subscriptions to avoid quota buildup
    await Promise.allSettled(subscriptions.map(sub => sub.delete()));
  });
});
```

**Local dev note:** The GCP Pub/Sub emulator (already in docker-compose.dev.yml at port 8085) auto-creates topics AND subscriptions when they don't exist. The subscription.delete() call should be guarded or skipped in tests since the emulator handles cleanup differently.

### Pattern 2: CORS Registration in app.ts

**What:** Register `@fastify/cors` before routes so the browser's SvelteKit SPA at `localhost:5173` can call the Fastify backend at `localhost:3001`.

**Example:**
```typescript
// Source: @fastify/cors 11.2.0 API
import cors from '@fastify/cors';

// In buildApp() — register BEFORE routes
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
});
```

**Note:** In production, `CORS_ORIGIN` should be the deployed UI URL. For local dev, `http://localhost:5173` (Vite dev server default).

### Pattern 3: @fastify/sse Plugin Registration

**What:** Register `@fastify/sse` once in `buildApp()` to enable the `{ sse: true }` route option and `reply.sse` API.

**Example:**
```typescript
// Source: @fastify/sse 0.4.0 API
import sse from '@fastify/sse';

// In buildApp() — register before SSE routes
await app.register(sse);
```

### Pattern 4: SvelteKit SPA Configuration

**What:** Configure SvelteKit as a pure SPA (no SSR) with adapter-static.

**Example:**
```javascript
// svelte.config.js — Source: svelte.dev/docs/kit/single-page-apps
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({ fallback: '200.html' })
  }
};
```

```javascript
// src/routes/+layout.js — disables SSR for ALL routes
export const ssr = false;
```

### Pattern 5: Svelte 5 Runes SSE Client State

**What:** Use `$state` for reactive data and `$effect` for EventSource lifecycle management in Svelte 5 components. EventSource is browser-only — wrap in `browser` check.

**Example:**
```svelte
<!-- Source: svelte.dev runes docs + MDN EventSource API -->
<script lang="ts">
  import { browser } from '$app/environment';

  let status = $state<string>('queued');
  let activeBotCount = $state(0);
  let budgetRemainingCents = $state(0);
  let activityFeed = $state<ActivityEvent[]>([]);

  const { executionId } = $props();

  $effect(() => {
    if (!browser) return;

    const es = new EventSource(`http://localhost:3001/executions/${executionId}/events`);

    es.addEventListener('execution_status_changed', (e) => {
      const payload = JSON.parse(e.data);
      status = payload.toStatus;
    });

    es.addEventListener('task_claimed', (e) => {
      const payload = JSON.parse(e.data);
      activityFeed = [...activityFeed, { type: 'task_claimed', ...payload }].slice(-100);
    });

    es.addEventListener('guardrail_triggered', (e) => {
      const payload = JSON.parse(e.data);
      activityFeed = [...activityFeed, { type: 'guardrail_triggered', isAlert: true, ...payload }].slice(-100);
    });

    es.onerror = () => {
      // EventSource auto-reconnects on error — no manual retry needed
    };

    return () => es.close(); // cleanup on component destroy
  });
</script>
```

### Pattern 6: API Client Module

**What:** A centralized `lib/api.ts` module with typed fetch wrappers for all execution-service endpoints.

**Example:**
```typescript
// services/ui/src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function createExecution(body: {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  allowedTools: string[];
}) {
  const res = await fetch(`${BASE}/executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create execution: ${res.status}`);
  return res.json() as Promise<{ executionId: string; status: 'queued' }>;
}

export async function getExecutionReport(executionId: string) {
  const res = await fetch(`${BASE}/executions/${executionId}/report`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
}
```

### Anti-Patterns to Avoid

- **Using `reply.raw` for SSE:** Bypasses Fastify lifecycle hooks including CORS. Use `@fastify/sse` instead.
- **One Pub/Sub subscription per topic per server (not per connection):** This means ALL browsers watching different executions receive all events — you'd have to filter client-side and forward to the right SSE stream via an in-memory registry. This works but adds complexity. The per-connection subscription is simpler for MVP.
- **Forgetting to delete temporary Pub/Sub subscriptions:** GCP has a quota on subscriptions per project. If SSE connections drop without cleanup, subscriptions accumulate. Always call `subscription.delete()` in the `onClose` handler.
- **Using Svelte stores instead of runes:** Svelte 5 runes (`$state`, `$effect`) are the current pattern. Svelte stores still work but are the legacy approach.
- **Server-side `+page.server.js` files in SPA mode:** SPA mode with `ssr = false` and adapter-static cannot use `+page.server.js` or `+server.js` files (no Node.js server at runtime). All data fetching must happen client-side.
- **Hardcoding API URL:** Use `VITE_API_URL` env var. Vite only exposes env vars prefixed with `VITE_` to the browser.

---

## What Backend Endpoints Already Exist vs What Needs to Be Built

### Already Built (Phase 1–5)

| Endpoint | Purpose | UI Screen |
|----------|---------|-----------|
| `POST /executions` | Create execution | New Execution form (06-02) |
| `GET /executions/:id` | Execution status | Live view status panel (06-03) |
| `GET /executions/:id/bots` | Bot list | Live view bot count (06-03) |
| `GET /executions/:id/report` | Execution summary | Post-Execution Dashboard (06-04) |
| `GET /executions/:id/leaderboard` | Bot leaderboard | Post-Execution Dashboard (06-04) |

### Needs to Be Built in Phase 6

| New Endpoint | Purpose | Plan |
|--------------|---------|------|
| `GET /executions/:id/events` | SSE bridge | 06-01 |
| `GET /executions/:id/metrics` | Live bot-hours, estimated cost, budget remaining for status panel | 06-01 or 06-03 |
| `GET /bots/:id/detail` | Per-bot metrics + step trace | 06-05 (or add to executions route) |
| `GET /billing/history` | List all executions with cost/bot-hours/task count | 06-06 |
| `GET /billing/summary` | Monthly bot-hours and spend totals | 06-06 |

### Live Metrics Endpoint Design

The Live Execution View needs: active bot count, bot-hours consumed, budget remaining, estimated cost (METR-04). These are not directly served by existing endpoints. A new `GET /executions/:id/metrics` route should:
- Query `bots` for active bot count (`WHERE status IN ('spawning','idle','working')`)
- Query `telemetry` for `SUM(metric_value) WHERE metric_name = 'bot_hours'`
- Query Redis for `budget:spend:{executionId}` and `budget:cap:{executionId}` (already available from billing-engine)
- Return: `{ activeBotCount, totalBotHours, spentCents, budgetCapCents, remainingCents, estimatedCostCents }`

**Note:** IORedis is already imported in billing-engine.ts. The metrics route can use the same Redis connection or create a read-only client.

### Per-Bot Detail Endpoint Design

`GET /bots/:botId/detail` should return:
- From `bots` table: status, startedAt, stoppedAt, compositeScore, tier
- From `computeBotMetrics()` (already implemented in `metrics-computer.ts`): all BotMetrics fields
- From `tool_invocations` WHERE `bot_id = :botId` ORDER BY `invoked_at`: step trace array (for optional step trace, UI-09)

The `computeBotMetrics` function already exists at `services/execution-service/src/performance/metrics-computer.ts` and returns a complete `BotMetrics` struct.

### Billing History Endpoint Design

`GET /billing/history` needs: list of executions with `totalCostCents`, `totalBotHours`, `taskCount` per run.

Data sources (all already populated by Phase 4–5):
- `billing_events` for `SUM(amount_cents) GROUP BY execution_id WHERE event_type = 'tool_invoked'`
- `telemetry` for `SUM(metric_value) GROUP BY execution_id WHERE metric_name = 'bot_hours'`
- `tasks` for `COUNT(*) GROUP BY execution_id WHERE status = 'completed'`

This is a JOIN query across three tables. For MVP, compute on demand (same pattern as report-builder.ts).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE endpoint in Fastify | Custom `reply.raw.write()` loop | `@fastify/sse` | reply.raw bypasses CORS hooks; plugin handles keep-alive, connection management |
| CORS headers | Manual `reply.header()` calls | `@fastify/cors` | Handles preflight OPTIONS requests, varied origin configs |
| SSE auto-reconnect | Custom WebSocket or polling fallback | Native browser EventSource | EventSource auto-reconnects on disconnect with exponential backoff |
| Svelte reactive state | Writable stores | Svelte 5 `$state` runes | Runes are the current Svelte 5 pattern; stores are legacy |
| API type definitions | Duplicating shared-types in UI | `@claw/shared-types` (workspace) | Already defined; import directly |
| Pub/Sub subscription cleanup | Memory leaks | `subscription.close()` + `subscription.delete()` in `onClose` | Subscriptions persist in GCP even after connection closes |

**Key insight:** The backend data layer is complete. Phase 6 is primarily wiring: expose existing data via two new endpoints, add SSE bridge, build Svelte screens that call the REST endpoints + EventSource.

---

## Common Pitfalls

### Pitfall 1: Temporary Pub/Sub Subscriptions Not Deleted

**What goes wrong:** SSE connections open, a subscription is created, the connection closes, but `subscription.delete()` is never called. Over time, GCP accumulates orphan subscriptions hitting the project subscription quota (10,000 per project by default).

**Why it happens:** `onClose` cleanup is easy to forget; the emulator silently drops connections without creating this problem locally.

**How to avoid:** Always call `await subscription.delete()` inside `reply.sse.onClose()`. Wrap in `Promise.allSettled` so one failure doesn't block others.

**Warning signs:** GCP console shows growing number of subscriptions with `sse-` prefix; Pub/Sub quota errors.

### Pitfall 2: CORS Not Registered Before Routes

**What goes wrong:** Browser receives `blocked by CORS policy` errors on all API calls; SSE connection fails immediately.

**Why it happens:** `@fastify/cors` must be registered before route plugins. Fastify plugin registration order matters.

**How to avoid:** Register `cors` and `sse` plugins at the top of `buildApp()` before `app.register(executionsRoutes, ...)`.

### Pitfall 3: SSE EventSource Opens on Server (SSR)

**What goes wrong:** SvelteKit attempts to evaluate `new EventSource(...)` during server-side rendering, which throws `ReferenceError: EventSource is not defined`.

**Why it happens:** Even with `ssr = false` in the root layout, nested `$effect` or `onMount` might execute during hydration if SSR is accidentally re-enabled for a route.

**How to avoid:** Wrap all `EventSource` usage with `if (!browser) return;` from `$app/environment`. The `$effect` pattern already handles this if you return early when `!browser`.

### Pitfall 4: Pub/Sub Emulator vs GCP Subscription Delete

**What goes wrong:** `subscription.delete()` throws an error in local dev because the emulator handles subscription lifecycle differently; the SSE connection appears to fail.

**Why it happens:** The Pub/Sub emulator auto-creates subscriptions and may throw on `delete()` if the subscription doesn't exist or was already cleaned up.

**How to avoid:** Wrap `subscription.delete()` in try/catch and log the error — it's non-fatal. Use `Promise.allSettled()` not `Promise.all()`.

### Pitfall 5: Live Metrics from Database vs Redis

**What goes wrong:** Budget remaining reads from the database (`billing_events` SUM) instead of from Redis `budget:spend:{executionId}`, giving stale data (DB writes lag behind Redis atomic INCRBY).

**Why it happens:** The authoritative budget spend is tracked in Redis (billing-engine.ts uses `enforceAtomicBudget()`). The DB `billing_events` table is the audit trail, not the live counter.

**How to avoid:** For the live metrics endpoint, read `budget:spend:{executionId}` and `budget:cap:{executionId}` from Redis (not from DB aggregation). IORedis is already available in execution-service.

### Pitfall 6: Activity Feed Ordering

**What goes wrong:** Events from different Pub/Sub topics arrive out of order. The UI shows task_completed before task_claimed.

**Why it happens:** Multiple Pub/Sub subscriptions are polled concurrently; network/processing variance between topics means timestamp ordering is not guaranteed.

**How to avoid:** Include `timestamp` in every event payload (all existing event schemas already have this field). Sort the activity feed client-side by `timestamp` after insertion, OR display with "received order" and include timestamps so users can interpret ordering themselves.

### Pitfall 7: @fastify/sse onClose Not Called for Abnormal Disconnects

**What goes wrong:** If a client hard-disconnects (browser tab crash, network failure), `onClose` may fire late or not at all, leaving subscriptions open.

**Why it happens:** TCP keep-alive behavior varies. The SSE connection may linger for minutes before the server detects the disconnect.

**How to avoid:** Additionally listen on `request.raw.on('close', ...)` as a backup cleanup trigger alongside `reply.sse.onClose()`. Both should call the same cleanup function.

---

## Code Examples

Verified patterns from official sources and verified codebase:

### @fastify/sse Route Registration and Event Sending

```typescript
// Source: @fastify/sse 0.4.0 README + verified via npm registry
import sse from '@fastify/sse';

const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
await app.register(sse);

app.get('/events', { sse: true }, async (request, reply) => {
  reply.sse.onClose(() => {
    // cleanup subscriptions
  });

  if (reply.sse.isConnected) {
    await reply.sse.send({
      event: 'bot_started',
      data: JSON.stringify({ botId: '...', executionId: '...' }),
      id: '1',
    });
  }
});
```

### @fastify/cors Registration

```typescript
// Source: @fastify/cors 11.2.0
import cors from '@fastify/cors';

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
});
```

### SvelteKit SPA Root Layout

```javascript
// Source: svelte.dev/docs/kit/single-page-apps
// src/routes/+layout.js
export const ssr = false;
```

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';
export default {
  kit: {
    adapter: adapter({ fallback: '200.html' })
  }
};
```

### Svelte 5 Runes EventSource Pattern

```svelte
<!-- Source: svelte.dev/docs/svelte/runes + MDN EventSource -->
<script lang="ts">
  import { browser } from '$app/environment';

  let events = $state<string[]>([]);

  $effect(() => {
    if (!browser) return;
    const es = new EventSource('/executions/123/events');
    es.addEventListener('task_claimed', (e) => {
      events = [...events, e.data].slice(-50);
    });
    return () => es.close();
  });
</script>

{#each events as event}
  <div>{event}</div>
{/each}
```

### Bot Detail Route Using Existing metrics-computer.ts

```typescript
// Source: services/execution-service/src/performance/metrics-computer.ts
// GET /bots/:botId/detail — return BotMetrics + tool_invocations step trace
import { computeBotMetrics } from '../performance/metrics-computer';

fastify.get('/:botId/detail', { schema: { params: ... } }, async (request, reply) => {
  const { botId } = request.params;
  const metrics = await computeBotMetrics(executionId, botId);  // already implemented

  const steps = await db
    .select()
    .from(toolInvocations)
    .where(eq(toolInvocations.botId, botId))
    .orderBy(toolInvocations.invokedAt);

  return reply.send({ metrics, steps });
});
```

### Billing History Query Pattern

```typescript
// Source: derived from billing-engine.ts + report-builder.ts patterns in codebase
// GET /billing/history — all executions with rolled-up cost/bot-hours/tasks
const rows = await db
  .select({
    executionId: executions.id,
    objective: executions.objective,
    status: executions.status,
    createdAt: executions.createdAt,
    totalCostCents: sql<number>`
      cast(coalesce(
        (SELECT SUM(be.amount_cents)
         FROM billing_events be
         WHERE be.execution_id = ${executions.id} AND be.event_type = 'tool_invoked'), 0
      ) as int)`,
  })
  .from(executions)
  .orderBy(sql`${executions.createdAt} DESC`);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 3/4 reactive stores (`writable`, `readable`) | Svelte 5 runes (`$state`, `$effect`, `$derived`) | Svelte 5 released Oct 2024 | Runes are the current API; stores still work but are legacy |
| `npm init svelte` | `pnpm dlx sv create` | SvelteKit 2 / 2025 CLI | New `sv` CLI is the official tool |
| `npm create svelte@latest` | `npx sv create` | 2024/2025 | Both work; `sv create` is canonical |
| reply.raw for Fastify SSE | `@fastify/sse` plugin | Released for Fastify 5 support (v0.4.0, ~3mo ago) | Official plugin, correct lifecycle integration |
| `fastify-cors` (unofficial) | `@fastify/cors` (v11.2.0) | Moved to fastify org | `@fastify/cors` is the official package |

**Deprecated/outdated:**
- `fastify-sse` (lolo32) and `fastify-sse-v2` (mpetrunic): Third-party plugins, not the official `@fastify/sse` — do not use
- Svelte writable stores for component state: Replaced by `$state` rune in Svelte 5 — use runes for new code
- `adapter-node` for static SPA: Use `adapter-static` — no need for a Node server for a pure frontend SPA

---

## Critical Architecture Decision: SSE Bridge Strategy

The roadmap labels this "Redis pub/sub to SSE bridge — Memorystore fan-out" but the actual event infrastructure uses GCP Pub/Sub (not Redis pub/sub). Redis is used only for BullMQ task queue and atomic budget enforcement. There is no Redis Pub/Sub (SUBSCRIBE/PUBLISH) anywhere in the codebase.

**The correct approach for the SSE bridge:**

**Option A — Per-connection Pub/Sub subscription (recommended for MVP):**
- Create 4 temporary Pub/Sub subscriptions per SSE connection (execution-lifecycle, task-lifecycle, bot-lifecycle, guardrail-events)
- Filter messages by `executionId` before forwarding to SSE
- Delete subscriptions when SSE connection closes
- Clean, simple, no server-side state
- Weakness: GCP subscription quota; slightly higher latency; must handle emulator subscription deletion edge case

**Option B — In-process EventEmitter fan-out:**
- Single Pub/Sub subscription per topic per server instance (module-level singletons)
- On each message, emit to a Node.js EventEmitter keyed by `executionId`
- Each SSE connection adds a listener to the EventEmitter for its execution
- Handles multi-viewer scenario cleanly; fewer GCP subscriptions
- Weakness: More complex server-side state; requires ensuring subscriptions are started on server startup

For MVP (single-tenant, likely ≤2 concurrent viewers), **Option A** is simpler to implement correctly. The planner should implement Option A. Option B can be refactored in later iteration.

---

## Open Questions

1. **How should the pnpm workspace handle the SvelteKit UI service?**
   - What we know: `pnpm-workspace.yaml` includes `services/*` — `services/ui` will be auto-included
   - What's unclear: SvelteKit's `package.json` has `"type": "module"` but SvelteKit config files use ESM syntax — this should be compatible with the monorepo's `"type": "module"` root
   - Recommendation: Scaffold with `pnpm dlx sv create services/ui`, verify it compiles in the monorepo context; the existing services already use ESM (`"type": "module"`)

2. **Does the GCP Pub/Sub emulator support subscription delete?**
   - What we know: The emulator auto-creates subscriptions on first use and is already in docker-compose.dev.yml
   - What's unclear: Whether `subscription.delete()` succeeds on the emulator or throws
   - Recommendation: Wrap `subscription.delete()` in try/catch. This is non-fatal — the emulator handles cleanup on its own.

3. **Where does the billing history endpoint live?**
   - What we know: The execution-service has all the data; billing-related endpoints could go in a new `routes/billing.ts` or extend `routes/executions.ts`
   - What's unclear: Whether a separate `/billing` prefix or `/executions` prefix is better
   - Recommendation: Create `routes/billing.ts` registered at prefix `/billing` — separates concerns cleanly and avoids bloating `routes/executions.ts`

4. **Should the live metrics endpoint poll or SSE-push?**
   - What we know: SSE events provide activity feed updates; numeric metrics (bot-hours, spend) require querying Redis and DB on demand
   - What's unclear: Whether to add a separate `GET /executions/:id/metrics` HTTP endpoint (polled every N seconds by the UI) or include metrics in the SSE stream as a `metrics_update` event type
   - Recommendation: Add a separate `GET /executions/:id/metrics` endpoint; poll every 5 seconds from the UI using `setInterval` inside `$effect`. This decouples metrics polling from the event stream and simplifies the SSE bridge.

5. **What tool names are available for the multi-select in the New Execution form?**
   - What we know: `allowedTools` is a `string[]` field on executions. The known tools are `llm_call`, `fetch_url`, `write_file` (from Phase 3)
   - What's unclear: Whether the tool list should be hardcoded in the UI or fetched from a backend endpoint
   - Recommendation: Hardcode `['llm_call', 'fetch_url', 'write_file']` in the UI for MVP — these are the only tools implemented and no dynamic tool registry endpoint exists

---

## Sources

### Primary (HIGH confidence)

- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/events/publisher.ts` — confirmed GCP Pub/Sub (NOT Redis pub/sub) is the event bus
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/events/billing-engine.ts` — confirmed Redis IORedis is for budget/dedup only; Pub/Sub for events
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/routes/executions.ts` — all existing API endpoints confirmed
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/performance/metrics-computer.ts` — `computeBotMetrics()` confirmed; reusable for bot detail endpoint
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/performance/report-builder.ts` — `buildExecutionReport()` confirmed; billing history can use same pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/tool-invocations.ts` — step trace fields (tool_name, duration_ms, total_tokens, request_summary, response_summary, invoked_at) confirmed
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/bots.ts` — composite_score, tier columns confirmed from Phase 5 migration
- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/STATE.md` — GCP Pub/Sub for events confirmed; Redis for BullMQ/budget only; Phase 5 complete
- `https://registry.npmjs.org/@fastify/sse/latest` — version 0.4.0, peerDeps `fastify ^5.x` confirmed
- `https://registry.npmjs.org/svelte/latest` — version 5.51.3 confirmed
- `https://registry.npmjs.org/@sveltejs/kit/latest` — version 2.52.0 confirmed
- `https://registry.npmjs.org/@sveltejs/adapter-static/latest` — version 3.0.10, peerDeps `@sveltejs/kit ^2.0.0` confirmed
- `https://svelte.dev/docs/kit/single-page-apps` — SPA configuration (ssr=false, fallback='200.html') confirmed

### Secondary (MEDIUM confidence — multiple sources agree)

- `@fastify/cors` v11.2.0 — confirmed via npm search; Fastify v5 compatible (multiple sources)
- `@fastify/sse` API (`reply.sse.send()`, `reply.sse.onClose()`, `reply.sse.isConnected`) — confirmed via @fastify/sse README fetch
- Svelte 5 `$state`/`$effect` runes pattern for EventSource — confirmed via official Svelte docs + community sources
- `pnpm dlx sv create` as scaffold command — confirmed via svelte.dev/docs/cli/sv-create

### Tertiary (LOW confidence — single source, validate before using)

- Pub/Sub emulator subscription delete behavior — unverified; wrap in try/catch per precaution
- In-process EventEmitter fan-out as alternative to per-connection subscriptions — not verified with load test; deferred to post-MVP

---

## Metadata

**Confidence breakdown:**
- Standard stack (Svelte 5, SvelteKit 2, @fastify/sse, @fastify/cors): HIGH — verified via npm registry
- GCP Pub/Sub → SSE bridge strategy: HIGH — confirmed by reading actual event publisher code
- Architecture (where new endpoints go, per-connection subscription model): HIGH — follows existing patterns exactly
- Svelte 5 runes patterns: MEDIUM — verified against official docs; no working codebase example in this project yet
- Pub/Sub emulator subscription cleanup: LOW — unverified; treat as uncertain

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable domain; Svelte 5 runes API is stable; @fastify/sse is stable)
