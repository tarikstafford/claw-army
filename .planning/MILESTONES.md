# Milestones

## v1.0 MVP (Shipped: 2026-02-19)

**Phases completed:** 6 phases, 23 plans
**Timeline:** 2 days (2026-02-18 → 2026-02-19)
**Code shipped:** ~10,220 LOC (8,362 TypeScript + 1,858 Svelte), 216 files

**Delivered:** A fully operational bot fleet platform — deploy AI workers against an objective, watch them run in real-time, enforce budget/guardrails atomically, score every bot's performance, capture elite DNA, and review everything in a Svelte UI.

**Key accomplishments:**
- pnpm monorepo with Drizzle ORM, 6-table PostgreSQL schema, Zod v4 shared-types/event-schemas/tool-contracts packages, and GCP Terraform infrastructure
- Docker internal network isolation — bot containers blocked from all external TCP/DNS with exclusive Tool Gateway access, verified by automated egress test
- Full execution pipeline — POST /executions through lease-based BullMQ task claiming, stub-bot Docker workers, and E2E test covering all 5 Phase 2 success criteria
- Tool Gateway with complete security boundary — JWT auth, per-execution tool allowlist, Zod schema validation, per-bot rate limiting (tools/min, tokens/min), per-invocation audit logging
- Atomic Redis Lua budget enforcement + Guardrail Watchdog (rate/loop detection, bot revocation via deny-list) + Billing Engine (bot-hours, cost estimation, Pub/Sub event sourcing)
- Composite performance scoring (Success 40% + Efficiency 30% + Cost 20% + Stability 10%), elite bot DNA capture (PII-safe structural patterns, versioned JSONB), and Svelte 5 frontend with 6 screens (deploy, live monitoring, post-run dashboard, bot detail, billing)

**Archive:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase details
- `.planning/milestones/v1.0-REQUIREMENTS.md` — all 51 requirements with outcomes

---

## v1.1 Google Auth Gate (Shipped: 2026-02-19)

**Phases completed:** 1 phase (Phase 7), 6 plans
**Timeline:** 1 day (2026-02-19)
**Code shipped:** +5,613 / -223 lines across 54 files

**Delivered:** Google OAuth authentication gate — unauthenticated users are redirected to /login, authenticated users access /new-execution with session tokens forwarded to the backend, and POST /executions enforces 401 without a valid Auth.js session.

**Key accomplishments:**
- Migrated SvelteKit from adapter-static → adapter-vercel, enabling server-side hooks and load functions required by Auth.js
- Backend 401 enforcement on POST /executions via HKDF key derivation + JWE (jose compactDecrypt) for Auth.js v5 session token verification
- Auth.js Google OAuth core setup — hooks.server.ts intercepts /auth/* routes, App.Locals.auth() typed globally across all server files
- /login page with dark-themed card + Google OAuth button; authenticated nav shows user avatar, name, and Sign Out
- /new-execution auth guard + server action that reads the httpOnly session cookie and forwards it as Authorization: Bearer to execution-service
- All 8 Google Auth Gate flows human-verified end-to-end: redirect, login page, Google OAuth, post-auth redirect, authenticated nav, sign-out, form submission, backend 401

**Archive:**
- `.planning/milestones/v1.1-ROADMAP.md` — full phase details

---


## v2.0 The SOUL System (Shipped: 2026-02-22)

**Phases completed:** 7 phases (8–14), 19 plans
**Timeline:** 2 days (2026-02-21 → 2026-02-22)
**Code shipped:** ~25,737 insertions across 111 files (~19,625 LOC total — 14,310 TypeScript + 5,315 Svelte)

**Delivered:** A full evolutionary learning engine — bots now deploy with differentiated behavioral constitutions (SOUL.md), a council of three LLM judges evaluates every agent post-run, confirmed verdicts drive DNA library writes and class promotions, and the UI surfaces class badges, lifecycle events, and Army Builder composition analysis.

**Key accomplishments:**
- SOUL System foundation: 4 new database tables (bot_souls, decision_traces, council_verdicts, negative_signal_register), SoulDocument/VerdictType shared types, and 6 canonical archetype seeds (Cautious Verifier, Aggressive Executor, Creative Synthesizer, Structured Analyst, Collaborative Integrator, and variants)
- Soul Generation Engine: library-seeded mutation for known task categories (top-5 historical parents + diversity injection) and archetype spread for novel categories — cosine similarity enforcement at 0.85 threshold and constitution validation before any VM spawn
- Decision Trace Collection: post-hoc attribution compiler producing per-decision soul directive attribution rows with idempotent inserts; TTL cleanup route; OpenClaw decision_annotation stub ready for real-time path
- The Council: 3 independent LLM judges (Performance Judge + Soul Analyst using Anthropic claude-sonnet-4-6, Devil's Advocate using Google gemini-2.5-flash) run async on a dedicated council-queue — verdicts never block execution results from surfacing to users
- Human Confirmation Gate: Promote/Retire verdicts require operator confirmation with evidence surfacing and anti-rubber-stamp mechanics (time-on-screen tracking, calibration warning at >95% confirmation rate over 10+ verdicts)
- God Layer + Agent Class System: confirmed verdicts drive atomic DNA library writes, class transitions (Novice→Understudy→Artisan per task category), pioneer tracking, and negative signal register updates — the evolutionary loop closes end-to-end
- UI Extensions: leaderboard with class tier badges + pioneer flags + verdict summaries, SSE lifecycle notifications for promotion/demotion/retirement events, Army Builder with category detection + library depth + three budget composition tiers + submission block

**Archive:**
- `.planning/milestones/v2.0-ROADMAP.md` — full phase details
- `.planning/milestones/v2.0-REQUIREMENTS.md` — all 37 requirements with outcomes

---


## v3.0 Bot Reliability & UX Overhaul (Shipped: 2026-02-23)

**Phases completed:** 23 phases, 73 plans, 8 tasks

**Key accomplishments:**
- (none recorded)

---


## v4.0 The Ring Leader (Shipped: 2026-03-02)

**Phases completed:** 9 phases (24–32), 30 plans
**Timeline:** 1 day (2026-03-02)
**Code shipped:** ~16,834 insertions across 114 files
**Git range:** feat(24-01) → feat(32-03) (91 commits)

**Delivered:** The Ring Leader — a first-class autonomous entity that owns the full execution lifecycle from soul selection through run synthesis, demoting the Orchestrator to a thin pre-flight layer. All 38 v4.0 requirements satisfied across 9 phases.

**Key accomplishments:**
- Orchestrator demoted to thin pre-flight layer (task graph parsing + budget validation) — Ring Leader owns soul selection, population assembly, agent spawning, real-time coordination, and run synthesis end-to-end
- Soul library search engine with pgvector embedding similarity, class-priority selection, differentiation enforcement (cosine < 0.85), pre-deployment mutation, and pioneer generation for novel task categories
- Budget validation with tiered reduction (Artisan→Understudy→minimum populations) and clear constraint messaging when minimum viable population cannot be funded
- DAG-respecting agent spawning with per-agent session JWTs, SOUL.md injection, constitution verification, upstream intelligence routing, and active session registry
- Real-time coordination loop: intelligence routing between agents, failure reallocation, objective drift detection (embedding similarity + reanchoring signals), and tiered budget degradation (deprioritize → consolidate → wrap up → hard stop)
- Run synthesis (LLM-driven) with soul selection retrospective, coordination self-assessment, and recommended library writes — delivered to Performance Judge as primary council input
- Ring Leader fitness scoring: coordination quality (4 dimensions, 60% weight) + soul selection quality (5 dimensions, 40% weight) with class progression (Novice → Understudy → Artisan) and Akashic Library persistence
- Dashboard surfaces: pre-flight population manifest, live Ring Leader state panel with drift indicator, activity feed with coordination event formatting, post-run synthesis and fitness score panels

**Tech debt accepted (9 items, 0 critical):**
- Council synthesis race condition (degraded, not blocking)
- Phase 25 missing VERIFICATION.md (complete but not formally verified)
- thirdPartyGrants placeholder, cost estimate placeholder, cosmetic comment, orphaned API function, unauthenticated Ring Leader GET routes, 4 human verification items pending live execution

**Archive:**
- `.planning/milestones/v4.0-ROADMAP.md` — full phase details
- `.planning/milestones/v4.0-REQUIREMENTS.md` — all 38 requirements with outcomes
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — pre-completion audit

---

