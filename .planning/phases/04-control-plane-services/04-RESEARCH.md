# Phase 4: Control Plane Services - Research

**Researched:** 2026-02-18
**Domain:** GCP Cloud Pub/Sub subscriber patterns, Redis atomic budget enforcement (Lua scripting), guardrail watchdog loop detection, billing engine bot-hour calculation, event-driven microservice architecture
**Confidence:** HIGH for Pub/Sub publisher/subscriber patterns (library installed and used in project); HIGH for Redis atomic operations (rate-limiter-flexible already proven); MEDIUM for loop/thrash detection algorithm design; MEDIUM for billing cost calculation precision requirements

---

## Summary

Phase 4 adds three cooperating control-plane sub-systems that sit on top of Phase 2/3's event bus foundation. The `@google-cloud/pubsub` library (v5.2.3) is already installed in execution-service and actively used in `publisher.ts` for publishing bot lifecycle and execution events. The Pub/Sub emulator is already running in `docker-compose.dev.yml`. What Phase 4 adds is (1) formalising the topic/subscription wiring for the NEW topics (`guardrail-events`, `billing-events`) and aligning publisher topic names with Terraform definitions; (2) a Guardrail Watchdog — a long-running async subscriber that reads from the `bot-lifecycle` subscription, tracks per-bot rate metrics and tool call sequences in Redis, and revokes offending bots via a Redis deny-list key checked by the Tool Gateway; (3) a Billing Engine — a subscriber consuming `bot-lifecycle` events to accumulate bot-hours, consuming `tool-invoked` events for LLM token costs (already in `tool_invocations` table), enforcing budget caps via an atomic Redis INCR/CAS operation, and writing `billing_events` rows to Postgres.

The critical insight is that **no new services are strictly required** — the Guardrail Watchdog and Billing Engine can both live in the execution-service as async background workers. However, they are logically distinct enough to warrant their own modules within execution-service. The Phase 4 plans call them out as separate "services" in spirit (04-02, 04-03) which maps to separate source files/modules, not separate processes.

The most complex requirement is the **atomic budget cap enforcement** (GARD-01). The success criterion explicitly states enforcement must be via Redis atomic check — not an application-level read-then-write. This means a Redis Lua script or `SET NX` + `INCR` pattern that atomically reads the current spend, compares against the cap, and either permits or denies the spend increment in a single round-trip. Rate-limiter-flexible's `RateLimiterRedis` already uses exactly this pattern — it can be re-used for budget enforcement by treating the budget cap as a points limit and token costs/tool costs as the consume amount.

**Critical pre-work item:** The existing `publisher.ts` uses topic names `bot-events`, `execution-events`, `task-events`, but the Terraform module provisions topics named `bot-lifecycle-{env}`, `execution-lifecycle-{env}`, `task-lifecycle-{env}`, `guardrail-events-{env}`, `billing-events-{env}`. Also, `docker-compose.dev.yml` does not set up any topics in the Pub/Sub emulator — they are created at runtime by the publisher (the GCP Pub/Sub client auto-creates topics in the emulator). This mismatch between publisher topic names and Terraform topic names must be resolved in Phase 4 as part of plan 04-01.

**Primary recommendation:** Use `rate-limiter-flexible`'s `RateLimiterRedis` for atomic budget cap enforcement (same library already in tool-gateway), use `setInterval`-based polling for the Guardrail Watchdog (same pattern as the existing idle-checker in bot-orchestrator), use Pub/Sub pull subscription via `subscription.on('message', ...)` event listener for both the Watchdog and Billing Engine, and write billing calculations directly to the `billing_events` and `telemetry` Postgres tables via Drizzle.

---

## Critical Pre-Work: Topic Name Alignment

### Mismatch Discovered

The existing `publisher.ts` in execution-service uses these topic names:
```
BOT_EVENTS_TOPIC = 'bot-events'
EXECUTION_EVENTS_TOPIC = 'execution-events'
TASK_EVENTS_TOPIC = 'task-events'
```

The Terraform module (`infra/terraform/modules/pubsub/main.tf`) provisions:
```
bot-lifecycle-{env}
execution-lifecycle-{env}
task-lifecycle-{env}
guardrail-events-{env}
billing-events-{env}
dead-letter-{env}
```

**This means Phase 4 plan 04-01 must either:**
1. Update `publisher.ts` to use the Terraform-aligned names (with environment suffix), OR
2. Accept the naming mismatch and use the current `publisher.ts` names for local dev (emulator auto-creates topics), with a note that production will need alignment.

**Recommendation:** For local dev, the emulator auto-creates topics on first publish, so the mismatch doesn't cause failures. For Phase 4, the planner should update topic names in `publisher.ts` to match the Terraform module (without env suffix for local dev, with env suffix configurable via env var). The existing Terraform subscriptions (`bot-lifecycle-sub-{env}`, etc.) also need subscriber client wiring in Phase 4.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google-cloud/pubsub | 5.2.3 | Pub/Sub publisher + subscriber client | Already installed in execution-service; emulator-compatible via PUBSUB_EMULATOR_HOST |
| rate-limiter-flexible | 9.1.1 | Atomic Redis budget cap enforcement | Already used in tool-gateway; RateLimiterRedis uses Lua scripts for atomic operations |
| ioredis | 5.9.3 | Redis client for deny-list, budget tracking, loop detection | Already used across all services |
| drizzle-orm | 0.45.1 | Write billing_events and telemetry rows | Already used; billing_events and telemetry tables already exist in schema |
| @claw/db | workspace | Drizzle client + all table schemas | Already built; billing_events, telemetry, bots, executions tables all relevant |
| @claw/event-schemas | workspace | Zod schemas for all event types | Already built; billing, guardrail, bot, execution event schemas all defined |
| zod | ^4.3.6 | Event payload validation on subscriber receive | Already in use; parse incoming Pub/Sub message data |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dockerode | 4.0.9 | Bot container termination from Guardrail Watchdog | Already in execution-service; watchdog needs to stop containers when revoking bots |
| bullmq | 5.69.3 | Check/update bot job status during revocation | Already used; watchdog may need to drain/fail in-progress jobs for revoked bots |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rate-limiter-flexible for budget cap | Custom Redis Lua script | rate-limiter-flexible already proven in Phase 3, wraps the same Lua atomics. Custom Lua gives more control but adds code to maintain. Use rate-limiter-flexible — it already does what's needed. |
| setInterval watchdog polling | Dedicated BullMQ repeatable job | setInterval is simpler, matches the existing idle-checker pattern. BullMQ repeatable jobs add queue overhead and require a separate worker. For a sub-second polling loop, setInterval is appropriate. |
| Pub/Sub subscription.on('message') | Pub/Sub subscription.pull() (manual pull) | Event-listener mode auto-manages flow control and ACK deadlines. Manual pull requires explicit polling loop and error handling. Use event-listener mode for simplicity. |
| In-process billing engine (in execution-service) | Separate billing-service process | No new process needed. The billing engine is a subscriber + DB writer, not a stateful service. Keeping it in execution-service reduces operational overhead. The plans call it a "service" (04-03) but it can be a module. |

**Installation:** No new packages required. All Phase 4 dependencies are already installed across execution-service, tool-gateway, and @claw packages. The only potential addition is `@google-cloud/pubsub` in any service that doesn't currently have it — but execution-service already has it.

---

## Architecture Patterns

### Recommended Project Structure

Phase 4 adds to execution-service and tool-gateway without new services:

```
services/execution-service/src/
├── events/
│   ├── publisher.ts          # EXISTING — add billing + guardrail publish functions
│   ├── billing-engine.ts     # NEW (04-03): Pub/Sub subscriber for billing accumulation
│   └── guardrail-watchdog.ts # NEW (04-02): Pub/Sub subscriber + Redis watchdog
│
├── orchestrator/
│   ├── bot-orchestrator.ts   # EXISTING — add revokeBot() using Redis deny-list
│   └── ...
│
services/tool-gateway/src/
├── middleware/
│   ├── rate-limit.ts         # EXISTING — add checkBotDenyList() check
│   └── budget-check.ts       # NEW (04-03): atomic budget cap check via Redis
```

### Pattern 1: Pub/Sub Subscriber (Event-Listener Mode)

**What:** The `@google-cloud/pubsub` Subscription object is an EventEmitter. Attach a `'message'` listener; the library automatically pulls messages, handles flow control, and manages ACK deadline renewal.

**When to use:** All Phase 4 subscriber loops (Guardrail Watchdog consuming bot-lifecycle, Billing Engine consuming bot-lifecycle + tool events).

**Example:**
```typescript
// Source: @google-cloud/pubsub library (verified in installed subscription.d.ts)
// on(event: 'message', listener: (message: Message) => void): this;

import { PubSub } from '@google-cloud/pubsub';
import type { Message } from '@google-cloud/pubsub';

const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
});

const subscription = pubsub.subscription('bot-lifecycle-sub');

subscription.on('message', (message: Message) => {
  try {
    const payload = JSON.parse(message.data.toString());
    // Process payload...
    message.ack();  // ACK on success
  } catch (err) {
    console.error('[subscriber] Failed to process message:', err);
    message.nack(); // NACK triggers redelivery
  }
});

subscription.on('error', (err) => {
  console.error('[subscriber] Subscription error:', err);
  // Do NOT crash — subscription auto-reconnects
});

// Graceful shutdown:
// subscription.close() — drains in-flight messages before closing
```

**Critical nuances:**
- Always call `message.ack()` on success or `message.nack()` on processing failure. Unacked messages are redelivered after the ACK deadline (30s in Terraform config).
- The emulator (`PUBSUB_EMULATOR_HOST=localhost:8085`) is detected automatically by the client — no code change needed.
- `subscription.close()` is async and should be awaited on process shutdown.

### Pattern 2: Atomic Budget Cap Enforcement via rate-limiter-flexible

**What:** Use `RateLimiterRedis` with `points` = `budgetCapCents` and `consume(executionId, costCents)` on each billing event. The library uses a Lua script that atomically reads, checks, and decrements in a single Redis round-trip. This satisfies GARD-01's requirement for atomic enforcement.

**When to use:** Every time a billing-relevant spend occurs (LLM token cost, tool invocation). Called in the Billing Engine subscriber.

**Example:**
```typescript
// Source: rate-limiter-flexible RateLimiterRedis (verified in tool-gateway Phase 3)
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

// Budget enforcer: points = budgetCapCents, duration = very large (effectively no expiry)
// Use duration = 0 for no time-based reset (budget is total, not rate)
// NOTE: rate-limiter-flexible does not natively support "no expiry" via duration=0.
// Use a very long duration (e.g., 86400 * 365 = 31,536,000 seconds = 1 year).
// OR: use Redis INCRBY + GET + compare directly for truly persistent budget tracking.
```

**IMPORTANT:** `rate-limiter-flexible` is designed for rate limits (time-window-based). For a **total budget cap** (not time-windowed), a direct Redis INCRBY + check pattern is more appropriate. The Lua script approach:

```typescript
// Atomic budget cap using Redis INCRBY + check Lua script
// Key: `budget:{executionId}` — cumulative spend in cents
// Returns: { newTotal, capExceeded }

const budgetCapScript = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
local current = redis.call('INCRBY', key, amount)
if current > cap then
  -- Overspent: return new total and signal exceeded
  return {current, 1}
end
return {current, 0}
`;

async function atomicSpendCheck(
  redis: IORedis,
  executionId: string,
  amountCents: number,
  capCents: number,
): Promise<{ newTotalCents: number; capExceeded: boolean }> {
  const result = await redis.eval(
    budgetCapScript,
    1,
    `budget:${executionId}`,
    amountCents.toString(),
    capCents.toString(),
  ) as [number, number];
  return {
    newTotalCents: result[0],
    capExceeded: result[1] === 1,
  };
}
```

**Confidence:** HIGH — Redis `EVAL` with Lua scripts is atomic by design (single-threaded Redis execution). The pattern is standard for budget enforcement.

### Pattern 3: Bot Deny-List for Guardrail Revocation

**What:** When the Guardrail Watchdog detects a violation, it adds the `botId` to a Redis deny-list set. The Tool Gateway checks this set on every `/tool.invoke` request. This provides near-instant revocation without requiring the Watchdog to directly kill the container for every request — the gateway enforces it.

**When to use:** GARD-02, GARD-03, GARD-04 revocation.

**Example:**
```typescript
// In Guardrail Watchdog (execution-service):
// Revoke a bot: add to deny-list, set TTL matching max execution runtime
await redis.sadd('guardrail:denied-bots', botId);
// Also stop the container directly:
await stopBot(botId, 'terminated');
// Publish guardrail_triggered event to Pub/Sub

// In Tool Gateway (rate-limit.ts or new middleware):
async function checkBotDenyList(botId: string): Promise<boolean> {
  const isDenied = await redis.sismember('guardrail:denied-bots', botId);
  return isDenied === 1;
}
// Call in /tool.invoke preHandler — return 403 if denied
```

**Alternative:** Use a Redis key `guardrail:denied:{botId}` with SETEX and a TTL, rather than a set. This auto-expires the deny entry when the bot's expected lifetime expires, avoiding stale entries. Either approach works — the key-per-bot pattern is cleaner for targeted revocation and TTL management.

### Pattern 4: Guardrail Watchdog — Rate Violation Detection

**What:** The Watchdog polls Redis rate-limiter state (already maintained by tool-gateway's `rate-limiter-flexible` instances) to detect bots that have already exceeded rate limits. Alternatively, it subscribes to bot events and tracks call sequences in its own Redis keys.

**Approach:** Since `rate-limiter-flexible` already tracks per-bot call counts in Redis (key prefix `rl:calls:{botId}` and `rl:tokens:{botId}`), the Watchdog can read these keys directly to identify bots that have hit their limits. However, the Watchdog's role is to **revoke** bots that have exceeded limits — meaning the Tool Gateway already blocks their calls via 429s (GARD-02, GARD-03), but the Watchdog should also terminate the container and emit a `guardrail_triggered` event.

**Loop/Thrash Detection (GARD-04):**
```typescript
// Track last N tool invocations per bot in Redis (capped list)
// Key: `loop:calls:{botId}` — Redis LIST of recent tool invocations (LPUSH + LTRIM)
// On each tool.invoke (logged in tool_invocations table):
//   LPUSH loop:calls:{botId} JSON.stringify({toolName, args_hash})
//   LTRIM loop:calls:{botId} 0 N-1  (keep last N)
//   Check if all N entries are identical → loop detected
```

The loop detection data can be fed from the `tool_invocations` Postgres table (queried periodically by the Watchdog) OR from a lightweight Redis key maintained by the Tool Gateway on each invocation. The Postgres approach adds latency but is already fully audited. The Redis approach is faster but adds coupling.

**Recommendation:** Use the Postgres `tool_invocations` table for loop detection (poll on Watchdog interval), since the data is already there and correctness matters more than sub-second detection speed. The Watchdog polling interval (e.g., 10s) is fast enough to catch loops before budget exhaustion.

### Pattern 5: Bot-Hours Calculation (METR-02)

**What:** Bot-hours = sum of (stoppedAt - startedAt) for all bots in an execution, converted to hours.

**Where the data lives:** The `bots` table already has `startedAt` and `stoppedAt` columns. The Billing Engine reads these from the DB when a `bot_stopped` event arrives, accumulates the wall-clock runtime, and writes to the `telemetry` table.

**Example:**
```typescript
// Called when bot_stopped event arrives in Billing Engine
async function recordBotHours(botId: string, executionId: string): Promise<void> {
  const bot = await db.select({ startedAt: bots.startedAt, stoppedAt: bots.stoppedAt })
    .from(bots).where(eq(bots.id, botId)).limit(1);

  if (!bot[0]?.startedAt || !bot[0]?.stoppedAt) return;

  const wallClockMs = bot[0].stoppedAt.getTime() - bot[0].startedAt.getTime();
  const botHours = wallClockMs / (1000 * 60 * 60);

  await db.insert(telemetry).values({
    executionId,
    botId,
    metricName: 'bot_hours',
    metricValue: botHours.toFixed(6), // numeric(12,6) — sub-microsecond precision
  });
}
```

### Pattern 6: Billing Engine Event Consumption

**What:** The Billing Engine subscribes to bot-lifecycle events. For each `bot_started`, `bot_stopped`, `tool_invoked`, `execution_completed`, `budget_exceeded` event, it writes a `billing_events` row and updates running totals.

**Data flow:**
- `bot_started` → insert `billing_events` row (event_type='bot_started')
- `bot_stopped` → insert `billing_events` row, calculate bot_hours, insert `telemetry` row
- `tool_invoked` (llm_call) → read token counts from `tool_invocations` table, calculate cost, insert `billing_events` row with `amountCents`
- `execution_completed` → calculate total cost, insert `billing_events` row (event_type='execution_completed')
- `budget_exceeded` → insert `billing_events` row (event_type='budget_exceeded')

**Token cost calculation (METR-03):**
```typescript
// LLM cost = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
// Rates are per-million tokens, in cents:
// gpt-4o-mini: input=15 cents/1M, output=60 cents/1M (example rates)
// Store rates in config/env — never hardcode
const costCents = Math.round(
  (inputTokens * INPUT_RATE_PER_M + outputTokens * OUTPUT_RATE_PER_M) / 1_000_000
);
```

**1% margin requirement (SC#5):** At integer cents precision, 1% of a $10 budget = 10,000 cents. Rounding errors at individual invocations (1-2 cents max) will accumulate < 0.01% across typical executions. The success criterion is achievable with integer cents arithmetic.

### Anti-Patterns to Avoid

- **Application-level read-then-write for budget enforcement:** Reading `SUM(amountCents)` from `billing_events` in Postgres, comparing to the cap, then writing — this has a TOCTOU race. Two concurrent billing events can both read "under budget" before either writes. Use Redis atomic INCRBY + Lua script.
- **Sharing the rate-limiter-flexible Redis connection with the deny-list connection:** The deny-list uses SADD/SISMEMBER; the rate limiter uses INCRBY scripts. These can share a connection but the deny-list should use a separate IORedis instance with default settings (fast-fail) rather than `maxRetriesPerRequest: null` (BullMQ worker mode).
- **Not acking Pub/Sub messages on error:** Unacked messages are redelivered up to `max_delivery_attempts` (5 in Terraform). If the Billing Engine crashes processing a message, `nack()` it to get a retry. If the message is permanently unprocessable, `ack()` it and log the failure — otherwise the dead-letter queue fills with unprocessable messages and the service runs in a retry loop.
- **Querying tool_invocations for every billing event:** If the Billing Engine subscribes to `bot-lifecycle` events but needs LLM token data from `tool_invocations`, it should batch-query rather than per-message-query. Better: the billing-relevant data (token counts, costs) should be in the `tool_invoked` billing event payload itself, not just in Postgres.
- **Running Guardrail Watchdog as a tight polling loop with no backoff:** A 1ms polling loop on Redis will saturate connections. Use `setInterval` with a minimum 1-5 second interval for rate violation checks. Loop detection can run every 10-30 seconds — it doesn't need sub-second latency.
- **Not emitting `guardrail_triggered` events to Pub/Sub:** The success criteria require structured guardrail events on the event bus (GARD-06). The Watchdog must publish to the `guardrail-events` topic after every revocation, not just stop the container.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic budget cap enforcement | Postgres transaction read-compare-write | Redis `EVAL` Lua script with INCRBY | Postgres transactions can't prevent concurrent reads between services; Redis is single-threaded and EVAL is atomic. The tool-gateway and billing engine both need the same atomic check. |
| Per-bot rate tracking for watchdog | Custom Redis structures | Read `rate-limiter-flexible` keys (`rl:calls:{botId}`, `rl:tokens:{botId}`) | The data already exists in Redis from Phase 3 tool-gateway enforcement. Don't duplicate tracking. |
| Loop detection sequence tracking | Custom DB table | Existing `tool_invocations` Postgres table | `tool_invocations` already stores every invocation with toolName and args. Query `SELECT tool_name, request_summary FROM tool_invocations WHERE bot_id = $botId ORDER BY invoked_at DESC LIMIT N` to detect repetition. |
| Pub/Sub topic/subscription creation | Custom setup scripts | GCP Pub/Sub client `topic.getOrCreate()` / `subscription.getOrCreate()` | The emulator creates topics on first publish. For production, Terraform handles provisioning. Don't add topic creation code to application startup. |
| Cost per token rates | Hardcoded constants | Environment variables (`LLM_COST_INPUT_CENTS_PER_M`, `LLM_COST_OUTPUT_CENTS_PER_M`) | LLM pricing changes frequently. Any hardcoded rate will be wrong within months. Env vars allow updates without code changes. |

**Key insight:** The control plane services are glue code — they read existing data (rate limiter state, bot rows, tool invocations) and write new data (billing events, telemetry, deny-list entries). The complexity is in the atomicity guarantees and the event routing, not the business logic. Keep implementations simple.

---

## Common Pitfalls

### Pitfall 1: Pub/Sub Topic Name Mismatch Between Publisher and Subscriber

**What goes wrong:** The existing `publisher.ts` uses topic names `bot-events`, `execution-events`, `task-events`. The Terraform module provisions `bot-lifecycle-{env}`, etc. The Guardrail Watchdog subscribes to `bot-lifecycle-sub` — but the publisher publishes to `bot-events`. No messages arrive.

**Why it happens:** Phase 2/3 publisher was built before the Terraform module was finalized. The topic names diverged.

**How to avoid:** Plan 04-01 must reconcile topic names. Two options:
1. Update `publisher.ts` to use env-var-configured topic names matching Terraform (with `PUBSUB_ENVIRONMENT` suffix).
2. Keep existing `bot-events` topic for backward compat; add new `billing-events` and `guardrail-events` topics.

The Terraform module also defines subscriptions (e.g., `bot-lifecycle-sub-{env}`) — the subscriber client must use the subscription name, not the topic name. The subscription name must also match what the Billing Engine and Watchdog subscribe to.

**Warning signs:** Subscriber never receives messages; topic/subscription create calls in the emulator show different names from what publisher uses.

### Pitfall 2: Budget Cap Race Condition with Integer Cents

**What goes wrong:** The Billing Engine receives two `tool_invoked` billing events simultaneously (from two concurrent bot LLM calls). Both read `SUM(amountCents) = 9900` from `billing_events`, compare to cap of `10000`, both see 100 cents of headroom, both insert amountCents=200. Total spend is now 10300 — 300 cents over budget.

**Why it happens:** Any non-atomic read-compare-write is vulnerable to this race condition with concurrent events.

**How to avoid:** The Redis INCRBY Lua script is the atomic solution. The `billing_events` table is the audit log; the Redis key `budget:{executionId}` is the enforcer. On execution creation, initialize `SET budget:{executionId} 0`. On each spend, `INCRBY budget:{executionId} amountCents` inside a Lua script that checks against the cap.

**Warning signs:** Test by sending two concurrent billing events when current spend is near the cap — verify only one succeeds per the cap.

### Pitfall 3: Pub/Sub Message Deduplication

**What goes wrong:** The Pub/Sub emulator (and GCP Pub/Sub in general) has at-least-once delivery. A `bot_stopped` event may be delivered twice. The Billing Engine inserts two `billing_events` rows for the same stop event, doubling the bot-hours calculation.

**Why it happens:** Exactly-once delivery is not guaranteed in Pub/Sub without additional idempotency logic.

**How to avoid:** Use the Pub/Sub message ID (`message.id`) as an idempotency key. Before processing, check Redis: `SETNX processed:{messageId} 1`. If the key already exists, `ack()` and skip. Set a TTL of 24h to avoid unbounded key growth.

Alternatively: The `billing_events` table can use a `UNIQUE` constraint on `(execution_id, event_type, occurred_at)` with an ON CONFLICT DO NOTHING. Less reliable than the Redis approach for deduplication of rapid re-deliveries, but simpler.

**Warning signs:** Bot-hours calculations are double what's expected; billing_events has duplicate rows for the same bot lifecycle.

### Pitfall 4: Guardrail Watchdog Missing the deny-list Check in Tool Gateway

**What goes wrong:** The Guardrail Watchdog correctly adds `botId` to the Redis deny-list and publishes a `guardrail_triggered` event. But the Tool Gateway doesn't check the deny-list before processing `/tool.invoke` requests. The revoked bot continues to make tool calls.

**Why it happens:** The deny-list is only effective if the Tool Gateway checks it on every request. The gateway currently doesn't have this check.

**How to avoid:** Plan 04-02 must add a deny-list check to the Tool Gateway's `/tool.invoke` preHandler, BEFORE the rate limit check:
```typescript
// In tool-gateway/src/routes/tool-invoke.ts or middleware:
const isDenied = await redis.get(`guardrail:denied:${botId}`);
if (isDenied) {
  return reply.status(403).send({ success: false, error: 'Bot has been revoked' });
}
```

**Warning signs:** After guardrail revocation, tool calls from the revoked bot still succeed with 200.

### Pitfall 5: Loop Detection False Positives from Legitimate Repetition

**What goes wrong:** A bot legitimately calls `write_file` 10 times to write 10 different files. The loop detector sees 10 consecutive `write_file` invocations and triggers a false positive.

**Why it happens:** Loop detection based on `toolName` alone is too coarse. Legitimate work involves repeated use of the same tool with different arguments.

**How to avoid:** Loop detection must compare the **hash of tool arguments**, not just the tool name. A bot calling `write_file` with path `file1.txt`, `file2.txt`, etc. has varying args — no loop. A bot calling `write_file` with identical path and content N times is looping.

For the Watchdog query against `tool_invocations`:
```sql
SELECT request_summary FROM tool_invocations
WHERE bot_id = $botId AND tool_name = $toolName
ORDER BY invoked_at DESC
LIMIT 5
```
Compare `JSON.stringify(requestSummary.args)` across the last N rows. If all identical → loop.

**Warning signs:** Bots doing legitimate repetitive work are terminated; test bots writing multiple distinct files get revoked.

### Pitfall 6: Billing Engine Startup Order — Budget Key Not Initialized

**What goes wrong:** The Billing Engine starts and the first spend attempt reads `budget:{executionId}` from Redis — but the key doesn't exist (first-ever spend). Redis `INCRBY` on a non-existent key treats it as 0 and creates it, which is correct. But the Lua script needs to know the cap value, which comes from Postgres (`executions.budgetCapCents`). The Lua script needs the cap passed as an argument — it cannot look it up from Redis unless the cap is also stored in Redis at execution start.

**How to avoid:** When an execution starts (on `execution_created` event or execution start logic), write the cap to Redis: `SET budget:cap:{executionId} {budgetCapCents}`. The Lua script then reads the cap from this key. Alternative: Pass the cap as a ARGV argument to the Lua script (query Postgres for the cap before calling eval). The latter avoids extra Redis keys but adds a DB round-trip per billing event.

**Recommendation:** Store the cap in Redis at execution start (`SET budget:cap:{executionId} {budgetCapCents}`) so the Lua script can read it atomically without a DB call. Set an appropriate TTL (e.g., `runtimeLimitSeconds + 24h` as buffer).

### Pitfall 7: `ioredis.eval()` Type Signature Complexity

**What goes wrong:** TypeScript types for `ioredis`'s `eval` command are complex. `redis.eval(script, numkeys, key, arg1, arg2)` returns `unknown` in the type definitions, requiring type assertions. Getting the argument order wrong (numkeys before keys, keys before args) causes silent failures.

**Why it happens:** IORedis wraps the Redis `EVAL` command which has a specific argument layout: `EVAL script numkeys [key ...] [arg ...]`.

**How to avoid:** Test the Lua script manually with `redis-cli` first:
```bash
redis-cli EVAL "local val = redis.call('INCRBY', KEYS[1], ARGV[1]); return val" 1 "budget:test" 500
```
Then verify the TypeScript call signature matches. Always cast the result with a comment explaining the return shape.

---

## Code Examples

Verified patterns from official sources and codebase analysis:

### Pub/Sub Subscriber Setup

```typescript
// Source: @google-cloud/pubsub subscription.d.ts (verified in installed library)
// on(event: 'message', listener: (message: Message) => void): this;

import { PubSub } from '@google-cloud/pubsub';
import type { Message } from '@google-cloud/pubsub';

export function startBotLifecycleSubscriber(): () => Promise<void> {
  const pubsub = new PubSub({
    projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
  });

  // Subscription name must match Terraform-provisioned name (with env suffix)
  // or emulator auto-created name
  const subName = process.env.BOT_LIFECYCLE_SUBSCRIPTION ?? 'bot-lifecycle-sub';
  const subscription = pubsub.subscription(subName);

  subscription.on('message', async (message: Message) => {
    try {
      const payload = JSON.parse(message.data.toString()) as unknown;
      await handleBotLifecycleEvent(payload);
      message.ack();
    } catch (err) {
      console.error('[billing-engine] Failed to process message:', err);
      message.nack(); // triggers redelivery up to max_delivery_attempts
    }
  });

  subscription.on('error', (err) => {
    console.error('[billing-engine] Subscription error (non-fatal):', err);
    // Do NOT crash — library auto-reconnects
  });

  // Return shutdown function
  return async () => {
    await subscription.close();
  };
}
```

### Atomic Budget Enforcement Lua Script

```typescript
// Redis Lua script for atomic budget cap enforcement
// KEYS[1] = budget spend key (e.g., "budget:spend:{executionId}")
// KEYS[2] = budget cap key (e.g., "budget:cap:{executionId}")
// ARGV[1] = amount to spend in cents
// Returns: [newTotal (number), capExceeded (0 or 1)]

const BUDGET_ENFORCE_SCRIPT = `
local spend_key = KEYS[1]
local cap_key = KEYS[2]
local amount = tonumber(ARGV[1])
local cap = tonumber(redis.call('GET', cap_key))
if cap == nil then
  -- No cap set: allow all spending
  local new_total = redis.call('INCRBY', spend_key, amount)
  return {new_total, 0}
end
local new_total = redis.call('INCRBY', spend_key, amount)
if new_total > cap then
  return {new_total, 1}
end
return {new_total, 0}
`;

async function enforceAtomicBudget(
  redis: IORedis,
  executionId: string,
  amountCents: number,
): Promise<{ newTotalCents: number; capExceeded: boolean }> {
  const result = (await redis.eval(
    BUDGET_ENFORCE_SCRIPT,
    2,
    `budget:spend:${executionId}`,
    `budget:cap:${executionId}`,
    amountCents.toString(),
  )) as [number, number];

  return {
    newTotalCents: result[0],
    capExceeded: result[1] === 1,
  };
}
```

### Guardrail Watchdog — setInterval Pattern

```typescript
// Follows existing idle-checker pattern in bot-orchestrator.ts
// Source: codebase (startIdleChecker / stopIdleChecker pattern)

const WATCHDOG_INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS ?? 10_000);

export function startGuardrailWatchdog(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      await checkRateViolations();     // checks rl:calls:* and rl:tokens:* Redis keys
      await checkLoopBehavior();        // queries tool_invocations for repetitive patterns
    } catch (err) {
      console.error('[guardrail-watchdog] Polling error:', err);
      // Do NOT re-throw — watchdog must survive errors
    }
  }, WATCHDOG_INTERVAL_MS);
}

export function stopGuardrailWatchdog(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}
```

### Bot Deny-List — Revocation Pattern

```typescript
// In guardrail-watchdog.ts — called when violation detected
async function revokeBot(
  redis: IORedis,
  botId: string,
  executionId: string,
  reason: 'rate_limit' | 'loop_detected' | 'budget_exceeded' | 'idle_timeout',
): Promise<void> {
  // 1. Add to Redis deny-list with TTL (max execution runtime + buffer)
  const TTL_SECONDS = Number(process.env.GUARDRAIL_DENY_TTL_SECONDS ?? 3600);
  await redis.setex(`guardrail:denied:${botId}`, TTL_SECONDS, '1');

  // 2. Stop the container (reuse existing stopBot from bot-orchestrator)
  await stopBot(botId, 'terminated');

  // 3. Publish guardrail_triggered event to Pub/Sub
  await publishGuardrailTriggered({
    type: 'guardrail_triggered',
    botId,
    executionId,
    reason,
    action: 'revoked',
    timestamp: new Date().toISOString(),
  });
}
```

### Tool Gateway Deny-List Check Addition

```typescript
// Add to services/tool-gateway/src/routes/tool-invoke.ts
// Before allowlist check — first security gate

// 0. Bot deny-list check (GARD-02, GARD-03, GARD-04)
const isDenied = await redis.get(`guardrail:denied:${botId}`);
if (isDenied) {
  return reply.status(403).send({
    success: false,
    error: 'Bot has been revoked by guardrail watchdog',
  });
}
```

### Billing Event Persistence

```typescript
// In billing-engine.ts — insert billing_events row
// Source: packages/db/src/schema/billing-events.ts (verified)

import { db, billingEvents } from '@claw/db';

async function writeBillingEvent(event: {
  executionId: string;
  botId?: string;
  eventType: 'bot_started' | 'bot_stopped' | 'tool_invoked' | 'execution_completed' | 'budget_exceeded';
  amountCents?: number;
  tokenCount?: number;
}): Promise<void> {
  await db.insert(billingEvents).values({
    executionId: event.executionId,
    botId: event.botId,
    eventType: event.eventType,
    amountCents: event.amountCents,
    tokenCount: event.tokenCount,
    occurredAt: new Date(),
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Poll Postgres for budget check | Redis atomic Lua script INCRBY | Standard practice since Redis 2.6 | Eliminates TOCTOU race; sub-millisecond latency vs tens-of-milliseconds for Postgres |
| Application-level read-then-write rate control | rate-limiter-flexible Lua atomics | Phase 3 established this pattern | Already proven; reuse for budget enforcement |
| Pub/Sub push subscriptions (HTTP endpoint) | Pub/Sub pull subscriptions (event listener) | Always available | Pull avoids public HTTP endpoint requirement; works in private networks |
| Separate billing service process | Module within execution-service | Architecture decision for Phase 4 | Reduces operational overhead; both consume same events |
| Integer INCR for budget (losing fractional cents) | Integer cents throughout | Phase 1 decision | Consistent with `budgetCapCents` and `amountCents` field naming in schemas |

**Deprecated/outdated:**
- Topic names `bot-events`, `execution-events`, `task-events` in `publisher.ts`: Will be superseded by Terraform-aligned names in Phase 4 plan 04-01.
- Hardcoded LLM token costs: Never acceptable — must come from env vars or config.

---

## Phase 4 Plan Decomposition Notes

### 04-01: GCP Cloud Pub/Sub Event Bus Setup

**Scope:** Resolve topic name mismatch, add billing and guardrail publisher functions to `publisher.ts`, add emulator topic setup to docker-compose (or verify auto-creation behavior), define subscription names via env vars.

**Key tasks:**
1. Audit current topic names (`bot-events` etc.) vs Terraform names (`bot-lifecycle-{env}` etc.)
2. Add `BILLING_EVENTS_TOPIC`, `GUARDRAIL_EVENTS_TOPIC` publisher functions to `publisher.ts`
3. Add `publishBillingEvent()` and `publishGuardrailTriggered()` using existing billing/guardrail Zod schemas from `@claw/event-schemas`
4. Verify Pub/Sub emulator auto-creates topics on first publish (no setup script needed for local dev)
5. Document subscription names for 04-02 and 04-03 to use

**Important:** The `@claw/event-schemas` package already has `billingEventSchema`, `budgetExceededEventSchema`, and `guardrailTriggeredEventSchema` — use these for validation in publisher functions (same pattern as existing `publishBotStarted`).

### 04-02: Guardrail Watchdog

**Scope:** New `events/guardrail-watchdog.ts` module in execution-service. `setInterval`-based polling. Redis deny-list write. Pub/Sub guardrail event publish. Tool Gateway deny-list check.

**Key tasks:**
1. Create `guardrail-watchdog.ts` with `startGuardrailWatchdog()` / `stopGuardrailWatchdog()` following idle-checker pattern
2. Implement rate violation detection (read `rl:calls:{botId}` Redis keys populated by rate-limiter-flexible)
3. Implement loop detection (query `tool_invocations` for last N calls per active bot, compare args hashes)
4. Implement idle timeout detection (read `lastHeartbeatAt` from bots table or Redis)
5. Implement `revokeBot()`: Redis deny-list SETEX + `stopBot()` + `publishGuardrailTriggered()`
6. Add deny-list check to Tool Gateway `/tool.invoke` handler (BEFORE allowlist check)
7. Start watchdog in execution-service `main.ts` (alongside idle-checker and QueueEvents listener)

**Note on GARD-05 (idle timeout):** The existing idle-checker in `bot-orchestrator.ts` already handles idle timeout via `lastTaskClaimedAt`. The Guardrail Watchdog should reuse or delegate to this existing mechanism rather than duplicating it. GARD-05 requires emitting a `guardrail_triggered` event — add this to the existing `stopBot()` call for idle_timeout reason.

### 04-03: Billing Engine

**Scope:** New `events/billing-engine.ts` module in execution-service. Pub/Sub subscriber for bot-lifecycle events. Atomic Redis budget cap enforcement. Billing event persistence. Bot-hours and cost calculation.

**Key tasks:**
1. Create `billing-engine.ts` with `startBillingEngine()` / `stopBillingEngine()`
2. Subscribe to bot-lifecycle events: handle `bot_started`, `bot_stopped`
3. Subscribe to billing events: handle `tool_invoked` (extract token counts from event or query `tool_invocations`)
4. Implement `enforceAtomicBudget()` Lua script
5. Implement `writeBillingEvent()` to insert `billing_events` rows
6. Implement `recordBotHours()` to insert `telemetry` rows on `bot_stopped`
7. Implement `calculateTokenCost()` using env-var rates
8. Initialize budget Redis key on execution start (in execution.service.ts or execution creation flow)
9. On `capExceeded`: publish `budget_exceeded` event, stop all execution bots, transition execution to 'stopped'
10. Start billing engine in execution-service `main.ts`

---

## Open Questions

1. **Which topics does the Billing Engine subscribe to?**
   - What we know: The billing engine needs `bot_started`, `bot_stopped` events (from bot-lifecycle topic) and LLM token data. Token data is in `tool_invocations` Postgres table. Alternatively, the Tool Gateway could publish a `tool_invoked` billing event directly.
   - What's unclear: Should the Tool Gateway publish a `billing_event` to the `billing-events` Pub/Sub topic on each `llm_call` completion, or should the Billing Engine query `tool_invocations` periodically?
   - Recommendation: The Tool Gateway already has all token data at call time. Add a `publishBillingEvent({ eventType: 'tool_invoked', amountCents, tokenCount })` call in `tool-invoke.ts` after a successful `llm_call`. This avoids polling Postgres and keeps billing data flowing through the event bus. The planner should choose this approach.

2. **How does the budget cap get initialized in Redis?**
   - What we know: `executions.budgetCapCents` exists in Postgres. The atomic budget Lua script needs the cap value.
   - What's unclear: Where/when is the Redis budget cap key set?
   - Recommendation: In the execution creation flow (execution.service.ts `createExecution()`), after inserting the execution row, call `redis.set('budget:cap:{executionId}', budgetCapCents.toString())` with a TTL of `runtimeLimitSeconds + 86400` seconds. This is a straightforward single-line addition.

3. **Should the Guardrail Watchdog subscribe to Pub/Sub events OR poll Redis/Postgres?**
   - What we know: Rate violation data is in Redis (rate-limiter-flexible keys). Loop data is in Postgres (tool_invocations). GARD-05 idle timeout is already in bot-orchestrator.
   - What's unclear: Whether the Watchdog should be event-driven (subscribe to `tool_invoked` billing events) or polling-based (read Redis/DB on interval).
   - Recommendation: Use polling for simplicity (matches existing idle-checker pattern). The event-driven approach requires the Watchdog to maintain per-bot state between events, which is more complex. Polling every 10s is fast enough for the success criteria ("within one Guardrail Watchdog polling interval").

4. **Does the existing idle timeout emit a `guardrail_triggered` event?**
   - What we know: `stopBot(botId, 'idle_timeout')` in `bot-orchestrator.ts` calls `publishBotStopped` but NOT `publishGuardrailTriggered`.
   - What's unclear: GARD-05 and GARD-06 require idle timeout to produce a guardrail event.
   - Recommendation: Modify `stopBot()` in bot-orchestrator.ts to also call `publishGuardrailTriggered` when reason is `idle_timeout`. This satisfies GARD-05 + GARD-06 without a separate Watchdog concern.

5. **What is the Guardrail Watchdog polling interval for the success criteria?**
   - What we know: SC#2 says "revoked within one Guardrail Watchdog polling interval." The interval is configurable.
   - What's unclear: What default interval satisfies the success criteria? The criterion is testing that the revocation IS prompt, not testing a specific time bound.
   - Recommendation: Default to 10 seconds (`WATCHDOG_INTERVAL_MS=10000`), configurable via env var. For E2E tests, override to 2-3 seconds (same pattern as `IDLE_CHECK_INTERVAL_MS`).

---

## Sources

### Primary (HIGH confidence)

- Codebase: `/services/execution-service/src/events/publisher.ts` — existing PubSub publish pattern, topic names, Zod validation before publish
- Codebase: `/services/execution-service/src/orchestrator/bot-orchestrator.ts` — existing setInterval watchdog pattern (startIdleChecker), stopBot pattern
- Codebase: `/services/tool-gateway/src/middleware/rate-limit.ts` — rate-limiter-flexible RateLimiterRedis pattern, consume-after-return
- Codebase: `/packages/event-schemas/src/` — all event type schemas already defined (billing, guardrail, bot, execution)
- Codebase: `/packages/db/src/schema/` — billing_events, telemetry, bots, tool_invocations tables all confirmed
- Codebase: `/infra/terraform/modules/pubsub/main.tf` — Terraform-provisioned topic and subscription names confirmed
- Library: `/services/execution-service/node_modules/@google-cloud/pubsub/build/src/subscription.d.ts` — confirmed `subscription.on('message', handler)` API
- `@google-cloud/pubsub` version: 5.2.3 (confirmed in execution-service package.json)
- Redis `EVAL` Lua script atomicity: Standard Redis documentation — EVAL is atomic by design

### Secondary (MEDIUM confidence)

- https://redis.io/docs/latest/commands/eval/ — EVAL command syntax and atomicity guarantee
- https://github.com/googleapis/nodejs-pubsub — @google-cloud/pubsub README, subscriber patterns, ack/nack semantics
- https://github.com/animir/node-rate-limiter-flexible — confirmed RateLimiterRedis uses Lua scripts internally

### Tertiary (LOW confidence — validate before acting)

- LLM token pricing rates: Must be sourced from current provider documentation at implementation time; rates change frequently
- Pub/Sub at-least-once delivery implications: Tested behavior in production vs emulator may differ; validate deduplication logic in E2E tests

---

## Metadata

**Confidence breakdown:**
- Pub/Sub subscriber API: HIGH — library installed, types verified in node_modules, publisher pattern already working in codebase
- Redis atomic budget enforcement: HIGH — pattern is standard Redis best practice; EVAL atomicity is guaranteed by Redis design
- Guardrail Watchdog architecture: HIGH — follows existing idle-checker pattern exactly; setInterval + Redis + stopBot is proven
- Loop detection algorithm: MEDIUM — the approach (query tool_invocations, compare args hashes) is sound but the exact threshold (N identical calls) needs tuning; may produce false positives without careful args comparison
- Billing cost calculation: MEDIUM — integer cents arithmetic is solid; the 1% margin requirement is achievable, but token cost rates must come from env vars (cannot be verified as correct without current provider pricing)
- Topic name alignment: HIGH — mismatch between publisher.ts and Terraform confirmed by code inspection; resolution approach is clear

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days — @google-cloud/pubsub and core libraries are stable; Redis Lua eval semantics are stable; LLM pricing data expires immediately)
