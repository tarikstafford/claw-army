# Akasa

Akasa is a D2C platform where anyone can acquire, deploy, and evolve AI agents to create compounding value. Users deploy fleets of AI bots against named objectives, and the evolutionary learning engine compounds agent intelligence through council-evaluated mutation and a versioned DNA library.

Built on top of [Paperclip](https://github.com/paperclipai/paperclip), an open-source AI orchestration platform.

## Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm 10+, Docker

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

# Run migrations
pnpm db:migrate

# Seed archetypes (required before any execution)
pnpm --filter @claw/db seed:archetypes

# Start all services
pnpm dev
```

This starts the Paperclip Express backend (port 3100) and SvelteKit frontend (port 5173).

## Repository Structure

```
packages/
  db/              Drizzle ORM schema, migrations, seeds (PostgreSQL + pgvector)
  shared-types/    Pure TS types mirroring DB schema (no runtime deps)
  event-schemas/   Zod v4 schemas for SSE/Pub/Sub events
  tool-contracts/  Zod v4 schemas for tool gateway contracts

services/
  akasa-server/    Fastify v5: evolution routes, Tool Nexus, OAuth, webhooks
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

See [docs/architecture.md](docs/architecture.md) for the full system architecture.

**Two-repo model:**

| Repo | Role |
|------|------|
| `claw-army` (this repo) | Akasa product: evolution engine, Tool Nexus, billing, UI |
| `claw-paper-clip` (submodule) | Paperclip: agent orchestration, 7 adapters, plugin SDK |

Akasa's backend calls Paperclip's Express API. All product logic lives here. Paperclip is an upstream dependency — never fork it.

## Key Concepts

| Term | Meaning |
|------|---------|
| **Execution** | A run of an objective — spawns bots, dispatches tasks, collects results |
| **Bot** | An AI agent running on a GCE VM |
| **Soul / SOUL.md** | Behavioral constitution (system prompt) with 7 dimensions |
| **Council** | 3 LLM judges that evaluate agent performance |
| **God Layer** | Post-council pipeline: class transitions, DNA writes, mutation prep |
| **Agent Class** | Novice → Understudy → Artisan → Retired |
| **DNA Store** | Captured behavioral patterns from high-performing agents |
| **Ring Leader** | Orchestrator that plans task graphs and coordinates execution |
| **Karma** | Compounding IP moat from accumulated evolution |

See [AGENTS.md](AGENTS.md) for the full agent reference and [docs/domain-model.md](docs/domain-model.md) for the domain model.

## Monetization

Pure token arbitrage: users set a daily budget, agents consume LLM tokens, Akasa charges provider cost + 20% markup via Stripe metered billing. No subscriptions, no tiers, no feature gates.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify v5 + TypeBox, Paperclip Express |
| Frontend | SvelteKit v2 + Svelte 5 runes |
| ORM | Drizzle ORM + node-postgres |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + IORedis |
| LLM routing | Vercel AI SDK |
| Events | GCP Pub/Sub + SSE |
| Auth | BetterAuth (Google OAuth) |
| Infra | Railway (app services) + GCP (database, bot VMs) |

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Agent roles, classes, evaluation system |
| [CLAUDE.md](CLAUDE.md) | AI coding assistant instructions |
| [docs/architecture.md](docs/architecture.md) | System architecture and data flows |
| [docs/domain-model.md](docs/domain-model.md) | Domain entities and relationships |
| [docs/conventions.md](docs/conventions.md) | Coding conventions and standards |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
| [docs/runbooks/](docs/runbooks/) | Operational runbooks |

## Contributing

1. Create a feature branch from `main`
2. Follow the conventions in [docs/conventions.md](docs/conventions.md)
3. Use the PR template when opening a pull request
4. All PRs require review before merging

## License

Proprietary. All rights reserved.
