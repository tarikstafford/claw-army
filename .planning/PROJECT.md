# Claw Bot Army

## What This Is

Claw Bot Army is a platform that lets SMEs and individuals deploy fleets of AI bot workers against a high-level objective. Users define an objective, set a bot count and budget cap, and the system spawns isolated bot VMs that claim and execute tasks in parallel — with real-time monitoring, atomic budget enforcement, per-bot billing metering, and an evolutionary learning engine that compounds agent intelligence over time through behavioral constitutions, council evaluation, and a versioned DNA library.

## Core Value

Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.

## Requirements

### Validated

- ✓ User can submit an objective with bot count, budget cap, runtime limit, and allowed tools — v1.0
- ✓ System splits objective into parallelizable tasks and queues them — v1.0
- ✓ Bot orchestrator spawns up to max_bots isolated VMs to claim and execute tasks — v1.0
- ✓ Each bot runs in an isolated VM (no filesystem, no direct internet, CPU/memory capped) — v1.0
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
- ✓ Platform generates a unique SOUL.md document for each bot before VM spawn (7 behavioral dimensions + inviolable constitution directives) — v2.0
- ✓ Platform enforces minimum 3 agents per task category — blocked with plain explanation if budget insufficient — v2.0
- ✓ Each soul document carries a content hash and generation counter for full mutation lineage tracing — v2.0
- ✓ Platform maintains 6+ canonical archetype soul templates used to seed novel task category populations — v2.0
- ✓ For known task categories: library-seeded mutation from top historical souls + diversity injection parent — v2.0
- ✓ For novel task categories: archetype spread with light mutations to produce required population size — v2.0
- ✓ 5 mutation operations applied during soul generation: Substitution, Amplification, Attenuation, Recombination, Introduction — v2.0
- ✓ Soul differentiation enforced via embedding cosine similarity at 0.85 threshold with targeted remutation — v2.0
- ✓ Constitution enforcement validates every soul against inviolable directives before deployment — v2.0
- ✓ Post-hoc attribution compiler produces per-decision soul directive attribution rows from tool_invocations — v2.0
- ✓ OpenClaw decision_annotation stub ready for real-time path when runtime supports it — v2.0
- ✓ Decision traces stored per agent per execution; 90-day TTL archival policy in place — v2.0
- ✓ 3 independent LLM judges (Performance Judge, Soul Analyst, Devil's Advocate) evaluate agents async via council-queue — v2.0
- ✓ Council judges produce outputs independently with no inter-judge visibility before aggregation — v2.0
- ✓ Heterogeneous LLM families: Devil's Advocate uses Google Gemini, Performance Judge + Soul Analyst use Anthropic — v2.0
- ✓ Soul Analyst performs counterfactual verification of directive attribution; disagreement rate tracked as health metric — v2.0
- ✓ Weighted verdict: Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15%; strong DA argument escalates to human review — v2.0
- ✓ 5 verdict types per agent: Promote, Maintain, Monitor, Demote, Retire with confidence score and human-confirmation flag — v2.0
- ✓ Promote and Retire verdicts require human confirmation before God Layer executes — v2.0
- ✓ Confirmation prompt surfaces concrete evidence (tool call sequence or DA argument) before confirm appears — v2.0
- ✓ Rejection framed as positive contribution; reject and confirm receive equivalent visual weight — v2.0
- ✓ Time-on-confirmation-screen tracked; per-user rate >95% across 10+ confirmations triggers calibration warning — v2.0
- ✓ God Layer BullMQ Worker processes confirmed verdicts: class transitions, DNA writes, mutation prep, negative signal updates — v2.0
- ✓ DNA Library entry contains full SOUL.md, task category, agent class, composite fitness score with dimension breakdown, causal attribution, council verdict summary, human confirmation timestamp, and full mutation lineage — v2.0
- ✓ DNA Library writes are versioned — each write links to predecessor; full Novice→Artisan lineage traceable — v2.0
- ✓ Retirements and below-benchmark runs written to negative signal register as constraint layer on future soul generation — v2.0
- ✓ Pioneer events trigger benchmark instantiation; Pioneer designation permanent in library entry — v2.0
- ✓ God Layer holds Redis lock on category soul library during active campaigns; evaluates bot_souls snapshot at execution start — v2.0
- ✓ Agent class (Novice, Understudy, Artisan) tracked per task category independently — v2.0
- ✓ Novice→Understudy promotion: 2+ confirmed above-benchmark runs, 1+ human confirmation, confidence >0.65, no unresolved DA arguments — v2.0
- ✓ Understudy→Artisan promotion: 5+ confirmed above-benchmark runs, multiple confirmations, confidence >0.80, soul-driven attribution confirmed — v2.0
- ✓ Demotion after 2 consecutive below-benchmark runs with soul-driven underperformance confirmed by Soul Analyst — v2.0
- ✓ Retirement after confirmed demotion + 2 further below-benchmark runs or catastrophic failure — v2.0
- ✓ Pioneer events receive permanent Pioneer designation and surface to users as notifications — v2.0
- ✓ Leaderboard displays agent class tier badge, council verdict summary, and pioneer flag — v2.0
- ✓ Pending Promote/Retire verdicts appear in UI with confirmation panel and concrete evidence — v2.0
- ✓ SSE pushes narrative lifecycle notifications for promotion, demotion, retirement, and pioneer events — v2.0
- ✓ Army Builder identifies task categories, displays class mix per category, library-depth rationale, and budget breakdown across three composition tiers — v2.0
- ✓ Army Builder blocks submission when minimum viable composition (3 agents/task) exceeds budget — v2.0

### Active

<!-- No active requirements — planning next milestone -->

### Out of Scope

- Real payment processing (Stripe) — metering/display only for MVP; add post-validation
- Multi-tenant isolation — single-tenant MVP; add post-validation
- DAG planner or recursive replanning — simple parallel task split only
- Arbitrary shell execution in bots — Tool Gateway enforced, non-negotiable
- Mobile app — web-first
- Firecracker/Kata microVM isolation — Docker/GCE sufficient; upgrade path exists
- User-editable raw soul text — corrupts evolutionary lineage attribution
- Fine-tuning model weights from soul data — requires RLHF infrastructure
- Real-time Council evaluation during execution — requires complete decision trace
- 5+ agent class tiers — 3 tiers is the RPG engagement optimum
- Continuous automated promotion without human gate — human confirmation is the ground truth circuit breaker
- All Council members from same model family — self-enhancement bias
- Agent marketplace / soul trading — requires DNA Library depth first (long-term play)
- Army composition sharing — post-validation feature
- DNA export (user-facing) — internal only in v2.0; user-facing in v3.0
- Per-run soul mutation — insufficient run count produces noisy signal (minimum 3–5 confirmed runs)
- UIEX-06: Mutation lineage visualization (depth-3 graphical view) — deferred to v2.1
- UIEX-07: Soul weight sliders (user-configurable fitness dimension weights) — deferred to v2.1
- UIEX-08: Army composition history (named armies with track record) — deferred to v2.1
- GODL-08: Army Composition Recommendation algorithm — deferred to v2.1
- GODL-09: Category weight auto-calibration after 10 confirmed runs — deferred to v2.1

## Context

**Shipped v2.0 with ~19,625 LOC total** (14 phases, 19 plans in v2.0, 2 days).

**Tech stack:**
- Backend: Node.js TypeScript (Fastify), pnpm monorepo
- Frontend: SvelteKit (Svelte 5 runes, adapter-vercel, Auth.js v5 Google OAuth)
- Database: PostgreSQL via Drizzle ORM (10 tables: executions, tasks, bots, billing_events, telemetry, dna_store, bot_souls, decision_traces, council_verdicts, negative_signal_register, agent_classes, category_benchmarks)
- Task queue: BullMQ 5 on Redis (3 queues: task-queue, council-queue, god-layer-queue)
- Bot isolation: GCE VMs with OpenClaw (migrated from Docker containers)
- Event bus: Google Cloud Pub/Sub (emulator in local dev)
- LLM routing: Vercel AI SDK 6, multi-provider (Anthropic claude-sonnet-4-6, Google gemini-2.5-flash, text-embedding-3-small via OpenAI)
- Billing: Metering and display only — atomic Redis Lua budget enforcement
- Auth: Auth.js v5 (@auth/sveltekit) with Google OAuth; backend verifies JWE-encrypted session tokens

**GCP deployment:** Terraform config committed and valid. Not yet applied — pending GCP project setup.

**Known issues / tech debt:**
- pgvector extension must be confirmed on Cloud SQL before running migrations 0003–0007 (`psql -c '\dx'`)
- Archetype seed must be run after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- OpenClaw WebSocket task dispatch protocol: confirm whether `run_task` accepts extra soul fields or requires prompt-prefix injection before Phase 9 dispatch code goes live
- Composite score weights (40/30/20/10) not empirically validated — iterate after first real execution data
- Production Terraform needs `bot-lifecycle-billing-sub` Pub/Sub subscription added for Billing Engine
- N+1 leaderboard enrichment acceptable for MVP (maxBots cap 20); add JOIN when bot counts grow
- Any new service or Dockerfile using `@claw/db` or internal packages must add `NODE_OPTIONS --conditions @claw/source`
- AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be configured in Vercel env vars for production
- Cloud Scheduler should be configured to POST /admin/cleanup/decision-traces on a cron schedule for 90-day TTL enforcement

## Constraints

- **Security**: Bots have zero network access except through Tool Gateway — this is non-negotiable
- **Isolation**: Each bot is ephemeral, stateless, no credentials, no persistent filesystem
- **Scope**: Single-tenant — Google Auth gates access but no multi-org data isolation yet
- **Budget**: No real Stripe integration — billing is metering + display only
- **Planner**: Simple parallel split only — no DAG, no recursive planning, no user-facing visual builder
- **Council integrity**: Devil's Advocate must always use a different LLM provider family than Performance Judge

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
| AnyPgColumn import for bot_souls self-referencing FK | TypeScript TS7022 implicit-any error on circular initializers requires explicit return type annotation | ✓ Good — avoids implicit any without runtime overhead |
| pgvector CREATE EXTENSION manually prepended to migration | drizzle-kit does not emit extension creation; manual prepend is idempotent | ✓ Good — standard approach, runs cleanly on first and subsequent migrations |
| Council runs on dedicated council-queue (concurrency=5) | Execution results surface immediately; Council never blocks user-facing response | ✓ Good — clean separation of execution and evaluation concerns |
| Devil's Advocate uses Google gemini-2.5-flash | Heterogeneous provider family prevents self-enhancement bias per CNCL-03 | ✓ Good — architectural requirement satisfied at model selection level |
| COUNTERFACTUAL_OVERRIDE_THRESHOLD=0.25 exported as named constant | Deterministic post-processing override avoids LLM confabulation in attribution | ✓ Good — overrides self-reported scores when counterfactual disagrees |
| God Layer holds Redis lock during active campaigns | Prevents mid-run library mutations from affecting agents in flight | ✓ Good — evaluates bot_souls snapshot at execution start, not current library state |
| IORedis v5 set() overload: EX, seconds, NX (not NX, EX) | TypeScript overload resolution requires this specific order | ✓ Good — enforced by compiler; silently wrong order would bypass NX semantic |
| Confirm/reject endpoints use atomic UPDATE WHERE status=pending + .returning() | Eliminates SELECT-then-UPDATE race conditions in concurrent confirmation scenarios | ✓ Good — 0 rows returned = 409 conflict; clean idempotency |
| evidenceLoaded flag gates action buttons at template level | CONF-02 requirement: evidence must render before confirm/reject appear | ✓ Good — enforced structurally, not via CSS visibility hack |
| lifecycleSseRoutes registered at /events prefix (not /executions) | Avoids /:id=events routing ambiguity with existing execution-scoped SSE route | ✓ Good — clean namespace separation |
| Army Builder analysis triggered by explicit button click | Avoids LLM latency on each input event; UIEX-05 submission block uses button disabled (not hidden) | ✓ Good — never silently reduces agent count per requirement |

---
*Last updated: 2026-02-22 after v2.0 milestone*
