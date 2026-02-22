# Architecture Patterns — SOUL System v2.0 Integration

**Domain:** AI Bot Fleet Orchestration + Evolutionary Learning
**Researched:** 2026-02-21
**Confidence:** HIGH — based on direct codebase analysis of all existing source files

---

## Summary

The existing system is a well-structured Fastify monolith (execution-service) with clear extension points. The SOUL System adds four new processing layers — Soul Generation, The Council, God Layer, and extended DNA Library — each of which integrates at a specific, identifiable seam in the existing code.

The core post-execution hook is `runPerformancePipeline()` in `performance-engine.ts`, called fire-and-forget from `completion-checker.ts` after execution transitions to `completed`. This is where the Council kicks off. The pre-execution hook is inside the `setImmediate` async block in `executions.ts` between `planObjective()` and `spawnBotsForExecution()`. This is where Soul Generation intercepts.

**The three critical architectural decisions:**

1. Soul content is delivered to OpenClaw agents via the WebSocket `run_task` message as an extended field, not via GCE metadata or the startup script. This avoids VM reconfiguration and keeps soul updates to a code-only change.
2. The Council is three LLM calls with structured outputs, not three running processes. Council "agents" are invocations of the existing `ai` SDK (already installed, used in `planner.service.ts`), not separate long-lived services.
3. All SOUL System components run inside execution-service as new modules and BullMQ Workers — no new GCE service is required at MVP scale.

---

## New Components

### 1. Soul Generation Service

**What it is:** A module within execution-service, not a standalone service.

**Location:** `services/execution-service/src/soul/`

```
soul/
  soul-generator.ts           Main generation logic (Path A known category, Path B archetypes)
  mutation-engine.ts          Substitution, amplification, attenuation, recombination, introduction
  differentiation-enforcer.ts Embedding generation, pairwise cosine similarity, remutation loop
  constitution-enforcer.ts    Inviolable directives validation — no soul ships without passing this
  soul-query.ts               Query dna_store for top-performing souls by task category
```

**Responsibilities:**
- Query `dna_store` for top-N performing souls in the task category (Path A) or generate archetype spread (Path B — unknown category)
- Apply mutation operations per Algorithm 2 of the PRD
- Enforce inviolable constitution layer before any soul is approved for deployment
- Run embedding-based differentiation enforcement per Algorithm 3
- Return array of `SoulDocument` objects, one per bot

**Key dependencies:**
- `@claw/db` → `dnaStore`, `negativeSignalRegister` tables
- Embedding API: `text-embedding-3-small` via `openai` provider from the existing `ai` SDK (already installed)
- LLM calls for mutation generation: existing `ai` SDK `generateText()` / `generateObject()`

**New shared type:**
```typescript
// packages/shared-types/src/soul.ts
export interface SoulDocument {
  soulId: string;             // UUID, becomes FK in bot_souls
  botId: string;              // Pre-assigned before VM spawn
  taskCategory: string;       // Derived from objective
  content: string;            // Full SOUL.md text
  agentClass: 'novice' | 'understudy' | 'artisan';
  parentLineage: string[];    // dna_store IDs of parent souls
  mutationOps: string[];      // ['substitution', 'amplification']
  differentiationScore: number; // 1 - max_pairwise_cosine_similarity across population
}
```

**Integration point:** Called from `executions.ts` `setImmediate` block, between `planObjective()` and `spawnBotsForExecution()`. Soul content is stored in new `bot_souls` table keyed by `botId`. The dispatcher reads from this table just before dispatching a task to a bot.

---

### 2. The Council

**What it is:** Three LLM calls orchestrated by a runner module, all within execution-service. Not a standalone service. Not three long-running OpenClaw agents.

**Location:** `services/execution-service/src/council/`

```
council/
  council-runner.ts       Orchestrates the three members, writes verdicts to DB
  performance-judge.ts    Scores outcomes against objective; produces ranked performance tier
  soul-analyst.ts         Reads decision traces, produces soul directive quality assessment
  devils-advocate.ts      Generates rebuttal for any Promote recommendation
  verdict-aggregator.ts   Weighted aggregation (50/35/15), confidence scoring, escalation check
```

**Responsibilities:**
- Load all `decision_traces` and `attribution_reports` for all bots in the execution
- Run Performance Judge, Soul Analyst, Devil's Advocate as sequential LLM calls using `generateObject()` with Zod schemas to force structured output
- Aggregate into per-bot verdicts with confidence scores
- Write verdicts to `council_verdicts` table
- Mark Promote and Retire verdicts as `awaiting_confirmation`; auto-execute Maintain, Monitor, Demote

**LLM usage:** `generateObject()` from the `ai` SDK with Zod output schemas. Same pattern as `planner.service.ts` uses `generateText()`. Council members do not need to be OpenClaw agents — they are single LLM calls with structured prompts and strict output schemas.

**Integration point:** Appended to `runPerformancePipeline()` in `performance-engine.ts` after the existing `identifyAndCaptureDna()` call. Runs fire-and-forget, same error isolation pattern as existing pipeline.

```typescript
// Modification to performance-engine.ts
export async function runPerformancePipeline(executionId: string): Promise<void> {
  await computeScoresForExecution(executionId);
  await identifyAndCaptureDna(executionId);
  await runCouncil(executionId);  // NEW — appended, same fire-and-forget contract
}
```

---

### 3. God Layer

**What it is:** A BullMQ Worker running inside execution-service alongside the existing `startOpenClawDispatcher()` worker. Consumes from a new `soul-verdicts` queue.

**Location:** `services/execution-service/src/god-layer/`

```
god-layer/
  god-layer-worker.ts      BullMQ Worker consuming 'soul-verdicts' queue
  promotion-engine.ts      Promotion/demotion/retirement thresholds per Algorithm 8
  dna-writer.ts            Versioned DNA library writes per Algorithm 9
  negative-register.ts     Failure pattern preservation to negative_signal_register
  benchmark-manager.ts     Pioneer event handling, benchmark instantiation per Algorithm 7
```

**Responsibilities:**
- Consume from BullMQ `soul-verdicts` queue (jobs enqueued by human confirmation endpoint on confirm, or by Council for auto-executable verdicts)
- Apply promotion/demotion/retirement logic
- Write versioned `dna_store` entries with soul content, lineage, attribution summary
- Update `bots.agentClass` column
- Write to `negative_signal_register` for retirements and below-benchmark runs
- Emit `class_transition` Pub/Sub event for SSE live monitor

**Idempotency gate:** Uses `council_verdicts.status` column. Only process verdicts in `confirmed` status. Atomically transition to `executed` before processing begins. If the same job is delivered twice (BullMQ at-least-once), the second delivery finds status already `executed` and skips.

**Integration point:** Started in `main.ts` alongside the existing dispatcher.

```typescript
// Modification to services/execution-service/src/main.ts
const openClawWorker = startOpenClawDispatcher();   // existing
const godLayerWorker = startGodLayerWorker();        // NEW
```

---

### 4. Human Confirmation API

**What it is:** A new Fastify route plugin within execution-service.

**Location:** `services/execution-service/src/routes/verdicts.ts`

**Endpoints:**
```
GET  /verdicts/:executionId       — list all verdicts for an execution (for UI display)
POST /verdicts/:verdictId/confirm — confirm or reject a pending verdict
  body:    { confirm: boolean }
  returns: { ok: boolean, verdictId: string, action: 'executed' | 'rejected' }
```

**On confirm=true:** Transitions `council_verdicts.status` from `awaiting_confirmation` to `confirmed`, then enqueues to `soul-verdicts` BullMQ queue.
**On confirm=false:** Transitions status to `rejected`; no God Layer action.

**Integration point:** Registered in `app.ts`.

---

### 5. Agent Runtime Instrumentation

**What it is:** An extension to the OpenClaw WebSocket protocol handled in `openclaw-client.ts`. No new service, no GCE changes.

**Location changes:**
- `services/execution-service/src/orchestrator/openclaw-client.ts` — modified
- `services/execution-service/src/queue/openclaw-dispatcher.ts` — modified
- `packages/event-schemas/src/soul-events.ts` — new

**Extended WebSocket messages:**

```typescript
// Extended run_task sent by orchestrator to agent
interface RunTaskMessage {
  type: 'run_task';
  sessionId: string;
  prompt: string;
  soul_content?: string;    // NEW — full SOUL.md text; optional for backward compat
  task_category?: string;   // NEW — for attribution context
}

// New inbound message type from agent during execution
interface DecisionAnnotationMessage {
  type: 'decision_annotation';
  sessionId: string;
  decisionId: string;
  decisionType: 'tool_call' | 'reasoning_branch' | 'output_generation';
  soulDirectiveRef: string; // Which directive drove this decision
  attributionConfidence: number; // 0.0–1.0
  outcome: 'success' | 'failure' | 'neutral';
}
```

**OPEN QUESTION (HIGH RISK):** Whether OpenClaw's WebSocket sessions API accepts extra fields in `run_task`. If the API rejects unknown fields, the fallback is prompt prefix injection:

```
SOUL CONSTITUTION:
${soulContent}
---
TASK:
${taskDescription}
```

This fallback is functional but less clean. Verify OpenClaw API behavior before building Phase 2.

**OPEN QUESTION (HIGH RISK):** Whether OpenClaw agents can be configured to emit `decision_annotation` messages. This is required for real-time attribution. If not available, the Soul Analyst falls back to post-hoc attribution analysis from the existing `tool_invocations` table using an LLM pass. The post-hoc approach is the safe fallback.

---

## Modified Components

### `services/execution-service/src/routes/executions.ts`

**Change:** Insert soul generation between `planObjective()` and `spawnBotsForExecution()` in the `setImmediate` async pipeline.

**Before:**
```
planObjective() → spawnBotsForExecution() → addTaskToQueue()
```

**After:**
```
planObjective() → generateSoulPopulation() → spawnBotsForExecution(preAssignedBotIds) → addTaskToQueue()
```

Soul population is generated once per execution before any VMs spawn. Each bot receives a pre-assigned `botId` (generated during soul generation so the soul can be keyed to it in `bot_souls`). `spawnBotsForExecution()` gains a `preAssignedBotIds?: string[]` parameter.

**Migration risk:** LOW. The `setImmediate` pipeline is already fire-and-forget. Inserting a step before VM spawn does not touch the VM lifecycle. If soul generation fails, execution falls back to spawning bots without souls — agents run on default OpenClaw behavior.

---

### `services/execution-service/src/orchestrator/bot-orchestrator.ts`

**Change:** `spawnBot()` moves UUID generation from internal to caller. `spawnBotsForExecution()` accepts optional `preAssignedBotIds`.

**Migration risk:** LOW. `spawnBot()` signature change is contained within `bot-orchestrator.ts` and its callers (`spawnBotsForExecution()`, one call site in `executions.ts`).

---

### `services/execution-service/src/orchestrator/openclaw-client.ts`

**Change 1:** `sendTask()` gains optional `soulContent?: string` and `taskCategory?: string` parameters included in the `run_task` WebSocket message.

**Change 2:** `handleMessage()` handles new `decision_annotation` message type. Each annotation is passed to a callback registered by the dispatcher.

**Migration risk:** LOW. Both parameters are optional. Existing callers continue to work without passing them.

---

### `services/execution-service/src/queue/openclaw-dispatcher.ts`

**Change:** `dispatchTaskToBot()` reads soul content from `bot_souls` table by `botId` and passes it to `sendTask()`. Also registers a `decision_annotation` callback on the client that writes to `decision_traces` table.

**Migration risk:** LOW. One additional DB read per dispatch (single row lookup by `botId`). If no soul row is found, dispatch proceeds without soul content.

---

### `services/execution-service/src/performance/performance-engine.ts`

**Change:** Append `runCouncil(executionId)` after `identifyAndCaptureDna()`.

**Migration risk:** LOW. Additive. Existing pipeline steps unchanged.

---

### `services/execution-service/src/performance/dna-capture.ts`

**Change:** `captureOneBotDna()` extended to also write soul content, agent class, parent lineage, mutation ops, and council verdict reference to the new `dna_store` columns.

**Migration risk:** MEDIUM. The `DnaPayload` interface and `dna_store` schema both change. Requires Drizzle migration. Existing rows remain valid (new columns are nullable). The function is extended, not rewritten.

---

### `packages/db/src/schema/dna-store.ts`

**Change:** New columns added to existing table. `DnaPayload` JSONB payload interface stays intact. New top-level columns added for soul-specific data (not inside the JSONB — proper column typing enables indexing).

**Migration risk:** MEDIUM. New columns are nullable with defaults. Drizzle `generate` + `migrate` handles additive migrations cleanly.

---

### `services/execution-service/src/app.ts`

**Change:** Register `verdicts` route plugin.

```typescript
app.register(verdictsRoutes, { prefix: '/verdicts' });  // NEW
```

---

### `packages/event-schemas/src/` (new file)

**Change:** Add `soul-events.ts` with `VerdictConfirmedEvent` and `ClassTransitionEvent` schemas.

---

## Data Flow Changes

### Pre-Execution: Soul Generation

```
POST /executions { objective, maxBots, ... }
  └─ setImmediate async pipeline:

     1. planObjective(objective, maxBots)
        └─ returns: PlannedTask[]

     2. [NEW] generateSoulPopulation(objective, taskCategory, maxBots)
        ├─ reads:  dna_store WHERE task_category = X ORDER BY composite_score DESC LIMIT N
        ├─ reads:  negative_signal_register WHERE task_category = X (constraint layer)
        ├─ calls:  embedding API for pairwise similarity (differentiation enforcement)
        ├─ calls:  LLM for soul mutation/generation
        ├─ writes: bot_souls (one row per bot, keyed by pre-assigned botId)
        └─ returns: SoulDocument[] (one per bot, with pre-assigned botIds)

     3. spawnBotsForExecution(executionId, maxBots, preAssignedBotIds)
        └─ for each botId: spawnBot(executionId, botId) → GCE VM

     4. addTaskToQueue() for each planned task
        └─ unchanged
```

### Execution-Time: Decision Trace Collection

```
Bot VM (OpenClaw agent):
  └─ receives: run_task { prompt, soul_content, task_category }
  └─ at each decision point (tool_call, reasoning branch):
       emits: decision_annotation { decisionId, soulDirectiveRef, confidence, outcome }
         → WebSocket → OpenClawClient.handleMessage()
           → NEW callback: INSERT INTO decision_traces
  └─ on task complete:
       emits: task_complete { sessionId, result }
       → existing completion flow unchanged
```

If real-time `decision_annotation` is not available from OpenClaw, the Soul Analyst LLM call performs post-hoc attribution analysis from `tool_invocations` rows.

### Post-Execution: Council + God Layer

```
checkExecutionCompletion() → execution transitions to 'completed'
  └─ fires: runPerformancePipeline(executionId) [fire-and-forget, existing pattern]
       1. computeScoresForExecution(executionId)    [existing — unchanged]
       2. identifyAndCaptureDna(executionId)        [existing — extended with soul fields]
       3. [NEW] runCouncil(executionId)
            ├─ loads: decision_traces for all bots in execution
            ├─ loads: attribution_reports (compiled from decision_traces)
            ├─ calls: performanceJudge(botMetrics) → scored verdicts
            ├─ calls: soulAnalyst(decisionTraces, soulDocuments) → directive assessments
            ├─ calls: devilsAdvocate(verdicts, assessments) → rebuttals
            ├─ calls: aggregateVerdicts() → final verdicts with confidence scores
            ├─ writes: council_verdicts (one row per bot)
            ├─ for Promote/Retire: marks awaiting_confirmation, triggers notification
            └─ for Maintain/Monitor/Demote: enqueues directly to soul-verdicts BullMQ queue

POST /verdicts/:verdictId/confirm { confirm: true }
  └─ transitions: council_verdicts.status → 'confirmed'
  └─ enqueues: soul-verdicts BullMQ job { verdictId, botId, executionId }
  └─ publishes: verdict_confirmed Pub/Sub event → SSE live monitor

BullMQ Worker: god-layer-worker (soul-verdicts queue)
  ├─ reads: council_verdicts, bot_souls, decision_traces for botId
  ├─ runs: promotionEngine(bot, verdict, runHistory) → classTransition?
  ├─ if class change:
  │    ├─ updates: bots.agentClass
  │    ├─ writes: dna_store versioned entry (soul content, lineage, attribution)
  │    ├─ writes: negative_signal_register (retirements and below-benchmark runs)
  │    └─ publishes: class_transition Pub/Sub event → SSE narrative events
  └─ marks: council_verdicts.status = 'executed'
```

---

## Database Schema Changes

### New Tables

#### `bot_souls` — Soul assignments keyed to bots before VM spawn

```sql
CREATE TABLE bot_souls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  task_category VARCHAR(255) NOT NULL,
  soul_content TEXT NOT NULL,
  agent_class VARCHAR(20) NOT NULL DEFAULT 'novice',
  parent_lineage UUID[] NOT NULL DEFAULT '{}',
  mutation_ops TEXT[] NOT NULL DEFAULT '{}',
  differentiation_score NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bot_souls_bot_id_idx ON bot_souls(bot_id);
CREATE INDEX bot_souls_execution_id_idx ON bot_souls(execution_id);
CREATE INDEX bot_souls_task_category_idx ON bot_souls(task_category);
```

**Note on embedding vectors:** Do not store raw embedding vectors in Postgres at MVP. They are computed transiently for differentiation enforcement and discarded. If vector search becomes needed for similarity lookup, add `pgvector` extension post-MVP.

---

#### `decision_traces` — Per-decision attribution annotations from agents

```sql
CREATE TABLE decision_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  decision_id UUID NOT NULL,
  decision_type VARCHAR(50) NOT NULL,
  soul_directive_ref TEXT NOT NULL,
  attribution_confidence NUMERIC(4, 3) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX decision_traces_execution_id_idx ON decision_traces(execution_id);
CREATE INDEX decision_traces_bot_id_idx ON decision_traces(bot_id);
CREATE INDEX decision_traces_session_id_idx ON decision_traces(session_id);
```

**Volume note:** This table will grow fast. At 100 decisions per task and 5 bots and 5 tasks per execution, that is 2,500 rows per execution. Add an archival policy or TTL before the table hits 1M rows. For MVP this is fine; add it to the Phase 6 backlog.

---

#### `council_verdicts` — Post-execution Council outputs, one row per bot per execution

```sql
CREATE TYPE verdict_type AS ENUM ('promote', 'maintain', 'monitor', 'demote', 'retire');
CREATE TYPE verdict_status AS ENUM (
  'pending', 'awaiting_confirmation', 'confirmed', 'rejected', 'executed'
);

CREATE TABLE council_verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  verdict verdict_type NOT NULL,
  status verdict_status NOT NULL DEFAULT 'pending',
  confidence_score NUMERIC(4, 3) NOT NULL,
  performance_judge_output JSONB NOT NULL,
  soul_analyst_output JSONB NOT NULL,
  devils_advocate_output JSONB,
  plain_language_summary TEXT NOT NULL,
  requires_human_confirmation BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX council_verdicts_execution_id_idx ON council_verdicts(execution_id);
CREATE INDEX council_verdicts_bot_id_idx ON council_verdicts(bot_id);
CREATE INDEX council_verdicts_status_idx ON council_verdicts(status);
```

---

#### `negative_signal_register` — Retirement and failure patterns preserved as mutation constraints

```sql
CREATE TABLE negative_signal_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL,
  execution_id UUID NOT NULL,
  task_category VARCHAR(255) NOT NULL,
  agent_class_at_failure VARCHAR(20) NOT NULL,
  failure_type VARCHAR(50) NOT NULL,
  soul_content TEXT NOT NULL,
  directive_activation_map JSONB NOT NULL,
  mutation_lineage UUID[] NOT NULL DEFAULT '{}',
  council_verdict_id UUID REFERENCES council_verdicts(id),
  failure_annotations TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX negative_signal_register_task_category_idx
  ON negative_signal_register(task_category);
```

---

### Modified Tables (additive, backward-compatible)

#### `dna_store` — Extended with SOUL System fields

All new columns are nullable or have defaults. Existing rows remain valid.

```sql
ALTER TABLE dna_store
  ADD COLUMN soul_content TEXT,
  ADD COLUMN agent_class VARCHAR(20),
  ADD COLUMN parent_lineage UUID[] DEFAULT '{}',
  ADD COLUMN mutation_ops TEXT[] DEFAULT '{}',
  ADD COLUMN council_verdict_id UUID REFERENCES council_verdicts(id),
  ADD COLUMN directive_activation_summary JSONB,
  ADD COLUMN human_confirmed_at TIMESTAMPTZ,
  ADD COLUMN pioneer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_provisional BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX dna_store_task_category_agent_class_idx
  ON dna_store(objective_category, agent_class);

CREATE INDEX dna_store_composite_score_confirmed_idx
  ON dna_store(composite_score) WHERE human_confirmed_at IS NOT NULL;
```

Soul generator queries filter `WHERE human_confirmed_at IS NOT NULL` to exclude unconfirmed provisional entries from seeding future populations.

---

#### `bots` — Extended with SOUL System fields

```sql
ALTER TABLE bots
  ADD COLUMN agent_class VARCHAR(20) NOT NULL DEFAULT 'novice',
  ADD COLUMN soul_id UUID REFERENCES bot_souls(id),
  ADD COLUMN task_category VARCHAR(255),
  ADD COLUMN pioneer BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX bots_agent_class_idx ON bots(agent_class);
CREATE INDEX bots_task_category_idx ON bots(task_category);
```

---

#### `executions` — Minor extension

```sql
ALTER TABLE executions
  ADD COLUMN task_category VARCHAR(255),
  ADD COLUMN soul_generation_status VARCHAR(20) NOT NULL DEFAULT 'pending';
```

`soul_generation_status` values: `'pending' | 'completed' | 'failed' | 'skipped'`. Allows the UI and debugging tools to distinguish executions with and without soul generation.

---

### What Does Not Change

| Table | Status | Reason |
|-------|--------|--------|
| `tasks` | Unchanged | Soul is per-bot, not per-task. Attribution is in `decision_traces`. |
| `tool_invocations` | Unchanged | Existing tool audit log remains the source for post-hoc attribution fallback. |
| `telemetry` | Unchanged | Score telemetry rows unchanged; Council writes to its own table. |
| `billing_events` | Unchanged | No billing change from SOUL System. |

---

## Suggested Build Order

Build order is driven by dependency direction. Each phase independently testable before the next begins.

### Phase 1: Database Schema + Shared Types

**What:** Write all Drizzle schema files for new tables and column additions. Generate and run migrations. Extend shared-types and event-schemas packages.

**Why first:** All subsequent phases depend on these types and tables. Having schema in place lets later phases write real data instead of stubs.

**Deliverables:**
- New Drizzle schema files: `bot-souls.ts`, `decision-traces.ts`, `council-verdicts.ts`, `negative-signal-register.ts`
- Modified schemas: `dna-store.ts`, `bots.ts`, `executions.ts`
- New shared types: `packages/shared-types/src/soul.ts`, `packages/shared-types/src/verdict.ts`
- New event schemas: `packages/event-schemas/src/soul-events.ts`
- Drizzle migration generated and applied

**Risk:** LOW. Additive migrations. No existing runtime code paths broken.

---

### Phase 2: Soul Generation + Dispatch Integration

**What:** Build soul generator end-to-end including differentiation enforcement. Wire into execution creation and task dispatch.

**Why second:** The soul must exist and be attached to bots before task dispatch. Building this second means every run from this point forward has real soul data, which all later phases need.

**Deliverables:**
- `soul/soul-generator.ts`, `soul/mutation-engine.ts`, `soul/differentiation-enforcer.ts`, `soul/constitution-enforcer.ts`, `soul/soul-query.ts`
- Modified `routes/executions.ts` — insert `generateSoulPopulation()` in pipeline
- Modified `orchestrator/bot-orchestrator.ts` — `spawnBot()` accepts pre-assigned `botId`; `spawnBotsForExecution()` accepts `preAssignedBotIds[]`
- Modified `orchestrator/openclaw-client.ts` — `sendTask()` gains optional `soulContent` and `taskCategory`
- Modified `queue/openclaw-dispatcher.ts` — look up soul from `bot_souls` before dispatch

**Risk:** MEDIUM. The pre-assigned `botId` flow requires a refactor of `spawnBotsForExecution()`. Verify OpenClaw `run_task` message field acceptance before finalizing soul delivery mechanism. If OpenClaw rejects unknown fields, switch to prompt prefix injection (same code path, simpler payload).

---

### Phase 3: Decision Trace Collection

**What:** Instrument OpenClaw WebSocket handler to receive and persist `decision_annotation` messages. Build post-hoc attribution compiler as fallback.

**Why third:** Council needs decision traces to produce causal attribution. This phase makes those traces real.

**Deliverables:**
- Modified `openclaw-client.ts` — handle `decision_annotation` message type
- Modified `openclaw-dispatcher.ts` — register annotation callback, write to `decision_traces`
- New `soul/attribution-compiler.ts` — compiles `decision_traces` rows into per-bot attribution reports (also serves as post-hoc analysis path from `tool_invocations`)

**Risk:** MEDIUM. Depends on OpenClaw emitting `decision_annotation` messages. If not available, the post-hoc path (LLM analysis of `tool_invocations` sequences) ships as the primary implementation. Build both, ship whichever is available from OpenClaw.

---

### Phase 4: The Council

**What:** Build the three LLM judge modules and verdict aggregation. Wire into the performance pipeline.

**Why fourth:** Depends on decision traces (Phase 3) and existing score pipeline. Can be partially built and tested against synthetic trace data while Phase 3 is confirmed.

**Deliverables:**
- `council/performance-judge.ts` — `generateObject()` call with structured verdict schema
- `council/soul-analyst.ts` — `generateObject()` call reading decision traces
- `council/devils-advocate.ts` — `generateObject()` call conditioned on PJ output
- `council/verdict-aggregator.ts` — weighted 50/35/15 aggregation, confidence scoring
- `council/council-runner.ts` — orchestration, DB writes
- Modified `performance/performance-engine.ts` — append `runCouncil(executionId)`

**Risk:** LOW. Structurally a set of LLM calls using the already-installed `ai` SDK. The risk is output consistency — use `generateObject()` with strict Zod schemas to prevent unstructured responses.

---

### Phase 5: Human Confirmation API + Notifications

**What:** Verdict confirmation endpoint. User notification flow. BullMQ enqueue to God Layer.

**Why fifth:** God Layer cannot execute until verdicts are confirmed. This is the human gate.

**Deliverables:**
- `routes/verdicts.ts` — `GET /verdicts/:executionId`, `POST /verdicts/:verdictId/confirm`
- Modified `app.ts` — register verdicts routes
- New Pub/Sub event: `verdict_confirmed` (in `packages/event-schemas/src/soul-events.ts`)
- UI additions: verdict notification panel on execution report page; confirm/reject buttons
- SSE extension: `verdict_confirmed` events streamed to UI using existing SSE infrastructure

**Risk:** LOW. Standard Fastify route and BullMQ enqueue pattern.

---

### Phase 6: God Layer

**What:** Background BullMQ Worker that processes confirmed verdicts, manages class transitions, and writes the DNA library.

**Why sixth:** Depends on confirmed verdicts (Phase 5). God Layer is the terminal step of the feedback loop that makes the DNA library compound.

**Deliverables:**
- `god-layer/god-layer-worker.ts` — BullMQ Worker on `soul-verdicts` queue
- `god-layer/promotion-engine.ts` — class transition logic per Algorithm 8
- `god-layer/dna-writer.ts` — versioned DNA library writes per Algorithm 9
- `god-layer/negative-register.ts` — failure pattern preservation
- `god-layer/benchmark-manager.ts` — Pioneer event handling, benchmark instantiation
- Modified `main.ts` — start `godLayerWorker` alongside existing openclaw dispatcher

**Risk:** LOW-MEDIUM. Most stateful component. Idempotency via `council_verdicts.status` atomic transition prevents double-promotion on duplicate BullMQ delivery.

---

### Phase 7: UI — Council Narrative + Leaderboard Extensions

**What:** Surface Council verdicts, agent class badges, and class transition events in SvelteKit UI.

**Why last:** All data these views consume is produced by Phases 4–6. Building last avoids dead UI while backend phases are in flight.

**Deliverables:**
- Extended leaderboard: `agentClass`, `tier`, council verdict summary per bot
- New verdict panel: pending confirmations with confirm/reject interface
- SSE `class_transition` events: narrative notifications ("Agent 7 has been promoted to Understudy")
- Pioneer flag surface: new task categories flagged in live dashboard

**Risk:** LOW. Additive UI changes on existing leaderboard and SSE infrastructure.

---

## Integration Points Map

| Integration Point | Existing Code | New Code | Change Type |
|-------------------|--------------|----------|-------------|
| Soul generation before spawn | `routes/executions.ts` setImmediate block | `soul/soul-generator.ts` | Call insertion |
| Soul delivery to agent | `openclaw-client.ts` `sendTask()` | Extended `run_task` message | Protocol extension |
| Soul lookup at dispatch | `openclaw-dispatcher.ts` `dispatchTaskToBot()` | `bot_souls` DB read by `botId` | DB lookup added |
| Decision trace ingestion | `openclaw-client.ts` `handleMessage()` | New `decision_annotation` handler + DB write | Message type added |
| Council trigger | `performance-engine.ts` `runPerformancePipeline()` | `council/council-runner.ts` appended | Function append |
| Human confirmation gate | None | `routes/verdicts.ts` | New route plugin |
| God Layer trigger | Human confirmation endpoint | BullMQ `soul-verdicts` queue enqueue | Queue integration |
| DNA library write enrichment | `dna-capture.ts` `captureOneBotDna()` | Extended with soul fields | Data enrichment |
| Agent class tracking | `bots` table (no class column) | New `agent_class` column, updated by God Layer | Schema addition |
| Negative signal register | None | New table + God Layer writes | New table |
| UI narrative events | Existing Pub/Sub + SSE infrastructure | New `class_transition` event type | New event type |
| Differentiation enforcement | None | Embedding API (OpenAI) via existing `ai` SDK | New external call |

---

## Component Boundaries: What Changes vs. What Stays the Same

### UNCHANGED — Do Not Touch

| Component | File | Reason |
|-----------|------|--------|
| Tool Gateway (entire service) | `services/tool-gateway/` | All tool routing, allowlisting, rate limiting unchanged |
| Billing Engine | `events/billing-engine.ts` | Billing is per tool invocation; soul/council adds no billing events |
| Guardrail Watchdog | `events/guardrail-watchdog.ts` | Operates at tool call level; unaffected by soul content |
| GCE bot launcher | `orchestrator/gce-bot-launcher.ts` | VM provision logic unchanged; soul delivered via WebSocket post-boot |
| BullMQ task queue | `queue/task-queue.ts`, `queue/openclaw-dispatcher.ts` (mostly) | Queue schema unchanged; dispatcher gets one additional DB read |
| Redis budget enforcement | Existing Lua script in billing-engine | Budget keys and enforcement mechanism unchanged |
| Existing Pub/Sub topics | `bot-lifecycle`, `execution-lifecycle`, `task-lifecycle`, `guardrail-events`, `billing-events` | All existing topics and subscriptions unchanged |
| Auth / JWT flow | `lib/verify-auth-token.ts` | No new auth surfaces except verdict confirmation endpoint which uses existing token verification |
| Bot registry (in-memory) | `orchestrator/bot-registry.ts` | Add `soulId?: string` field only; core registry logic unchanged |
| Score engine | `performance/score-engine.ts` | Unchanged; Council adds separate verdict scoring on top |
| Completion checker | `orchestrator/completion-checker.ts` | Unchanged; Council fires via the existing performance pipeline extension |

### MODIFIED — Touch Carefully

| Component | File | Change | Risk |
|-----------|------|--------|------|
| Execution creation pipeline | `routes/executions.ts` | Insert soul generation step | LOW — additive to existing pipeline |
| Bot spawn | `orchestrator/bot-orchestrator.ts` | Pre-assigned botId flow | LOW — small refactor |
| OpenClaw client | `orchestrator/openclaw-client.ts` | Optional soul_content param, new message handler | LOW — optional fields |
| Task dispatcher | `queue/openclaw-dispatcher.ts` | Soul lookup + annotation callback | LOW — one DB read added |
| Performance engine | `performance/performance-engine.ts` | Append Council call | LOW — additive |
| DNA capture | `performance/dna-capture.ts` | Write soul fields to new dna_store columns | MEDIUM — schema change |
| DNA store schema | `packages/db/src/schema/dna-store.ts` | New columns | MEDIUM — migration required |

### NEW — Build From Scratch

| Component | Location | Notes |
|-----------|----------|-------|
| Soul generator | `soul/` (6 modules) | Most complex new component |
| Council | `council/` (5 modules) | LLM calls with structured output |
| God Layer | `god-layer/` (5 modules) | BullMQ worker, most stateful |
| Verdicts API | `routes/verdicts.ts` | Standard Fastify route |
| New DB tables | `packages/db/src/schema/` (4 files) | bot_souls, decision_traces, council_verdicts, negative_signal_register |
| Soul event schemas | `packages/event-schemas/src/soul-events.ts` | verdict_confirmed, class_transition |
| Soul shared types | `packages/shared-types/src/soul.ts` | SoulDocument, verdict types |

---

## Architecture Decisions and Rationale

### Decision 1: No New GCE Service for SOUL System

All SOUL System components run inside execution-service. The Council and God Layer run as BullMQ Workers and in-process modules. This matches the existing pattern: `startOpenClawDispatcher()` is already a BullMQ Worker inside execution-service. A separate service would add operational complexity (new GCE process, health checks, deployment step) for no benefit at this traffic volume.

**Reconsider when:** Council LLM calls consistently exceed 60 seconds per execution or God Layer processing causes execution-service memory pressure. Extraction to a separate process is straightforward at that point — BullMQ queues are already the interface.

### Decision 2: Soul Delivered via WebSocket, Not VM Startup Script

The soul is included in the `run_task` WebSocket message, not baked into the GCE startup script or VM metadata. This means soul content can change without VM changes. A bot VM is a generic OpenClaw runner; the soul content is injected per-task by the orchestrator.

The alternative (startup script injection) would require souls to be available before VM boot (adds latency), bake the soul into the VM image (inflexible), and couple soul generation to GCE provisioning (tight coupling that increases risk).

### Decision 3: Council Members Are LLM Calls, Not Agents

The Performance Judge, Soul Analyst, and Devil's Advocate are `generateObject()` calls with strict Zod schemas, not long-lived OpenClaw agents. Running them as agents would add boot time (2–5 min per VM), billing complexity (VM cost per Council run), and WebSocket session management for what is a batch inference job. The `ai` SDK pattern is already established in `planner.service.ts`.

### Decision 4: Pre-Assigned botIds

Soul generation must precede `spawnBot()` so souls are keyed to botIds before VM boot. The current `spawnBot()` generates its own UUID internally. Moving UUID generation to the caller (`spawnBotsForExecution()`) is a 3-line refactor with minimal risk. The `botId` remains the primary key in `bots`; only where UUID is generated changes.

### Decision 5: Provisional Register as Column, Not Separate Table

Non-confirmed entries (below confidence threshold, no human confirmation) are flagged via `is_provisional = true` and `human_confirmed_at = null` on the existing `dna_store` rather than a separate `provisional_register` table. The soul generator query explicitly filters `WHERE human_confirmed_at IS NOT NULL` to exclude provisional entries from population seeding. This avoids table proliferation and keeps all DNA records in one queryable place.

---

## Scaling Considerations

| Concern | At 100 runs | At 10K runs | Mitigation |
|---------|-------------|-------------|------------|
| `bot_souls` table | ~500 rows | ~50K rows | Trivial at both scales |
| `decision_traces` table | ~250K rows (100 decisions × 5 bots × 5 tasks × 100 runs) | 25M rows — archive or TTL | Add `captured_at` TTL (90 days) before table hits 5M rows |
| Council LLM cost | 3 calls/run × $0.01 avg = $0.03/run | $300 total — monitor | Consider sampling: only run Council on executions above budget threshold |
| DNA library query | Trivial | Add `(task_category, agent_class, composite_score)` composite index | Done in Phase 1 |
| Embedding computation | 5–7 calls/run (one per soul) | 50K–70K calls total | Cache embeddings for souls that haven't changed; use batch embedding API |
| `negative_signal_register` | ~50 rows total (retirements rare) | Grows slowly — no concern | No scaling concern |
| God Layer worker | Synchronous, completes in seconds | Still synchronous | Increase BullMQ concurrency if verdicts queue backs up |

---

## Open Questions That Block Build Order

| Question | Blocks | Risk | How to Investigate |
|----------|--------|------|-------------------|
| Does OpenClaw `run_task` accept extra fields (`soul_content`, `task_category`)? | Phase 2 soul delivery mechanism | HIGH | Inspect OpenClaw source code or contact adversa-ai; test with a real WebSocket message that includes extra fields |
| Does OpenClaw support emitting `decision_annotation` messages from agent reasoning? | Phase 3 trace quality | HIGH | Same investigation; check OpenClaw plugin/extension API |
| Which embedding model: `text-embedding-3-small` (OpenAI) or `gemini-embedding-exp-03-07`? | Phase 2 differentiation enforcer | LOW — either works | Benchmark latency on 7 souls; pick whichever returns in under 2s |
| What is the correct pairwise similarity threshold (0.85 suggested in PRD)? | Phase 2 differentiation enforcer | LOW — can ship at 0.85 and tune | Calibration run post-MVP |
| What is the OpenClaw `onboard` configuration for structured annotation output? | Phase 3 | HIGH | OpenClaw documentation review |

---

## Sources

All findings from direct codebase analysis. No WebSearch required — this is an integration architecture document for an existing codebase, not ecosystem research.

**Files analyzed:**
- `services/execution-service/src/routes/executions.ts` — execution creation pipeline
- `services/execution-service/src/orchestrator/bot-orchestrator.ts` — bot spawn/stop
- `services/execution-service/src/orchestrator/openclaw-client.ts` — WebSocket protocol
- `services/execution-service/src/orchestrator/gce-bot-launcher.ts` — VM provisioning
- `services/execution-service/src/orchestrator/bot-registry.ts` — in-memory registry
- `services/execution-service/src/queue/openclaw-dispatcher.ts` — task dispatch
- `services/execution-service/src/queue/task-queue.ts` — BullMQ queue config
- `services/execution-service/src/orchestrator/completion-checker.ts` — completion detection
- `services/execution-service/src/performance/performance-engine.ts` — performance pipeline
- `services/execution-service/src/performance/dna-capture.ts` — DNA capture
- `services/execution-service/src/performance/score-engine.ts` — scoring
- `services/execution-service/src/events/publisher.ts` — Pub/Sub publishing
- `services/execution-service/src/app.ts` — Fastify app setup
- `services/execution-service/src/services/execution.service.ts` — execution CRUD
- `services/execution-service/src/services/planner.service.ts` — LLM task planning
- `services/execution-service/src/routes/bots.ts` — bot routes and ready callback
- `packages/db/src/schema/` — all schema files
- `packages/event-schemas/src/` — all event schemas
- `soulprd.md` — full PRD (February 2026)
- `services/execution-service/package.json` — dependency versions

**Confidence levels by area:**

| Area | Confidence | Basis |
|------|------------|-------|
| Integration points | HIGH | Direct code analysis |
| Database schema changes | HIGH | Direct schema analysis; additive migration pattern verified |
| Build order | HIGH | Dependency graph is explicit in code |
| OpenClaw WebSocket extension | LOW | Message schema verified in openclaw-client.ts; OpenClaw API acceptance unverified |
| Decision annotation capability | LOW | Depends on OpenClaw runtime; unverified against source |
| Embedding model choice | MEDIUM | Both options viable in existing ai SDK; latency calibration needed |
| Council LLM latency | MEDIUM | Estimate 5–15s per Council member per execution based on similar structured output tasks |
