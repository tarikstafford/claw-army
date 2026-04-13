# Akasa

Akasa is a D2C platform where anyone can acquire, deploy, and evolve AI agents to create compounding value.

Users deploy fleets of AI bots against named objectives. The evolutionary learning engine compounds agent intelligence through council-evaluated mutation and a versioned DNA library -- the more you run, the smarter your agents get.

Built on top of [Paperclip](https://github.com/paperclipai/paperclip), an open-source AI orchestration platform.

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 10+, Docker

# Clone with submodule
git clone --recurse-submodules https://github.com/tarikstafford/claw-army.git
cd claw-army

# Install dependencies
pnpm install

# Start infrastructure (Postgres, Redis, PubSub emulator)
docker compose -f docker-compose.dev.yml up -d

# Install pgvector (first time only)
docker exec postgres-db-1 apt-get install -y postgresql-17-pgvector
docker exec postgres-db-1 psql -U postgres -d clawdb -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Run migrations and seed data
pnpm db:migrate
pnpm --filter @claw/db seed:archetypes

# Start all services
pnpm dev
```

This starts the Akasa backend and SvelteKit frontend (port 5173).

> **Note:** pnpm 10.x does not pass inline env vars to child processes. Each service uses `.npmrc` with `node-options=--conditions=@claw/source` to resolve workspace packages to source in dev.

See [docs/runbooks/local-dev.md](docs/runbooks/local-dev.md) for the full local development guide.

## Repository Structure

```
packages/
  db/              Drizzle ORM schema, migrations, seeds (PostgreSQL + pgvector)
  shared-types/    Pure TS types mirroring DB schema (no runtime deps)
  event-schemas/   Zod v4 schemas for SSE/Pub/Sub events
  tool-contracts/  Zod v4 schemas for tool gateway contracts

services/
  akasa-server/    Fastify v5: evolution routes, Tool Nexus, OAuth, webhooks
  execution-service/  Fastify v5: bot lifecycle, task dispatch, Council, God Layer
  ui/              SvelteKit v2 + Svelte 5: consumer UI (two-world design system)
  tool-gateway/    HTTP proxy + Tool Nexus invocation gateway
  telegram-bot/    Telegram <> Paperclip bridge (Command Channel)
  stub-bot/        BullMQ worker for dev/testing

paperclip/         Git submodule: agent orchestration, adapters, plugin SDK

scripts/           Utility scripts
infra/             Terraform, Docker configs
tasks/             PRDs and product planning
docs/              Architecture, domain model, conventions, ADRs, runbooks
```

## Architecture

**Two-repo model:**

| Repo | Role | Hosting |
|------|------|---------|
| `claw-army` (this repo) | Akasa product: evolution engine, skills, Tool Nexus, billing, UI | Railway (app) + GCP (database, bot VMs) |
| `claw-paper-clip` (submodule) | Paperclip: agent orchestration, 7 runtime adapters, plugin SDK | Railway |

Akasa's backend calls Paperclip's API. All product logic lives here. Paperclip is an upstream dependency -- never fork it.

**Key decisions:**
- Bot execution on GCE VMs with OpenClaw (not containers)
- Task dispatch via BullMQ (Redis) with concurrency=20
- GCP Pub/Sub for inter-service events, SSE for real-time UI updates
- SvelteKit reverse proxy (`/api/...`) so the browser never talks directly to the backend
- All bot egress routes through Tool Gateway (`HTTP_PROXY`)

See [docs/architecture.md](docs/architecture.md) for the full system architecture and data flows.

## Services

| Service | Description |
|---------|-------------|
| **akasa-server** | Evolution routes, Tool Nexus management, OAuth connections, webhook receiver |
| **execution-service** | Bot lifecycle management, task dispatch, Council evaluation, God Layer transitions |
| **ui** | SvelteKit consumer UI with two visual worlds (Screenplay light + Director's Cut dark) |
| **tool-gateway** | HTTP forward proxy and Tool Nexus invocation gateway for bot internet access |
| **telegram-bot** | Telegram bridge for the Command Channel (chat-first fleet management) |
| **stub-bot** | BullMQ worker that simulates bot behavior for development and testing |

## Key Concepts

| Term | Meaning |
|------|---------|
| **Execution** | A run of an objective -- spawns bots, dispatches tasks, collects results |
| **Bot** | An AI agent running on a GCE VM with OpenClaw |
| **Soul / SOUL.md** | Behavioral constitution (system prompt) with 7 personality dimensions |
| **Archetype** | One of 6 canonical seed souls (Cautious Verifier, Aggressive Executor, etc.) |
| **Council** | 3 LLM judges (Performance Judge, Soul Analyst, Devil's Advocate) that evaluate agents |
| **God Layer** | Post-council pipeline: class transitions, DNA capture, mutation prep |
| **Agent Class** | Progression tiers: Novice -> Understudy -> Artisan -> Retired |
| **DNA Store** | Captured behavioral patterns from high-performing agents per task category |
| **Skill** | Composable procedural knowledge unit (SKILL.md) equipped on agents |
| **Karpathy Loop** | Autonomous feedback engine: mutate -> execute -> evaluate -> keep/discard -> capture DNA -> repeat |
| **Ring Leader** | Orchestrator agent that plans task graphs and coordinates execution |
| **Indra** | The CEO agent -- Chief of Staff that orchestrates the fleet |
| **Tool Nexus** | Unified gateway for external tool invocations (HubSpot, Slack, Stripe, etc.) |
| **Karma** | Compounding IP moat from accumulated agent evolution and learning |

See [AGENTS.md](AGENTS.md) for agent roles and evaluation, and [docs/domain-model.md](docs/domain-model.md) for the full domain model.

## Monetization

Pure token arbitrage: users set a daily budget, agents consume LLM tokens, Akasa charges provider cost + 20% markup via Stripe metered billing. No subscriptions, no tiers, no feature gates.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify v5 + TypeBox |
| Frontend | SvelteKit v2 + Svelte 5 runes |
| ORM | Drizzle ORM + node-postgres |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + IORedis |
| LLM routing | Vercel AI SDK |
| Events | GCP Pub/Sub + SSE |
| Auth | BetterAuth (Google OAuth) |
| Infra | Railway (app services) + GCP (database, bot VMs) |

## Testing

```bash
# Run unit tests (Vitest)
pnpm --filter @claw/execution-service exec vitest run
```

Tests are in `src/__tests__/` and `src/services/__tests__/`. E2E tests require running services.

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Agent roles, classes, evaluation system |
| [CLAUDE.md](CLAUDE.md) | AI coding assistant context and conventions |
| [docs/architecture.md](docs/architecture.md) | System architecture and data flows |
| [docs/domain-model.md](docs/domain-model.md) | Domain entities and relationships |
| [docs/conventions.md](docs/conventions.md) | Coding conventions and standards |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
| [docs/runbooks/](docs/runbooks/) | Operational runbooks |

## Contributing

1. Create a feature branch from `main`
2. Follow the conventions in [docs/conventions.md](docs/conventions.md) and [CLAUDE.md](CLAUDE.md)
3. Run tests before opening a PR
4. All PRs require review before merging

## License

Proprietary. All rights reserved.
