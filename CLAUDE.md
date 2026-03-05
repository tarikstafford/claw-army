# CLAUDE.md — claw-army

## What is this project?

Claw Army is an AI bot orchestration platform. It spawns fleets of AI agent bots on GCE VMs, each running OpenClaw (an AI gateway), to execute objectives in parallel. Bots have "souls" (personality documents) that evolve through a genetic algorithm — a Council evaluates performance, a God Layer promotes/demotes/retires bots, and top-performing behavioral DNA is captured for future runs.

## Monorepo structure

```
packages/
  db/              — Drizzle ORM schema, migrations, seeds (PostgreSQL + pgvector)
  shared-types/    — Pure TS types mirroring DB schema (no runtime deps)
  event-schemas/   — Zod v4 schemas for all SSE/Pub/Sub events
  tool-contracts/  — Zod v4 schemas for tool gateway request/response contracts

services/
  execution-service/  — Fastify v5 backend: bot lifecycle, task dispatch, Council, God Layer
  tool-gateway/       — Fastify v5 HTTP proxy + tool invocation gateway for bot VMs
  stub-bot/           — BullMQ worker that simulates a bot (dev/testing only)
  ui/                 — SvelteKit v2 + Svelte 5 frontend (Vercel deployment)

scripts/           — One-off utility scripts
infra/             — Terraform, Docker configs
```

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
- **Styling**: Pure CSS with custom properties (design tokens in `app.css`), scoped `<style>` blocks — no Tailwind
- **Design tokens**: `--s-1` through `--s-12` spacing scale, deep violet primary (`#7c3aed`), near-black bg (`#07060f`)
- **Fonts**: Clash Display (display), Inter (body), JetBrains Mono (mono)
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

## GCP infrastructure
- Execution service runs on `claw-app-dev` (10.0.0.3)
- Bot VMs: `e2-standard-2` Ubuntu 22.04, no external IP, on 10.0.0.0/24 subnet
- Cloud SQL at 10.101.0.3
- IAP enabled for SSH access; `allow-iap-ssh-bots` firewall rule for `claw-bot-vm` tag
