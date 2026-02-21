# Claw Bot Army

## What This Is

Claw Bot Army is a platform that lets SMEs and individuals deploy fleets of AI bot workers against a high-level objective. Users define an objective, set a bot count and budget cap, and the system spawns isolated bot containers that claim and execute tasks in parallel — with real-time monitoring, atomic budget enforcement, per-bot billing metering, retroactive performance scoring, and elite bot DNA capture.

## Core Value

Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.

## Requirements

### Validated

- ✓ User can submit an objective with bot count, budget cap, runtime limit, and allowed tools — v1.0
- ✓ System splits objective into parallelizable tasks and queues them — v1.0
- ✓ Bot orchestrator spawns up to max_bots Docker containers to claim and execute tasks — v1.0
- ✓ Each bot runs in an isolated container (no filesystem, no direct internet, CPU/memory capped) — v1.0
- ✓ All external tool calls route through Tool Gateway with allowlist + rate limits + audit logging — v1.0
- ✓ MVP tool set: llm_call (metered, multi-provider), fetch_url (domain allowlist), write_file (artifact store) — v1.0
- ✓ Guardrails watchdog enforces: budget cap (atomic Redis Lua), token burn rate, tool call rate, loop detection, idle shutdown — v1.0
- ✓ Metering captures bot_started/stopped/tool_invoked/execution events for billing calculation — v1.0
- ✓ UI shows live execution status: active bots, bot-hours consumed, estimated cost, budget remaining — v1.0
- ✓ UI shows live activity feed: task claims, tool invocations, completions, guardrail triggers — v1.0
- ✓ Post-run performance metrics computed per bot: tasks/min, tokens/task, success rate, composite score — v1.0
- ✓ Post-run dashboard: total cost, bot-hours, task count, avg score, top bot, bot leaderboard with tiers — v1.0
- ✓ Per-bot detail view: tasks, runtime, token usage, tool calls, errors, score, expandable step trace — v1.0
- ✓ Usage & billing screen: bot-hours this month, spend estimate, historical executions, cost per execution — v1.0
- ✓ Elite bot DNA captured for top performers: system prompt, tool call sequence, decision patterns, timing — v1.0
- ✓ DNA stored versioned, PII-redacted, tagged by objective category (internal only) — v1.0
- ✓ Unauthenticated users redirected to /login — cannot access /new-execution without Google account — v1.1
- ✓ Authenticated users see their Google avatar, name, and a Sign Out button in the nav — v1.1
- ✓ POST /executions enforces 401 if no valid Auth.js session token present — v1.1
- ✓ /new-execution server action reads httpOnly session cookie and forwards Bearer token to backend — v1.1

## Current Milestone: v2.0 — The SOUL System

**Goal:** Transform the platform into an evolutionary learning engine where every run generates signal that mutates and improves agent behavioral configurations over time.

**Target features:**
- SOUL.md architecture (agent behavioral constitutions loaded at session start)
- Soul generation, mutation, and differentiation enforcement
- The Council (3-agent post-run evaluation with causal attribution)
- God Layer + DNA Library (versioned, indexed, mutation lineage)
- Agent class system (Novice → Understudy → Artisan) per task category
- Human confirmation gate for Promote/Retire verdicts
- Army Builder UI with composition recommendations
- Gamified promotion/retirement narrative events

---

### Active

<!-- v2.0 The SOUL System — Evolutionary Agent Intelligence -->

- [ ] Every run deploys a minimum of 3 agents per task with meaningfully differentiated SOUL.md behavioral constitutions
- [ ] Soul generation produces populations via library-seeded mutation (known categories) or archetype spread (novel categories)
- [ ] Soul differentiation is enforced algorithmically via embedding similarity before deployment
- [ ] Agents are instrumented to annotate causal soul directive attribution at runtime
- [ ] Post-run Council (Performance Judge, Soul Analyst, Devil's Advocate) produces verdicts with causal attribution
- [ ] God Layer reads council verdicts, manages DNA library, drives promotions, retirements, and mutation cycles
- [ ] DNA Library stores versioned, indexed soul entries with mutation lineage and causal attribution reports
- [ ] Agent classes (Novice, Understudy, Artisan) tracked per task category with promotion/demotion/retirement logic
- [ ] Human confirmation gate for Promote and Retire verdicts before library write
- [ ] Army Builder UI with class composition, library-depth-aware recommendations, and budget enforcement
- [ ] Gamified promotion/retirement narrative events surfaced to users

### Out of Scope

- Real payment processing (Stripe) — metering/display only for MVP; add in v1.1+ after billing trust established
- Multi-tenant isolation — single-tenant MVP; add post-validation
- DAG planner or recursive replanning — simple parallel task split only for v1
- DNA Replay Engine user-facing — internal tool only in MVP; user-facing in v2
- Arbitrary shell execution in bots — Tool Gateway enforced, non-negotiable
- Mobile app — web-first
- Firecracker/Kata microVM isolation — Docker sufficient for MVP; upgrade path exists

## Context

**Shipped v1.1 with ~15,833 LOC total** (8 phases, 29 plans, 3 days total).

**Tech stack:**
- Backend: Node.js TypeScript (Fastify), pnpm monorepo
- Frontend: SvelteKit (Svelte 5 runes, adapter-vercel, Auth.js v5 Google OAuth)
- Database: PostgreSQL via Drizzle ORM (6 tables: executions, tasks, bots, billing_events, telemetry, dna_store)
- Task queue: BullMQ 5 on Redis
- Bot isolation: Docker containers (internal network, --internal flag)
- Event bus: Google Cloud Pub/Sub (emulator in local dev)
- LLM routing: Vercel AI SDK 6, multi-provider via Tool Gateway
- Billing: Metering and display only — atomic Redis Lua budget enforcement
- Auth: Auth.js v5 (@auth/sveltekit) with Google OAuth; backend verifies JWE-encrypted session tokens

**GCP deployment:** Terraform config committed and valid. Not yet applied — pending GCP project setup. Local dev uses Docker Compose equivalents.

**Known issues / tech debt:**
- Composite score weights (40/30/20/10) are env-var configurable but not empirically validated — iterate after first real execution data
- Production Terraform needs `bot-lifecycle-billing-sub` Pub/Sub subscription added for Billing Engine
- N+1 leaderboard enrichment acceptable for MVP (maxBots cap 20); add JOIN when bot counts grow
- Any new service or Dockerfile using `@claw/db` or internal packages must add `NODE_OPTIONS --conditions @claw/source`
- AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be configured in Vercel env vars for production

## Constraints

- **Security**: Bots have zero network access except through Tool Gateway — this is non-negotiable
- **Isolation**: Each bot is ephemeral, stateless, no credentials, no persistent filesystem
- **Scope**: Single-tenant — Google Auth gates access but no multi-org data isolation yet
- **Budget**: No real Stripe integration — billing is metering + display only
- **Planner**: Simple parallel split only — no DAG, no recursive planning, no user-facing visual builder

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Docker containers for bot isolation | GCP-native, simpler ops than Firecracker for MVP | ✓ Good — worked well; --internal network provides strong isolation |
| Svelte for frontend | User preference | ✓ Good — Svelte 5 runes mode clean; SPA mode via adapter-static works |
| Multi-provider LLM routing via Tool Gateway | Flexibility, cost optimization across providers | ✓ Good — Vercel AI SDK 6 multi-provider abstraction clean |
| Single-tenant MVP | Reduce complexity, ship faster, add multi-tenancy post-validation | ✓ Good — removed significant auth/infra complexity |
| Billing display only (no Stripe) | MVP focus is proving the orchestration model, not payment plumbing | ✓ Good — atomic Redis Lua cap sufficient for trust-building |
| BullMQ over Postgres row-locking for task queue | Redis-native leasing, better visibility | ✓ Good — BullMQ QueueEvents reliable for lease expiry/reassignment |
| dockerode on GCE VM over Cloud Run Jobs | Faster lifecycle control, tighter per-bot management | — Pending validation — Cloud Run Jobs still long-term target |
| moduleResolution: Bundler for all packages | Required for drizzle-kit + pnpm workspace resolution | ✓ Good — consistent across all packages |
| Integer cents for all monetary values | Avoid float precision errors | ✓ Good — no rounding issues in billing calculations |
| Per-connection Pub/Sub subscription for SSE | Simpler than EventEmitter fan-out for MVP | ✓ Good — 4 subs/connection manageable at MVP scale |
| Composite score weights: 40/30/20/10 | Reasoned starting point based on priority | ⚠️ Revisit — not empirically validated; iterate after real execution data |
| DNA argument patterns: Object.keys only, never values | PII isolation at code level | ✓ Good — prevents any customer data from entering DNA store |
| adapter-vercel over adapter-static | Auth.js server runtime requires serverless functions, not static HTML | ✓ Good — enables hooks.server.ts + server load functions; Vercel routing handles unknown paths natively |
| jose compactDecrypt for Auth.js token verification | Auth.js v5 uses JWE encrypted tokens (A256CBC-HS512), not signed JWTs | ✓ Good — HKDF + dual-salt approach handles both HTTP dev and HTTPS prod cookies |
| Server action (not client fetch) for execution creation | httpOnly cookie inaccessible from client JS | ✓ Good — server action reads and forwards session token transparently; no XSS exposure |

---
*Last updated: 2026-02-21 after v2.0 milestone start*
