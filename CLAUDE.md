# CLAUDE.md — claw-army (Akasa)

## What is this project?

**Akasa** is a D2C platform where anyone can acquire, deploy, and evolve AI agents to create compounding value. It's built in this repository (`claw-army`) on top of **Paperclip** (`claw-paper-clip`), an open-source AI orchestration platform that runs as a separate service dependency.

**Core thesis:** Value creation is a war of attrition — the number of agents you operate (bit rate) and how good they are at their task (effective bit rate) determines your output.

**What this repo owns:** All Akasa product logic — the evolution engine (soul system, council, god layer), skill system, Tool Nexus, Command Channel, Akashic Library + Skill Bazaar marketplaces, billing, and the consumer UI.

**What Paperclip provides (via API):** Agent orchestration, 7 runtime adapters (Claude, Codex, Gemini, OpenClaw, Cursor, OpenCode, PI), plugin SDK, issue-backed communication, and agent sessions.

**Key documents:**
- `tasks/prd-akasa-mvp.md` — Complete product requirements document
- `tasks/akasa-design-guide.md` — Visual language reference (Screenplay + Director's Cut worlds, typography, components)
- `tasks/akasa-onboarding.md` — Onboarding flow PRD (Start Mode vs Connect Mode, team proposal, Indra brief)
- `tasks/akasa-vision.html` — Interactive visual for team presentations
- `design-context.md` — Original claw-army design system (Director's Cut foundation)

## Monorepo structure

```
packages/
  db/              — Drizzle ORM schema, migrations, seeds (PostgreSQL + pgvector)
  shared-types/    — Pure TS types mirroring DB schema (no runtime deps)
  event-schemas/   — Zod v4 schemas for all SSE/Pub/Sub events
  tool-contracts/  — Zod v4 schemas for tool gateway request/response contracts

services/
  execution-service/  — Fastify v5 backend: bot lifecycle, task dispatch, Council, God Layer, evolution engine
  tool-gateway/       — Fastify v5 HTTP proxy + Tool Nexus (generalized tool invocation gateway)
  telegram-bot/       — Telegram ↔ Paperclip bridge for Command Channel
  stub-bot/           — BullMQ worker that simulates a bot (dev/testing only)
  ui/                 — SvelteKit v2 + Svelte 5 frontend (Akasa consumer UI)

scripts/           — One-off utility scripts
infra/             — Terraform, Docker configs
tasks/             — PRDs and product planning docs
```

## Two-repo architecture

| Repo | Role | Hosting |
|------|------|---------|
| `claw-army` (this repo) | Akasa product — evolution, skills, tools, billing, UI, marketplaces | Railway (app services) + GCP (database, bot VMs) |
| `claw-paper-clip` | Paperclip — agent orchestration, adapters, plugin SDK, communication | Railway |

Akasa's Fastify backend calls Paperclip's API over HTTPS for agent operations. All product logic lives here. Paperclip is an upstream open-source dependency — never fork it, pull updates regularly.

## Monetization

Pure token arbitrage: users set a daily budget, agents consume LLM tokens, Akasa charges provider cost + 20% markup via Stripe metered billing. No subscriptions, no tiers, no feature gates.

## Key architecture decisions

- **Bot execution**: GCE VMs with OpenClaw (not Docker containers)
- **Task dispatch**: BullMQ (Redis) with concurrency=20
- **Events**: GCP Pub/Sub for inter-service events, SSE for real-time UI
- **UI → backend**: SvelteKit `/api/[...path]` reverse proxy to execution-service (browser never talks directly to backend)
- **Bot → internet**: All bot egress routes through tool-gateway via `HTTP_PROXY` (CONNECT tunneling + HTTP forward proxy)
- **Logical FKs**: Several tables use logical foreign keys (no `references()`) to avoid circular TypeScript inference at module load time — this is intentional, not a bug

## Domain glossary

| Term | Meaning |
|------|---------|
| **Execution** | A run of an objective — spawns bots, dispatches tasks, collects results |
| **Objective** | Reusable execution template with default config |
| **Bot** | An AI agent running on a GCE VM with OpenClaw |
| **Soul / SOUL.md** | Personality document (system prompt) that defines a bot's behavior |
| **Archetype** | One of 6 canonical seed souls (Cautious Verifier, Aggressive Executor, etc.) |
| **Dimensions** | 7 behavioral axes in a soul (identityRole, decisionPriorities, toolUsageDoctrine, riskTolerance, communicationStyle, recoveryBehavior, ethicalHardStops) |
| **Council** | 3 LLM judges (Performance Judge, Soul Analyst, Devil's Advocate) that evaluate bot performance |
| **Verdict** | Council output: Promote / Maintain / Monitor / Demote / Retire |
| **God Layer** | Post-council pipeline that executes class transitions, writes DNA, handles negative signals |
| **Agent Class** | Bot progression: Novice → Understudy → Artisan → Retired |
| **DNA Store** | Captured behavioral patterns from high-performing bots per task category |
| **Ring Leader** | Orchestrator agent that plans task graphs, selects souls, coordinates execution |
| **Pre-flight** | Execution state where Ring Leader builds its mission brief before spawning bots |
| **Pioneer** | First bot to achieve a category benchmark — triggers soul lifecycle events |
| **Skill** | Composable procedural knowledge unit (SKILL.md) — what an agent knows how to do |
| **Skill Loadout** | Set of skills equipped on an agent, capacity scales with class (3/5/8) |
| **Tool Nexus** | Unified gateway for external tool invocations (HubSpot, Slack, Stripe, etc.) |
| **Command Channel** | Chat-first interface for talking to CEO and fleet, built on Paperclip's issue-backed comms |
| **Akashic Library** | Marketplace for pre-evolved agent souls (Artisan-only publishing) |
| **Skill Bazaar** | Marketplace for proven procedural knowledge (skills) |
| **Karpathy Loop** | Autonomous feedback engine: mutate → execute → evaluate → keep/discard → capture DNA → repeat |
| **Bit Rate** | Number of agents in a fleet |
| **Effective Bit Rate** | Agent count × average composite fitness score = actual output capacity |
| **Paperclip** | Open-source AI orchestration platform (separate repo: `claw-paper-clip`), consumed as a service dependency |
| **Indra** | The CEO agent — Chief of Staff, always Opus tier, orchestrates the fleet |
| **Screenplay** | Light/warm UI world (user-facing: onboarding, chat, Office). Cream/plum/gold palette |
| **Director's Cut** | Dark UI world (technical: architecture, evolution, integrations). Near-black/violet/amber palette |
| **Start Mode** | Onboarding path for users with an idea but no tools (0→1) |
| **Connect Mode** | Onboarding path for users with a live business and existing tools (1→N) |
| **Karma** | Compounding IP moat — represents accumulated agent evolution and learning. Always amber |

## Coding conventions

### TypeScript
- **ESM everywhere** — `"type": "module"` in all package.json files
- **`node:` prefix** for all Node.js builtins (`node:crypto`, `node:net`, `node:http`)
- **Strict mode** — `strict: true`, `noUncheckedIndexedAccess: true` (array indexing returns `T | undefined`)
- **`@claw/source` custom condition** — workspace packages resolve to `./src/index.ts` in dev (no build step)
- **Named exports only** — never use `export default`
- **`import type`** for type-only imports; inline `type` keyword when mixing values and types
- **Barrel exports** — every package has `src/index.ts` that re-exports with `export *`

### Naming
- **Files**: `kebab-case.ts` (all TS files), `PascalCase.svelte` (Svelte components)
- **Variables/functions**: `camelCase`
- **Types/interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE` for module-level config values
- **DB tables**: `snake_case` (Drizzle convention)

### Import order
1. Node builtins (`node:*`)
2. External packages
3. Workspace packages (`@claw/*`)
4. Relative imports

### Types
- **Enums as string union `type`** — never use the `enum` keyword. Always pair with a `const` readonly array for runtime iteration (e.g., `type BotStatus = 'spawning' | 'idle' | ...` + `const BOT_STATUSES = [...] as const`)
- **Domain entities as `interface`** — `interface Bot { ... }`
- **Input/create types as `Omit<>`** — `type NewBot = Omit<Bot, 'id' | 'createdAt' | ...>`
- **DB row types inferred from Drizzle** — `type Bot = typeof bots.$inferSelect`
- **Shared types in `@claw/shared-types`** mirror DB schema without Drizzle dependency

### Functions
- **`export function` declarations** for public module exports
- **Arrow functions** for inline callbacks and Fastify route handlers
- **`async/await` everywhere** — no `.then()` chains
- **`Promise.allSettled`** for parallel ops where individual failures shouldn't block

### Error handling
- No custom error classes — use plain `Error` with descriptive messages
- **Try/catch** with structured `console.error` logs and `(err as Error).message`
- **Fire-and-forget `.catch()`** for non-critical side effects (Pub/Sub publish, VM termination, billing events)
- **Fail-open** for Redis operations (guardrail checks, rate limits) — log and allow through
- **Fastify routes** return typed error responses: `reply.code(404).send({ error: 'Bot not found' })`

### Logging
- Route handlers: Fastify's built-in Pino logger (`fastify.log.info/error/warn`)
- Application logic: `console.log/error/warn` with `[module-name]` prefix and structured object
- Example: `console.error('[bot-orchestrator] Failed to launch VM:', { botId, error: (err as Error).message })`

### Event schemas
- All events validated with Zod v4 before publishing
- Every event has a `type: z.literal(...)` discriminant + `timestamp: z.iso.datetime()`
- Discriminated unions for event families

## Backend specifics (execution-service + tool-gateway)

- **Framework**: Fastify v5 with `@fastify/type-provider-typebox` for typed routes
- **Route schemas**: TypeBox (`@sinclair/typebox`) for request/response validation
- **Database**: Drizzle ORM with `node-postgres` driver
- **Queue**: BullMQ with Redis
- **Auth**: JWT tokens (execution-service validates via `AUTH_SECRET`; tool-gateway via `BOT_JWT_SECRET`)

## Frontend specifics (ui)

- **Framework**: SvelteKit v2 with Svelte 5 runes
- **Runes syntax**: `$props()`, `$state()`, `$derived()`, `$effect()`, `{@render children()}`
- **Styling**: Pure CSS with custom properties, scoped `<style>` blocks — no Tailwind, no CSS modules, no component library
- **Two worlds**: Screenplay (light, `--h-bg: #F5F2EC`) and Director's Cut (dark, `--d-bg: #06050E`), toggled via `body.system` class
- **Fonts**: Cormorant Garamond (display/headlines), DM Sans (body/UI), Press Start 2P (labels/tags at 6-8px only)
- **Design guide**: `tasks/akasa-design-guide.md` — the authoritative reference for all visual decisions
- **Auth**: `@auth/sveltekit` with Google OAuth
- **API calls**: `lib/api.ts` (`apiFetch` wrapper) → `/api/...` proxy → execution-service
- **Real-time**: `lib/sse.ts` with three EventSource streams (execution events, bot logs, lifecycle)
- **No global state library** — local `$state()` + SvelteKit load functions

## Database

- **ORM**: Drizzle with PostgreSQL
- **Schema files**: `packages/db/src/schema/*.ts` — one file per table
- **Migrations**: `packages/db/migrations/` — SQL files generated by Drizzle Kit
- **pgvector**: Required for soul embedding similarity search (`vector(1536)` column on `bot_souls`)
- **Seeds**: `packages/db/src/seed/archetypes.ts` — 6 canonical soul archetypes (idempotent)

## Dev environment

### Running locally
```bash
# Start infra (Postgres, Redis, PubSub emulator)
docker compose -f docker-compose.dev.yml up -d

# Install pgvector extension (first time only)
docker exec postgres-db-1 apt-get install -y postgresql-17-pgvector
docker exec postgres-db-1 psql -U postgres -d clawdb -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Run migrations
pnpm db:migrate

# Seed archetypes (required before any execution works)
pnpm --filter @claw/db seed:archetypes

# Start services (each in separate terminal)
pnpm --filter @claw/execution-service dev
pnpm --filter @claw/tool-gateway dev
pnpm --filter @claw/ui dev
```

### Important quirks
- **pnpm 10.x** does not pass inline env vars to child processes — each service has `.npmrc` with `node-options=--conditions=@claw/source`
- **Migrations 0008–0010** may not be in `_journal.json` — apply manually via psql if DB is behind (they're idempotent with `IF NOT EXISTS`)
- **OpenClaw pinned to `v2026.2.22-2`** — `@latest` can pull breaking releases

### Tests
```bash
# Run tests (Vitest)
pnpm --filter @claw/execution-service exec vitest run
```

Tests are in `src/__tests__/` and `src/services/__tests__/`. E2E tests require running services.

## OpenClaw CLI (pinned to v2026.2.22-2)
- Only valid command: `openclaw gateway --port PORT`
- Auth token goes in config file (`~/.openclaw/openclaw.json`), not CLI flags
- Health check: `nc -z <ip> <port>` (WebSocket-only, no HTTP /health)
- Config: `{"gateway": {"auth": {"token": "TOKEN"}, "mode": "local", "bind": "lan"}}`

## Infrastructure (hybrid GCP + Railway)

### GCP (database, bot VMs, networking)
- Cloud SQL PostgreSQL + pgvector at 10.101.0.3
- Bot VMs: `e2-standard-2` Ubuntu 22.04, no external IP, on 10.0.0.0/24 subnet
- `claw-app-dev` at 10.0.0.3
- Pub/Sub for inter-service events
- IAP enabled for SSH access; `allow-iap-ssh-bots` firewall rule for `claw-bot-vm` tag

### Railway (application services)
- Akasa backend (execution-service)
- Paperclip service (claw-paper-clip)
- Telegram bot
- Tool gateway
- Railway connects to Cloud SQL via public IP + SSL

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Claw Bot Army**

Akasa is a platform that lets SMEs and individuals deploy fleets of AI bot workers against a named objective. Users create persistent objectives, set a budget cap, and the system's Ring Leader — an autonomous orchestration entity — decomposes the objective into a DAG of tasks, searches the Akashic Library to assemble differentiated soul populations per task, validates budget constraints, spawns agents with session JWTs and full SOUL.md constitutions into isolated GCE VMs, and coordinates them in real time with intelligence routing, failure reallocation, objective drift detection, and tiered budget degradation. Post-run, the Ring Leader produces a synthesis document covering soul selection retrospective and coordination self-assessment, which feeds into a three-judge Council evaluation. The evolutionary learning engine compounds agent intelligence through council-evaluated mutation and a versioned DNA library, with both worker agents and Ring Leaders progressing through Novice to Artisan class tiers.

**Core Value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.

### Constraints

- **Security**: Bots have zero network access except through Tool Gateway — this is non-negotiable
- **Isolation**: Each bot is ephemeral, stateless, no credentials, no persistent filesystem
- **Scope**: Single-tenant — Google Auth gates access but no multi-org data isolation yet
- **Budget**: No real Stripe integration — billing is metering + display only
- **Planner**: Ring Leader decomposes into DAG — no recursive replanning or user-facing visual builder
- **Council integrity**: Devil's Advocate must always use a different LLM provider family than Performance Judge
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Existing Validated Stack (Do Not Re-Research)
| Layer | Technology | Version |
|-------|-----------|---------|
| Backend framework | Fastify v5 + TypeBox | ^5.7.4 |
| Frontend | SvelteKit v2 + Svelte 5 runes | ^2.52.0 / ^5.51.3 |
| ORM | Drizzle ORM + node-postgres | ^0.45.1 |
| Database | PostgreSQL + pgvector | Cloud SQL at 10.101.0.3 |
| Queue | BullMQ + IORedis | ^5.69.3 / ^5.9.3 |
| LLM routing | Vercel AI SDK | ai ^6.0.90 |
| Events | GCP Pub/Sub + SSE | @google-cloud/pubsub ^5.2.3 |
| Auth | Auth.js v5 (@auth/sveltekit) | ^1.11.1 |
| Embeddings | text-embedding-3-small via @ai-sdk/openai | ^3.0.29 |
| Token auth | jose (JWE/JWT) | ^6.1.3 |
## Summary: Net New for v6.0
## Domain 1: Paperclip API Client
### Recommendation: `got` ^14 for the HTTP client, native `ws` for WebSocket streaming
- Retry with exponential backoff built-in (critical: Paperclip agent dispatch may take several seconds to respond; retries prevent cascading failures)
- TypeScript-first with proper generic support for typed response bodies
- Streams first-class (supports Paperclip's streaming agent output)
- Actively maintained: ^14.x released 2024, widely used in Node.js backends
- `ky` is browser-oriented (wraps Fetch API); `got` is Node.js-native
| Concern | Likely endpoint pattern | Notes |
|---------|------------------------|-------|
| Agent dispatch | `POST /api/v1/companies/:id/agents` | Creates an agent session |
| Session management | `GET/POST /api/v1/companies/:id/agents/:agentId/sessions` | Task-key continuity |
| Issue comments (Command Channel) | `POST /api/v1/companies/:id/issues/:issueId/comments` | Durable conversation record |
| WebSocket stream | `ws://.../api/companies/:id/events/ws` | Real-time agent output |
| Heartbeat/wakeup | `POST /api/v1/companies/:id/agents/:agentId/heartbeat` | Wakes agent with context |
| Adapter selection | Part of agent creation payload | `adapter: 'claude' | 'openclaw' | 'codex'` |
## Domain 2: Tool Nexus Generalization
### 2a. OAuth Connection Flows
- `@fastify/oauth2` is designed for authenticating your users into Akasa (which Auth.js already handles). The Tool Nexus needs to authenticate Akasa's services as OAuth clients to third-party APIs — a different concern.
- `simple-oauth2` ^5 provides `AuthorizationCode`, `ClientCredentials`, and `ResourceOwnerPassword` grant types. The authorization code flow is what HubSpot, Slack, etc. require.
- Actively maintained: ^5.1.0 published in 2024, 672 dependent packages
### 2b. Credential Encryption
- Built into Node.js — no package dependency, no supply chain risk
- AES-256-GCM provides authenticated encryption (prevents undetected tampering)
- OWASP recommended for database column encryption in Node.js (2025)
- The encryption key comes from a `TOOL_ENCRYPTION_KEY` environment variable (32 bytes, base64-encoded)
### 2c. OpenAPI/Swagger Import
- Validates and dereferences `$ref` pointers (critical — most real OpenAPI specs use `$ref` extensively)
- Supports Swagger 2.0 and OpenAPI 3.0/3.1
- 672 dependent npm packages — battle-tested
- TypeScript types included
### 2d. Webhook Signature Verification
- Raw body buffer must be captured before JSON parsing — use Fastify's `addContentTypeParser` with `parseAs: 'buffer'` to get the raw bytes
- Always use `crypto.timingSafeEqual()` for signature comparison — prevents timing attacks
- Check timestamp header (if provided by sender) to reject replays older than 5 minutes
## Domain 3: Evolution Dashboard & Design System
### 3a. Self-Hosted Fonts
- Eliminates external CDN DNS lookup + TLS handshake (saves ~300ms on desktop, 1s+ on 3G)
- No GDPR/privacy concerns from third-party font loading
- Works offline in dev without network dependency
- Fontsource packages integrate directly with Vite (SvelteKit's bundler)
# Add to @claw/ui
### 3b. Lineage Tree Visualization
- Tree and hierarchy layouts only — no need for scales, axes, brush, zoom, etc. at this stage
- Smaller bundle: `d3-hierarchy` ~45KB vs full `d3` ~300KB
- Svelte 5 integration pattern: use `$effect()` to bind D3 layout calculations to reactive state; render as SVG in the Svelte template (not D3's DOM manipulation)
### 3c. CSS Token System (Two Worlds)
- Tailwind CSS — conflicts with the bespoke token system and would require migrating existing CSS
- CSS modules — the existing scoped `<style>` blocks in Svelte already provide component isolation
- Design token libraries (Style Dictionary, Theo) — overkill for a two-theme single-product system
## What NOT to Add
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `axios` for Paperclip client | No advantage over `got` for Node.js server-to-server; worse streaming | `got ^14` |
| `node-fetch` | Deprecated in favor of native fetch in Node.js 22; lacks retry | `got ^14` |
| `@fastify/oauth2` for Tool Nexus | Designed for user auth, not third-party API OAuth | `simple-oauth2 ^5` |
| `passport` + OAuth strategies | Heavy framework; adds Express-style middleware pattern incompatible with Fastify | `simple-oauth2 ^5` |
| `@scalar/openapi-parser` | Modern but lower adoption than `@apidevtools/swagger-parser` | `@apidevtools/swagger-parser ^10` |
| `openapi-typescript` | Code generation, not runtime parsing | `@apidevtools/swagger-parser ^10` |
| Full `d3` bundle | 300KB for tree layout that only needs `d3-hierarchy` (45KB) | `d3-hierarchy ^3` |
| `svend3r` / `chart.js` / `apexcharts` | Abstract away the layout computation that must be custom | `d3-hierarchy ^3` + Svelte SVG |
| Tailwind CSS | Conflicts with existing pure CSS token system; requires migration | Pure CSS custom properties |
| Google Fonts CDN | External DNS, GDPR exposure, 300ms latency penalty | `@fontsource/*` packages |
| External encryption packages (`aes-encryption`, etc.) | Supply chain risk for security-critical path | `node:crypto` built-in |
| LangChain / LangGraph | Not needed for Council (existing generateObject() pattern) | Existing Vercel AI SDK |
## Installation Summary
# execution-service: Paperclip client + OAuth connections
# tool-gateway: OpenAPI import
# ui: fonts + D3 tree layout
- Webhook signature verification (node:crypto)
- Credential encryption (node:crypto)
- CSS design token system (existing app.css pattern)
- WebSocket streaming from Paperclip (existing `ws ^8.18.0`)
- Council LLM calls (existing Vercel AI SDK)
## Version Compatibility
| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `got` | `^14` | Node.js 18+, ESM | ESM-only package — matches existing `"type": "module"` in package.json |
| `simple-oauth2` | `^5.1.0` | Node.js 18+, ESM | ESM-compatible |
| `@apidevtools/swagger-parser` | `^10` | Node.js 12+, CJS+ESM | Has CJS interop; works with ESM via named import |
| `d3-hierarchy` | `^3` | Browser + Node.js, ESM | ESM module — works in Vite/SvelteKit |
| `@fontsource/*` | latest | Vite 6 | Import CSS directly in +layout.svelte |
## Integration Points with Existing Stack
| New Capability | Integrates With | Pattern |
|----------------|----------------|---------|
| Paperclip client (`got`) | `execution-service` routes for agent dispatch | `services/paperclip-client.ts` — singleton `got.extend()` instance with auth headers |
| OAuth token storage | `tool_connections` DB table | Encrypt with `node:crypto` before `INSERT`; decrypt in `getValidToken()` helper |
| OAuth refresh | `tool-gateway` tool invocation path | `getValidToken()` checks `accessToken.expired()`, refreshes, re-persists encrypted token |
| OpenAPI import | `tool-gateway` POST `/tools/import` route | `SwaggerParser.dereference(url)` → extract path objects → create `ToolContract` rows |
| Webhook receiver | `tool-gateway` POST `/webhooks/:toolId/:userId` | Raw body buffer → `verifyWebhookSignature()` → route to BullMQ job for agent dispatch |
| Font imports | `services/ui/src/routes/+layout.svelte` | Import CSS at top level — Vite bundles and hashes font files |
| Lineage tree | `services/ui/src/lib/components/evolution/LineageTree.svelte` | `d3-hierarchy` layout computed in `$derived.by()`; rendered as declarative SVG |
| CSS design tokens | `services/ui/src/app.css` | Extend existing 28-token system with Screenplay + Director's Cut tokens from design guide |
## Open Questions (Verify Before Shipping)
## Sources
- [got npm](https://www.npmjs.com/package/got) — MEDIUM confidence (verified active, ^14 ESM-only)
- [simple-oauth2 npm](https://www.npmjs.com/package/simple-oauth2) — MEDIUM confidence (^5 verified, 672 dependents)
- [@apidevtools/swagger-parser npm](https://www.npmjs.com/package/@apidevtools/swagger-parser) — HIGH confidence (672 dependents, actively maintained)
- [d3-hierarchy docs](https://d3js.org/d3-hierarchy/tree) — HIGH confidence (official D3 docs)
- [@fontsource/cormorant-garamond npm](https://www.npmjs.com/package/@fontsource/cormorant-garamond) — HIGH confidence
- [@fontsource-variable/dm-sans npm](https://www.npmjs.com/package/@fontsource-variable/dm-sans) — HIGH confidence
- [@fontsource/press-start-2p npm](https://www.npmjs.com/package/@fontsource/press-start-2p) — HIGH confidence
- [Node.js crypto AES-256-GCM pattern](https://nodejs.org/api/crypto.html) — HIGH confidence (built-in, no version uncertainty)
- [Paperclip GitHub README](https://github.com/paperclipai/paperclip) — MEDIUM confidence (API base URL confirmed, endpoint paths inferred)
- [OWASP Node.js Crypto Best Practices](https://www.nodejs-security.com/blog/owasp-nodejs-authentication-authorization-cryptography-practices) — HIGH confidence
- [Webhook HMAC-SHA256 best practices](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) — HIGH confidence
- Codebase review: `services/execution-service/package.json`, `services/tool-gateway/package.json`, `services/ui/package.json`, `tasks/prd-akasa-mvp.md`, `tasks/akasa-design-guide.md` — HIGH confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
