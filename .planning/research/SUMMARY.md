# Research Summary — SOUL System v2.0

**Synthesized:** 2026-02-21
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Prior summary (v1 base platform):** preserved above the break below for reference

---

## Executive Summary

The SOUL System v2.0 transforms Claw Army from a bot execution platform into an evolutionary learning system. The paradigm shift: bots no longer just execute tasks — they carry behavioral constitutions (SOUL.md documents with 7 defined dimensions), get evaluated by a three-judge Council after each run, and are mutated by a meta-orchestrator (God Layer) based on causal attribution of which soul directives drove which outcomes. The resulting DNA Library compounds over time, seeding future populations with increasingly specialized agents organized into a Novice/Understudy/Artisan class progression. No competitor is doing this. The moat is real if the attribution signal is real — that conditional is the single biggest implementation risk in the entire milestone.

The recommended implementation approach is a 7-phase incremental build, all inside the existing Fastify/BullMQ/PostgreSQL execution-service. Net new infrastructure: one npm package (`pgvector ^0.2.0`). Net new external dependencies: none. All LLM orchestration uses the already-installed Vercel AI SDK (`ai ^6.0.90`). All persistent state goes into the existing Cloud SQL PostgreSQL instance using Drizzle's built-in `vector()` column type. All background processing uses the existing BullMQ installation with a dedicated `council-queue` added alongside the existing execution queue. This is a capability milestone, not an infrastructure migration.

The highest-risk element is not technical. It is epistemic: the causal attribution pipeline (which soul directive drove which outcome) is built on LLM self-reporting, which research confirms is post-hoc rationalization rather than genuine introspection. The counterfactual verification step in the Council's Soul Analyst is not optional — it is the mechanism that separates a learning signal from an expensive random walk. Build it before the first production Council run. The second highest risk is that three LLM judges running in the same model family will produce sycophantic consensus rather than genuine adversarial evaluation. Use heterogeneous model families for the three Council roles from the start — this is an architectural constraint, not a prompt engineering tweak.

---

## Stack Additions

### Net New Packages

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `pgvector` | `^0.2.0` | `@claw/db` | Wire-format serialization for PostgreSQL vector columns |

**Install command:** `pnpm --filter @claw/db add pgvector`

### Already Available — No Action Required

| Capability | Package | Notes |
|-----------|---------|-------|
| Embedding generation | `ai ^6.0.90` + `@ai-sdk/openai ^3.0.29` | `embed()` and `.embedding('text-embedding-3-small')` ready |
| Structured LLM output (Council judges) | `ai ^6.0.90` + `zod ^4.3.6` | `generateObject()` with Zod schemas — same pattern as `planner.service.ts` |
| WebSocket (OpenClaw client) | `ws ^8.18.0` | Installed — extend `openclaw-client.ts`, no new package |
| Vector column DDL | `drizzle-orm 0.45.1` | Built-in `vector()` column type in `drizzle-orm/pg-core` |
| BullMQ dedicated queues + rate limiting | BullMQ 5.69.x | `limiter: { max: N, duration: Ms }` supported natively |
| Cosine similarity | Pure TypeScript | 10-line inline function — no package needed (OpenAI embeddings are unit-normalized) |

### Critical Stack Decisions

1. **No vector database.** pgvector in existing Cloud SQL handles 3–7 soul populations. Pinecone/Weaviate/Qdrant add managed service overhead for zero benefit at this scale.
2. **No orchestration framework.** The Council is 3 parallel `generateObject()` calls with `Promise.all()`. LangChain/LangGraph add abstraction overhead and conflict with the Fastify/BullMQ architecture.
3. **Embedding model: `text-embedding-3-small`.** 1,536 dimensions. Cost to embed a full 7-soul population: ~$0.00014. Reduce to 512 dimensions only if storage becomes a concern at thousands of souls.
4. **Council model: `gpt-4o` for judges — but heterogeneous model families.** Use at least one non-OpenAI model family for one judge role to prevent self-enhancement bias. Do not use `gpt-4o-mini` for the Devil's Advocate; genuine adversarial reasoning requires frontier capability.
5. **Prerequisite: enable pgvector on Cloud SQL.** Drizzle-kit does not auto-enable extensions. Run `CREATE EXTENSION IF NOT EXISTS vector;` manually and confirm with `\dx` before running migrations.

---

## Feature Landscape

### Table Stakes — v2.0 (Must-Have for Coherence)

Features that make the evolutionary loop meaningful. Missing any one makes the v2.0 premise hollow.

| Feature | Why Required | Complexity |
|---------|--------------|------------|
| SOUL.md schema (7 behavioral dimensions) | No axes = mutations operate on noise | MEDIUM |
| Soul loading at bot spawn (per-agent distinct constitution) | No distinct constitutions = no differentiated behavioral signal | LOW |
| Soul differentiation enforcement (embedding similarity pre-deploy) | Near-clones make causal comparison worthless | MEDIUM |
| Minimum 3 differentiated agents per task category | Single-agent runs produce no comparison baseline | LOW |
| Soul version tracking (hash + generation counter) | No version = no mutation lineage attribution | LOW |
| Runtime soul directive annotation per tool call | Without per-decision self-tagging, Council attribution is retrospective guessing | HIGH |
| 5 mutation operations: Substitution, Amplification, Attenuation, Recombination, Introduction | Full taxonomy required for non-trivial evolution; Recombination/Introduction add exploration | HIGH |
| Council evaluation: 3 independent judges, structured JSON verdicts, post-run only | Evaluation machinery for the learning loop | HIGH |
| Causal attribution with counterfactual verification | Self-report alone is confabulation; counterfactual is the real signal | HIGH |
| God Layer: reads verdicts, generates mutations and class transitions | Closes the evolutionary loop; without this, Council is a log file | HIGH |
| DNA Library: versioned souls, lineage, confirmed entries only | Compound learning requires a validated pattern store | MEDIUM |
| Human confirmation gate (async, summary-only, anti-rubber-stamp) | Ground truth circuit breaker for miscalibrated council verdicts | LOW |

### Differentiators — v2.0 (Create Competitive Distance)

| Feature | Value | Complexity |
|---------|-------|------------|
| Agent class progression (Novice/Understudy/Artisan per task category) | Specialization is domain-specific; progression is visible and engaging | MEDIUM |
| Archetype library (6–8 canonical personality templates) | Warm start for cold categories; prevents random initialization | MEDIUM |
| Army Builder UI (soul composition view pre-deployment) | Users see what they're deploying, not just "3 bots" | MEDIUM |
| Gamified lifecycle events (promotion ceremony, retirement, pioneer badge) | Narrative engagement; makes the system feel alive | LOW |
| Mutation lineage visualization | Shows the evolutionary story; builds trust | MEDIUM |
| Run-level evolution feed | God Layer decisions visible without reading technical verdicts | LOW |

### Anti-Features — Explicitly Excluded

| Anti-Feature | Why Excluded |
|--------------|-------------|
| Full-soul replacement as mutation | Destroys lineage continuity; attribution becomes impossible |
| User-editable raw soul text | Pollutes algorithmically-generated evolutionary space; corrupts lineage graph |
| Fine-tuning model weights from soul data | Requires RLHF infrastructure; out of scope for v2.0 |
| Real-time Council evaluation during execution | Council requires complete trace; mid-run attribution is garbage |
| 5+ class tiers | Three is the RPG engagement optimum; more creates choice paralysis |
| Continuous automated promotion without human gate | Miscalibrated verdicts silently degrade the DNA library |
| All Council members from the same model family | Self-enhancement bias; research confirms heterogeneous families are required |
| Per-run soul mutation | Insufficient run count produces noisy signal; require 3–5 runs minimum before Council eligibility |

### MVP Build Sequence

**Phase 1 (Mechanical Loop — must exist for v2.0 coherence):** SOUL.md schema, soul loading, directive annotation, differentiation enforcement, Council, causal attribution, God Layer, soul mutations, DNA Library, human confirmation gate.

**Phase 2 (User-Facing — depends on loop being closed):** Agent class system, archetype library, Army Builder UI.

**Phase 3 (Engagement — depends on class system existing):** Gamified lifecycle events, run-level evolution feed.

**Defer to v2.1+:** Soul weight sliders, multi-category army optimization, DNA export, soul A/B testing UI.

---

## Architecture Integration Points

### How New Components Hook Into Existing Stack

All new components live inside `services/execution-service`. No new GCE service. No new managed service.

| Seam | Existing Code | New Code | Change Type |
|------|--------------|----------|-------------|
| Pre-execution (soul generation) | `routes/executions.ts` setImmediate block | `soul/soul-generator.ts` — insert between `planObjective()` and `spawnBotsForExecution()` | Call insertion |
| Task dispatch (soul delivery) | `queue/openclaw-dispatcher.ts` `dispatchTaskToBot()` | Soul lookup from `bot_souls` by `botId`; pass to `sendTask()` | DB lookup + optional field |
| Execution-time (trace collection) | `openclaw-client.ts` `handleMessage()` | `decision_annotation` message handler — writes to `decision_traces` table | New message type handler |
| Post-execution (Council trigger) | `performance/performance-engine.ts` `runPerformancePipeline()` | Append `runCouncil(executionId)` after `identifyAndCaptureDna()` | Function append |
| Background (God Layer) | `main.ts` | `startGodLayerWorker()` started alongside existing openclaw dispatcher | BullMQ Worker addition |
| API (confirmation gate) | `app.ts` | Register `verdicts` route plugin | Route plugin |

**New directory structure inside execution-service:**

```
services/execution-service/src/
  soul/
    soul-generator.ts           Query dna_store, apply mutations, return SoulDocument[]
    mutation-engine.ts          5 mutation operations (Substitution, Amplification, etc.)
    differentiation-enforcer.ts Embedding generation + pairwise cosine similarity
    constitution-enforcer.ts    Inviolable directives validation
    attribution-compiler.ts     Post-hoc fallback from tool_invocations if annotation unavailable
    soul-query.ts               Query top-performing souls from dna_store by task category
  council/
    council-runner.ts           Orchestrate 3 judges, write council_verdicts, route to BullMQ
    performance-judge.ts        generateObject() — outcome metrics vs objectives
    soul-analyst.ts             generateObject() — directive-level attribution from decision traces
    devils-advocate.ts          generateObject() — adversarial rebuttal (heterogeneous model)
    verdict-aggregator.ts       50/35/15 weighted aggregation, confidence scoring
  god-layer/
    god-layer-worker.ts         BullMQ Worker on soul-verdicts queue
    promotion-engine.ts         Class transition thresholds (Novice → Understudy → Artisan)
    dna-writer.ts               Versioned DNA library writes
    negative-register.ts        Failure pattern preservation to negative_signal_register
    benchmark-manager.ts        Pioneer event handling, benchmark instantiation
  routes/verdicts.ts            GET /verdicts/:executionId, POST /verdicts/:verdictId/confirm
```

### New Database Tables Required

| Table | Purpose | Volume Note |
|-------|---------|-------------|
| `bot_souls` | Soul content keyed to bots before VM spawn; read by dispatcher | ~500 rows / 100 runs — trivial |
| `decision_traces` | Per-decision annotation from agents; Council's primary input | HIGH — ~2,500 rows/execution; plan 90-day TTL before 5M rows |
| `council_verdicts` | Post-execution Council outputs; one row per bot per execution | Low volume; long-lived |
| `negative_signal_register` | Failure patterns preserved as mutation constraints | Rare (retirement events) — low volume |

### Modified Tables (Additive — All Backward-Compatible)

| Table | New Columns |
|-------|-------------|
| `dna_store` | `soul_content`, `agent_class`, `parent_lineage UUID[]`, `mutation_ops TEXT[]`, `council_verdict_id`, `directive_activation_summary JSONB`, `human_confirmed_at`, `pioneer BOOLEAN`, `is_provisional BOOLEAN` |
| `bots` | `agent_class VARCHAR(20)`, `soul_id UUID`, `task_category VARCHAR(255)`, `pioneer BOOLEAN` |
| `executions` | `task_category VARCHAR(255)`, `soul_generation_status VARCHAR(20)` |

**All new columns are nullable or have defaults. Existing rows remain valid. Single coordinated Drizzle migration required — not incremental ALTER TABLE statements.**

### Critical Integration Risks

1. **OpenClaw WebSocket protocol (BLOCKER for Phase 2).** The `run_task` / `task_complete` message types in `openclaw-client.ts` are explicitly flagged as unverified placeholders in the existing code. Soul context delivery mechanism depends on whether OpenClaw accepts extra fields in `run_task` or requires prompt-prefix injection. Must verify against a live instance on `claw-app-dev` before finalizing Phase 2 design. Fallback (prompt prefix) is functional but less structured.

2. **Decision annotation capability (BLOCKER for Phase 3 quality).** Whether OpenClaw agents can emit `decision_annotation` messages from their reasoning loop is unconfirmed. If unavailable, the post-hoc attribution path (LLM analysis of `tool_invocations` sequences) ships as primary. Build both paths; ship whichever OpenClaw supports. Post-hoc is the safe fallback.

3. **Pre-assigned botId refactor.** `spawnBot()` currently generates its own UUID. Soul generation must precede VM spawn, so botIds must be pre-assigned by the caller (`spawnBotsForExecution()`). This is a 3-line change but touches the core spawn path — test carefully against existing bot lifecycle tests.

4. **`dna_store` schema migration.** `DnaPayload` interface and `dna_store` schema both change. All downstream queries that consume DNA records must handle nulls for soul fields. Audit every query site before migrating. Add `soul_generation_status` discriminator to distinguish pre-SOUL and post-SOUL runs in historical queries.

5. **Council queue isolation.** The Council must run on a separate named `council-queue` with its own worker pool. If Council jobs share the existing execution dispatcher queue (concurrency=20), they compete for worker slots during peak execution. Design the queue topology before writing the first Council job handler.

---

## Critical Watch-Outs

### Top 5 Pitfalls by Severity

**SOUL-1 — Council runs synchronously in the execution critical path (CRITICAL)**
Relevant phase: Council architecture (Phase 4)
The obvious implementation awaits all three Council `generateObject()` calls before returning the execution result. Three `gpt-4o` calls × 2,000–8,000 tokens each adds 10–45 seconds latency and costs $0.03–$0.25 per run. At concurrency=20 bots, this creates 60 simultaneous LLM calls that back up behind each other, causing cascading delays.
Prevention: Council evaluation is a fully async BullMQ job on a separate `council-queue`, triggered by the `execution:completed` event. Display run results immediately; push Council verdicts via SSE when ready. Separate queue with dedicated worker pool (start at concurrency=5). Set a hard token ceiling of 8,000 tokens per Council member; compress/summarize decision traces before passing. Route Council LLM cost through existing metering so users see total spend.

**SOUL-2 — LLM self-reported causal attribution is post-hoc rationalization (CRITICAL)**
Relevant phase: Causal Attribution implementation (Phase 3)
Agents annotate which soul directive drove each decision at runtime. Research on LLM explainability consistently finds that Chain-of-Thought rationales are plausible narratives constructed after decisions, not introspective records of the actual computation. If treated as ground truth, God Layer mutations operate on confabulated signal, and the platform degrades invisibly with each mutation cycle.
Prevention: The counterfactual verification step is mandatory. If an agent claims directive X caused a decision, the Soul Analyst must evaluate: "Would this decision trace have differed without directive X?" Cross-population validation (did agents without directive X make a different decision at the same branch point?) is the only behaviorally grounded check. Track attribution disagreement rate between self-reported and counterfactual assessments as a system health metric — if it exceeds 40%, the pipeline is producing noise. Build counterfactual verification at the same time as self-report instrumentation, not after observing drift.

**SOUL-3 — Council collapses into sycophantic consensus (CRITICAL)**
Relevant phase: Council implementation (Phase 4)
Multi-agent LLM debate research finds models converge toward consensus (mean 0.892 convergence rate) through sycophancy rather than genuine evaluation. The Devil's Advocate is most vulnerable — after seeing a strong Performance Judge score, it produces weak or no rebuttals regardless of actual weaknesses. If all three judges use the same model family, self-enhancement bias amplifies this further.
Prevention: Run three Council members with zero inter-agent visibility — no judge sees any other judge's output before producing its own. Only aggregate after all three independent outputs are collected. Use heterogeneous model families (e.g., GPT-4o for Performance Judge, Claude for Soul Analyst, Gemini for Devil's Advocate). If the Devil's Advocate no-objection rate on promotion recommendations exceeds 80% over a sample window, harden the DA prompt. This is an architectural constraint enforced by separate API calls with no shared context — not a prompt engineering fix.

**SOUL-4 — Human confirmation degrades into a rubber stamp (CRITICAL)**
Relevant phase: Human Confirmation Gate UX (Phase 5)
The human confirmation gate is the ground-truth signal that prevents miscalibrated council verdicts from corrupting the DNA Library. Research on HITL workflows finds sub-5-second confirmation times indicate button-pressing not genuine review. Gamification mechanics amplify this: users feel social pressure to confirm promotions framed as "your agent is ready." Once the signal is laundered as validated, all downstream library writes are corrupted.
Prevention: Measure time-on-confirmation-screen. Surface at least one concrete evidence item (a specific tool call, a Devil's Advocate argument if one exists) that requires parsing before the confirm button appears. Frame rejection as positive contribution. Track per-user confirmation rate — above 95% across 10+ confirmations is a rubber-stamp signal warranting a calibration check. Anti-rubber-stamp mechanics must ship at launch, not be added after observing degradation.

**INT-1 — Council jobs compete with execution jobs for the same BullMQ queue (HIGH)**
Relevant phase: Council architecture (Phase 4)
Council jobs added to the existing `execution-queue` (concurrency=20) compete for worker slots. During peak execution, a burst of 20 concurrent bots fills the pool; queued Council evaluations wait. After a large campaign, a burst of Council evaluations blocks the next campaign's bots from starting.
Prevention: Create a separate named `council-queue` with its own worker pool (initial concurrency=5) before deploying any Council job handlers. Add a BullMQ rate limiter on `council-queue` to prevent post-campaign bursts from queuing 50 evaluations simultaneously. Also: `decision_traces` table grows at ~2,500 rows/execution — plan a 90-day TTL archival policy before reaching 5M rows.

### Additional High-Severity Watch-Outs

| Pitfall | Phase | Key Prevention |
|---------|-------|---------------|
| INT-3: Embedding differentiation adds 2–5s to pre-run startup if sequential | Phase 2 | Batch all embedding calls via single API request; cache by soul content hash; `Promise.all` for pairwise comparison |
| INT-4: God Layer mutates souls during active campaigns (race condition) | Phase 6 | Snapshot soul at execution start (`bot_souls` is immutable per run); Redis lock on category library during active runs |
| EVAL-2: Thin benchmark window (Pioneer categories) produces misleading verdicts | Phase 6 | No promotion executes until benchmark has 3 confirmed runs; mandatory confidence discount in UI |
| EVAL-3: Unbounded Council LLM cost on large decision traces | Phase 4 | Hard 8,000-token ceiling per Council member context; compress traces before passing; route cost through existing metering |
| INT-2: DNA schema changes break existing run history queries on null soul fields | Phase 1 | Single coordinated migration; audit all query sites; `soul_generation_status` discriminator column gates soul-specific aggregations |
| DATA-2: Mutation lineage graph degrades query performance over time | Phase 6 (future) | Index on `(task_category, agent_class, fitness_score)`; store drift distance as computed column; plan lineage pruning at depth-3 for UI display |

---

## Open Questions

Ranked by blocking impact.

| Question | Blocks | Must Resolve Before | How to Investigate |
|----------|--------|--------------------|--------------------|
| Does OpenClaw `run_task` accept extra fields (`soul_content`, `task_category`) without rejecting the message? | Phase 2 soul delivery mechanism | Phase 2 coding begins | Test against live OpenClaw on `claw-app-dev` — send a `run_task` message with extra fields; inspect source or contact adversa-ai |
| What is the OpenClaw task dispatch method name (`agent.send` vs `agent.execute`) and params structure? | Phase 2 — correct dispatch | Phase 2 coding begins | Inspect running OpenClaw process on `claw-app-dev`; review DeepWiki source mappings for `openclaw/openclaw/12.2-agent-commands` |
| Does OpenClaw support emitting `decision_annotation` messages from agent reasoning? | Phase 3 — real-time vs. post-hoc attribution path | Phase 3 coding begins | Same investigation; check OpenClaw plugin/extension API; check `onboard` configuration |
| Is pgvector enabled on the Cloud SQL `claw-army` database? | Phase 1 migration | Phase 1 migration runs | `gcloud compute ssh claw-app-dev --zone=us-central1-a --command="psql [connection string] -c '\dx'"` |
| Does Council LLM cost at concurrency=20 hit OpenAI TPM limits? | Phase 4 — council-queue rate limiter sizing | Before Phase 4 production rollout | Load test in staging; configure `limiter: { max: 10, duration: 60000 }` on `council-queue` if limits are hit |
| What is the empirically correct pairwise similarity threshold for soul differentiation? | Phase 2 — differentiation enforcer calibration | Can ship at 0.85 and tune post-MVP | Run calibration run after first 10 executions; compare embedding distance with actual behavioral variance |
| Maximum SOUL.md document size vs. `text-embedding-3-small` 8,191-token context window | Phase 2 | Phase 2 soul schema design | Define hard max token limit in SOUL.md schema spec; truncation strategy if exceeded |

---

## Recommended Phase Order

Build order driven by hard dependency direction: you cannot evaluate what hasn't run; you cannot mutate based on evaluations that don't exist; you cannot surface class transitions before the class system exists. Each phase is independently testable before the next begins.

### Phase 1 — Database Schema + Shared Types
**Why first:** All subsequent phases write to or read from these tables. Having real schema in place means later phases write real data, not stubs. The DNA store migration must be done in a single coordinated operation to avoid breaking existing run history queries.
**Deliverables:** 4 new Drizzle schema files (`bot-souls.ts`, `decision-traces.ts`, `council-verdicts.ts`, `negative-signal-register.ts`); modified schemas (`dna-store.ts`, `bots.ts`, `executions.ts`); new shared types (`soul.ts`, `verdict.ts`); new event schemas (`soul-events.ts`); Drizzle migration applied.
**Risk:** LOW — additive columns, nullable defaults, no existing runtime paths broken.
**Research flag:** None — additive Drizzle migration patterns are well-documented and HIGH confidence.
**Blocker prerequisite:** Confirm pgvector extension available on Cloud SQL before running migration.

### Phase 2 — Soul Generation + Dispatch Integration
**Why second:** Souls must exist and be attached to bots before task dispatch. Every run from this phase forward has real soul data, which all later phases consume for evaluation.
**Deliverables:** `soul/` module (6 files); modified `executions.ts` (soul generation inserted); modified `bot-orchestrator.ts` (pre-assigned botId flow); modified `openclaw-client.ts` (optional soul fields); modified `openclaw-dispatcher.ts` (soul lookup before dispatch).
**Risk:** MEDIUM — pre-assigned botId refactor touches core spawn path; OpenClaw field acceptance must be confirmed before finalizing soul delivery. Fallback to prompt-prefix injection is functional.
**Research flag:** BLOCKER — verify OpenClaw WebSocket task dispatch protocol before writing Phase 2 soul delivery code.

### Phase 3 — Decision Trace Collection
**Why third:** The Council's Soul Analyst needs decision traces for causal attribution. Without this phase, Soul Analyst falls back to coarse post-hoc analysis from `tool_invocations`, producing weaker attribution signal.
**Deliverables:** Extended `openclaw-client.ts` (`decision_annotation` handler); extended `openclaw-dispatcher.ts` (annotation callback + DB write to `decision_traces`); new `soul/attribution-compiler.ts` (post-hoc fallback compiling `tool_invocations` rows into attribution reports).
**Risk:** MEDIUM — depends on OpenClaw emitting annotation messages. Build both paths; the post-hoc path is the safe fallback and ships regardless.
**Research flag:** BLOCKER — confirm OpenClaw annotation capability before Phase 3. If unavailable, the post-hoc path ships as primary; this must be decided before Phase 3 begins so the Soul Analyst is built against the right input.

### Phase 4 — The Council
**Why fourth:** Depends on decision traces (Phase 3) and existing score pipeline (already running). First phase where the learning signal becomes real. Council queue topology must be designed before writing any Council LLM handlers.
**Deliverables:** Separate `council-queue` BullMQ configuration (concurrency=5, rate limiter); `council/` module (5 files including verdict-aggregator with 50/35/15 weighting); modified `performance-engine.ts` (append `runCouncil()` — async BullMQ enqueue, not await).
**Risk:** LOW structurally — `generateObject()` follows the established pattern used in `planner.service.ts`. Quality risk: enforce independent execution (no judge sees another's output), heterogeneous model families, position randomization in comparison inputs.
**Research flag:** None — LLM-as-judge bias mitigations are HIGH confidence from multiple peer-reviewed sources.

### Phase 5 — Human Confirmation API + Notifications
**Why fifth:** God Layer cannot execute until verdicts are confirmed. The human gate is required before any DNA library writes occur.
**Deliverables:** `routes/verdicts.ts` (GET + POST endpoints); registered in `app.ts`; Pub/Sub `verdict_confirmed` event schema; UI verdict notification panel with confirm/reject interface and mandatory evidence surface; SSE extension for `verdict_confirmed` events.
**Risk:** LOW — standard Fastify route and BullMQ enqueue pattern. UX risk: anti-rubber-stamp mechanics must ship at launch (evidence surface, time measurement, rejection framing). Do not defer UX hardening to post-launch.
**Research flag:** None — HITL UX patterns are HIGH confidence. Anti-rubber-stamp mechanics are well-specified.

### Phase 6 — God Layer
**Why sixth:** Terminal step of the feedback loop. Depends on confirmed verdicts (Phase 5). Makes the DNA Library compound over time.
**Deliverables:** `god-layer/` module (5 files); `godLayerWorker` started in `main.ts` alongside existing openclaw dispatcher; idempotency via `council_verdicts.status` atomic transition; soul snapshot binding (God Layer evaluates run's `bot_souls` snapshot, not current library); Redis lock on category library during active campaigns.
**Risk:** LOW-MEDIUM — most stateful component. Idempotency and snapshot binding are the critical correctness requirements; both must be in place before the first God Layer run touches real DNA library data.
**Research flag:** None — BullMQ worker patterns are established by the existing openclaw dispatcher.

### Phase 7 — UI: Council Narrative, Leaderboard Extensions, Army Builder
**Why last:** All data these views consume is produced by Phases 4–6. Building last avoids dead UI while backend phases are in flight.
**Deliverables:** Extended leaderboard (`agentClass`, council verdict summary, tier badges, pioneer flag); verdict confirmation panel with anti-rubber-stamp UX; SSE `class_transition` narrative notifications; Army Builder UI (soul composition view, class-aware slot filling, differentiation enforcement feedback); mutation lineage display (depth-3 max for UI).
**Risk:** LOW — additive UI changes on existing leaderboard and SSE infrastructure. Army Builder depends on stable DNA Library and class system API.
**Research flag:** Army Builder role-legibility patterns are HIGH confidence per ACM DIS 2025 research. Gamification engagement patterns (promotion ceremony, pioneer badge) are HIGH confidence per RPG progression literature.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack additions | HIGH | Direct package.json + schema analysis; 1 new package with clear precedent |
| Feature set (table stakes) | HIGH | Cross-referenced: evolutionary AI (arXiv), LLM-as-judge surveys, PRD |
| Feature set (differentiators) | MEDIUM-HIGH | Novel domain; gamification and HITL patterns are HIGH; class progression novelty introduces calibration uncertainty |
| Architecture integration points | HIGH | Direct source analysis of all relevant execution-service files |
| Database schema design | HIGH | Additive Drizzle migration pattern verified against existing schema structure |
| OpenClaw WebSocket extensions | LOW | Message schema in existing code flagged as unverified placeholder; actual protocol acceptance unconfirmed |
| Decision annotation capability | LOW | Depends on OpenClaw runtime behavior; not confirmed from public documentation |
| Council bias mitigations (sycophancy, position, verbosity) | HIGH | Multiple peer-reviewed ACL 2025 papers, arXiv surveys on LLM judge biases |
| Causal attribution quality | MEDIUM | Research confirms self-report is unreliable; counterfactual approach is correct direction but implementation-specific quality unknown until calibrated against real runs |
| Embedding differentiation threshold (0.85) | MEDIUM | Community guidance; requires empirical calibration against real SOUL.md corpus |
| Council LLM cost at concurrency=20 | MEDIUM | Per-call estimates grounded; TPM behavior under load requires staging measurement |

### Gaps Requiring Attention During Implementation

1. **OpenClaw protocol** — Both soul delivery (Phase 2) and decision annotation capability (Phase 3) depend on unconfirmed OpenClaw behavior. Investigate on `claw-app-dev` before writing these components. This is the only true external dependency that could force significant design changes.
2. **pgvector Cloud SQL availability** — Must be confirmed before Phase 1 migration. If unavailable on the current Cloud SQL instance version, a flag change or instance upgrade is required.
3. **Attribution quality calibration** — The disagreement rate between self-reported and counterfactual attribution is unknown until real runs are evaluated. Build the tracking metric into the Council from Phase 4 launch; do not wait to observe drift before adding measurement.
4. **Council cost under load** — Run a staging load test before enabling Council in production. Configure `council-queue` rate limiter before the test, not after observing TPM errors.

---

## Sources (Aggregated)

**Stack (HIGH confidence):** Vercel AI SDK docs, pgvector-node GitHub, Drizzle ORM vector guide, BullMQ rate limiting docs, OpenAI model pricing (cross-referenced via Helicone). **Stack (MEDIUM confidence):** OpenClaw Gateway Protocol docs (JSON-RPC framing confirmed; specific method names not public), OpenClaw DeepWiki agent commands (inferred from source file references).

**Features (HIGH confidence):** EvoAgent arXiv:2406.14228, GAAPO Frontiers 2025, arXiv:2512.09108 (evolutionary LLM agents), Anthropic Constitutional AI, CONSENSAGENT ACL 2025, LLM-as-Judge survey arXiv:2412.05579, permit.io HITL best practices, RPG progression systems IntechOpen, ACM DIS 2025 multi-agent UX. **Features (MEDIUM confidence):** CrewClaw SOUL.md patterns, Agent Factory paradigm docs.

**Architecture (HIGH confidence):** Direct codebase analysis of all execution-service source files, full PRD `soulprd.md`. **Architecture (LOW confidence):** OpenClaw WebSocket extension acceptance (unverified against live instance).

**Pitfalls (HIGH confidence):** Evidently AI LLM-as-Judge guide, arXiv:2410.02736 (position bias), CONSENSAGENT ACL 2025 (sycophancy), arXiv:2509.23055 (multi-agent sycophancy), arXiv:2410.21819 (self-preference bias), Lil'Log reward hacking, METR reward hacking report, KDD causal interpretability survey, Goodhart's Law in AI (Collinear AI). **Pitfalls (MEDIUM confidence):** Embedding threshold calibration (community guidance), mutation drift math (research-backed but implementation-specific).

---

## Appendix: v1 Base Platform Summary

*The original v1 base platform research summary (researched 2026-02-18) is preserved below for reference. All v1 features listed there are SHIPPED and are not re-evaluated in this document.*

---

**Project:** Claw Bot Army — AI Multi-Agent Orchestration Platform
**Researched:** 2026-02-18

### v1 Executive Summary

Claw Bot Army is a multi-agent AI orchestration platform where a user submits an objective, the system decomposes it into parallel tasks, and a fleet of isolated bot workers execute those tasks concurrently. The recommended approach is a pull-based task queue with lease semantics, container-isolated bot workers that communicate exclusively through a Tool Gateway, and an event-driven control plane where billing, guardrail enforcement, and telemetry collection are decoupled consumers of a canonical event bus. The DNA capture flywheel is the primary competitive moat.

### v1 Stack (Shipped)

Node.js 22 LTS, Fastify 5, BullMQ 5 on Redis 7, Drizzle ORM 0.45.x on Cloud SQL PostgreSQL 15, Vercel AI SDK 5+ provider packages, GCE VMs with OpenClaw (replaced dockerode after v1.1), Svelte 5 + SvelteKit 2, Zod 4, Auth.js v5.

### v1 Features (Shipped)

All table-stakes execution features, Tool Gateway, guardrails, performance scoring (composite 40/30/20/10), bot leaderboard, DNA capture, real-time live activity feed, structured trace capture, execution history, cost reporting, bot detail drill-down, Google OAuth auth, GCE VM sandbox isolation with OpenClaw.

### v1 Phase Order (Completed)

Phase 1: Data Foundation + Infrastructure. Phase 2: Core Execution Pipeline. Phase 3: Bot Runtime + Tool Gateway. Phase 4: Control Plane Services (Guardrails, Billing, Event Bus). Phase 5: Performance Intelligence + DNA Capture. Phase 6: UI Command Center.
