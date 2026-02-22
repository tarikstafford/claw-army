# Phase 10: Decision Trace Collection - Research

**Researched:** 2026-02-21
**Domain:** Post-hoc attribution compilation from tool_invocations, LLM-based directive inference, decision_traces DB writes, OpenClaw runtime event capabilities
**Confidence:** HIGH for post-hoc path (all patterns verified in codebase); LOW for real-time annotation path (OpenClaw does not support decision_annotation messages — confirmed by documentation and GitHub issues)

---

## Summary

Phase 10 produces attribution records in `decision_traces` — one row per significant agent decision — that the Council (Phase 11) uses for causal attribution. The phase has two specified paths: real-time annotation (if OpenClaw emits `decision_annotation` messages) and post-hoc attribution (compiling `tool_invocations` sequences after execution completes). Research confirms that **OpenClaw does not support `decision_annotation` messages** from agent reasoning. The real-time annotation path does not ship in v2.0; the post-hoc attribution path is primary and ships first.

The post-hoc attribution compiler is the only verified implementation path. It runs as part of the existing `runPerformancePipeline` in `completion-checker.ts` — the natural integration point established in Phase 5 for fire-and-forget post-execution work. The compiler reads `tool_invocations` for a bot, infers which soul directive most likely drove each decision using an LLM call, assigns an attribution confidence score, and writes rows to `decision_traces`. No new npm packages are required.

The `decision_traces` table already exists in the database schema (created in Phase 8) with all required columns: `decision_id`, `decision_type`, `directive_referenced`, `attribution_confidence`, `outcome`, `decided_at`. The table has a documented 90-day TTL policy (Phase 8 JSDoc) — Phase 10 is noted as the phase that implements the archival enforcement mechanism. TTL enforcement is therefore also in scope for this phase.

**Primary recommendation:** Build only the post-hoc attribution compiler. Hook it into `runPerformancePipeline` immediately after `identifyAndCaptureDna`. Use `generateText` with `gpt-4o-mini` and structured output to infer directive attribution from each tool invocation. Do not build a real-time annotation path; leave a clearly-labeled no-op stub with a TODO comment for when OpenClaw emits decision events.

---

## OpenClaw Decision Annotation Capability Assessment

**Finding (MEDIUM confidence):** OpenClaw does not currently support `decision_annotation` messages or equivalent real-time reasoning annotation events.

**Evidence gathered:**

1. **Current WebSocket protocol** — Confirmed in `openclaw-client.ts` (Phase 9 research): `RunTaskMessage` is `{type:'run_task', sessionId, prompt}`. Inbound messages are `task_complete` and `task_failed` only. No intermediate annotation messages exist in the current client.

2. **GitHub Issue #6467 (Agent Event Stream API)** — Closed Feb 1, 2026 as a blanket "halt on enhancement requests." Proposes `tool.call` events and `llm.reasoning` events, but was never confirmed implemented. Closure redirects to issue #5799, not to a completed feature.

3. **GitHub Issue #8901 (Tool Event Streaming)** — Confirms OpenClaw currently emits `agent` events with `stream: "tool"` to connected operator/webchat clients, but only when verbose mode is on. These tool events are display-oriented metadata bubbles (tool name + arguments prefix), not structured attribution annotations.

4. **OpenClaw docs (gateway, security, thinking)** — No mention of `decision_annotation`, attribution, or directive-driven event types anywhere in official documentation.

5. **CHANGELOG.md (v2026.2.19)** — Adds `thinking_*` stream event handling for native reasoning model support. These are reasoning content display events, not decision annotation events with structured attribution fields.

**Conclusion:** OpenClaw emits tool progress events and thinking display content via WebSocket, but **no structured annotation that includes directive attribution, confidence scores, or decision type classification**. The `decision_annotation` message type referenced in Phase 10 requirements does not exist in the current OpenClaw runtime. The post-hoc path is primary.

---

## Standard Stack

### Core (all already installed — zero new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^6.0.90 | `generateText()` for directive inference LLM calls | Already installed in execution-service; same model used by planner.service.ts and soul-generator.ts |
| `@ai-sdk/openai` | ^3.0.29 | `openai('gpt-4o-mini')` for attribution inference | Already installed; same provider used throughout |
| `drizzle-orm` | ^0.45.1 | `db.insert(decisionTraces)` writes, `db.select().from(toolInvocations)` reads | Already installed in execution-service via @claw/db |
| `node:crypto` | built-in | `randomUUID()` for idempotent `decision_id` generation | No install needed |
| `zod` | ^4.3.6 | Structured output schema for LLM attribution inference | Already installed in execution-service |

### Supporting (already present in codebase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@claw/db` | workspace | `decisionTraces`, `toolInvocations`, `botSouls`, `bots` tables | Read tool invocations, write decision traces, look up soul directives |
| `@claw/shared-types` | workspace | `SoulDocument`, `SoulDimension` | Type soul content when passing to LLM for directive matching |

**Installation:** None. All dependencies are already present.

---

## Architecture Patterns

### Recommended Service Structure

```
services/execution-service/src/
├── performance/
│   ├── performance-engine.ts       # MODIFY: add runAttributionCompiler() call after identifyAndCaptureDna
│   ├── dna-capture.ts              # no change
│   ├── score-engine.ts             # no change
│   ├── report-builder.ts           # no change
│   └── attribution-compiler.ts    # NEW: post-hoc attribution compiler
└── (real-time path — not built in Phase 10, stub comment only in openclaw-client.ts)
```

The `attribution-compiler.ts` file is the only new file. The only other change is a 3-line addition to `performance-engine.ts` to call it.

### Pattern 1: Post-Hoc Attribution Compiler (Primary Path)

**What:** After execution completes, for each bot in the execution: read all `tool_invocations`, load the bot's soul directives from `bot_souls`, call an LLM to infer which directive drove each tool invocation, write a `decision_traces` row per invocation.

**When to use:** Always — called from `runPerformancePipeline` after `identifyAndCaptureDna`.

**Pipeline:**
1. Fetch all bots for the execution (with their `soulId`)
2. For each bot with a `soulId`, load the soul's `constitutionDirectives` + `dimensions` from `bot_souls`
3. Fetch all `tool_invocations` for that bot (accepted + rejected, ordered by `invokedAt`)
4. Batch-call LLM (gpt-4o-mini) to attribute each invocation to a directive with confidence score
5. Write one `decision_traces` row per invocation (idempotent: use invocation's UUID as `decision_id` seed)
6. Write additional `decision_traces` rows for output steps (one per completed task)

**Decision types produced:**
- `tool_call` — one per `tool_invocations` row
- `output_step` — one per completed `tasks` row (task result delivery)
- `reasoning_branch` — synthesized: one row per bot representing overall reasoning pattern (derived from tool sequence, not from individual invocations)

**Key LLM attribution call pattern:**

```typescript
// Source: same pattern as planner.service.ts generateText + soul-generator.ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const AttributionResultSchema = z.object({
  directiveText: z.string(),            // verbatim directive from soul that drove this decision
  confidence: z.number().min(0).max(1), // 0.000–1.000
  outcome: z.enum(['success', 'failure', 'partial']),
  reasoning: z.string(),               // brief 1-sentence explanation (for debugging only)
});

const { text } = await generateText({
  model: openai('gpt-4o-mini'),
  system: `You are a soul attribution analyst. Given a SOUL.md document and a tool invocation record, identify which soul directive most likely drove this specific tool call. Return valid JSON matching the schema.`,
  prompt: `
SOUL.md:
${soulContent}

Tool Invocation:
- Tool: ${invocation.toolName}
- Request summary: ${JSON.stringify(invocation.requestSummary)}
- Duration: ${invocation.durationMs}ms
- Tokens: ${invocation.totalTokens}
- Rejected: ${invocation.rejected}

Task description this invocation served: ${taskDescription}

Return JSON: { directiveText, confidence, outcome, reasoning }
  `.trim(),
  temperature: 0.1,
});

const attribution = AttributionResultSchema.parse(JSON.parse(text));
```

**DB write pattern:**

```typescript
// Source: decision_traces schema in packages/db/src/schema/decision-traces.ts
import { randomUUID, createHash } from 'node:crypto';
import { decisionTraces } from '@claw/db';

// Idempotent decision_id: deterministic UUID derived from invocation ID
// Ensures re-running the compiler doesn't create duplicate rows
const decisionId = createHash('sha256')
  .update(`tool_call:${invocation.invocationId}`)
  .digest('hex')
  .slice(0, 32);
// Convert to UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const decisionIdUUID = [
  decisionId.slice(0, 8),
  decisionId.slice(8, 12),
  decisionId.slice(12, 16),
  decisionId.slice(16, 20),
  decisionId.slice(20, 32),
].join('-');

await db.insert(decisionTraces).values({
  executionId,
  botId,
  soulId,
  decisionId: decisionIdUUID,
  decisionType: 'tool_call',
  directiveReferenced: attribution.directiveText,
  attributionConfidence: attribution.confidence.toFixed(3),
  outcome: attribution.outcome,
  decidedAt: invocation.invokedAt,
  metadata: {
    toolName: invocation.toolName,
    durationMs: invocation.durationMs,
    totalTokens: invocation.totalTokens,
    rejected: invocation.rejected,
    attributionReasoning: attribution.reasoning,
  },
}).onConflictDoNothing(); // idempotency: skip if decision_id already exists
```

**NOTE:** `decisionTraces` table has no unique constraint on `decision_id` in the Phase 8 schema. Two options:
1. Add a unique constraint on `decision_id` (preferred — enables true ON CONFLICT DO NOTHING)
2. Check for existence before insert (less efficient but avoids a migration)

The planner should decide: add a migration to put a unique constraint on `decision_id`, or use a pre-insert existence check. A unique constraint is better long-term.

### Pattern 2: Integration Point — performance-engine.ts

**What:** Add attribution compiler call after DNA capture, fire-and-forget style identical to existing pipeline steps.

```typescript
// MODIFY: services/execution-service/src/performance/performance-engine.ts
import { runAttributionCompiler } from './attribution-compiler';

export async function runPerformancePipeline(executionId: string): Promise<void> {
  console.log('[performance-engine] Starting pipeline for execution', executionId);

  await computeScoresForExecution(executionId);
  await identifyAndCaptureDna(executionId);
  await runAttributionCompiler(executionId);   // NEW — Phase 10

  console.log('[performance-engine] Pipeline complete for execution', executionId);
}
```

### Pattern 3: TTL Archival Enforcement

**What:** A cleanup function that deletes `decision_traces` rows older than 90 days when the table approaches 5M rows. Called periodically.

**When to use:** Triggered by a scheduled check. Options:
- Cloud Scheduler → HTTP endpoint on execution-service (preferred: keeps infra simple, no new Pub/Sub topics)
- `setInterval` inside execution-service process (simpler but not idempotent across restarts)
- Manual `npm run cleanup` script via GCE SSH (deferrable to operational setup)

**Recommended approach for Phase 10:** Implement as a simple exported async function `pruneDecisionTraces()` callable from an admin route `POST /admin/cleanup/decision-traces`. Defer scheduling integration to a later phase. Document the threshold constants clearly.

```typescript
// services/execution-service/src/performance/attribution-compiler.ts (or separate file)
const DECISION_TRACES_TTL_DAYS = 90;
const DECISION_TRACES_MAX_ROWS = 5_000_000;

export async function pruneDecisionTraces(): Promise<{ deleted: number }> {
  // 1. Check row count
  const [{ total }] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(decisionTraces);

  if (total < DECISION_TRACES_MAX_ROWS) {
    console.log(`[attribution-compiler] ${total} decision traces — below threshold, no pruning`);
    return { deleted: 0 };
  }

  // 2. Delete rows older than 90 days
  const cutoff = new Date(Date.now() - DECISION_TRACES_TTL_DAYS * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(decisionTraces)
    .where(sql`${decisionTraces.decidedAt} < ${cutoff}`)
    .returning({ id: decisionTraces.id });

  console.log(`[attribution-compiler] Pruned ${result.length} decision traces older than ${DECISION_TRACES_TTL_DAYS} days`);
  return { deleted: result.length };
}
```

### Pattern 4: Output Step Attribution

**What:** One `decision_traces` row per completed `tasks` row — captures the outcome of the agent's final output delivery as a `decision_type: 'output_step'`.

**When to use:** After tool_call rows are written, iterate completed tasks for each bot.

```typescript
// Source: completion-checker.ts + tasks schema patterns
const completedTasks = await db
  .select()
  .from(tasks)
  .where(and(
    eq(tasks.executionId, executionId),
    eq(tasks.claimedByBotId, botId),
    eq(tasks.status, 'completed'),
  ));

for (const task of completedTasks) {
  const outputDecisionId = createHash('sha256')
    .update(`output_step:${task.id}`)
    .digest('hex')
    .slice(0, 32);

  await db.insert(decisionTraces).values({
    executionId,
    botId,
    soulId,
    decisionId: formatAsUUID(outputDecisionId),
    decisionType: 'output_step',
    directiveReferenced: null,    // no specific directive attributed to output delivery
    attributionConfidence: null,
    outcome: 'success',
    decidedAt: task.updatedAt,    // time the task was marked completed
    metadata: { taskId: task.id, taskDescription: task.description.slice(0, 200) },
  }).onConflictDoNothing();
}
```

### Pattern 5: Reasoning Branch Attribution

**What:** A single synthesized `decision_traces` row per bot representing the overall reasoning pattern for the execution — captures whether the soul's Decision Priorities dimension drove the agent's tool sequencing pattern.

**When to use:** After tool_call rows are written, generate one summary attribution row.

```typescript
// One LLM call that sees the full tool sequence and attributes the overall reasoning pattern
const { text: reasoningText } = await generateText({
  model: openai('gpt-4o-mini'),
  system: `You are a soul attribution analyst. Given a SOUL.md and the complete tool call sequence for an agent, identify which Decision Priorities directive most drove the agent's overall approach. Return JSON: { directiveText, confidence, outcome, reasoning }`,
  prompt: `
SOUL.md: ${soulContent}

Tool call sequence (${toolCallSequence.length} calls):
${toolCallSequence.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Task completion rate: ${completedCount}/${totalCount}
`.trim(),
  temperature: 0.1,
});

const reasoningAttribution = AttributionResultSchema.parse(JSON.parse(reasoningText));

await db.insert(decisionTraces).values({
  executionId,
  botId,
  soulId,
  decisionId: formatAsUUID(createHash('sha256').update(`reasoning_branch:${executionId}:${botId}`).digest('hex').slice(0, 32)),
  decisionType: 'reasoning_branch',
  directiveReferenced: reasoningAttribution.directiveText,
  attributionConfidence: reasoningAttribution.confidence.toFixed(3),
  outcome: reasoningAttribution.outcome,
  decidedAt: new Date(),
  metadata: { attributionReasoning: reasoningAttribution.reasoning, toolCallCount: toolCallSequence.length },
}).onConflictDoNothing();
```

### Pattern 6: Bots Without Souls

**What:** Handle the case where a bot has no `soulId` (pre-Phase 9 bots, or bots where soul generation failed). Attribution is skipped for these bots.

```typescript
// Early exit for bots with no soul
if (!bot.soulId) {
  console.log(`[attribution-compiler] Bot ${botId} has no soulId, skipping attribution`);
  continue;
}
```

### Pattern 7: Unique Constraint Migration for decision_id

**What:** The Phase 8 schema does not include a unique constraint on `decision_traces.decision_id`. Phase 10 should add one to enable `ON CONFLICT DO NOTHING` idempotency.

**Migration pattern:**

```sql
-- In a new drizzle-kit generated migration (or --custom)
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_decision_id_unique" UNIQUE ("decision_id");
```

In Drizzle schema:
```typescript
// MODIFY: packages/db/src/schema/decision-traces.ts
// Add unique constraint:
import { pgTable, uuid, varchar, text, numeric, timestamp, index, unique } from 'drizzle-orm/pg-core';

// In table definition second argument array:
unique('decision_traces_decision_id_unique').on(t.decisionId),
```

### Anti-Patterns to Avoid

- **Calling attribution compiler synchronously in the request handler:** Like soul generation, attribution compilation involves LLM calls and can take 30-120 seconds for a full execution. It MUST run fire-and-forget from `runPerformancePipeline`, never in a request handler.
- **One LLM call per tool invocation (naive implementation):** A bot with 50 tool invocations = 50 LLM calls. This is expensive and slow. Group invocations by task (5-10 invocations per task), and batch-attribute 5-10 invocations per LLM call. Pass the tool sequence for a task as a list to the LLM and get back a list of attributions.
- **Calling attribution compiler before score computation:** `computeScoresForExecution` sets `compositeScore` and `tier` on bots, which are useful context for the Council. Attribution runs after scoring so the `outcome` field in traces has context from scores.
- **Blocking Council (Phase 11) on attribution being 100% complete:** Attribution should emit a "done" flag (e.g., an execution-level metadata column or a Pub/Sub event) so Phase 11's council-queue worker knows traces are ready. Phase 10 must define this signal.
- **Omitting attribution for rejected tool invocations:** Rejected tool calls are as important for soul analysis as accepted ones. CNCL-04 (Soul Analyst counterfactual) needs the rejected calls to evaluate directive-driven risk behavior.
- **Storing `attributionReasoning` as top-level column:** The LLM's explanation of why it chose a directive is debugging information, not primary data. Store it in the `metadata` JSONB field, not as a separate column.
- **Running pruneDecisionTraces on every execution:** Pruning is triggered by row count threshold (5M), not by time. Checking count on every execution completion is cheap, but actually pruning is a full table scan. Call `pruneDecisionTraces` infrequently (daily via scheduled endpoint, not per execution).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Directive attribution inference | Custom text matching algorithm | `generateText` with `gpt-4o-mini` at temperature 0.1 | LLM understands semantic similarity between tool behavior and directive intent; string matching cannot capture "agent used web_search because it has a verification-first Decision Priority" |
| Structured attribution output | Manual JSON parsing | `zod` schema validation of LLM output | Catches malformed JSON, missing fields, confidence values outside 0-1 range |
| Idempotent decision_id | Random UUID on every run | SHA-256 of `invocationId` formatted as UUID | Deterministic: re-running the compiler on the same execution produces the same `decision_id` values, allowing ON CONFLICT DO NOTHING deduplication |
| TTL archival | Custom date math | Drizzle `where(sql\`${decisionTraces.decidedAt} < ${cutoff}\`)` | Drizzle handles the parameter escaping and timestamp comparison correctly |
| LLM error handling | Custom retry loop | AI SDK's built-in retry (automatic on rate limit) | Already present in execution-service for planner and soul-generator calls |

---

## Common Pitfalls

### Pitfall 1: Attribution Compiler Blocks Execution Completion Event Delivery

**What goes wrong:** `runAttributionCompiler` runs inside `runPerformancePipeline`, which is already fire-and-forget. But if attribution takes 5 minutes, the execution's `completed` status is visible immediately while traces are still being written. Phase 11's council worker may pick up the execution before traces exist.

**Why it happens:** Council queue (Phase 11) listens for `execution_status_changed` events with `toStatus: 'completed'`. Attribution finishes after this event is published.

**How to avoid:** Phase 10 must define how Phase 11 knows attribution is ready. Two options:
1. Add `attributionCompletedAt` timestamp column to `executions` table (requires a migration)
2. Publish a separate `attribution_complete` Pub/Sub event after `runAttributionCompiler` finishes (requires a new topic or reusing execution-lifecycle topic with new event type)
3. Phase 11's council worker simply reads whatever traces exist at evaluation time — attribution is best-effort (simplest, but reduces CNCL-04 accuracy)

Option 3 (best-effort) is the pragmatic choice for Phase 10 and must be documented as the chosen approach. The Council reads traces that exist at time of evaluation.

**Warning signs:** Council evaluation produces low-quality CNCL-04 counterfactual analysis because traces are missing.

### Pitfall 2: LLM Attribution Hallucination — Directive Not In Soul

**What goes wrong:** The attribution LLM returns a `directiveText` that is semantically related to a soul directive but is NOT verbatim text from the soul. The Council's Soul Analyst (CNCL-04) performs counterfactual verification against the actual soul content, and a non-verbatim directive cannot be found.

**Why it happens:** LLM paraphrases directives instead of quoting them exactly.

**How to avoid:** Explicitly instruct the LLM to quote the directive VERBATIM from the SOUL.md provided. Validate after LLM call: if `attributionConfidence > 0.5`, confirm `directiveText` appears as a substring in `soulContent`. If not, set `attributionConfidence` to `Math.min(attributionConfidence, 0.3)` and add a `validationWarning` to `metadata`.

**Validation check:**
```typescript
if (attribution.confidence > 0.5 && !soulContent.includes(attribution.directiveText)) {
  console.warn('[attribution-compiler] LLM returned non-verbatim directive — confidence degraded');
  attribution.confidence = Math.min(attribution.confidence, 0.3);
  attribution.metadata = { ...attribution.metadata, validationWarning: 'directive_not_verbatim_in_soul' };
}
```

**Warning signs:** Council CNCL-04 consistently finds no matching directive in soul for high-confidence attributions.

### Pitfall 3: N+1 Query Pattern for Soul Lookup

**What goes wrong:** Attribution compiler loops over bots, then for each bot fetches its soul from `bot_souls`. With 20 bots per execution, that's 20 separate DB queries.

**Why it happens:** Naive implementation does `db.select().from(botSouls).where(eq(botSouls.id, bot.soulId))` inside the per-bot loop.

**How to avoid:** Collect all `soulId` values upfront, bulk-fetch all souls in one query, index by ID:

```typescript
// Before the per-bot loop:
const allSoulIds = bots.filter(b => b.soulId !== null).map(b => b.soulId!);
const allSouls = await db
  .select()
  .from(botSouls)
  .where(inArray(botSouls.id, allSoulIds));
const soulMap = new Map(allSouls.map(s => [s.id, s]));

// Inside the per-bot loop:
const soul = soulMap.get(bot.soulId);
```

**Warning signs:** Attribution compiler taking > 5 seconds just for DB queries before any LLM calls begin.

### Pitfall 4: LLM Attribution Too Expensive for Large Tool Counts

**What goes wrong:** A bot that makes 200 tool invocations across a long execution generates 200 LLM attribution calls. At ~0.5s per call (gpt-4o-mini) that's 100+ seconds for one bot.

**Why it happens:** Naive 1:1 mapping of invocations to LLM calls.

**How to avoid:** Group invocations by the task they served (`tasks.claimedByBotId` links tasks to bots; `tool_invocations` have the same `botId`). Approximate grouping: batch invocations by `invokedAt` time windows aligned with task `claimedAt`/`completedAt` window. Send 5-10 invocations per LLM call and get back a list of attributions. This reduces 200 calls to ~40 calls.

**Alternative:** Cap attribution at the first 50 tool invocations per bot, document the cap in `metadata.attributionCap`.

**Warning signs:** Attribution compiler consistently times out or adds > 2 minutes to post-execution pipeline.

### Pitfall 5: `decision_id` Uniqueness Constraint Not Present — ON CONFLICT Fails Silently

**What goes wrong:** Without a unique constraint on `decision_traces.decision_id`, `onConflictDoNothing()` has no constraint to trigger on — Drizzle will not add the `ON CONFLICT` clause, and duplicate rows will be inserted on compiler re-runs.

**Why it happens:** Drizzle's `.onConflictDoNothing()` requires a unique constraint to work. The Phase 8 schema does not include one on `decision_id`.

**How to avoid:** Phase 10 must add a Drizzle migration with `UNIQUE (decision_id)` on the `decision_traces` table. This is a prerequisite for idempotent compiler behavior.

**Warning signs:** `decision_traces` row count doubles on each re-run of the compiler for the same execution.

### Pitfall 6: Bots with No Tool Invocations

**What goes wrong:** A bot that was spawned but never claimed a task (e.g., was spawning when the execution completed) has zero `tool_invocations`. The attribution compiler loop finds no invocations and writes no traces — this is correct behavior, but must not throw.

**Why it happens:** Bot lifecycle timing: bots can be in `spawning` status at completion.

**How to avoid:** Check `invocations.length === 0` early and continue to the next bot with a log line. Do not treat zero-invocation bots as errors.

### Pitfall 7: OpenClaw Streaming Tool Events Confused for Decision Annotations

**What goes wrong:** A future developer sees that OpenClaw emits `agent` events with `stream: "tool"` (via GitHub issue #8901) and assumes these are structured decision annotation events. Attempts to use them for real-time trace writes.

**Why it happens:** The verbose-mode tool events are display-oriented metadata bubbles (tool name + argument prefix string), not structured attribution records with directive references, confidence scores, or outcome fields.

**How to avoid:** Document clearly in `openclaw-client.ts` with a comment: "OpenClaw tool streaming events (stream:'tool') are display-only. They do not carry directive attribution fields. Use post-hoc attribution compiler (attribution-compiler.ts) for decision_traces writes."

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Full attribution-compiler.ts Skeleton

```typescript
// Source: Derived from dna-capture.ts (performance pipeline pattern) +
//         soul-generator.ts (LLM call pattern) + decision-traces schema

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { db, bots, botSouls, toolInvocations, tasks, decisionTraces } from '@claw/db';
import { eq, and, inArray, sql } from 'drizzle-orm';

const ATTRIBUTION_MODEL = openai('gpt-4o-mini');
const ATTRIBUTION_TEMPERATURE = 0.1;
const MAX_INVOCATIONS_PER_BOT = 50; // cap to control LLM cost

const AttributionSchema = z.object({
  directiveText: z.string(),
  confidence: z.number().min(0).max(1),
  outcome: z.enum(['success', 'failure', 'partial']),
  reasoning: z.string(),
});

function toUUIDFormat(hex: string): string {
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20,32)].join('-');
}

function makeDeterministicId(seed: string): string {
  return toUUIDFormat(createHash('sha256').update(seed).digest('hex').slice(0, 32));
}

export async function runAttributionCompiler(executionId: string): Promise<void> {
  console.log('[attribution-compiler] Starting for execution', executionId);

  // 1. Fetch all bots for execution with soulId
  const botRows = await db
    .select({ id: bots.id, soulId: bots.soulId })
    .from(bots)
    .where(eq(bots.executionId, executionId));

  // 2. Bulk-fetch all souls
  const soulIds = botRows.filter(b => b.soulId !== null).map(b => b.soulId!);
  const soulRows = soulIds.length > 0
    ? await db.select().from(botSouls).where(inArray(botSouls.id, soulIds))
    : [];
  const soulMap = new Map(soulRows.map(s => [s.id, s]));

  // 3. Process each bot
  for (const bot of botRows) {
    if (!bot.soulId) {
      console.log(`[attribution-compiler] Bot ${bot.id} has no soulId, skipping`);
      continue;
    }

    const soul = soulMap.get(bot.soulId);
    if (!soul) {
      console.warn(`[attribution-compiler] Soul ${bot.soulId} not found for bot ${bot.id}`);
      continue;
    }

    await attributeBot(executionId, bot.id, bot.soulId, soul.soulContent as string);
  }

  console.log('[attribution-compiler] Complete for execution', executionId);
}
```

### Per-Invocation LLM Attribution Call

```typescript
// Source: soul-generator.ts generateText pattern + decision-traces schema
async function attributeInvocation(
  invocation: ToolInvocation,
  soulContent: string,
  taskDescription: string,
): Promise<z.infer<typeof AttributionSchema>> {
  try {
    const { text } = await generateText({
      model: ATTRIBUTION_MODEL,
      system: `You are a soul attribution analyst. Given a SOUL.md and a tool invocation, identify which directive VERBATIM from the soul most likely drove this tool call. Return JSON with fields: directiveText (exact quote from SOUL.md), confidence (0-1), outcome (success|failure|partial), reasoning (1 sentence).`,
      prompt: `
SOUL.md:
${soulContent}

Tool Call:
- Tool: ${invocation.toolName}
- Request: ${JSON.stringify(invocation.requestSummary).slice(0, 500)}
- Duration: ${invocation.durationMs}ms
- Rejected: ${invocation.rejected}
- Task: ${taskDescription.slice(0, 200)}

Return JSON only.
      `.trim(),
      temperature: ATTRIBUTION_TEMPERATURE,
    });

    const parsed = AttributionSchema.parse(JSON.parse(text));

    // Validate verbatim directive exists in soul
    if (parsed.confidence > 0.5 && !soulContent.includes(parsed.directiveText)) {
      parsed.confidence = Math.min(parsed.confidence, 0.3);
    }

    return parsed;
  } catch {
    // LLM failure — return low-confidence fallback, do not throw
    return {
      directiveText: '',
      confidence: 0,
      outcome: 'partial',
      reasoning: 'Attribution failed — LLM error',
    };
  }
}
```

### Drizzle insert with ON CONFLICT DO NOTHING (requires unique constraint on decision_id)

```typescript
// Source: decision-traces.ts schema + drizzle-orm ON CONFLICT docs
await db
  .insert(decisionTraces)
  .values({
    executionId,
    botId,
    soulId,
    decisionId: makeDeterministicId(`tool_call:${invocation.invocationId}`),
    decisionType: 'tool_call',
    directiveReferenced: attribution.directiveText || null,
    attributionConfidence: attribution.confidence.toFixed(3),
    outcome: attribution.outcome,
    decidedAt: invocation.invokedAt,
    metadata: {
      toolName: invocation.toolName,
      durationMs: invocation.durationMs,
      rejected: invocation.rejected,
      attributionReasoning: attribution.reasoning,
    },
  })
  .onConflictDoNothing();
```

### Migration: Add unique constraint to decision_id

```typescript
// In packages/db/src/schema/decision-traces.ts — MODIFY to add unique:
// (after the index array, add unique constraint in table definition)
// Source: drizzle-orm docs + existing pgTable patterns

import { unique } from 'drizzle-orm/pg-core';

// In the table definition second argument:
unique('decision_traces_decision_id_unique').on(t.decisionId),
```

Generated SQL migration:
```sql
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_decision_id_unique" UNIQUE ("decision_id");
```

### Drizzle TTL Pruning Query

```typescript
// Source: decision-traces schema + drizzle-orm date comparison pattern
const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const deleted = await db
  .delete(decisionTraces)
  .where(sql`${decisionTraces.decidedAt} < ${cutoff}`)
  .returning({ id: decisionTraces.id });
console.log(`[attribution-compiler] Pruned ${deleted.length} rows`);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate observability SDK for agent attribution | Post-hoc LLM inference from tool logs | Current best practice (2025–2026) | No external dependency; uses existing tool_invocations data already captured by tool-gateway |
| Manual decision logging via agent-side SDK calls | Compiler runs post-execution against existing DB data | Current best practice for non-instrumented runtimes | Decoupled from OpenClaw — works even if OpenClaw protocol never adds annotation events |
| Blocking attribution before returning results | Fire-and-forget in performance pipeline | Established in Phase 5 (dna-capture) | Non-blocking; execution completion not delayed |

**Not yet available (relevant to Phase 10):**
- OpenClaw native `decision_annotation` messages: Not implemented as of v2026.2.19. GitHub issues (#6467, #8901) propose real-time streaming events but were closed without confirmed implementation. The post-hoc path is the only verified approach.

---

## Open Questions

1. **Phase 11 Synchronization: How does the Council know attribution is ready?**
   - What we know: Council (Phase 11) runs on `council-queue`, triggered after execution completes. Attribution compiler runs fire-and-forget after DNA capture, taking 30-120 seconds for large executions.
   - What's unclear: Whether Phase 11's council worker should wait for attribution to finish or read whatever traces exist at evaluation time.
   - Recommendation: Phase 10 chooses "best-effort" — Council reads whatever traces exist. Attribution completing first is a timing optimization, not a hard requirement. Document this in attribution-compiler.ts with a comment.

2. **Unique constraint on decision_id — migration required**
   - What we know: Phase 8 schema does not include a unique constraint on `decision_traces.decision_id`. Drizzle's `.onConflictDoNothing()` requires a unique constraint to work.
   - What's unclear: Whether to add the constraint via a new Drizzle migration or use a pre-insert existence check.
   - Recommendation: Add a new migration `0005_decision_traces_unique_decision_id.sql`. This is cleaner and enables proper idempotency. The migration is a single `ALTER TABLE ... ADD CONSTRAINT` statement — fast and non-breaking.

3. **LLM attribution cost for large executions**
   - What we know: A 20-bot execution with 50 tool invocations per bot = 1,000 LLM calls at ~$0.002 per 1K tokens for gpt-4o-mini. At ~100 tokens per attribution call, that's ~$0.20 per execution.
   - What's unclear: Whether batch attribution (pass 10 invocations, get 10 attributions) is achievable with gpt-4o-mini structured output.
   - Recommendation: Start with per-invocation calls capped at 50 per bot. If cost is unacceptable, switch to batch calls. Document the cap constant (`MAX_INVOCATIONS_PER_BOT = 50`).

4. **TTL enforcement trigger mechanism**
   - What we know: `pruneDecisionTraces()` function needs to be called periodically. Options: admin HTTP endpoint, Cloud Scheduler, or setInterval.
   - What's unclear: Whether Phase 10 should provision a Cloud Scheduler job or defer this to an operational setup step.
   - Recommendation: Phase 10 implements `pruneDecisionTraces()` and exposes it at `POST /admin/cleanup/decision-traces`. Scheduling is operational setup, documented as a post-deployment step. This avoids adding infrastructure complexity to Phase 10.

5. **OpenClaw tool events (stream:'tool') — future real-time path**
   - What we know: OpenClaw emits `agent` events with `stream: 'tool'` when verbose mode is on (Issue #8901). These are display-oriented, not structured attribution events.
   - What's unclear: Whether future OpenClaw versions will formalize structured tool events usable for real-time annotation.
   - Recommendation: Add a stub handler in `openclaw-client.ts` with a TODO comment for a future `decision_annotation` handler. Do not wire it to any real logic. When OpenClaw formalizes structured tool events, Phase 10's post-hoc compiler can be deprecated in favor of the real-time path.

---

## Sources

### Primary (HIGH confidence)

- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/decision-traces.ts` — Full schema confirmed: all required columns exist, TTL policy documented, no unique constraint on decision_id (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/tool-invocations.ts` — Source data schema confirmed: toolName, invocationId, rejected, durationMs, totalTokens, requestSummary, invokedAt (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/performance/performance-engine.ts` — Integration point confirmed: `runPerformancePipeline` calls `computeScoresForExecution` then `identifyAndCaptureDna`; fire-and-forget pattern established (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/performance/dna-capture.ts` — Confirms pattern for reading `tool_invocations` per bot, joining with `tasks`, writing post-hoc analysis records (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/orchestrator/openclaw-client.ts` — `RunTaskMessage` confirmed as `{type:'run_task', sessionId, prompt}` only; inbound messages are `task_complete` and `task_failed` only; no `decision_annotation` handler (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/orchestrator/completion-checker.ts` — Confirms `runPerformancePipeline` is called fire-and-forget from `checkExecutionCompletion` after execution transitions to 'completed' (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/services/execution-service/src/services/soul-generator.ts` — Confirms `generateText` with `openai('gpt-4o-mini')` pattern for LLM calls; same pattern used for attribution inference (directly read)
- `/Users/tarikstafford/Desktop/Projects/claw-army/packages/db/src/schema/bots.ts` — Confirms `soulId` nullable UUID column exists on bots (directly read)

### Secondary (MEDIUM confidence)

- [GitHub Issue #6467: Agent Event Stream API](https://github.com/openclaw/openclaw/issues/6467) — Proposes tool.call and llm.reasoning events; closed Feb 1 2026 as blanket halt on enhancement requests, NOT as confirmed implementation. Real-time tool events not confirmed.
- [GitHub Issue #8901: Separate tool event streaming from channel verbose mode](https://github.com/openclaw/openclaw/issues/8901) — Confirms OpenClaw emits `agent` events with `stream:'tool'` for display only when verbose mode is on. Not structured attribution data.
- [OpenClaw CHANGELOG.md v2026.2.19](https://github.com/openclaw/openclaw/blob/main/CHANGELOG.md) — Adds `thinking_*` stream event handling for reasoning display. Not attribution annotation events.
- [OpenClaw docs — Thinking Levels](https://docs.openclaw.ai/tools/thinking) — Reasoning display via `/reasoning` directive. No WebSocket event schema for reasoning steps documented.

### Tertiary (LOW confidence — validate before acting)

- [innfactory.ai — OpenClaw architecture](https://innfactory.ai/en/blog/openclaw-architecture-explained/) — Confirms Event frame type `{type:"event", event, payload}` but does not enumerate all event types emitted during agent execution. Cannot confirm absence of decision_annotation events from this source alone.

---

## Metadata

**Confidence breakdown:**
- Post-hoc attribution compiler pattern: HIGH — directly derived from `dna-capture.ts` (same pipeline stage, same data sources), `soul-generator.ts` (same LLM call pattern), `decision-traces.ts` (same target table)
- OpenClaw real-time annotation unavailability: MEDIUM-HIGH — no documentation of decision_annotation events found across docs, CHANGELOG, GitHub issues; GitHub Issue #6467 closes the event stream feature as unimplemented; combined evidence is strong but not a definitive "does not exist" from official source
- LLM attribution approach (generateText + gpt-4o-mini): HIGH — same pattern verified in installed node_modules and used by planner + soul-generator in this codebase
- TTL pruning implementation: HIGH — straightforward Drizzle delete with date comparison; same patterns used in guardrail-watchdog
- LLM attribution cost estimate: MEDIUM — based on gpt-4o-mini public pricing at time of training; verify current pricing before committing to per-invocation approach
- Phase 11 synchronization strategy (best-effort): MEDIUM — practical choice; but the Council's CNCL-04 accuracy depends on traces being complete; if attribution regularly finishes after Council evaluation begins, counterfactual quality degrades

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days — Drizzle patterns are stable; OpenClaw protocol assessment may become outdated if new version ships real-time annotation events)
