# Requirements: Claw Bot Army

**Defined:** 2026-02-18
**Core Value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.

## v1 Requirements

### Execution

- [ ] **EXEC-01**: User can create an execution by submitting an objective, max bot count, allowed tools, budget cap (USD), and max runtime (minutes)
- [ ] **EXEC-02**: System returns an execution_id and initial status of "queued" upon execution creation
- [ ] **EXEC-03**: Execution transitions through lifecycle states: queued → running → paused → stopped → completed/failed
- [ ] **EXEC-04**: User can view the current status of any execution
- [ ] **EXEC-05**: System splits the objective into N independent parallelizable tasks and queues them for bot consumption

### Bot Orchestration

- [ ] **ORCH-01**: System spawns up to max_bots Docker containers when an execution transitions to running
- [ ] **ORCH-02**: Each bot claims tasks via atomic leasing (one task per bot at a time, no double-claiming)
- [ ] **ORCH-03**: Bot lease heartbeats are maintained; failed/expired leases result in task reassignment to another bot
- [ ] **ORCH-04**: Each bot container runs with no persistent filesystem, no direct internet access, CPU and memory capped
- [ ] **ORCH-05**: Bots automatically terminate after 5 minutes of idle time (no active task)
- [ ] **ORCH-06**: Bot lifecycle events (started, stopped, claimed task, completed task) are emitted to the event bus

### Tool Gateway

- [ ] **GATE-01**: Bots can only invoke tools by calling POST /tool.invoke through the Tool Gateway — no direct external access
- [ ] **GATE-02**: Tool Gateway enforces an allowlist; calls to tools not in the execution's allowed_tools list are rejected
- [ ] **GATE-03**: Tool Gateway validates argument schema (Zod) for every invocation; malformed arguments are rejected
- [ ] **GATE-04**: Tool Gateway enforces per-bot rate limits (tool calls/min, tokens/min); bots exceeding limits are blocked
- [ ] **GATE-05**: Tool Gateway logs every invocation with bot_id, tool, arguments, response summary, duration, and tokens used
- [ ] **GATE-06**: User can invoke llm_call tool — routes to configured LLM provider (multi-provider), response returned to bot
- [ ] **GATE-07**: User can invoke fetch_url tool — fetches URL content, domain allowlist enforced, content returned to bot
- [ ] **GATE-08**: User can invoke write_file tool — writes artifact to artifact store, path returned to bot

### Guardrails

- [ ] **GARD-01**: Execution stops automatically when cumulative spend reaches max_budget_usd (enforced via Redis atomic check, not app-level)
- [ ] **GARD-02**: Bot is revoked when it exceeds the token burn rate limit (max tokens/min), with event logged
- [ ] **GARD-03**: Bot is revoked when it exceeds the tool call rate limit (max tool calls/min), with event logged
- [ ] **GARD-04**: Guardrail watchdog detects and kills bots exhibiting loop/thrashing behavior (repetitive identical tool calls)
- [ ] **GARD-05**: Bot is terminated automatically after 5 minutes of idle time, with event logged
- [ ] **GARD-06**: All guardrail violations are captured as structured events: bot revoked, execution paused/stopped, reason, timestamp

### Metering & Billing

- [ ] **METR-01**: System captures metering events for every billing-relevant action: bot_started, bot_stopped, tool_invoked, execution_completed, budget_exceeded
- [ ] **METR-02**: System calculates bot-hours per execution as Σ(bot wall-clock runtime in hours)
- [ ] **METR-03**: System calculates estimated cost per execution using bot-hours × hourly rate + LLM token costs (provider-reported actuals)
- [ ] **METR-04**: User can see live bot-hours consumed, estimated cost, and remaining budget during an active execution
- [ ] **METR-05**: User can see historical executions with total cost, bot-hours, and task count per run on the Usage & Billing screen

### Performance Intelligence

- [ ] **PERF-01**: System computes per-bot efficiency metrics post-run: tasks/min, tokens/task, tool calls/task, idle ratio
- [ ] **PERF-02**: System computes per-bot reliability metrics post-run: success rate, retry rate, error frequency
- [ ] **PERF-03**: System computes per-bot cost efficiency post-run: cost per successful task
- [ ] **PERF-04**: System assigns each bot a composite performance score: Success Rate (40%) + Efficiency (30%) + Cost Efficiency (20%) + Stability (10%), normalized 0–100
- [ ] **PERF-05**: Each bot is assigned a tier based on score: High (green, top tier), Medium (yellow), Low (red)
- [ ] **PERF-06**: Post-run execution report includes: total bots, total bot-hours, total cost, average bot score, top-performing bot, error distribution, cost per task
- [ ] **PERF-07**: User can view a bot leaderboard per execution showing each bot's tasks, runtime, score, and tier

### DNA Capture

- [ ] **DNA-01**: System identifies elite bot candidates post-run: score exceeds threshold AND above execution average by configured % AND low error rate
- [ ] **DNA-02**: System captures DNA for elite bots: system prompt, tool call sequence, argument patterns, retry strategy, decision branches, timing, token distribution
- [ ] **DNA-03**: DNA is stored as a versioned execution template, tagged by objective category
- [ ] **DNA-04**: DNA storage is PII-redacted and contains structural patterns only (no raw customer data)

### UI — New Execution

- [ ] **UI-01**: User can enter an objective (text), set max bots (slider), set budget cap ($), and select allowed tools (multi-select) on the New Execution screen
- [ ] **UI-02**: User can click "Deploy Crew" to submit the execution and be routed to the Live Execution View

### UI — Live Execution View

- [ ] **UI-03**: User sees current execution status (Running / Paused / Completed) on the Live Execution View
- [ ] **UI-04**: User sees active bot count, bot-hours consumed, budget remaining, and estimated cost — updated in real-time
- [ ] **UI-05**: User sees a live activity feed showing: bot claimed task, tool invoked, task completed, guardrail triggered — streamed via SSE

### UI — Post-Execution Dashboard

- [ ] **UI-06**: User sees execution summary after completion: total cost, total bot-hours, tasks completed, average score, top bot
- [ ] **UI-07**: User sees a bot leaderboard table with tier color indicators (High/Medium/Low) on the Post-Execution Dashboard

### UI — Bot Detail View

- [ ] **UI-08**: User can click any bot to see its detail view: tasks completed, runtime, token usage, tool calls, error count, performance score
- [ ] **UI-09**: Developer can expand an optional step trace in the bot detail view showing each step's prompt, response, tool, arguments, output summary, duration, tokens

### UI — Usage & Billing

- [ ] **UI-10**: User can see total bot-hours this month, estimated spend, list of historical executions, and cost per execution on the Usage & Billing screen

## v2 Requirements

### Auth & Multi-Tenancy

- **AUTH-01**: User can sign up with email and password
- **AUTH-02**: Multi-tenant data isolation (per-org executions, billing, DNA)
- **AUTH-03**: API key management for programmatic execution creation

### Planner

- **PLAN-01**: DAG-based task planner with dependency resolution
- **PLAN-02**: User-facing visual DAG builder

### Payments

- **PAY-01**: Stripe integration for real payment collection
- **PAY-02**: Invoicing and billing history download

### DNA (Extended)

- **DNA-05**: User-facing DNA Replay Engine (benchmarking top-performing templates)
- **DNA-06**: User can seed new executions from saved elite DNA templates

### Platform

- **PLAT-01**: Firecracker/Kata microVM isolation (stronger than Docker)
- **PLAT-02**: RBAC and admin panel for platform operators

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real payment processing (Stripe) | Metering and display only for MVP; billing trust must be established before collection |
| Multi-tenant data isolation | Single-tenant MVP to reduce auth/infra complexity |
| DAG planner / visual builder | PRD explicitly excludes; parallel-only is sufficient for v1 validation |
| DNA Replay Engine (user-facing) | Internal tooling only in MVP; external UI in v2 |
| Arbitrary shell execution in bots | Security non-negotiable; Tool Gateway enforces boundaries |
| Recursive replanning | Out of scope per PRD; adds orchestration complexity without v1 value |
| Mobile app | Web-first |
| Human-in-the-loop approval gates | Adds complexity without validating core autonomous value prop |
| Real-time model fine-tuning | Infrastructure cost and complexity far exceed MVP need |

## Traceability

Phase 1 (Data Foundation) owns no v1 requirements directly — it delivers the infrastructure and shared contracts that all Phase 2-6 implementations depend on.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXEC-01 | Phase 2 | Pending |
| EXEC-02 | Phase 2 | Pending |
| EXEC-03 | Phase 2 | Pending |
| EXEC-04 | Phase 2 | Pending |
| EXEC-05 | Phase 2 | Pending |
| ORCH-01 | Phase 2 | Pending |
| ORCH-02 | Phase 2 | Pending |
| ORCH-03 | Phase 2 | Pending |
| ORCH-04 | Phase 2 | Pending |
| ORCH-05 | Phase 2 | Pending |
| ORCH-06 | Phase 2 | Pending |
| GATE-01 | Phase 3 | Pending |
| GATE-02 | Phase 3 | Pending |
| GATE-03 | Phase 3 | Pending |
| GATE-04 | Phase 3 | Pending |
| GATE-05 | Phase 3 | Pending |
| GATE-06 | Phase 3 | Pending |
| GATE-07 | Phase 3 | Pending |
| GATE-08 | Phase 3 | Pending |
| GARD-01 | Phase 4 | Pending |
| GARD-02 | Phase 4 | Pending |
| GARD-03 | Phase 4 | Pending |
| GARD-04 | Phase 4 | Pending |
| GARD-05 | Phase 4 | Pending |
| GARD-06 | Phase 4 | Pending |
| METR-01 | Phase 4 | Pending |
| METR-02 | Phase 4 | Pending |
| METR-03 | Phase 4 | Pending |
| METR-04 | Phase 6 | Pending |
| METR-05 | Phase 6 | Pending |
| PERF-01 | Phase 5 | Pending |
| PERF-02 | Phase 5 | Pending |
| PERF-03 | Phase 5 | Pending |
| PERF-04 | Phase 5 | Pending |
| PERF-05 | Phase 5 | Pending |
| PERF-06 | Phase 5 | Pending |
| PERF-07 | Phase 5 | Pending |
| DNA-01 | Phase 5 | Pending |
| DNA-02 | Phase 5 | Pending |
| DNA-03 | Phase 5 | Pending |
| DNA-04 | Phase 5 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 6 | Pending |
| UI-05 | Phase 6 | Pending |
| UI-06 | Phase 6 | Pending |
| UI-07 | Phase 6 | Pending |
| UI-08 | Phase 6 | Pending |
| UI-09 | Phase 6 | Pending |
| UI-10 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0 — all requirements covered

| Phase | Requirements Owned |
|-------|-------------------|
| Phase 1: Data Foundation | 0 (infrastructure only — enables all others) |
| Phase 2: Core Execution Pipeline | 11 (EXEC-01–05, ORCH-01–06) |
| Phase 3: Bot Runtime and Tool Gateway | 8 (GATE-01–08) |
| Phase 4: Control Plane Services | 9 (GARD-01–06, METR-01–03) |
| Phase 5: Performance Intelligence and DNA Capture | 11 (PERF-01–07, DNA-01–04) |
| Phase 6: UI Command Center | 12 (UI-01–10, METR-04–05) |

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation — all 51 v1 requirements mapped across Phases 2–6*
