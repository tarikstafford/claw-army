# Claw Bot Army

## What This Is

Claw Bot Army is a platform that lets SMEs and individuals deploy fleets of AI bot workers against a high-level objective. Users define an objective, set a bot count and budget cap, and the system spawns isolated bot workers that claim and execute tasks in parallel — with real-time monitoring, per-bot billing metering, and retroactive performance scoring.

## Core Value

Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can submit an objective with bot count, budget cap, runtime limit, and allowed tools
- [ ] System splits objective into parallelizable tasks and queues them
- [ ] Bot orchestrator spawns up to max_bots Docker containers to claim and execute tasks
- [ ] Each bot runs in an isolated container (no filesystem, no direct internet, CPU/memory capped)
- [ ] All external tool calls route through Tool Gateway (POST /tool.invoke) with allowlist + rate limits + audit logging
- [ ] MVP tool set: llm_call (metered, multi-provider), fetch_url (domain allowlist), write_file (artifact store)
- [ ] Guardrails watchdog enforces: budget cap, token burn rate, tool call rate, loop detection, idle shutdown
- [ ] Metering captures bot_started/stopped/tool_invoked/execution events for billing calculation
- [ ] UI shows live execution status: active bots, bot-hours consumed, estimated cost, budget remaining
- [ ] UI shows live activity feed: task claims, tool invocations, completions, guardrail triggers
- [ ] Post-run performance metrics computed per bot: tasks/min, tokens/task, success rate, composite score
- [ ] Post-run dashboard: total cost, bot-hours, task count, avg score, top bot, bot leaderboard with tiers
- [ ] Per-bot detail view: tasks, runtime, token usage, tool calls, errors, score, expandable step trace
- [ ] Usage & billing screen: bot-hours this month, spend estimate, historical executions, cost per execution
- [ ] Elite bot DNA captured for top performers: system prompt, tool call sequence, decision patterns, timing
- [ ] DNA stored versioned, PII-redacted, tagged by objective category (internal only)

### Out of Scope

- Real payment processing (Stripe) — metering/display only for MVP
- Multi-tenant isolation — single-tenant MVP, multi-tenant later
- DAG planner or recursive replanning — simple parallel task split only
- DNA Replay Engine user-facing — internal tool only in MVP
- Arbitrary shell execution in bots — Tool Gateway enforced
- Mobile app — web-first

## Context

- Backend: Node.js (TypeScript)
- Frontend: Svelte
- Bot isolation: Docker containers (GCP)
- Deployment: GCP (Cloud Run or GKE)
- LLM routing: Multi-provider via llm_call tool (not locked to one provider)
- Billing: Metering and display only — no real payment collection in MVP
- The DNA capture and improvement loop is a core long-term moat but replay is internal-only for MVP
- Performance scoring uses weighted composite: Success Rate (40%) + Efficiency (30%) + Cost Efficiency (20%) + Stability (10%)

## Constraints

- **Security**: Bots have zero network access except through Tool Gateway — this is non-negotiable
- **Isolation**: Each bot is ephemeral, stateless, no credentials, no persistent filesystem
- **Scope**: Single-tenant for MVP — no auth complexity, no multi-org data isolation
- **Budget**: No real Stripe integration — billing is metering + display only
- **Planner**: Simple parallel split only — no DAG, no recursive planning, no user-facing visual builder

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Docker containers for bot isolation | GCP-native, simpler ops than Firecracker for MVP | — Pending |
| Svelte for frontend | User preference | — Pending |
| Multi-provider LLM routing via Tool Gateway | Flexibility, cost optimization across providers | — Pending |
| Single-tenant MVP | Reduce complexity, ship faster, add multi-tenancy post-validation | — Pending |
| Billing display only (no Stripe) | MVP focus is proving the orchestration model, not payment plumbing | — Pending |

---
*Last updated: 2026-02-18 after initialization*
