# Claw Bot Army

## Milestone Status

- ✅ v1.0 MVP — shipped 2026-02-19
- ✅ v1.1 Google Auth Gate — shipped 2026-02-19
- ✅ v2.0 The SOUL System — shipped 2026-02-22
- ✅ v3.0 Bot Reliability & UX Overhaul — shipped 2026-02-23
- ✅ v4.0 The Ring Leader — shipped 2026-03-02
- ✅ v5.0 Full Spectrum — shipped 2026-03-03

---

## What This Is

Akasa is a platform that lets SMEs and individuals deploy fleets of AI bot workers against a named objective. Users create persistent objectives, set a budget cap, and the system's Ring Leader — an autonomous orchestration entity — decomposes the objective into a DAG of tasks, searches the Akashic Library to assemble differentiated soul populations per task, validates budget constraints, spawns agents with session JWTs and full SOUL.md constitutions into isolated GCE VMs, and coordinates them in real time with intelligence routing, failure reallocation, objective drift detection, and tiered budget degradation. Post-run, the Ring Leader produces a synthesis document covering soul selection retrospective and coordination self-assessment, which feeds into a three-judge Council evaluation. The evolutionary learning engine compounds agent intelligence through council-evaluated mutation and a versioned DNA library, with both worker agents and Ring Leaders progressing through Novice to Artisan class tiers.

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

- ✓ GCE startup script installs OpenClaw/SecureClaw idempotently with structured failure reporting to /ready — v3.0
- ✓ Bot spawn failures write errorMessage to DB; UI displays human-readable error on bot card — v3.0
- ✓ /ready handler validates OpenClaw WebSocket liveness before setting bot to idle — v3.0
- ✓ Spawn-timeout bots write failed status + errorMessage before stopBot() runs (skipDbUpdate guard) — v3.0
- ✓ Named persistent objectives: CRUD API + DB table with ON DELETE SET NULL executions FK — v3.0
- ✓ Objectives list page shows each objective with last-run status, run count, spend, best class achieved — v3.0
- ✓ Objective detail page: run history table, aggregate stats, live SSE status panel, DNA evolution summary — v3.0
- ✓ Launch-from-objective: objectiveId wired end-to-end from /objectives/:id button through createExecution() to DB — v3.0
- ✓ Soul inspector panel: GET /bots/:botId/soul endpoint + SoulInspectorPanel drawer with 7 dimensions, lineage, verdict — v3.0
- ✓ Soul tier badges (Novice/Understudy/Artisan/Retired) on bot cards in monitoring, leaderboard, and bot detail — v3.0
- ✓ Bot cards in live view show currentTaskDescription, toolCallCount, tokenBurnRate, soul tier badge — v3.0
- ✓ Post-run report shows soul tier distribution panel — v3.0
- ✓ Pending Promote/Retire verdicts highlighted in run view with inline VerdictConfirmPanel — v3.0
- ✓ Akasa dark violet design system: 28 CSS tokens, Clash Display/Inter/JetBrains Mono, 13 routes — v3.0
- ✓ Platform brand: "Claw Army" → "Akasa" across all UI surfaces — v3.0

- ✓ Orchestrator parses objective into validated task graph DAG with complexity, tools, dependencies, and population sizes — v4.0
- ✓ Orchestrator validates tool grants and budget cap against task graph before spawning Ring Leader — v4.0
- ✓ Orchestrator spawns Ring Leader with structured mission brief and steps back from execution — v4.0
- ✓ Ring Leader searches Akashic Library per task using embedding similarity, tool/complexity filters, campaign weighting, and negative signal exclusion — v4.0
- ✓ Ring Leader selects from pool with class priority and cosine similarity < 0.85 differentiation enforcement — v4.0
- ✓ Ring Leader applies targeted pre-deployment mutations with logged rationale — v4.0
- ✓ Ring Leader generates 5 archetypal pioneer souls for novel task categories — v4.0
- ✓ Ring Leader produces structured population manifest per task with all required fields — v4.0
- ✓ Budget validation with tiered reduction (Artisan→Understudy→minimum) and minimum 3-agent guard — v4.0
- ✓ Session JWT per agent with soul_id, task_id, tool_allowlist, budget_allocation, runtime_limit — v4.0
- ✓ SOUL.md injection with constitution verification before execution — v4.0
- ✓ Task brief and upstream intelligence signals injected per agent session — v4.0
- ✓ DAG-respecting spawn sequencing with active session registry — v4.0
- ✓ Pre-flight dashboard shows full population manifest before execution begins — v4.0
- ✓ Real-time coordination loop: polling, live run state, intelligence routing, failure reallocation, drift detection, budget degradation — v4.0
- ✓ Reanchoring signal broadcast when objective drift exceeds 0.35 — v4.0
- ✓ Run synthesis with soul selection retrospective, coordination self-assessment, and recommended library writes — v4.0
- ✓ Performance Judge receives Ring Leader synthesis as primary input — v4.0
- ✓ Ring Leader fitness scoring: coordination quality (60%) + soul selection quality (40%) — v4.0
- ✓ Ring Leader class progression: Novice→Understudy (4 runs, 0.68), Understudy→Artisan (9 runs, 0.85, soul selection 0.75 in 6+) — v4.0
- ✓ Dashboard: pre-flight manifest, live state panel, coordination events in activity feed, post-run synthesis and fitness panels — v4.0

- ✓ Execution data model extended with llmProvider and allowedDomains; Tool Gateway wired for per-execution domain filtering — v5.0
- ✓ API alignment verified: Ring Leader routes, SSE streams (billing events + per-topic resilience), calibration endpoint — v5.0
- ✓ Execution form enhanced with campaign type, tool allowlist, runtime limit — all stored end-to-end — v5.0
- ✓ Pre-flight manifest review gate: pre_flight status, confirm/cancel endpoints, manifest polling UI — v5.0
- ✓ Objective CRUD UI: create form, inline edit, archive/unarchive, kebab menus, archived toggle — v5.0
- ✓ DNA evolution timeline on objective detail: paginated, filterable, expandable with judge details — v5.0
- ✓ Soul library browser, decision trace viewer, negative signal register, category benchmarks — all browsable — v5.0
- ✓ Ring Leader fitness breakdown: all 9 dimensions (4 coordination + 5 soul selection) in execution reports — v5.0
- ✓ Landing page: request access form captures email, dead footer links removed, GET /admin/health endpoint — v5.0

### Active

## Current Milestone: v6.0 Paperclip Foundation

**Goal:** Unify claw-army and claw-paper-clip into a single product via git submodule (Path C), replace React UI with SvelteKit, extend Paperclip's Express backend with evolution routes, build Tool Nexus as Paperclip plugins, and rebuild the Evolution Dashboard with the two-world design system.

**Architecture (Path C — Submodule):**
- claw-paper-clip imported as git submodule inside claw-army
- Paperclip's Express server = THE backend, extended with Akasa evolution routes
- One Postgres DB: Paperclip's 55 tables + Akasa's evolution tables
- SvelteKit replaces Paperclip's React UI (one frontend, two-world design system)
- Tool Nexus connectors built as Paperclip plugins
- Akasa imports @paperclipai/db, @paperclipai/shared, @paperclipai/adapters via pnpm workspace
- Main model adapter: M2.7 Minimax (added to Paperclip fork)

**Target features:**
- [ ] Submodule integration — claw-paper-clip as git submodule, pnpm workspace spanning both, shared DB schema
- [ ] Design System Foundation — Screenplay/Director's Cut CSS tokens, Cormorant Garamond/DM Sans/Press Start 2P typography
- [ ] SvelteKit frontend replacing Paperclip React UI — leveraging Paperclip's backend APIs directly
- [ ] Evolution routes on Paperclip's Express server — soul system, council, god layer wired into heartbeat lifecycle
- [ ] Tool Nexus connectors as Paperclip plugins — OAuth connections, typed contracts, tool catalog
- [ ] Tool Nexus UI — catalog, connection flows, Tool Belt view in SvelteKit
- [ ] Evolution Dashboard — fleet overview, bit rate metrics, per-agent timelines, lineage trees, experiment ledger, category benchmarks

### Out of Scope

- Real payment processing (Stripe) — metering/display only for MVP; add post-validation
- Multi-tenant isolation — single-tenant MVP; add post-validation
- DAG replanning — Ring Leader decomposes into DAG but does not replan mid-run
- Arbitrary shell execution in bots — Tool Gateway enforced, non-negotiable
- Mobile app — web-first
- Firecracker/Kata microVM isolation — Docker/GCE sufficient; upgrade path exists
- User-editable raw soul text — corrupts evolutionary lineage attribution
- Fine-tuning model weights from soul data — requires RLHF infrastructure
- Real-time Council evaluation during execution — council runs post-synthesis per design
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

**Shipped v5.0 with ~47,200 LOC** (41 phases across 6 milestones, 120 plans total, 16 days, 88 files changed in v5.0 alone).

**Tech stack:**
- Backend: Node.js TypeScript (Fastify), pnpm monorepo
- Frontend: SvelteKit (Svelte 5 runes, adapter-vercel, Auth.js v5 Google OAuth) — Akasa dark violet design system
- Database: PostgreSQL via Drizzle ORM (12 tables: + objectives, + errorMessage column on bots)
- Task queue: BullMQ 5 on Redis (3 queues: task-queue, council-queue, god-layer-queue)
- Bot isolation: GCE VMs with OpenClaw (migrated from Docker containers in v1.0)
- Event bus: Google Cloud Pub/Sub (emulator in local dev)
- LLM routing: Vercel AI SDK 6, multi-provider (Anthropic claude-sonnet-4-6, Google gemini-2.5-flash, text-embedding-3-small via OpenAI)
- Billing: Metering and display only — atomic Redis Lua budget enforcement
- Auth: Auth.js v5 (@auth/sveltekit) with Google OAuth; backend verifies JWE-encrypted session tokens

**GCP deployment:** Terraform config committed and valid. Not yet applied — pending GCP project setup.

**Known issues / tech debt:**
- pgvector extension must be confirmed on Cloud SQL before running migrations 0003–0007 (`psql -c '\dx'`)
- Archetype seed must be run after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- OpenClaw WebSocket task dispatch protocol: confirm whether `run_task` accepts extra soul fields or requires prompt-prefix injection
- Composite score weights (40/30/20/10) not empirically validated — iterate after first real execution data
- Production Terraform needs `bot-lifecycle-billing-sub` Pub/Sub subscription added for Billing Engine
- N+1 leaderboard enrichment acceptable for MVP (maxBots cap 20); add JOIN when bot counts grow
- Any new service using `@claw/db` or internal packages must add `NODE_OPTIONS --conditions @claw/source`
- AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be configured in Vercel env vars
- Cloud Scheduler should POST /admin/cleanup/decision-traces on cron for 90-day TTL enforcement
- landing page `.tok { color: #4ade80 }` uses raw hex (no --green token) — low-priority cosmetic

## Constraints

- **Security**: Bots have zero network access except through Tool Gateway — this is non-negotiable
- **Isolation**: Each bot is ephemeral, stateless, no credentials, no persistent filesystem
- **Scope**: Single-tenant — Google Auth gates access but no multi-org data isolation yet
- **Budget**: No real Stripe integration — billing is metering + display only
- **Planner**: Ring Leader decomposes into DAG — no recursive replanning or user-facing visual builder
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
| Startup script uses EXIT trap + FAILURE_REASON (not set -e) | set -e prevents EXIT trap from firing post-failure; explicit || blocks required for structured failure reporting | ✓ Good — reliable structured error delivery to /ready |
| /ready returns 200 for failure payloads | VM completed its job by reporting; ACK prevents retry spam | ✓ Good — idempotent, no retry loops |
| Spawn timeout uses botRegistry polling (not DB query) | Avoids per-interval DB hit; registry is authoritative in-process state | ✓ Good — zero DB load per timeout tick |
| stopBot() skipDbUpdate optional third param | Existing 2-arg callers unaffected; only spawn-timeout path passes true | ✓ Good — non-breaking, surgical fix for BOT-04 |
| objectiveId nullable FK with ON DELETE SET NULL | Existing executions unaffected; no backfill needed | ✓ Good — clean migration path |
| db.select() with sql<T> correlated subqueries for objectives aggregation | db.execute() returns non-iterable QueryResult | ✓ Good — avoids QueryResult iteration bug |
| objectiveId conditional spread in createExecution() | TypeBox Optional(Type.String({format:'uuid'})) rejects null; omit field when absent | ✓ Good — TypeBox compliant without nullable workarounds |
| Hidden input pattern for objectiveId in form | URL search params NOT included in formData on POST; hidden input is reliable | ✓ Good — standard SvelteKit form pattern |
| Akasa CSS tokens: 28 custom properties in app.css | Zero hardcoded hex across 13 routes (acceptable exceptions: SVG fills, #fff on violet, Google brand) | ✓ Good — audit confirms zero old tokens remaining |
| Orchestrator demoted to pre-flight only | Ring Leader needs full lifecycle ownership for autonomous coordination | ✓ Good — clean separation: Orchestrator validates, Ring Leader executes |
| JSONB for all Ring Leader domain documents | Schema flexibility as Ring Leader types evolve; avoids migration churn | ✓ Good — missionBrief, manifest, runState, synthesis all stored as typed JSONB |
| Logical FK pattern for ring_leader_run_id | Avoids circular reference between executions and ring_leader_runs | ✓ Good — matches existing bots.soulId and executions.taskCategory patterns |
| pgvector cosine distance in SQL WHERE clause | DB-level filtering at 0.78 threshold before app-layer processing | ✓ Good — eliminates N+1 embedding comparisons |
| Jaccard keyword-overlap for intelligence routing | Avoids embedding API calls on every 30s poll cycle | ✓ Good — lightweight heuristic sufficient for v1 relevance detection |
| Tiered budget degradation (4 levels) | Graceful degradation preserves partial results under cost pressure | ✓ Good — deprioritize→consolidate→wrap up→hard stop at 95% cap |
| Reanchoring debounce 2min | Prevents signal flooding when drift stays elevated across consecutive polls | ✓ Good — drift detection + reanchoring signal tested end-to-end |
| Session JWT per agent (separate from bot JWT) | Different concern: per-agent grants vs bot identity; separate evolution paths | ✓ Good — clean security boundary per agent session |
| Fire-and-forget synthesis from coordination loop | Synthesis handles its own persistence; coordination loop can stop cleanly | ✓ Good — fitness scoring chained after synthesis via .then() |
| agent_classes reused for Ring Leaders (taskCategory='ring_leader') | No new table or migration needed for Ring Leader class progression | ✓ Good — natural extension of existing class system |
| Ring Leader SSE via existing subscription fan-out | RING_LEADER_EVENTS_TOPIC added to topicNames array | ✓ Good — zero new SSE infrastructure needed |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 — Phase 4 (SvelteKit Frontend Core) complete: BetterAuth replaces Auth.js, API proxy retargeted to Paperclip with cookie forwarding, WebSocket store, OFFICE CRUD (agents/issues/goals/projects), INDRA fleet dashboard, CHAT with real-time WebSocket messaging, SANCTUM costs, old v5 routes deleted, error page added — Paperclip React UI fully replaced*
