# Roadmap: Claw Bot Army

## Overview

Claw Bot Army ships in six sequential phases, each completing a coherent system capability that the next phase depends on. The build order follows hard architectural dependencies: schema and shared contracts must exist before any code references them, the orchestration loop must be verifiable before real LLMs run through it, the Tool Gateway must enforce security boundaries before any bot touches external APIs, and guardrails plus billing must be atomic and correct before real spending occurs. Performance intelligence and DNA capture come last in the backend sequence because they depend on telemetry accumulated across earlier phases. The UI command center is the final phase — building real-time dashboards against stable, event-emitting backends rather than against moving targets.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Schema, shared contracts, GCP infrastructure, and bot network isolation topology ready for all subsequent phases
- [x] **Phase 2: Core Execution Pipeline** - Objective intake, task decomposition, bot spawning, and lease-based task claiming working end-to-end with stub bots
- [ ] **Phase 3: Bot Runtime and Tool Gateway** - Real bot reasoning loop running through a security-enforcing Tool Gateway with network isolation finalized
- [ ] **Phase 4: Control Plane Services** - Event bus, guardrail watchdog, and billing engine operational with atomic budget enforcement
- [ ] **Phase 5: Performance Intelligence and DNA Capture** - Post-run composite bot scoring, leaderboard tiers, and elite-bot DNA extraction operational
- [ ] **Phase 6: UI Command Center** - Svelte frontend delivering real-time execution monitoring, post-run dashboards, bot detail drill-down, and billing history

## Phase Details

### Phase 1: Data Foundation

**Goal**: Every data structure, shared contract, and GCP resource that all subsequent phases depend on exists, is correct, and is reachable from local development — before any application code is written.

**Depends on**: Nothing (first phase)

**Requirements**: None directly owned — Phase 1 is pre-application infrastructure that all requirement implementations depend on. (All 49 v1 requirements are assigned to Phases 2-6.)

**Success Criteria** (what must be TRUE):
  1. The PostgreSQL schema (executions, tasks, bots, billing_events, telemetry, dna_store tables) can be applied via migration with zero errors, and all tables accept and return typed records that match the shared TypeScript interfaces with no cast or coercion.
  2. The shared-types, event-schemas, and tool-contracts packages compile in strict mode without errors and can be imported cleanly from any service workspace in the monorepo.
  3. GCP resources (Cloud SQL, Memorystore Redis, Pub/Sub topics, VPC, Artifact Registry) are provisioned and reachable from the local development environment — verified by a connectivity health check script that tests each resource.
  4. A Docker container started with the bot isolation profile cannot reach any external host except the designated Tool Gateway address — confirmed by an egress test that verifies both TCP connections and DNS queries to external hosts are blocked.

**Plans:** 4 plans

Plans:
- [ ] 01-01-PLAN.md — pnpm monorepo workspace, packages/db with Drizzle ORM, all 6 table schemas, initial SQL migration
- [ ] 01-02-PLAN.md — @claw/shared-types, @claw/event-schemas, @claw/tool-contracts packages with Zod v4 schemas
- [ ] 01-03-PLAN.md — Terraform modules (Cloud SQL, Memorystore, Pub/Sub, VPC, Artifact Registry), docker-compose.dev.yml, connectivity check script
- [ ] 01-04-PLAN.md — Docker internal network bot isolation topology, automated egress test script

---

### Phase 2: Core Execution Pipeline

**Goal**: A user can submit an objective and the system will decompose it into parallel tasks, spawn bot containers that claim and complete those tasks via lease semantics, and advance the execution through its full lifecycle — all verifiable without real LLM calls.

**Depends on**: Phase 1

**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06

**Success Criteria** (what must be TRUE):
  1. A POST to /executions with an objective, max_bots, budget_cap, runtime_limit, and allowed_tools returns an execution_id and status "queued" within one second.
  2. The system decomposes the objective into N parallelizable tasks visible in the task queue, and stub bot containers (up to max_bots) are spawned and begin claiming tasks atomically — no two bots ever claim the same task concurrently.
  3. A bot container that stops sending heartbeats has its lease expired and its claimed task reassigned to another active bot within the configured lease timeout — without manual intervention.
  4. An execution advances through queued → running → completed in the correct order, and a GET /executions/:id returns the accurate current state at each transition.
  5. A bot container that goes 5 minutes without claiming a task terminates automatically, and a bot_stopped lifecycle event is emitted to the event bus.

**Plans:** 4 plans

Plans:
- [ ] 02-01-PLAN.md — Execution Service: Fastify scaffold, POST /executions, GET /executions/:id, lifecycle state machine (Wave 1)
- [ ] 02-02-PLAN.md — Planner + Task Queue: stub planner, BullMQ queue with lease semantics, async planning trigger (Wave 2)
- [ ] 02-03-PLAN.md — Bot Orchestrator: dockerode spawn/terminate, bot registry, max_bots enforcement, JWT injection, Pub/Sub lifecycle events, idle termination (Wave 2)
- [ ] 02-04-PLAN.md — Stub Bot + Integration: stub-bot Docker container, full pipeline wiring, completion checker, E2E integration test (Wave 3)

---

### Phase 3: Bot Runtime and Tool Gateway

**Goal**: A real bot container running an LLM reasoning loop can only reach the outside world through the Tool Gateway, which enforces allowlists, validates schemas, applies rate limits, and logs every invocation — making the security boundary both operational and auditable.

**Depends on**: Phase 2

**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-08

**Success Criteria** (what must be TRUE):
  1. A bot container attempting any outbound connection other than POST /tool.invoke on the Tool Gateway is blocked at the network layer — confirmed by attempting a direct HTTP call and a DNS query from within a running bot container and observing both are dropped.
  2. A tool invocation for a tool not in the execution's allowed_tools list is rejected with a structured error, and the attempt is logged with bot_id, tool name, rejection reason, and timestamp.
  3. A malformed tool invocation (invalid argument schema) is rejected by Zod validation before any business logic executes, returning a structured error to the bot with the specific validation failure.
  4. A bot that exceeds its per-minute tool-call or token rate limit is blocked mid-invocation; subsequent calls within the same rate window continue to be rejected until the window resets.
  5. An llm_call, fetch_url, and write_file invocation each succeed end-to-end: the Gateway routes to the correct provider or store, applies the domain allowlist or artifact path as appropriate, and returns a structured response to the bot with the full invocation logged.

**Plans:** 4 plans

Plans:
- [ ] 03-01-PLAN.md — Tool Gateway service scaffold: tool_invocations DB table, POST /tool.invoke endpoint, JWT auth, allowlist, Zod validation, rate limiting, audit logging (Wave 1)
- [ ] 03-02-PLAN.md — Tool implementations: llm_call (Vercel AI SDK multi-provider), fetch_url (domain allowlist), write_file (artifact store), token rate limit integration (Wave 2)
- [ ] 03-03-PLAN.md — Bot worker reasoning loop: generateText tool-calling loop, gateway proxy stubs, SIGTERM handler, execution-service planner LLM upgrade, 24h JWT (Wave 2)
- [ ] 03-04-PLAN.md — Network isolation finalization: Tool Gateway Dockerfile, dual-network docker-compose, --internal bot network, network isolation test, Phase 3 E2E integration test (Wave 3)

---

### Phase 4: Control Plane Services

**Goal**: Every execution involving real LLM spending is guarded by atomic budget enforcement, and every guardrail violation, billing event, and bot lifecycle transition is captured on the event bus — so no execution can overspend, loop indefinitely, or go unaccounted.

**Depends on**: Phase 3

**Requirements**: GARD-01, GARD-02, GARD-03, GARD-04, GARD-05, GARD-06, METR-01, METR-02, METR-03

**Success Criteria** (what must be TRUE):
  1. An execution that reaches its max_budget_usd cap stops automatically — verified by running an execution to budget exhaustion and confirming no billing_events record spend above the cap; the stop is enforced via atomic Redis operation, not an application-level read-then-write check.
  2. A bot that exceeds the token burn rate limit or tool-call rate limit is revoked within one Guardrail Watchdog polling interval, and a structured guardrail_triggered event (bot_id, reason, timestamp) appears on the Pub/Sub event bus.
  3. A bot exhibiting loop behavior (N identical consecutive tool invocations) is detected and terminated by the Guardrail Watchdog before the bot exhausts its budget allocation.
  4. Every billing-relevant action — bot_started, bot_stopped, tool_invoked, execution_completed, budget_exceeded — produces a structured event on the Pub/Sub event bus with enough data to reconstruct the full cost of any execution from events alone.
  5. Calculated bot-hours (sum of wall-clock runtimes from bot_started/bot_stopped pairs) and estimated cost (bot-hours × rate + provider-reported LLM token actuals) for a completed test execution match expected values within a 1% margin.

**Plans**: TBD

Plans:
- [ ] 04-01: GCP Cloud Pub/Sub event bus setup — topic/subscription definitions, canonical event type payloads, publisher/subscriber client wiring
- [ ] 04-02: Guardrail Watchdog — async Pub/Sub subscriber, rate violation detection, loop/thrash detection, bot revocation via Redis deny list, guardrail event emission
- [ ] 04-03: Billing Engine — bot lifecycle event consumption, bot-hour accumulation, LLM token cost calculation using provider-reported actuals, atomic Redis budget cap enforcement

---

### Phase 5: Performance Intelligence and DNA Capture

**Goal**: After any completed execution, every bot has a composite performance score and tier, an execution summary report is queryable, and elite bots have their structural patterns extracted and stored as versioned, PII-redacted DNA records.

**Depends on**: Phase 4

**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, DNA-01, DNA-02, DNA-03, DNA-04

**Success Criteria** (what must be TRUE):
  1. After a completed execution, every participating bot has a composite score (0–100) computed from four separately-stored components: Success Rate (40%), Efficiency (30%), Cost Efficiency (20%), Stability (10%) — and each component score is queryable independently so the composite can be audited.
  2. Every bot is assigned a tier (High/Medium/Low) based on its composite score, and a leaderboard for the execution is queryable sorted by score descending with each bot's tasks, runtime, and tier visible.
  3. An execution summary report is available post-run containing: total bots, total bot-hours, total cost, average bot score, top-performing bot ID, error distribution, and cost per task.
  4. Elite bot candidates — composite score above the configured threshold AND above the execution average by the configured percentage AND below the error rate ceiling — are identified automatically, and their DNA (system prompt template, tool call sequence, argument patterns, retry strategy, timing profile, token distribution) is extracted and stored as a versioned JSONB record tagged with objective_category.
  5. DNA records contain no raw LLM outputs and no customer data — only structural intent patterns — and each capture creates a new versioned record rather than overwriting the prior version.

**Plans**: TBD

Plans:
- [ ] 05-01: Performance Engine — post-run metric computation (efficiency, reliability, cost efficiency), composite score formula with component breakdown, tier assignment, leaderboard data model
- [ ] 05-02: Execution Report — summary aggregation (total cost, bot-hours, task count, avg score, top bot, error distribution, cost per task)
- [ ] 05-03: DNA Capture Engine — elite bot identification, structural pattern extraction, PII stripping, versioned JSONB storage with objective_category tagging

---

### Phase 6: UI Command Center

**Goal**: A user can create an execution, watch their bot fleet work in real-time with live cost and activity updates, review the post-run leaderboard and bot details, and check their billing history — all in a Svelte frontend connected to the backend via Server-Sent Events.

**Depends on**: Phase 5

**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, METR-04, METR-05

**Success Criteria** (what must be TRUE):
  1. A user can fill in the New Execution form (objective text, bot count slider, budget cap, allowed tools multi-select) and click "Deploy Crew" — the execution is created and the browser navigates automatically to the Live Execution View for that execution.
  2. During an active execution, the Live Execution View shows current status, active bot count, bot-hours consumed, budget remaining, and estimated cost — all updating in real-time without a page refresh, delivered via SSE.
  3. The Live Execution View activity feed streams legible, human-readable events (bot claimed task, tool invoked, task completed, guardrail triggered) as they occur, with guardrail events visually distinguished from normal operation events.
  4. The Post-Execution Dashboard shows the execution summary (total cost, bot-hours, tasks, average score, top bot) and a bot leaderboard table with tier color indicators (green/yellow/red) for every bot in the run.
  5. A user can click any bot in the leaderboard to open its detail view showing tasks completed, runtime, token usage, tool calls, error count, and composite score — and a developer can expand the optional step trace showing each step's prompt, tool, arguments, output summary, duration, and token count.
  6. The Usage and Billing screen shows total bot-hours this month, estimated spend, and a list of historical executions with total cost, bot-hours, and task count per run.

**Plans**: TBD

Plans:
- [ ] 06-01: Redis pub/sub to SSE bridge — Memorystore fan-out, Fastify SSE endpoint, multi-instance safe event delivery
- [ ] 06-02: New Execution screen — objective input, bot count slider, budget cap field, tool allowlist multi-select, Deploy Crew submission
- [ ] 06-03: Live Execution View — real-time status panel (bot count, bot-hours, budget remaining, estimated cost), SSE activity feed with event type styling and guardrail event distinction
- [ ] 06-04: Post-Execution Dashboard — execution summary panel, bot leaderboard table with tier color indicators
- [ ] 06-05: Bot Detail View — per-bot metrics panel, expandable step trace
- [ ] 06-06: Usage and Billing screen — monthly bot-hours and spend summary, historical execution list with cost per run

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 4/4 | Complete (GCP deferred) | 2026-02-18 |
| 2. Core Execution Pipeline | 4/4 | Complete | 2026-02-18 |
| 3. Bot Runtime and Tool Gateway | 0/4 | Planned | - |
| 4. Control Plane Services | 0/3 | Not started | - |
| 5. Performance Intelligence and DNA Capture | 0/3 | Not started | - |
| 6. UI Command Center | 0/6 | Not started | - |
