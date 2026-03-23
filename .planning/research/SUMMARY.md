# Project Research Summary

**Project:** Akasa — v6.0 Paperclip Foundation
**Domain:** AI Agent Fleet Platform — Paperclip Integration, Tool Nexus, Evolution Dashboard
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (Paperclip API internals unverified; all other areas HIGH)

---

## Executive Summary

Akasa v6.0 is a platform-layer migration milestone: the product moves from owning the full agent execution stack (GCE VMs, OpenClaw WebSocket dispatch) to owning only the product logic layer above Paperclip, an open-source orchestration engine. This is the right architectural direction — Paperclip handles the hard distributed systems problems (adapter selection, session continuity, multi-agent coordination) while Akasa's competitive moat lives entirely in what runs on top: evolved souls, skill loadouts, the Karpathy loop, Tool Nexus security boundaries, and marketplaces. The migration reduces operational surface area substantially, but introduces a hard external dependency whose API internals must be verified against a live instance before the dispatch client can be finalized. This is the one genuine blocker in the milestone and must be resolved before Phase 2 implementation begins.

Three feature domains are new in v6.0: the Paperclip API client (agent dispatch, session management, soul injection), the Tool Nexus generalization (OAuth, typed contracts, catalog, OpenAPI import, webhooks), and the Evolution Dashboard rebuild (two-world design system, lineage trees, bit rate metrics). These domains have a clear dependency order: the CSS token system unblocks all UI work, the Paperclip client unblocks agent dispatch, and Tool Nexus contracts must be defined before the gateway can validate invocations. Crucially, none of the Evolution Dashboard work is blocked by the Paperclip migration — the dashboard is a new UI layer over data that already exists in the database. The four implementation phases can therefore proceed with meaningful parallelism between the Paperclip client work and the Tool Nexus backend work.

The top three risks are: (1) Paperclip API contract drift silently breaking agent sessions if types are hand-authored rather than generated from a spec; (2) OAuth token expiry corrupting the evolution signal if the tool gateway does not distinguish credential failures from agent behavior failures and exclude them from the composite fitness score; and (3) the design system migration producing zombie tokens if the old token system is not removed atomically before new components are built. All three risks are entirely preventable with design decisions made before implementation begins.

---

## Key Findings

### Recommended Stack

The validated existing stack (Fastify v5, SvelteKit 2 + Svelte 5 runes, Drizzle ORM, BullMQ, Vercel AI SDK, GCP Pub/Sub) requires no changes for v6.0. Six to eight net-new packages are added across three services. The existing `ws ^8.18.0` package already handles Paperclip WebSocket streaming; no new package is needed for that concern.

**Core new technologies:**
- `got ^14` (execution-service): Paperclip HTTP client — ESM-native, built-in retry with exponential backoff, typed generics. Do not use native `fetch` (no retry semantics) or `axios` (no streaming advantage for server-to-server)
- `simple-oauth2 ^5` (execution-service): OAuth 2.0 authorization code flows for Tool Nexus tool connections — designed for server-as-OAuth-client, unlike `@fastify/oauth2` which is for authenticating users into Akasa
- `@apidevtools/swagger-parser ^10` (tool-gateway): OpenAPI 3.0/3.1 + Swagger 2.0 spec parsing with `$ref` dereferencing — 672 dependents, actively maintained, handles the large real-world specs that `@scalar/openapi-parser` struggles with
- `d3-hierarchy ^3` (ui): Lineage tree layout only — 45KB vs 300KB for full D3. Use `$derived.by()` for layout computation; render as declarative SVG in the Svelte template. Do not use D3's DOM manipulation
- `@fontsource/cormorant-garamond`, `@fontsource-variable/dm-sans`, `@fontsource/press-start-2p` (ui): Self-hosted fonts eliminate Google Fonts CDN latency (~300ms desktop, 1s+ mobile) and GDPR exposure. Use the variable font variant for DM Sans to reduce HTTP requests
- `node:crypto` built-in (no package): Handles both AES-256-GCM credential encryption and HMAC-SHA256 webhook verification — no external package, no supply chain risk

**Critical ESM note:** `got ^14` is ESM-only. All services already use `"type": "module"` which is compatible, but verify the `tsx` dev runner handles it correctly with the `@claw/source` export condition active before committing to this choice.

See `.planning/research/STACK.md` for the full package rationale, version compatibility table, integration patterns, and installation commands.

### Expected Features

**Must have for v6.0 launch (P1):**
- CSS token system — Screenplay (`--h-*`) and Director's Cut (`--d-*`) tokens with `body.system` toggle; hard prerequisite for all UI work
- Three-typeface loading (Cormorant Garamond, DM Sans variable, Press Start 2P) — self-hosted via `@fontsource`
- Paperclip API client — agent dispatch, adapter selection, session management with task-key continuity
- Soul injection into Paperclip sessions — SOUL.md as system-prompt prefix; this is Akasa's core moat traveling with each agent
- Tool catalog UI — 5-8 curated integrations (HubSpot, Slack, Stripe, Google Sheets, Telegram, GitHub, Notion); quality over quantity
- OAuth + API key connection flows — encrypted token storage, proactive 5-minute look-ahead refresh, re-auth on expiry with status badge per connection
- Tool Belt view — connected tools, connection status badges (connected/expired/rate_limited/errored), last used timestamp
- Typed tool contracts — `tool-contracts` package extended with built-in integration schemas; validates inputs before gateway forwards
- Gateway invocation endpoint — single `POST /tools/invoke` for all agent tool calls with auth injection, schema validation, normalized `{ success, data, error }` response envelope
- Rate limiting per-tool (Redis sliding window) — 429 with retry-after header; prevents one agent from exhausting a user's API quota
- Invocation logging — structured per-invocation audit trail (toolId, action, agentId, executionId, latency, success/failure, failureReason)
- Retry logic — exponential backoff with jitter on 429/503 before surfacing failure to agent
- Fleet overview + bit rate metrics — class distribution, bit rate, effective bit rate always prominent with amber/gold treatment
- Per-agent evolution timeline — council verdicts, class transitions, mutations, DNA captures in chronological order
- Composite score trend chart — per-agent score over executions
- Lineage tree (depth-1) — archetype root to current soul; makes the compounding thesis tangible
- Experiment ledger — run-by-run log per agent (score, delta, mutation type, verdict, outcome)
- Category benchmarks view — pioneer baselines, maturity status, thin-data flags
- Two-world toggle — Director's Cut default for evolution views; Screenplay for onboarding/chat; persisted in user preferences

**Should have — add in v6.1 after validation:**
- Custom tool registration (name, base URL, auth config, action schemas)
- OpenAPI/Swagger import (paste URL or upload spec, auto-generate action definitions)
- Webhook receiver with routing rules and dead letter queue — add when tool catalog is in active use and users request event-driven triggers
- Tool performance factored into evolution (Council Performance Judge extension + fitness score update) — requires 10+ executions of clean invocation data first
- Cost metering per invocation (per-call cost attribution)
- Lineage tree depth-3 graphical view

**Defer to v7.0+:**
- Skill System (SKILL.md, skill loadout capacity scaling with class, Skill Bazaar marketplace)
- Command Channel (Paperclip issue-backed comms, WebSocket streaming, Indra CEO agent)
- Akashic Library (soul marketplace — requires DNA Library depth before publishable Artisan souls exist at scale)
- Agent-authored tools (requires new GCP Cloud Run sandboxed container infrastructure)

See `.planning/research/FEATURES.md` for the full prioritization matrix, feature dependency graph, competitor analysis (Zapier, n8n, Composio), and anti-feature rationale.

### Architecture Approach

The v6.0 architecture is an existing service mesh being extended, not rebuilt. The boundary is clean: Paperclip owns agent lifecycle and adapter dispatch; Akasa owns everything above — soul generation, council evaluation, DNA capture, class transitions, tool connections, skill loadouts, billing, UI. The key new component is `paperclip-client.ts` in execution-service, which supersedes the GCE VM provisioning and OpenClaw WebSocket dispatch paths. Migration uses a feature flag (`AGENT_RUNTIME=paperclip|openclaw`) rather than a big-bang swap; the existing GCE path stays live until the Paperclip path is validated in staging.

**Major components (v6.0 additions):**
1. `paperclip-client.ts` (execution-service/src/services/) — `got.extend()` singleton wrapping all Paperclip HTTP + WebSocket calls; idempotency keys on all dispatch calls; error categorization (network = retry, 409 = already dispatched, 422 = permanent fail)
2. `tool-invoker.ts` + `openapi-importer.ts` + `webhook-router.ts` (tool-gateway/src/services/) — generalize the existing hardcoded 3-tool gateway into a contract-driven, auth-injecting, rate-limiting dispatch layer
3. `tool_definitions`, `tool_connections`, `tool_invocations` tables (packages/db/src/schema/) — 3 new tables; note `tool_invocations` may already exist, extend rather than replace
4. Two-world CSS token system (ui/src/app.css) — replace existing 28-token dark violet system atomically before any new component is built; `body.system` class scopes Director's Cut overrides
5. Evolution Dashboard routes (ui/src/routes/(app)/dashboard/) — new UI layer over existing data using `d3-hierarchy` for lineage trees and existing SSE infrastructure for live updates

**Critical boundary rules that must hold in all implementations:**
- Browser never calls Paperclip directly — all Paperclip calls go through execution-service server-side
- Agents never receive raw credentials — Tool Gateway injects credentials server-side at invocation time, decrypted in memory, never logged
- All bot egress routes through tool-gateway via `HTTP_PROXY` — non-negotiable per CLAUDE.md
- Single `app.css` for both worlds — `body.system` is a pure CSS class swap, not a component remount; no state is destroyed

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, component boundary table, build order, and scaling considerations.

### Critical Pitfalls

1. **Paperclip dispatch treats network errors as permanent agent failures** — A Railway restart or Paperclip timeout during dispatch causes a bot to be marked `failed` when the agent may have been created (or the acknowledgment was simply lost). Add idempotency keys (`${executionId}:${botId}` as `claw-idempotency-key` header), categorize error types (network = retry with backoff, 409 = already dispatched treat as success, 422 = do not retry), and add a BullMQ reconciliation job that checks Paperclip session status 60s after dispatch before ever marking a bot `failed`. Must be addressed in the Paperclip integration phase before any production traffic.

2. **OAuth token expiry corrupts the evolution signal** — When an access token expires, tool calls fail with 401. If the gateway maps this to a generic `ToolCallError`, the Council Performance Judge penalizes the agent's soul behavior for an infrastructure failure, writing false negative signals to the DNA store. Store `accessToken`, `refreshToken`, `expiresAt`, and `scope` (never just the access token); implement proactive refresh (5-minute look-ahead); add a `credentialError` failure category that Council judges are explicitly instructed to exclude from composite score. Must be addressed before any live tool exercises an agent.

3. **Design system migration leaves zombie tokens** — Incremental migration (new routes use new tokens, old routes updated "later") creates ambiguous token ownership and mixed-world rendering bugs where `body.system` class toggle produces incorrect colors on routes that still reference old token names. Remove all old tokens atomically at the start of the design system phase; add a CI grep check that fails on deprecated token names in new component files; run `grep -r 'var(--' services/ui/src` as an audit at phase completion.

4. **Paperclip API contract drift silently breaks agent sessions** — Hand-authored TypeScript types for the Paperclip client will drift from the live API as Paperclip ships updates. Generate types from Paperclip's actual OpenAPI spec via a `pnpm generate:paperclip-types` script; add a startup version assertion against Paperclip's healthcheck; pin the Paperclip Railway service version and upgrade deliberately rather than on auto-deploy. Must be in place before the client handles production traffic.

5. **Credential encryption key rotation makes all tool connections permanently unreadable** — Without key versioning, rotating `TOOL_ENCRYPTION_KEY` makes all stored credentials undecryptable simultaneously with no automated recovery. Add a `keyVersion` integer column to `tool_connections`; implement envelope encryption (per-record DEK encrypted with versioned KEK); maintain two active key versions during any rotation period. Must be designed before the first credential is persisted — retrofitting key versioning is painful.

See `.planning/research/PITFALLS.md` for the full pitfall catalog including webhook replay attacks, OpenAPI import runtime failures, SSRF via custom tool contracts, performance traps, and a "Looks Done But Isn't" verification checklist.

---

## Implications for Roadmap

Research reveals a clear dependency structure that maps directly to four sequential phases, with meaningful parallelism available between Phases 2 and 3. Phase 1 (design system) is the unconditional prerequisite for all UI work. Phases 2 (Paperclip client) and 3 (Tool Nexus backend) can proceed in parallel since they touch different services. Phase 4 (Evolution Dashboard) is the user-facing payoff that depends on Phase 1 for tokens and benefits from Phase 2 for Command Channel streaming.

### Phase 1: Design System Foundation

**Rationale:** The CSS token system is the hard prerequisite for all v6.0 UI work. No Evolution Dashboard component, no Tool Nexus UI, and no Command Channel widget can be built correctly without stable tokens. Doing this first forces the zombie-token cleanup while the codebase is smaller. The atomic replacement is safer than incremental migration because incremental creates ambiguous token ownership that compounds with every new component added.
**Delivers:** Two-world CSS token system (`--h-*` Screenplay + `--d-*` Director's Cut) fully specified in `app.css`, all existing routes migrated to new tokens with zero references to old token names, self-hosted font imports (Cormorant Garamond, DM Sans variable, Press Start 2P) in `+layout.svelte`, `body.system` toggle wired to user preferences with localStorage fallback, CI grep check blocking deprecated token names.
**Addresses:** CSS token system, typography loading, two-world toggle (all P1 table stakes)
**Avoids:** Zombie token pitfall (Pitfall 3 in PITFALLS.md) — old tokens must be removed atomically, not incrementally
**Research flag:** Standard patterns. No `/gsd:research-phase` needed — the design guide in `tasks/akasa-design-guide.md` is the authoritative specification.

### Phase 2: Paperclip API Client

**Rationale:** Agent dispatch is the core platform capability for v6.0. This phase starts with an unavoidable discovery step — inspecting `claw-paper-clip`'s `server/` directory and `DEVELOPING.md`, running a local Paperclip instance, and verifying actual endpoint paths before writing any client code. The existing GCE/OpenClaw path stays live behind a `AGENT_RUNTIME=paperclip|openclaw` feature flag throughout this phase so production can continue operating.
**Delivers:** `paperclip-client.ts` with typed endpoints generated from Paperclip's OpenAPI spec (not hand-authored), idempotency keys (`${executionId}:${botId}`) on all dispatch calls, error categorization (network/conflict/validation), `dispatch_pending` bot state with BullMQ reconciliation job, startup version assertion against Paperclip healthcheck, `paperclip-client` integration test suite against a real Paperclip instance, `AGENT_RUNTIME` feature flag, `bot-orchestrator.ts` and `openclaw-dispatcher.ts` updated to use paperclip-client in the Paperclip code path.
**Addresses:** Paperclip API client, adapter selection per agent class, session management with task-key continuity, soul injection as system-prompt prefix
**Avoids:** Paperclip dispatch network errors as agent failures (Pitfall 1), API contract drift (Pitfall 6 in PITFALLS.md), big-bang migration risk (anti-pattern 5 in ARCHITECTURE.md)
**Research flag:** NEEDS `/gsd:research-phase` — Paperclip endpoint paths, request/response shapes, auth mechanism (API key vs JWT), and OpenAPI spec location are all unverified. This is the only hard blocker in the milestone. Begin Phase 2 planning by directly inspecting `claw-paper-clip` repo's `server/` directory. All Paperclip-dependent features block on this discovery.

### Phase 3: Tool Nexus Generalization

**Rationale:** Tool Nexus is a significant generalization of the existing tool-gateway. The backend work (DB schema, gateway logic, OAuth flows, credential storage) is independent of the Paperclip migration and can proceed in parallel with Phase 2. The UI is blocked on Phase 1 (design tokens) but the backend is not. Credential encryption with key versioning must be the first sub-task — before any OAuth credential is ever persisted.
**Delivers:** `tool_definitions`, `tool_connections`, `tool_invocations` DB tables with Drizzle migrations and `keyVersion` column; `tool-invoker.ts` with Zod schema validation, credential decryption at invocation time, auth injection, Redis sliding-window rate limiting (per userId+toolId), fire-and-forget invocation logging, exponential backoff retry; `tool-nexus.ts` CRUD routes in execution-service; built-in tool contract definitions for 5-8 integrations; OAuth authorization code flow via `simple-oauth2 ^5` with proactive refresh and `credentialError` error category; API key connection flow; Tool Belt UI; Tool catalog UI; credential encryption with envelope encryption (`keyVersion` column + per-record DEK + versioned KEK) from day one.
**Addresses:** All P1 Tool Nexus features from FEATURES.md
**Avoids:** OAuth token expiry corrupting evolution signal (Pitfall 2), credential key rotation breaking connections (Pitfall 7 in PITFALLS.md), SSRF via custom tool contracts (validate `baseUrl` against RFC 1918 blocklist before saving), webhook URL guessability (include cryptographically random token in URL, never just userId+toolSlug)
**Research flag:** Standard patterns. No `/gsd:research-phase` needed — OAuth 2.0, AES-256-GCM, Redis rate limiting, and Zod validation are all well-documented with high-confidence sources.

### Phase 4: Evolution Dashboard

**Rationale:** The Evolution Dashboard is primarily a new UI layer over data that already exists in the database (council_verdicts, dna_store, agent_classes, bot_souls). It is blocked on Phase 1 for design tokens but is otherwise largely independent. The Command Channel widget is the one sub-feature that requires the Paperclip client from Phase 2 for WebSocket streaming — if Phase 2 is not complete, Command Channel is deferred to v6.1 while the rest of the dashboard ships. Building this last lets the design token system and component patterns be established before the most visually complex surface is built.
**Delivers:** `evolution.ts` API routes (fleet overview with bit rate aggregation, per-agent timeline joining council_verdicts + dna_store + agent_classes + bot_souls, category benchmarks, lineage data, experiment ledger); Director's Cut component library (card, badge, timeline, Pioneer designation treatment in amber, tree SVG primitives); Evolution Dashboard SvelteKit routes with SSE integration; per-agent evolution timeline; lineage tree (depth-1) using `d3-hierarchy` with `$derived.by()` for layout and declarative SVG for rendering; experiment ledger; bit rate and effective bit rate metrics with amber/gold color treatment; category benchmarks view with pioneer baselines; composite score trend chart; pending confirmation notifications with inline evidence panel; Pioneer designation badge (permanent, amber treatment, "First in [category]"); Command Channel chat UI (if Phase 2 Paperclip client is available).
**Addresses:** All P1 Evolution Dashboard features from FEATURES.md
**Avoids:** Lineage tree crashing for Artisan agents with deep lineage (paginate depth — show 3 generations by default, load deeper on demand to prevent 5+ second cold-load); effective bit rate distortion from agents with zero completed runs (exclude from denominator)
**Research flag:** Standard patterns. No `/gsd:research-phase` needed — `d3-hierarchy` + Svelte 5 integration is documented, and dashboard data already exists.

### Phase Ordering Rationale

- **Phase 1 must be first and is never skippable.** The CSS token system is the prerequisite for all UI work across every other phase. The zombie-token pitfall makes incremental migration more dangerous than a single upfront atomic replacement — every new component added before cleanup deepens the technical debt.
- **Phases 2 and 3 can run in parallel** because they touch different services (execution-service for Paperclip, tool-gateway for Tool Nexus) and different database tables. Teams can split. Both converge in Phase 4 when Command Channel needs the Paperclip WebSocket.
- **Phase 4 (Evolution Dashboard) is last** because it is the user-facing payoff of all prior phases. Its highest-value component (lineage tree) needs stable data from the existing evolution engine (already shipped) and stable design tokens (Phase 1). Command Channel needs Phase 2. The dashboard API routes benefit from having stable invocation logging from Phase 3 (though the core dashboard does not depend on it for v6.0).
- **OpenAPI import and webhooks are deliberately deferred to v6.1.** Both require significant implementation effort (large-spec streaming parse, HMAC verification, routing rules, dead letter queue) and neither blocks the core v6.0 value proposition. Shipping the catalog and OAuth flows first lets users demonstrate tool usage and validate demand before power-user features are built.

### Research Flags

Phases requiring deeper research during planning:

- **Phase 2 (Paperclip API Client):** NEEDS `/gsd:research-phase` before implementation. Paperclip endpoint paths, request/response shapes, auth mechanism, WebSocket event format, and OpenAPI spec location are all unverified. Start by inspecting `claw-paper-clip/server/` and `DEVELOPING.md` against a running Paperclip instance. This is the only hard blocker in the milestone — all Paperclip-dependent features wait on this discovery.

Phases with well-documented patterns (skip research-phase):

- **Phase 1 (Design System Foundation):** The `tasks/akasa-design-guide.md` is the authoritative spec. CSS custom property patterns and `@fontsource` integration are standard.
- **Phase 3 (Tool Nexus Generalization):** OAuth 2.0 authorization code flow, AES-256-GCM encryption, Zod validation, Redis sliding-window rate limiting are all established patterns with high-confidence documentation. `simple-oauth2 ^5` and `@apidevtools/swagger-parser ^10` choices are well-reasoned.
- **Phase 4 (Evolution Dashboard):** Dashboard data already exists. `d3-hierarchy` + Svelte 5 `$derived.by()` pattern is fully documented. SSE infrastructure is existing.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | All choices HIGH confidence except Paperclip client API surface (MEDIUM — endpoint paths inferred from README + PRD, not verified against live instance). ESM compatibility of `got ^14` in current dev runner needs a quick smoke test |
| Features | HIGH | PRD is authoritative. Feature prioritization is clear, internally consistent, and cross-referenced against competitor patterns. Dependency graph is explicit |
| Architecture | HIGH | Based on direct codebase analysis of all relevant service files plus PRD and CLAUDE.md. Component boundaries, data flows, and build order are internally consistent and follow existing patterns |
| Pitfalls | HIGH | Fastify/SvelteKit/BullMQ patterns from existing codebase (HIGH); OAuth credential storage and HMAC patterns (HIGH); AES-256-GCM key rotation patterns (HIGH); Paperclip-specific pitfalls (MEDIUM — external API behavior inferred, not observed) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Paperclip API endpoint paths and auth mechanism (BLOCKER):** The `paperclip-client.ts` patterns in STACK.md use inferred endpoint paths (`/api/v1/companies/:id/agents`, etc.). These must be verified against a live Paperclip instance before Phase 2 coding begins. Check `claw-paper-clip/server/` directory and `DEVELOPING.md`. If Paperclip does not expose an OpenAPI spec, hand-authored types are acceptable but require integration tests (not just unit tests with mocks) to catch drift.

- **`got ^14` ESM compatibility in execution-service dev runner:** `got` is ESM-only. The `@claw/source` export condition + `tsx` dev runner combination should handle this (all services use `"type": "module"`), but a quick smoke test before finalizing the package choice avoids a late surprise.

- **`@apidevtools/swagger-parser` CJS interop in tool-gateway ESM context:** The package has CJS internals with an ESM entry point. If it fails at runtime, use `@readme/openapi-parser` (the maintained fork with better ESM support) as a drop-in alternative. Test at the start of Phase 3 OpenAPI import work.

- **Paperclip service Railway deployment strategy:** Auto-deploy on push to `claw-paper-clip` main would silently break `paperclip-client.ts` types and behavior. Establish a pinning and deliberate upgrade process (pin version in Railway, upgrade via explicit PR, regenerate types, run integration tests) before the Paperclip client handles any production traffic.

- **Effective bit rate formula edge case:** Agents with zero completed runs must be excluded from the effective bit rate denominator to avoid distorting the metric. This is a correctness requirement for the fleet overview, not a performance concern. Verify the aggregation query handles this correctly.

---

## Sources

### Primary (HIGH confidence)
- `tasks/prd-akasa-mvp.md` — authoritative PRD, US-009 through US-032, FR-16 through FR-52
- `tasks/akasa-design-guide.md` — authoritative design guide, two-world token specification, typography rules, world switching pattern
- `.planning/PROJECT.md` — v6.0 milestone definition, known issues, key architecture decisions
- `CLAUDE.md` — coding conventions, service responsibilities, monorepo structure, domain glossary
- Direct codebase analysis: `services/execution-service/src/`, `services/tool-gateway/src/`, `packages/db/src/schema/`, `services/ui/src/`
- Node.js `crypto` module official docs — AES-256-GCM authenticated encryption, HMAC-SHA256 webhook verification
- D3 hierarchy official docs (d3js.org/d3-hierarchy/tree) — tree layout API
- `@apidevtools/swagger-parser` npm — 672 dependents, actively maintained, Swagger 2.0 + OpenAPI 3.0/3.1

### Secondary (MEDIUM confidence)
- Paperclip GitHub README — API base URL confirmed; endpoint paths inferred (not verified against live instance)
- `got ^14` npm — ESM-only confirmed, retry API and stream handling verified
- `simple-oauth2 ^5` npm — 672 dependents, authorization code grant type API verified
- [Zapier Auth Documentation](https://docs.zapier.com/platform/build/auth) — OAuth v2 auto-refresh pattern (authoritative for the UX standard users expect)
- [Composio integration patterns](https://composio.dev/content/apis-ai-agents-integration-patterns) — per-user OAuth token patterns at scale
- [Composio outgrowing n8n/Zapier](https://composio.dev/content/outgrowing-make-zapier-n8n-ai-agents) — tenant isolation patterns
- [API Gateway Patterns for AI SaaS — dasroot.net](https://dasroot.net/posts/2026/02/api-gateway-patterns-ai-saas/) — gateway design patterns for AI platforms

### Tertiary (LOW confidence)
- [Tool Discovery Guide — icme.io](https://blog.icme.io/getting-found-by-agents-a-builders-guide-to-tool-discovery-in-2026/) — OpenAPI spec quality for agent tool discovery; single source

---

## Appendix: Prior Summary Reference

The v2.0 SOUL System research summary (researched 2026-02-21) is the predecessor to this document. All SOUL System features (soul generation, Council, God Layer, DNA Library, class progression, human confirmation gate, Army Builder UI) are SHIPPED and are not re-evaluated here. That summary is preserved in git history.

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
