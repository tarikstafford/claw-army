# CLAUDE.md — claw-army (Akasa)

## What is this project?

**Akasa** is a D2C platform where anyone can acquire, deploy, and evolve AI agents to create compounding value. Everything lives in this single repository (`claw-army`).

**Core thesis:** Value creation is a war of attrition — the number of agents you operate (bit rate) and how good they are at their task (effective bit rate) determines your output.

**Core loop:** Build team -> Set goals -> Interact via Chat -> Indra surfaces improvements. Evolution is background infrastructure — users never need to think about it directly.

**What this repo owns:** Everything — the evolution engine (soul system, council, god layer), skill system, Tool Nexus, Chat (Command Channel), billing, the consumer UI, and all database tables (previously split across Paperclip).

**Key documents:**
- `tasks/prd-akasa-mvp.md` — Complete product requirements document
- `tasks/akasa-design-guide-v2.md` — Visual language reference (Front Office + Back Office modes, typography, components)
- `tasks/akasa-onboarding.md` — Onboarding flow PRD (Start Mode vs Connect Mode, team proposal, Indra brief)
- `tasks/akasa-vision.html` — Interactive visual for team presentations

## Monorepo structure

```
packages/
  db/              — Drizzle ORM schema, migrations, seeds (PostgreSQL + pgvector)
  shared-types/    — Pure TS types mirroring DB schema (no runtime deps)
  event-schemas/   — Zod v4 schemas for all SSE/Pub/Sub events
  tool-contracts/  — Zod v4 schemas for tool gateway request/response contracts

services/
  akasa-server/       — Express backend: evolution routes, Tool Nexus, OAuth, webhooks, skills
  execution-service/  — Fastify v5 backend: bot lifecycle, task dispatch, Council, God Layer, evolution engine
  tool-gateway/       — Fastify v5 HTTP proxy + Tool Nexus (generalized tool invocation gateway)
  stub-bot/           — BullMQ worker that simulates a bot (dev/testing only)
  ui/                 — SvelteKit v2 + Svelte 5 frontend (Akasa consumer UI)

scripts/           — One-off utility scripts
infra/             — Terraform, Docker configs
tasks/             — PRDs and product planning docs
docs/              — Architecture, domain model, conventions, ADRs, runbooks
```

## Single-repo architecture

All code lives in `claw-army`. Paperclip was previously a separate repo consumed as a git submodule — it has been fully absorbed. All Paperclip tables (companies, company_memberships, paperclip_agents, heartbeat_runs, chat_threads, chat_messages, projects, issues, instance_user_roles) have been migrated into `@claw/db`. There are no `@paperclipai/*` imports anywhere in the codebase.

| Component | Hosting |
|-----------|---------|
| Akasa backend (execution-service, akasa-server) | Railway |
| SvelteKit UI | Railway |
| Tool gateway | Railway |
| PostgreSQL + pgvector | GCP Cloud SQL |
| Bot VMs | GCP Compute Engine |

## Monetization

Pure token arbitrage: users set a daily budget, agents consume LLM tokens, Akasa charges provider cost + 20% markup via Stripe metered billing. No subscriptions, no tiers, no feature gates.

## Key architecture decisions

- **Bot execution**: GCE VMs with OpenClaw (not Docker containers)
- **Task dispatch**: BullMQ (Redis) with concurrency=20
- **Events**: GCP Pub/Sub for inter-service events, SSE for real-time UI
- **UI -> backend**: SvelteKit `/api/[...path]` reverse proxy to execution-service (browser never talks directly to backend)
- **Bot -> internet**: All bot egress routes through tool-gateway via `HTTP_PROXY` (CONNECT tunneling + HTTP forward proxy)
- **Logical FKs**: Several tables use logical foreign keys (no `references()`) to avoid circular TypeScript inference at module load time — this is intentional, not a bug

## Navigation

4 primary tabs:
- **Home** — Dashboard and fleet overview
- **Team** (`/team`) — Agent management, profiles, evolution status
- **Chat** — Interact with Indra and agents via Command Channel
- **Settings** — Profile, billing (`/settings/billing`), tool connections (`/settings/tools`)

Old routes (`/office`, `/sanctum`, `/evolution`, `/akashic`, `/skills`) still exist in the codebase but are not in the primary navigation.

## Domain glossary

| Term | Meaning |
|------|---------|
| **Execution** | A run of an objective — spawns bots, dispatches tasks, collects results |
| **Objective** | Reusable execution template with default config |
| **Goal** | Explicit measurable target set by the user — Indra tracks progress and surfaces improvements |
| **Bot** | An AI agent running on a GCE VM with OpenClaw |
| **Soul / SOUL.md** | Personality document (system prompt) that defines a bot's behavior |
| **Archetype** | One of 6 canonical seed souls (Cautious Verifier, Aggressive Executor, etc.) |
| **Dimensions** | 7 behavioral axes in a soul (identityRole, decisionPriorities, toolUsageDoctrine, riskTolerance, communicationStyle, recoveryBehavior, ethicalHardStops) |
| **Council** | 3 LLM judges (Performance Judge, Soul Analyst, Devil's Advocate) that evaluate bot performance |
| **Verdict** | Council output: Promote / Maintain / Monitor / Demote / Retire |
| **God Layer** | Post-council pipeline that executes class transitions, writes DNA, handles negative signals |
| **Agent Class** | Bot progression: Novice -> Understudy -> Artisan -> Retired |
| **DNA Store** | Captured behavioral patterns from high-performing bots per task category |
| **Ring Leader** | Orchestrator agent that plans task graphs, selects souls, coordinates execution |
| **Pre-flight** | Execution state where Ring Leader builds its mission brief before spawning bots |
| **Pioneer** | First bot to achieve a category benchmark — triggers soul lifecycle events |
| **Skill** | Composable procedural knowledge unit (SKILL.md) — what an agent knows how to do |
| **Skill Loadout** | Set of skills equipped on an agent, capacity scales with class (3/5/8) |
| **Tool Nexus** | Unified gateway for external tool invocations (HubSpot, Slack, Stripe, etc.) |
| **Command Channel** | Chat-first interface for talking to Indra and the fleet |
| **Akashic Library** | Marketplace for pre-evolved agent souls (Artisan-only publishing) |
| **Skill Bazaar** | Marketplace for proven procedural knowledge (skills) |
| **Karpathy Loop** | Autonomous feedback engine: mutate -> execute -> evaluate -> keep/discard -> capture DNA -> repeat |
| **Bit Rate** | Number of agents in a fleet |
| **Effective Bit Rate** | Agent count x average composite fitness score = actual output capacity |
| **Indra** | The CEO agent — Chief of Staff, always Opus tier, orchestrates the fleet. The narrative thread of the product — users interact primarily through Indra |
| **Start Mode** | Onboarding path for users with an idea but no tools (0->1) |
| **Connect Mode** | Onboarding path for users with a live business and existing tools (1->N) |
| **Karma** | Compounding IP moat — represents accumulated agent evolution and learning. Always amber |
| **Front Office** | The operational UI surface (chat, team, dashboard). Warm cream/plum/gold palette |
| **Back Office** | The system/technical UI surface (architecture, karma mechanics, integrations). Dark violet/amber palette |

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

## Backend specifics (execution-service + akasa-server + tool-gateway)

- **execution-service**: Fastify v5 with `@fastify/type-provider-typebox` for typed routes
- **akasa-server**: Express.js, mounted at `/api/akasa/` — evolution routes, Tool Nexus, OAuth, webhooks, skills
- **Route schemas**: TypeBox (`@sinclair/typebox`) for request/response validation (execution-service)
- **Database**: Drizzle ORM with `node-postgres` driver
- **Queue**: BullMQ with Redis
- **Auth**: JWT tokens (execution-service validates via `AUTH_SECRET`; tool-gateway via `BOT_JWT_SECRET`)

## Frontend specifics (ui)

- **Framework**: SvelteKit v2 with Svelte 5 runes
- **Runes syntax**: `$props()`, `$state()`, `$derived()`, `$effect()`, `{@render children()}`
- **Styling**: Pure CSS with custom properties, scoped `<style>` blocks — no Tailwind, no CSS modules, no component library
- **One warm theme**: Unified warm palette (cream/plum/gold). No more two-world Screenplay/Director's Cut toggle. The Back Office dark mode exists for technical/system views but is not a primary user experience
- **Fonts**: Cormorant Garamond (display/headlines), DM Sans (body/UI), Press Start 2P (labels/tags at 6-8px only)
- **Design guide**: `tasks/akasa-design-guide-v2.md` — the authoritative reference for all visual decisions
- **Auth**: `@auth/sveltekit` with Google OAuth
- **API calls**: `lib/api.ts` (`apiFetch` wrapper) -> `/api/...` proxy -> execution-service
- **Real-time**: `lib/sse.ts` with three EventSource streams (execution events, bot logs, lifecycle)
- **No global state library** — local `$state()` + SvelteKit load functions

## Database

- **ORM**: Drizzle with PostgreSQL
- **Schema files**: `packages/db/src/schema/*.ts` — one file per table
- **Migrations**: `packages/db/migrations/` — SQL files generated by Drizzle Kit
- **pgvector**: Required for soul embedding similarity search (`vector(1536)` column on `bot_souls`)
- **Seeds**: `packages/db/src/seed/archetypes.ts` — 6 canonical soul archetypes (idempotent)
- **Migrated tables**: companies, company_memberships, paperclip_agents, heartbeat_runs, chat_threads, chat_messages, projects, issues, instance_user_roles (all formerly in Paperclip, now in `@claw/db`)

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
- **Migrations 0008-0010** may not be in `_journal.json` — apply manually via psql if DB is behind (they're idempotent with `IF NOT EXISTS`)
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
- Akasa backend (execution-service, akasa-server)
- Tool gateway
- SvelteKit UI
- Railway connects to Cloud SQL via public IP + SSL

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Claw Bot Army**

Akasa is a platform that lets SMEs and individuals deploy fleets of AI bot workers against named goals. Users build a team of agents, set measurable goals, and interact primarily through Chat with Indra (the CEO agent). The system's Ring Leader decomposes objectives into task graphs, selects souls from the library, spawns agents into GCE VMs, and coordinates them in real time. Evolution runs in the background — the Council evaluates agent performance, the God Layer executes class transitions, and the DNA library captures high-performing behavioral patterns. Users see the results through Indra's narrative updates, not through raw evolution dashboards.

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
| Backend framework (execution-service) | Fastify v5 + TypeBox | ^5.7.4 |
| Backend framework (akasa-server) | Express.js | - |
| Frontend | SvelteKit v2 + Svelte 5 runes | ^2.52.0 / ^5.51.3 |
| ORM | Drizzle ORM + node-postgres | ^0.45.1 |
| Database | PostgreSQL + pgvector | Cloud SQL at 10.101.0.3 |
| Queue | BullMQ + IORedis | ^5.69.3 / ^5.9.3 |
| LLM routing | Vercel AI SDK | ai ^6.0.90 |
| Events | GCP Pub/Sub + SSE | @google-cloud/pubsub ^5.2.3 |
| Auth | Auth.js v5 (@auth/sveltekit) | ^1.11.1 |
| Embeddings | text-embedding-3-small via @ai-sdk/openai | ^3.0.29 |
| Token auth | jose (JWE/JWT) | ^6.1.3 |

## What NOT to Add
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Tailwind CSS | Conflicts with existing pure CSS token system; requires migration | Pure CSS custom properties |
| Google Fonts CDN | External DNS, GDPR exposure, 300ms latency penalty | `@fontsource/*` packages |
| External encryption packages (`aes-encryption`, etc.) | Supply chain risk for security-critical path | `node:crypto` built-in |
| LangChain / LangGraph | Not needed for Council (existing generateObject() pattern) | Existing Vercel AI SDK |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Comprehensive system architecture documented in `docs/architecture.md`. Includes:
- Full system topology diagrams
- Service-by-service route and module reference
- Database schema relationships
- Security architecture (bot isolation, Tool Gateway)
- Evolution engine flow (Karpathy Loop)
- Infrastructure reference (GCP + Railway)

Key architecture decisions:
- **Bot execution**: GCE VMs with OpenClaw (not Docker containers)
- **Task dispatch**: BullMQ (Redis) with concurrency=20
- **Events**: GCP Pub/Sub for inter-service events, SSE for real-time UI
- **UI -> backend**: SvelteKit `/api/[...path]` reverse proxy to execution-service (browser never talks directly to backend)
- **Bot -> internet**: All bot egress routes through tool-gateway via `HTTP_PROXY` (CONNECT tunneling + HTTP forward proxy)
- **Logical FKs**: Several tables use logical foreign keys (no `references()`) to avoid circular TypeScript inference at module load time — this is intentional, not a bug
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
