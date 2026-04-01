# Phase 34: API Alignment and SSE Verification - Research

**Researched:** 2026-03-03
**Domain:** Fastify route registration, Server-Sent Events via @fastify/sse + GCP Pub/Sub, SvelteKit API alignment
**Confidence:** HIGH (all findings based on direct codebase inspection)

## Summary

Phase 34 is primarily a **verification and gap-filling phase**, not a greenfield build. The backend routes and UI client code already exist and are largely aligned. The work is to audit the mapping, identify and close the few real gaps, then verify that SSE streams actually deliver events in the browser.

All four Ring Leader `by-execution/:executionId/*` routes are registered in `services/execution-service/src/routes/ring-leader.ts` and registered under the `/ring-leader` prefix in `app.ts`. The UI's `api.ts` calls the correct paths. **No path misalignment exists for the Ring Leader routes.** The only structural gap found is that the `BILLING_EVENTS_TOPIC` is published to by the Billing Engine but is **not subscribed to** in `routes/sse.ts`, meaning `billing_event` and `budget_exceeded` events never reach the UI SSE activity feed even though the UI client listens for them.

The two SSE endpoints (`GET /executions/:id/events` and `GET /events/lifecycle`) are correctly implemented using `@fastify/sse` v0.4.0 (peer-compatible with Fastify v5). The `verdicts/calibration` route exists and returns `{ total, confirmed, rate, warningTriggered }` as required. The Fastify route-ordering concern (static `/calibration` vs parametric `/:verdictId`) is not an issue — Fastify resolves static segments before parametric ones regardless of registration order.

**Primary recommendation:** Add `BILLING_EVENTS_TOPIC` to the SSE subscription list in `routes/sse.ts`, then write an integration smoke test that verifies each of the four phase requirements can return data or stream events. No route renames or UI changes are needed.

## Standard Stack

### Core (already in use, no new installs needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `fastify` | ^5.7.4 | HTTP server | Already installed |
| `@fastify/sse` | ^0.4.0 | SSE plugin (Fastify v5 compatible) | Already installed, confirmed peer-dep match |
| `@google-cloud/pubsub` | ^5.2.3 | Pub/Sub for SSE message bus | Already installed |
| `@fastify/type-provider-typebox` | ^6.1.0 | TypeBox schema validation | Already installed |

**No new dependencies required for this phase.**

## Architecture Patterns

### Route Registration Pattern (as used in this codebase)

Routes are registered in `app.ts` with a prefix. Each plugin file uses relative paths. The resolved paths are:

```
app.register(ringLeaderRoutes, { prefix: '/ring-leader' });
  → GET /ring-leader/runs/:runId/manifest
  → GET /ring-leader/runs/by-execution/:executionId
  → GET /ring-leader/runs/by-execution/:executionId/state
  → GET /ring-leader/runs/by-execution/:executionId/events
  → GET /ring-leader/runs/by-execution/:executionId/synthesis

app.register(sseRoutes, { prefix: '/executions' });
  → GET /executions/:id/events

app.register(lifecycleSseRoutes, { prefix: '/events' });
  → GET /events/lifecycle

app.register(verdictsRoutes, { prefix: '/verdicts' });
  → GET /verdicts/pending
  → GET /verdicts/:verdictId
  → POST /verdicts/:verdictId/confirm
  → POST /verdicts/:verdictId/reject
  → GET /verdicts/calibration        ← static, resolves before /:verdictId
```

### UI Client Call Pattern (as used in this codebase)

The UI calls all go through the `/api` prefix which Vercel rewrites to `http://34.30.239.113:3001`. The `VITE_API_URL` env var defaults to `/api`.

```typescript
// api.ts — REST calls
const BASE = import.meta.env.VITE_API_URL ?? '/api';
// e.g. GET /api/ring-leader/runs/by-execution/{id} → backend GET /ring-leader/runs/by-execution/{id}

// sse.ts — SSE streams
const es = new EventSource(`${BASE}/executions/${executionId}/events`);
const es = new EventSource(`${BASE}/events/lifecycle`);
```

### SSE Implementation Pattern (@fastify/sse v0.4.0)

The existing pattern is correct. Key API verified from source:

```typescript
// Source: node_modules/@fastify/sse/index.js
fastify.get('/:id/events', { sse: true }, async (request, reply) => {
  // reply.sse.isConnected — boolean getter
  // reply.sse.onClose(callback) — register cleanup callback
  // reply.sse.send({ event: 'type', data: 'string' }) — send event

  // Guard against double-cleanup (already implemented in sse.ts)
  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // ... resource teardown
  };
  reply.sse.onClose(cleanup);
  request.raw.on('close', cleanup);
});
```

### Pub/Sub SSE Bridge Pattern

Existing pattern in `routes/sse.ts` creates per-connection subscriptions:

```typescript
// Pattern: create ephemeral sub → listen → filter by executionId → forward to SSE → cleanup on close
const subName = `sse-${executionId.slice(0, 8)}-${connId}-${topicName}`;
await pubsub.topic(topicName).createSubscription(subName);
const sub = pubsub.subscription(subName);

sub.on('message', async (message) => {
  const payload = JSON.parse(message.data.toString());
  if (payload.executionId !== executionId) { message.ack(); return; }
  if (reply.sse.isConnected) {
    await reply.sse.send({ event: payload.type, data: JSON.stringify(payload) });
  }
  message.ack();
});

// Cleanup: removeAllListeners → close → delete
reply.sse.onClose(cleanup);
request.raw.on('close', cleanup);
```

### Anti-Patterns to Avoid

- **Adding the billing topic without an executionId filter**: `billing_event` events have `executionId`. `budget_exceeded` events also have `executionId`. Both have the field — the existing filter `payload.executionId !== executionId` will work correctly without modification.
- **Treating the Fastify route ordering of `/calibration` vs `/:verdictId` as a bug**: Fastify static routes win over parametric routes. `GET /verdicts/calibration` will not be captured by `GET /verdicts/:verdictId`. This is correct behavior, not a defect.
- **Renaming existing routes to "fix" alignment**: The UI and backend are already aligned. Route renames would break working callers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE heartbeat | Custom ping timer | `@fastify/sse` built-in heartbeat | Plugin handles it with configurable interval |
| Topic/subscription naming | Custom UUID scheme | Existing `sse-${executionId.slice(0,8)}-${connId}-${topicName}` | Already prevents collisions |
| Route-order conflict resolution | Manual ordering logic | Fastify's built-in static-before-parametric resolution | Framework handles it |

**Key insight:** The infrastructure is already built. This phase is verification + one targeted fix (billing topic gap), not new construction.

## Common Pitfalls

### Pitfall 1: Billing Events Never Reach the UI
**What goes wrong:** `billing_event` and `budget_exceeded` events are published to `BILLING_EVENTS_TOPIC` but `sse.ts` only subscribes to 5 topics — not billing. The UI SSE client registers listeners for `billing_event` and `budget_exceeded` but receives nothing.
**Why it happens:** `BILLING_EVENTS_TOPIC` was added to the publisher but not to the SSE subscription list.
**How to avoid:** Add `BILLING_EVENTS_TOPIC` to the `topicNames` array in the `sseRoutes` handler. Both billing event types have `executionId` fields and pass the existing filter.
**Warning signs:** Activity feed never shows budget or billing entries even when spend is non-zero.

### Pitfall 2: Vercel Rewrite Buffering SSE
**What goes wrong:** Vercel's `/api/:path*` rewrite in `vercel.json` proxies to the raw GCE IP. Vercel serverless functions may buffer the response body before forwarding, breaking SSE streaming.
**Why it happens:** SSE requires chunked transfer encoding and no response buffering. Some proxy configurations buffer responses.
**How to avoid:** The existing setup uses a static `rewrites` entry (not a serverless function), which acts as a pass-through proxy. Verify by checking that the EventSource connection stays open and events arrive without delay in staging. If buffering occurs, the fix is to ensure the Vercel rewrite uses a streaming-compatible edge config.
**Warning signs:** SSE connects successfully (HTTP 200 with `Content-Type: text/event-stream`) but events never arrive in the browser.

### Pitfall 3: GCP Pub/Sub Subscription Leak on Abnormal Disconnect
**What goes wrong:** If a client disconnects without triggering the `close` event, ephemeral subscriptions accumulate and hit GCP quota limits.
**Why it happens:** Network interruptions can skip the normal close path.
**How to avoid:** Already mitigated — `sse.ts` registers `request.raw.on('close', cleanup)` as a backup, and uses a `cleanedUp` flag to prevent double-execution. The `sub.delete()` is wrapped in `.catch(() => {})` for emulator compatibility.
**Warning signs:** GCP quota errors for Pub/Sub subscriptions in production logs.

### Pitfall 4: `/verdicts/calibration` Returns 404 in Testing
**What goes wrong:** Manual testing hits `GET /verdicts/calibration` and gets a 404 because it's confused with `/:verdictId`.
**Why it happens:** Misconception about Fastify route resolution. Fastify static routes take priority over parametric routes regardless of registration order.
**How to avoid:** Fastify handles this correctly. No action needed. Verified by reading Fastify v5 routing behavior.
**Warning signs:** This won't happen — Fastify resolves `/calibration` as a static segment before `/:verdictId`.

### Pitfall 5: SSE Events Not Arriving Due to Missing `executionId` Field
**What goes wrong:** An event published to a subscribed topic doesn't have `executionId` in the payload, so `payload.executionId !== executionId` causes it to be silently dropped.
**Why it happens:** New event types or event schema changes may omit `executionId`.
**How to avoid:** All event schemas in `packages/event-schemas/src/` have `executionId` as a required field (verified). Any new event type added to the SSE subscription topics must include `executionId`.
**Warning signs:** Events are published (visible in Pub/Sub metrics) but never appear in the UI feed.

## Code Examples

### Current SSE Topic Subscription List (fix needed)

```typescript
// Source: services/execution-service/src/routes/sse.ts

// CURRENT (missing billing topic):
const topicNames = [
  EXECUTION_LIFECYCLE_TOPIC,
  TASK_LIFECYCLE_TOPIC,
  BOT_LIFECYCLE_TOPIC,
  GUARDRAIL_EVENTS_TOPIC,
  RING_LEADER_EVENTS_TOPIC,
];

// FIXED (add billing):
const topicNames = [
  EXECUTION_LIFECYCLE_TOPIC,
  TASK_LIFECYCLE_TOPIC,
  BOT_LIFECYCLE_TOPIC,
  GUARDRAIL_EVENTS_TOPIC,
  RING_LEADER_EVENTS_TOPIC,
  BILLING_EVENTS_TOPIC,  // add this line
];
```

Also add the constant at the top of `sse.ts`:
```typescript
const BILLING_EVENTS_TOPIC = process.env.BILLING_EVENTS_TOPIC ?? 'billing-events';
```

### Calibration Endpoint (already correct)

```typescript
// Source: services/execution-service/src/routes/verdicts.ts lines 235-269
// GET /verdicts/calibration?userId= → returns:
// { total: number, confirmed: number, rate: number, warningTriggered: boolean }
// warningTriggered = total >= 10 && rate > 0.95
```

### UI API Call for Calibration (already correct)

```typescript
// Source: services/ui/src/lib/api.ts line 136-138
export async function getCalibration(userId: string): Promise<CalibrationData> {
  return apiFetch(`${BASE}/verdicts/calibration?userId=${encodeURIComponent(userId)}`);
}
```

### Ring Leader Route Alignment (already correct)

```typescript
// UI calls (api.ts):
getRingLeaderManifest(id)  → GET /api/ring-leader/runs/by-execution/{id}
getRingLeaderState(id)     → GET /api/ring-leader/runs/by-execution/{id}/state
getRingLeaderEvents(id)    → GET /api/ring-leader/runs/by-execution/{id}/events
getRingLeaderSynthesis(id) → GET /api/ring-leader/runs/by-execution/{id}/synthesis

// Backend (ring-leader.ts registered at prefix '/ring-leader'):
fastify.get('/runs/by-execution/:executionId', ...)          // ✓ matches
fastify.get('/runs/by-execution/:executionId/state', ...)    // ✓ matches
fastify.get('/runs/by-execution/:executionId/events', ...)   // ✓ matches
fastify.get('/runs/by-execution/:executionId/synthesis', ...) // ✓ matches
```

## Gap Analysis: What Phase 34 Must Fix

| Requirement | Current State | Action Needed |
|-------------|--------------|---------------|
| API-01: Ring Leader `by-execution/:executionId/*` paths align | **ALIGNED** — all 4 routes match | Verify with smoke test, no code change |
| API-04: `GET /executions/:id/events` SSE streams activity feed | **PARTIAL** — route exists, but `billing_event` and `budget_exceeded` are dropped (billing topic not subscribed) | Add `BILLING_EVENTS_TOPIC` to `topicNames` in `sseRoutes` |
| API-05: `GET /events/lifecycle` SSE streams soul lifecycle | **ALIGNED** — route exists and subscribes to `SOUL_LIFECYCLE_TOPIC` | Verify with smoke test, no code change |
| API-06: `GET /verdicts/calibration?userId=` returns rate + warning | **ALIGNED** — route exists, returns `{ total, confirmed, rate, warningTriggered }` | Verify with smoke test, no code change |

## State of the Art

| Capability | Current Implementation | Status |
|------------|----------------------|--------|
| Ring Leader manifest lookup | `/ring-leader/runs/by-execution/:id` → DB query | Working |
| Ring Leader state lookup | `/ring-leader/runs/by-execution/:id/state` → DB query | Working |
| Ring Leader coord events | `/ring-leader/runs/by-execution/:id/events` → in-memory log | Working |
| Ring Leader synthesis | `/ring-leader/runs/by-execution/:id/synthesis` → DB query + join | Working |
| Execution SSE | 5-topic Pub/Sub subscription per connection | Working, missing billing topic |
| Lifecycle SSE | 1-topic Pub/Sub subscription per connection | Working |
| Calibration | DB aggregate query with 95% threshold | Working |

## Open Questions

1. **Vercel SSE proxy behavior in production**
   - What we know: `vercel.json` uses a static `rewrites` rule to a raw GCE IP. EventSource browser API will reconnect automatically on connection drops.
   - What's unclear: Whether Vercel's edge network buffers the response before forwarding for rewrites pointing to external IPs. This can't be verified by code inspection alone.
   - Recommendation: Verify in staging by opening the browser DevTools network tab on `/executions/:id` and confirming `text/event-stream` response type stays open and delivers events. If buffering occurs, investigate Vercel Edge Middleware or hosting SSE separately.

2. **GCP Pub/Sub topic existence in staging**
   - What we know: Topics are created by Terraform for production. The Pub/Sub emulator auto-creates topics on first publish.
   - What's unclear: Whether `billing-events` topic exists in the staging GCP project if SSE subscriptions try to create subs on it before any message is published.
   - Recommendation: When adding `BILLING_EVENTS_TOPIC` to SSE subscriptions, ensure the topic is created in GCP staging. The `pubsub.topic(topicName).createSubscription(subName)` call will fail with a "topic not found" error if the topic doesn't exist, causing the entire SSE connection to fail. Add error handling per topic or create the topic if missing.

3. **Ring Leader coordination events in memory vs. persistence**
   - What we know: `getCoordinationLog(runId)` returns from an in-memory `Map` in `coordination-events.ts`. If the process restarts, history is lost.
   - What's unclear: Whether this is acceptable for the UI's Ring Leader events panel or if persistence is needed.
   - Recommendation: This is out of scope for Phase 34 (the route works correctly). Flag for a future phase if event replay after restart is required.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection:
  - `services/execution-service/src/routes/ring-leader.ts` — all 5 routes verified
  - `services/execution-service/src/routes/sse.ts` — SSE implementation and topic list verified
  - `services/execution-service/src/routes/verdicts.ts` — calibration route verified
  - `services/execution-service/src/app.ts` — all route registrations and prefixes verified
  - `services/ui/src/lib/api.ts` — all UI REST calls verified
  - `services/ui/src/lib/sse.ts` — all UI SSE connections verified
  - `services/ui/src/lib/types.ts` — CalibrationData type confirmed `{ total, confirmed, rate, warningTriggered }`
  - `services/ui/vercel.json` — proxy rewrite configuration verified
  - `packages/event-schemas/src/billing-events.ts` — `executionId` field confirmed in billing events
  - `packages/event-schemas/src/soul-lifecycle-events.ts` — soul lifecycle event types confirmed
- `node_modules/@fastify/sse/index.js` + `node_modules/@fastify/sse/package.json` — v0.4.0, peer-dep Fastify ^5.x confirmed, `reply.sse.isConnected` / `reply.sse.onClose` / `reply.sse.send` API verified

### Secondary (MEDIUM confidence)
- Fastify route resolution behavior (static before parametric) — well-documented Fastify v5 behavior, confirmed by lack of any special handling in codebase for the `/calibration` vs `/:verdictId` ordering

## Metadata

**Confidence breakdown:**
- Gap analysis (what's broken vs. working): HIGH — direct code inspection
- SSE implementation: HIGH — verified against @fastify/sse source
- Route alignment: HIGH — traced all UI calls to backend registrations
- Vercel SSE proxy behavior: MEDIUM — architecture is correct but runtime behavior not verifiable without staging test

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable stack, no fast-moving dependencies)
