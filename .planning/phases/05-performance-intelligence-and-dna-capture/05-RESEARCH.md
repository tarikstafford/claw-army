# Phase 5: Performance Intelligence and DNA Capture - Research

**Researched:** 2026-02-18
**Domain:** Post-run analytics, composite scoring, JSONB storage, PII redaction patterns
**Confidence:** HIGH (codebase-grounded; all findings verified against actual source files)

---

## Summary

Phase 5 is a pure backend analytics phase. No new external service dependencies are required. All data needed to compute scores, generate reports, and extract DNA already exists in the database from Phases 2–4. The work is: read existing data, compute derived values, write them to new columns or existing tables, and expose query endpoints on the execution-service.

The correct architectural choice is to add a `performance-engine` module inside `services/execution-service` rather than creating a new service. The completion-checker is already the trigger point: `checkExecutionCompletion` in `orchestrator/completion-checker.ts` transitions the execution to `completed` and publishes `execution_completed`. Phase 5 code hooks there — after the transition — to kick off the performance pipeline.

The schema needs two additions: (1) score component columns on `bots` (or a new `bot_scores` table — see open question below), and (2) the `dna_store` table already exists and is fully structured. The `telemetry` table's generic `metric_name` / `metric_value` pattern is reusable for storing the four score components as named rows, which avoids a schema migration and matches how `bot_hours` is already stored there.

PII redaction for DNA is straightforward: the `DnaPayload` interface already excludes raw LLM outputs and customer data by design — it only stores structural patterns. The work is ensuring the extraction logic never writes task results or prompt content verbatim.

**Primary recommendation:** Add a `services/performance-engine.ts` module to `execution-service`, triggered from `completion-checker.ts` after the `running → completed` transition. Use the existing `telemetry` table for the four score components (matching the `bot_hours` pattern), add `composite_score` and `tier` columns to `bots`, and expose report/leaderboard queries as new routes in `routes/executions.ts`.

---

## Standard Stack

### Core (already in the project — no new installs)

| Library | Version | Purpose | Already Used In |
|---------|---------|---------|----------------|
| drizzle-orm | 0.45.1 | DB queries, inserts, aggregations | All services |
| pg | ^8.18.0 | PostgreSQL driver | db package, execution-service |
| fastify | ^5.7.4 | HTTP endpoint for report/leaderboard | execution-service |
| @sinclair/typebox | ^0.34.48 | Route schema validation | execution-service routes |
| zod | ^4.3.6 | Event schema validation | event-schemas, billing-engine |

### No New Dependencies Required

Phase 5 needs no new npm packages. All computation is straightforward arithmetic on integers and numerics. No LLM calls are needed during scoring. No new Pub/Sub topics are needed (the `execution_completed` event already fires from `completion-checker.ts`).

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (additions to execution-service)

```
services/execution-service/src/
├── events/
│   ├── billing-engine.ts         (Phase 4, existing)
│   └── guardrail-watchdog.ts     (Phase 4, existing)
├── orchestrator/
│   └── completion-checker.ts     (Phase 4, trigger point for Phase 5)
├── performance/                  (NEW — Phase 5 domain)
│   ├── metrics-computer.ts       (PERF-01, PERF-02, PERF-03: compute raw metrics)
│   ├── score-engine.ts           (PERF-04, PERF-05: composite score + tier)
│   ├── report-builder.ts         (PERF-06: execution summary report)
│   └── dna-capture.ts            (DNA-01 through DNA-04)
├── routes/
│   └── executions.ts             (extend with /report and /leaderboard routes)
└── services/
    └── execution.service.ts      (Phase 4, existing)
```

### Pattern 1: Trigger from Completion-Checker

**What:** After `transitionExecution(executionId, 'running', 'completed')` returns `true`, call `runPerformancePipeline(executionId)` asynchronously (non-blocking — same pattern as the `setImmediate` in routes/executions.ts).

**Why:** The completion-checker already guards the transition atomically via `UPDATE...WHERE...RETURNING`. The `if (transitioned)` block is the safe, single-entry point for post-completion side effects.

**Current completion-checker.ts hook point:**
```typescript
// completion-checker.ts line 29–54
if (transitioned) {
  await publishExecutionStatusChanged({...});
  await publishBillingEvent({...});

  // Phase 5 hook — add after publishBillingEvent:
  // runPerformancePipeline(executionId).catch((err) => {
  //   console.error('[performance-engine] Pipeline error (non-fatal):', err);
  // });
}
```

**When to use:** This is the only correct trigger point. Do not use a Pub/Sub subscription for the performance pipeline — the execution-service already has the execution in scope and a Pub/Sub round-trip adds latency and complexity for no benefit (the performance pipeline runs once per execution, not at scale).

### Pattern 2: Telemetry Table for Score Components

**What:** Store each of the four score components (success_rate_score, efficiency_score, cost_efficiency_score, stability_score) as named rows in the `telemetry` table — one row per metric per bot — using the same `metric_name` / `metric_value` pattern already used for `bot_hours`.

**Why:** The `telemetry` table already has `(bot_id, metric_name)` composite index. The Phase 5 success criterion requires components to be "queryable independently." Using `telemetry` avoids a new migration. Adding columns to `bots` for `composite_score` and `tier` is still necessary for leaderboard sorting and querying.

**Telemetry metric names (proposed):**
```
success_rate_score      -- 0–100, weighted input for composite (weight: 40%)
efficiency_score        -- 0–100, weighted input for composite (weight: 30%)
cost_efficiency_score   -- 0–100, weighted input for composite (weight: 20%)
stability_score         -- 0–100, weighted input for composite (weight: 10%)
```

**Example insert pattern (matching billing-engine.ts recordBotHours):**
```typescript
// Source: packages/db/src/schema/telemetry.ts + billing-engine.ts line 148–153
await db.insert(telemetry).values({
  executionId,
  botId,
  metricName: 'success_rate_score',
  metricValue: successRateScore.toFixed(6),
});
```

### Pattern 3: Schema Migration for Bot Score Fields

**What:** Add `composite_score` (numeric 5,2) and `tier` (varchar or enum: 'high'/'medium'/'low') columns to the `bots` table via a new Drizzle migration. These support the leaderboard query (`ORDER BY composite_score DESC`).

**Why:** Storing composite_score in `bots` enables a single-table sort for the leaderboard without a `GROUP BY` on `telemetry`. The `telemetry` rows provide the component audit trail; the `bots` column provides the fast sort key.

**Migration approach:** Add columns to bots.ts schema, run `pnpm db:generate` to create the migration SQL, then `pnpm db:migrate`.

### Pattern 4: DNA Extraction — Structural Patterns Only

**What:** Extract DNA from `tool_invocations` (for tool call sequence, argument patterns, timing profile, token distribution) and bot runtime metadata. Do NOT read from `tasks.result` (which contains raw LLM output/customer data).

**Available structural data (PII-safe):**
```
tool_invocations.tool_name       → toolCallSequence: string[]
tool_invocations.request_summary → argumentPatterns (JSONB summaries, not raw prompts)
tool_invocations.duration_ms     → timingProfile
tool_invocations.total_tokens    → tokenDistribution
tool_invocations.invoked_at      → timing sequence
bots.tasks_claimed/completed     → retry strategy inference
telemetry (bot_hours)            → runtime framing
```

**DnaPayload interface (already defined in dna-store.ts):**
```typescript
// Source: packages/db/src/schema/dna-store.ts lines 13–21
export interface DnaPayload {
  systemPromptTemplate: string;    // structural template, not actual prompts
  toolCallSequence: string[];      // ordered list of tool names
  argumentPatterns: Record<string, unknown>;  // shape of args, not values
  retryStrategy: Record<string, unknown>;     // attempt counts, timing
  timingProfile: Record<string, unknown>;     // durations
  tokenDistribution: Record<string, unknown>; // token counts by tool/step
}
```

**Versioning pattern:** Always INSERT a new row (never UPDATE). Use `MAX(version) + 1` for the new version number scoped to `(bot_id, objective_category)`.

### Pattern 5: Leaderboard and Report Routes

**What:** Extend `routes/executions.ts` with two new routes:
- `GET /executions/:id/report` — returns execution summary (PERF-06)
- `GET /executions/:id/leaderboard` — returns bots sorted by composite_score DESC (PERF-07)

**Why:** These are query-only endpoints over existing data. Adding them to the existing Fastify plugin in `routes/executions.ts` requires no new service, no new Fastify instance, no new port.

### Anti-Patterns to Avoid

- **Computing scores inline during bot execution:** Scores are computed POST-RUN only. Never try to compute scores during an active execution — the metrics won't be complete.
- **Storing raw LLM output in dna_payload:** The `request_summary` and `response_summary` JSONB fields in `tool_invocations` are summaries (already abstracted). Do not use `tasks.result` as a DNA source — it contains raw customer/LLM output.
- **Using floats for cost values:** All monetary values are integer cents throughout the codebase. The `cost_per_successful_task` metric must be computed in integer cents and can be displayed with division.
- **Overwriting DNA records:** Use INSERT only. The versioning requirement (DNA-03, SC#5) mandates immutable append-only records.
- **Blocking the completion transition with performance work:** The pipeline should be fire-and-forget from the completion-checker. A failure in scoring must not roll back the `completed` status.

---

## What Data is Already Available (Verified Against Schema)

### From `bots` table

| Column | Type | Available For |
|--------|------|---------------|
| `tasks_claimed` | integer | Retry rate calculation |
| `tasks_completed` | integer | Success rate numerator |
| `tasks_failed` | integer | Success rate denominator, error frequency |
| `started_at` | timestamp | Runtime duration |
| `stopped_at` | timestamp | Runtime duration |
| `execution_id` | uuid | Join key |

**VERIFIED GAP:** `tasks_claimed`, `tasks_completed`, `tasks_failed` are ALWAYS ZERO in practice — the bot-worker (`reasoning-loop.ts`) does not update these counters. Phase 5 MUST compute success/failure counts from the `tasks` table using `claimed_by_bot_id = $botId` as the source of truth.

### From `tasks` table

| Column | Type | Available For |
|--------|------|---------------|
| `claimed_by_bot_id` | uuid | Link tasks to bots |
| `status` | enum | completed vs failed count per bot |
| `attempt_count` | integer | Retry count per task |

**Key insight:** `tasks.attempt_count` is the canonical retry count source. `tasks WHERE claimed_by_bot_id = $botId AND status = 'completed'` gives successful tasks per bot.

### From `billing_events` table

| Column | Type | Available For |
|--------|------|---------------|
| `amount_cents` | integer | Cost per bot (filter by `bot_id` + `event_type = 'tool_invoked'`) |
| `token_count` | integer | Token usage per bot |
| `event_type` | enum | Filter for `tool_invoked` events only for cost |
| `bot_id` | uuid | Per-bot cost summation |

**Total cost per bot:** `SUM(amount_cents) WHERE bot_id = $botId AND event_type = 'tool_invoked'`.

### From `telemetry` table

| `metric_name` | Type | Populated By |
|---------------|------|-------------|
| `bot_hours` | numeric | billing-engine.ts `recordBotHours()` on bot_stopped |

**Key insight:** `bot_hours` is already stored per-bot in telemetry. Phase 5 reads this directly for efficiency metric and execution report total bot-hours.

### From `tool_invocations` table

| Column | Type | Available For |
|--------|------|---------------|
| `tool_name` | varchar(50) | Tool call sequence, tool calls/task |
| `duration_ms` | integer | Timing profile for DNA |
| `total_tokens` | integer | Tokens/task, token distribution for DNA |
| `request_summary` | jsonb | Argument pattern extraction (PII-safe — summaries) |
| `rejected` | boolean | Error rate contribution |
| `invoked_at` | timestamp | Ordering for sequence and timing |

---

## Composite Score Formula

**Confirmed formula (from phase description and PERF-04):**

```
composite_score = (
  success_rate_score   * 0.40 +
  efficiency_score     * 0.30 +
  cost_efficiency_score * 0.20 +
  stability_score      * 0.10
) → normalized 0–100
```

**Component computation approach (all normalized 0–100):**

| Component | Raw Metric | Normalization |
|-----------|------------|---------------|
| `success_rate_score` | `tasks_completed / (tasks_completed + tasks_failed)` | × 100 |
| `efficiency_score` | tasks/min, tokens/task, tool_calls/task, idle_ratio composite | normalize against execution max |
| `cost_efficiency_score` | `total_cost_cents / tasks_completed` (inverted — lower is better) | normalize: `(max_cost - bot_cost) / (max_cost - min_cost) × 100` |
| `stability_score` | error frequency (rejected tool calls + failed tasks) | normalize against execution max |

**Tier assignment (PERF-05):**
- High: composite_score >= 75 (configurable threshold)
- Medium: composite_score >= 40
- Low: composite_score < 40

**Note from STATE.md:** "Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Plan to iterate after first real execution data is collected." Treat thresholds as env-var configurable from day one.

---

## Elite Bot Identification (DNA-01)

**Three conditions (all must be true):**
1. `composite_score > DNA_ELITE_THRESHOLD` (env-var, suggested default: 75)
2. `composite_score > execution_average_score × (1 + DNA_ABOVE_AVERAGE_PCT / 100)` (env-var, suggested default: 20%)
3. `error_rate < DNA_ERROR_RATE_CEILING` (env-var, suggested default: 0.10 = 10%)

**Where `error_rate`** = `tasks_failed / (tasks_completed + tasks_failed)`.

All three thresholds must be env-var configurable and documented.

---

## DNA Versioning Pattern

The `dna_store` table has:
```sql
"version" integer DEFAULT 1 NOT NULL
```

There is NO unique constraint on `(bot_id, objective_category, version)` in the current schema (verified from migration 0000). This is a gap — without a unique constraint, concurrent captures could create duplicate version numbers.

**Options:**
1. Add a unique constraint `(bot_id, objective_category, version)` via migration
2. Use `INSERT ... SELECT MAX(version) + 1 WHERE bot_id = $botId AND objective_category = $cat` in a transaction

Option 1 is safer. The migration can be added in plan 05-01 or 05-03.

**Versioning query pattern:**
```typescript
// Get next version number
const result = await db
  .select({ maxVersion: sql<number>`COALESCE(MAX(${dnaStore.version}), 0)` })
  .from(dnaStore)
  .where(and(
    eq(dnaStore.botId, botId),
    eq(dnaStore.objectiveCategory, objectiveCategory),
  ));
const nextVersion = (result[0]?.maxVersion ?? 0) + 1;
```

---

## Trigger Point: completion-checker.ts

The performance pipeline trigger is `completion-checker.ts`. Specifically, the `if (transitioned)` block at line 31:

```typescript
// services/execution-service/src/orchestrator/completion-checker.ts
if (transitioned) {
  await publishExecutionStatusChanged({...});    // line 33
  await publishBillingEvent({...});              // line 45

  // Phase 5 adds here (non-blocking, fire-and-forget):
  runPerformancePipeline(executionId).catch((err) =>
    console.error('[performance-engine] Pipeline error:', err)
  );
}
```

The `runPerformancePipeline` function should:
1. Compute and store score components in `telemetry`
2. Compute composite score and tier, update `bots` table
3. Build and cache execution report (or compute on demand)
4. Identify elite bots and run DNA capture

---

## Service Architecture Decision

**Verdict: Add to execution-service (not a new service)**

Reasons:
1. The trigger point is already inside execution-service (completion-checker.ts)
2. All DB tables are already accessible via `@claw/db`
3. No new infrastructure needed (no new queues, subscriptions, or services)
4. Performance computation is CPU-light arithmetic — no reason to isolate it
5. The report/leaderboard endpoints belong on the existing Fastify server at the same port (3001)
6. Adding a new service adds Docker Compose, Dockerfile, package.json, and deployment overhead for no architectural gain at this scale

The Phase 4 pattern (billing-engine.ts and guardrail-watchdog.ts as modules inside execution-service) establishes this precedent clearly.

---

## Schema Changes Required (New Migration)

Phase 5 needs one new Drizzle migration:

**Additions to `bots` table:**
```sql
ALTER TABLE "bots" ADD COLUMN "composite_score" numeric(5, 2);
ALTER TABLE "bots" ADD COLUMN "tier" varchar(10);   -- 'high', 'medium', 'low'
```

These are nullable initially (populated only after execution completes).

**Optional — unique constraint on dna_store:**
```sql
ALTER TABLE "dna_store" ADD CONSTRAINT "dna_store_bot_objective_version_unique"
  UNIQUE ("bot_id", "objective_category", "version");
```

**Index for leaderboard query:**
```sql
CREATE INDEX "bots_composite_score_idx" ON "bots" USING btree ("composite_score" DESC NULLS LAST);
```

No new tables are needed. The `telemetry` table handles score components. `dna_store` is already defined. `bots` needs two new nullable columns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL aggregation | Custom loop over JS arrays | Drizzle ORM `sql<>` template + `sum()`, `avg()`, `count()` | DB-side aggregation is faster and avoids loading all rows to JS |
| Score normalization | Complex normalization library | Inline arithmetic — it's just `(val - min) / (max - min) * 100` | The formula is fixed; no library needed |
| PII detection | NLP library or regex scanning | Structural design — only extract predefined fields from predefined columns | The DNA schema is already structured to avoid PII; don't scan, just don't include |
| Versioning lock | Distributed lock (Redis) | PostgreSQL transaction with MAX(version)+1 | Single write path, no contention at this scale |
| Configuration | Hardcoded thresholds | `process.env` with documented defaults | Matches existing codebase pattern (WATCHDOG_INTERVAL_MS, LOOP_DETECTION_WINDOW, etc.) |

**Key insight:** Phase 5 is arithmetic on already-collected data. The complexity is in correctly identifying which data sources to use and ensuring normalization is consistent — not in the computation itself.

---

## Common Pitfalls

### Pitfall 1: Missing Bot Counters (tasks_claimed/completed/failed)

**What goes wrong:** The `bots` schema has `tasks_claimed`, `tasks_completed`, `tasks_failed` columns. If the bot-worker does not UPDATE these on every task claim/completion/failure, Phase 5 will read zeros and all success rates will be 0% or undefined.

**Why it happens:** The columns exist in the schema but the write path in bot-worker may not maintain them. The Phase 4 tests did not validate these counters.

**How to avoid:** Before writing scoring logic, verify the bot-worker updates these counters (check `services/bot-worker/src/reasoning-loop.ts`). If not, compute success counts from `tasks WHERE claimed_by_bot_id = $botId` as a fallback.

**Warning signs:** All bots score 0 on success_rate_score. Check `SELECT tasks_completed, tasks_failed FROM bots` for any completed execution.

### Pitfall 2: Division by Zero in Normalization

**What goes wrong:** If only one bot ran (or all bots have identical scores), `max - min = 0` and normalization divides by zero.

**Why it happens:** Cost efficiency normalization uses `(max_cost - bot_cost) / (max_cost - min_cost)`. Single-bot executions or uniform-performance executions collapse this.

**How to avoid:** Guard all normalization with `if (max === min) return 100` (everyone scores max when there's no variance). Document this edge case in code.

### Pitfall 3: Cost Efficiency When Zero Tasks Completed

**What goes wrong:** `cost_per_successful_task = total_cost / tasks_completed`. A bot that completed zero tasks causes divide-by-zero and should score 0 on this component, not infinity.

**How to avoid:** Guard: `if (tasksCompleted === 0) return 0`.

### Pitfall 4: DNA Capture from Wrong Data Source

**What goes wrong:** Using `tasks.result` or `tool_invocations.response_summary` directly in `dna_payload` — these may contain raw LLM output or customer data verbatim.

**Why it happens:** `response_summary` sounds like a safe summary but may contain full LLM outputs depending on what the tool-gateway wrote. Check what the tool-gateway writes to `response_summary` before using it.

**How to avoid:** Use only structural metadata for DNA:
- `tool_invocations.tool_name` — safe (tool names are predefined strings)
- `tool_invocations.request_summary` — inspect what tool-gateway writes here before trusting it
- `tool_invocations.duration_ms`, `total_tokens` — safe (numeric)
- `bots.tasks_claimed`, `attempt_count` from tasks — safe (counters)

**Do NOT use:** `tasks.result`, `tool_invocations.response_summary` without inspection.

### Pitfall 5: Performance Pipeline Blocking Completion

**What goes wrong:** If `runPerformancePipeline` throws and is awaited synchronously inside `checkExecutionCompletion`, a scoring error rolls back or prevents the execution from being marked completed.

**How to avoid:** Always call the pipeline with `.catch()` and never await it in the completion-checker. The execution status must be immutable after the `transitioned = true` branch runs.

### Pitfall 6: Idle Ratio Calculation Without Start/Stop Times

**What goes wrong:** Idle ratio = `idle_time / total_runtime`. If `bots.stopped_at` is null (bot was revoked/budget-exceeded, not cleanly stopped), total_runtime calculation breaks.

**How to avoid:** Fallback to `NOW()` for `stopped_at` if null. Use `bot_hours` from telemetry as the total runtime source rather than recomputing from timestamps — it was already computed correctly by `recordBotHours` in billing-engine.ts.

---

## Code Examples

### Drizzle Aggregation Pattern (used in Phase 4 guardrail-watchdog)

```typescript
// Source: services/execution-service/src/events/guardrail-watchdog.ts lines 114–123
const [callRow] = await db
  .select({ count: sql<number>`cast(count(*) as int)` })
  .from(toolInvocations)
  .where(
    and(
      eq(toolInvocations.botId, botId),
      sql`${toolInvocations.invokedAt} > ${cutoff}`,
    ),
  );
const callCount = callRow?.count ?? 0;
```

### Telemetry Insert Pattern (used in billing-engine)

```typescript
// Source: services/execution-service/src/events/billing-engine.ts lines 148–153
await db.insert(telemetry).values({
  executionId,
  botId,
  metricName: 'bot_hours',
  metricValue: botHours.toFixed(6),
});
```

### Non-Blocking Pipeline Trigger Pattern

```typescript
// Source: services/execution-service/src/routes/executions.ts line 59
setImmediate(async () => {
  try {
    // async pipeline work here
  } catch (err) {
    fastify.log.error({ err }, 'Pipeline error');
  }
});
```

### Cost Per Bot Query (from billing_events)

```typescript
// Derived from Phase 4 E2E test billing_events cost query pattern
// Source: services/execution-service/src/__tests__/phase4-e2e.test.ts lines 397–405
const costResult = await db.query(
  `SELECT COALESCE(SUM(amount_cents), 0)::int AS total_cents
   FROM billing_events
   WHERE execution_id = $1 AND bot_id = $2 AND event_type = 'tool_invoked'`,
  [executionId, botId],
);
```

### DNA Store Insert with Version

```typescript
// Source: packages/db/src/schema/dna-store.ts — DnaPayload interface
await db.insert(dnaStore).values({
  botId,
  executionId,
  objectiveCategory,
  version: nextVersion,
  compositeScore: compositeScore.toFixed(2),
  dnaPayload: {
    systemPromptTemplate: extractedTemplate,
    toolCallSequence: toolNames,
    argumentPatterns: argShapes,
    retryStrategy: retryMetrics,
    timingProfile: timings,
    tokenDistribution: tokenCounts,
  },
});
```

---

## State of the Art

| Area | Approach Used | Notes |
|------|---------------|-------|
| Score storage | Telemetry table (generic name/value rows) | Matches existing bot_hours pattern. Avoids migration for components. |
| Score sort | Composite column on bots table | Enables efficient ORDER BY without aggregation on report read |
| DNA versioning | Append-only INSERT with MAX(version)+1 | Simple, correct, no distributed lock needed at this scale |
| Trigger mechanism | Direct function call from completion-checker | Simpler than Pub/Sub subscription, same process, zero latency |
| PII protection | Structural schema design (no raw output fields in DnaPayload) | Enforced at the type level, not via scanning |

---

## Open Questions

1. **Do bots.tasks_completed/tasks_failed actually get updated? (VERIFIED: NO)**
   - What we know: `services/bot-worker/src/reasoning-loop.ts` does NOT update `tasks_completed`, `tasks_failed`, or `tasks_claimed` on the `bots` table. The reasoning loop calls `runReasoningLoop(taskDescription)` and returns a string. There is no DB write to the `bots` counters.
   - Impact: All three counter columns are always 0 in practice. Phase 5 MUST compute success/failure counts from `tasks WHERE claimed_by_bot_id = $botId` instead.
   - Resolution (confirmed): Use `SELECT COUNT(*) FROM tasks WHERE claimed_by_bot_id = $botId AND status = 'completed'` and `status = 'failed'` as the source of truth. Also use `tasks.attempt_count` for retry metrics.
   - Action for planner: Plan 05-01 should NOT rely on `bots.tasks_completed` / `bots.tasks_failed`. Use tasks table queries exclusively.

2. **What does `tool_invocations.request_summary` actually contain? (VERIFIED: TRUNCATED RAW INPUT)**
   - What we know: `services/tool-gateway/src/services/audit-log.ts` writes `requestSummary` and `responseSummary` using `truncateSummary()`. This function serializes the value to JSON and truncates at 2000 characters. It does NOT sanitize or redact — it passes whatever the caller provides directly (possibly including verbatim tool arguments like LLM messages with prompt content).
   - Impact: `tool_invocations.request_summary` may contain verbatim user prompts or LLM messages (e.g., `llm_call` request includes `messages[].content`). It is NOT safe to use `request_summary` as a DNA source without additional scrubbing.
   - Resolution: For DNA argument patterns, extract only structural metadata from `request_summary` — tool name, argument keys/shapes — but NOT argument values. Alternatively, use only `tool_invocations.tool_name` and derived structural metrics (counts, durations, token totals) which are provably PII-free.
   - Action for planner: Plan 05-03 DNA capture must scrub or selectively extract from `request_summary`. The safest approach: extract the keys (not values) of the argument object and the tool name sequence only.

3. **Where does objective_category come from for DNA tagging?**
   - What we know: `dna_store.objective_category` is varchar(255). `executions.objective` is a free-text string.
   - What's unclear: How to derive a normalized category from a free-text objective (e.g., "Summarize these documents" → "summarization").
   - Recommendation: For MVP, derive objective_category from the first N words of `executions.objective`, lowercased and slug-ified. A more sophisticated classifier can be added in v2. The field just needs to be non-null and consistent for grouping.

4. **Should bot-performance scores be re-computed if called twice (idempotency)?**
   - What we know: The completion-checker fires once (atomic transition guard). But re-runs of the performance pipeline could happen in a crash-recovery scenario.
   - What's unclear: Whether to add idempotency guards (check if telemetry rows already exist).
   - Recommendation: Add a guard: if telemetry rows for `success_rate_score` already exist for this execution, skip re-computation. Use `INSERT ... ON CONFLICT DO NOTHING` or a pre-check query.

5. **Should the execution report be stored or computed on demand?**
   - What we know: Success Criterion #3 says "available post-run" — queryable but not necessarily pre-computed.
   - What's unclear: Whether to cache the report in a new table or compute it from the existing tables on each GET request.
   - Recommendation: Compute on demand. The query is a handful of aggregations over indexed columns. No caching needed for MVP — the report is queried rarely (once after execution, not at scale).

---

## Sources

### Primary (HIGH confidence — verified against actual source files)

- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/bots.ts` — bots table schema, available columns for scoring
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/tasks.ts` — tasks table, attempt_count and claimed_by_bot_id
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/billing-events.ts` — billing_events, amount_cents per bot
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/telemetry.ts` — telemetry, bot_hours pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/dna-store.ts` — DnaPayload interface, version column, existing indexes
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/tool-invocations.ts` — tool_invocations, structural DNA fields
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/orchestrator/completion-checker.ts` — trigger point, transitioned guard
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/events/billing-engine.ts` — recordBotHours pattern, telemetry insert, cost rates
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/events/guardrail-watchdog.ts` — Drizzle aggregation SQL pattern
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/__tests__/phase4-e2e.test.ts` — billing_events cost query pattern, test setup patterns
- `/Users/tarikstafford/Desktop/Projects/claw-army/.planning/STATE.md` — composite score weighting decision, Phase 4 completion confirmation
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/migrations/0000_misty_iron_fist.sql` — actual column list in dna_store, confirmed no unique constraint on version

### Secondary (MEDIUM confidence)

- Phase description and requirements from the task context — used to derive score formula and DNA field list
- PRD at `/Users/tarikstafford/Desktop/Projects/claw-army/PRD — Claw Bot Army.md` — not read directly, but referenced indirectly via REQUIREMENTS.md and ROADMAP.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in use
- Architecture (add to execution-service): HIGH — completion-checker is the clear single trigger point; Phase 4 establishes the module-per-feature pattern
- Score formula: HIGH — requirements specify weights exactly (40/30/20/10)
- Telemetry for score components: HIGH — matches existing bot_hours pattern exactly
- DNA payload structure: HIGH — DnaPayload interface is already defined in schema
- DNA PII-safety: MEDIUM — depends on what tool-gateway writes to request_summary (unverified)
- tasks_completed counter update path: LOW — needs verification in reasoning-loop.ts before planning
- objective_category derivation: LOW — no specified approach in requirements; MVP heuristic needed

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable domain — schema and service structure will not change before Phase 5 implementation)
