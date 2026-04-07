# AGENTS.md — Akasa (claw-army)

> Read this first. Whether you are a human or an AI agent, this is the entry point.

## What this app does

Akasa lets anyone deploy fleets of AI agents against a named objective. Agents evolve — a three-judge Council evaluates every run, promotes or retires agents based on performance, and captures winning behavioral DNA into a versioned library. The DNA library is the compounding moat: it cannot be replicated without the run history.

Built on [Paperclip](https://github.com/paperclipai/paperclip) (git submodule), which handles agent orchestration, 7 LLM adapters, and a plugin SDK. Akasa owns everything else: evolution engine, Tool Nexus, billing, and the consumer UI.

Monetization is pure token arbitrage — provider cost + 20% markup. No subscriptions, no tiers.

## Repo layout

```
packages/
  db/                Drizzle ORM schema + migrations (PostgreSQL + pgvector)
  shared-types/      Pure TS types (no runtime deps)
  event-schemas/     Zod v4 schemas for events
  tool-contracts/    Zod v4 schemas for tool gateway

services/
  akasa-server/      Express extension: evolution routes, Tool Nexus, OAuth, webhooks
  ui/                SvelteKit v2 + Svelte 5 (two-world design system)
  execution-service/ Fastify v5: bot lifecycle, BullMQ dispatch, Council, God Layer
  tool-gateway/      HTTP proxy for agent tool invocation
  telegram-bot/      Telegram bridge (Command Channel)
  stub-bot/          Dev/test worker

paperclip/           Git submodule — never fork, pull updates, pin commits
docs/                Architecture, domain model, conventions, ADRs, runbooks
tasks/               PRDs and design guides
```

## Commands

```bash
# First time
git clone --recurse-submodules <repo-url> && cd claw-army && pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate && pnpm --filter @claw/db seed:archetypes

# Daily
pnpm dev                                      # Starts Express (3100) + SvelteKit (5173)

# Tests
pnpm --filter @claw/execution-service exec vitest run
pnpm --filter @claw/akasa-server exec vitest run

# Submodule
git submodule update --init --recursive       # After clone or branch switch
```

## Architectural boundaries

These are load-bearing walls. Do not move them without an ADR.

| Boundary | Rule |
|----------|------|
| **Akasa vs Paperclip** | Paperclip is a submodule dependency. Akasa never forks it. All product logic lives in claw-army. |
| **Bot isolation** | Bots have zero network access except through Tool Gateway. No credentials, no persistent filesystem. Non-negotiable. |
| **Council integrity** | Devil's Advocate must always use a different LLM provider family than Performance Judge. |
| **Promote/Retire** | These verdicts always require human confirmation before God Layer executes. |
| **UI → Backend** | SvelteKit `/api/[...path]` proxies to Express. Browser never talks directly to backend. |
| **Credentials** | All secrets encrypted with AES-256-GCM via `node:crypto`. No external crypto packages. |
| **Two worlds** | Front Office (`--fo-*`) and Back Office (`--bo-*`) CSS tokens. `body.back-office` toggles. No Tailwind. |
| **Single DB** | Paperclip and Akasa share one PostgreSQL instance. Separate migration journals. |

## Coding conventions

**TypeScript:** ESM everywhere. `node:` prefix for builtins. `strict: true`, `noUncheckedIndexedAccess: true`. Named exports only — never `export default`.

**Types:** String unions, not enums. `interface` for entities. `Omit<>` for input types. DB types inferred from Drizzle.

**Files:** `kebab-case.ts` for TypeScript, `PascalCase.svelte` for components.

**Svelte 5:** Runes only — `$props()`, `$state()`, `$derived()`, `$effect()`. Use `$derived.by()` for computed values (especially d3 layouts). No global state library.

**Styling:** Pure CSS with scoped `<style>` blocks. `--fo-*` / `--bo-*` custom properties. No Tailwind, no CSS modules, no component library.

**Errors:** Plain `Error`, no custom classes. `Promise.allSettled` for parallel ops. Fire-and-forget `.catch()` for non-critical side effects.

**Imports:** Node builtins → external packages → `@claw/*` workspace → relative.

Full reference: [docs/conventions.md](docs/conventions.md)

## Testing rules

- Tests live in `src/__tests__/` and `src/services/__tests__/`
- Framework: Vitest
- Run before committing: `pnpm --filter @claw/akasa-server exec vitest run`
- E2E tests require running services
- Council evaluation tests must verify heterogeneous provider constraint

## How to make changes safely

1. **Read before writing.** Understand the file you're modifying. Check the schema if touching DB queries. Check the design guide if touching UI.

2. **One concern per commit.** Conventional commit format: `feat(scope):`, `fix(scope):`, `docs(scope):`.

3. **Migrations are append-only.** Never edit an existing migration file. New migration for every schema change. All migrations must be idempotent (`IF NOT EXISTS`).

4. **Submodule pin is intentional.** Don't advance the Paperclip submodule without testing the full stack.

5. **Logical FKs are intentional.** Several tables use logical foreign keys (no SQL `REFERENCES`) to avoid circular TypeScript inference. This is a deliberate pattern, not a bug.

6. **Two-world tokens are strict.** Violet = coordination. Amber = karma. Teal = execution. Rose = contractors/tools. No arbitrary hex values. No `#000000` (use `#06050E`).

7. **Product naming matters.** "Karma" not "score". Agents "work" not "run". "Sanctum" not "dashboard". See the full list in [docs/conventions.md](docs/conventions.md).

## Do not touch without approval

| Area | Why |
|------|-----|
| `packages/db/src/schema/` | Schema changes cascade everywhere. Requires migration + type updates. |
| `packages/db/migrations/` | Append-only. Editing existing migrations breaks deployed environments. |
| `infra/` | Terraform state is shared. Bad applies are hard to reverse. |
| `services/akasa-server/src/services/credential-encryption.ts` | Security-critical encryption path. |
| `services/akasa-server/src/services/token-manager.ts` | OAuth token lifecycle. |
| `services/ui/src/app.css` | Design system token definitions. Changes ripple across every component. |
| `paperclip/` | Submodule pin. Advancing without testing breaks the stack. |
| Council judge weights (0.5/0.3/0.2) | Tuned through evaluation. Changing alters all future verdicts. |
| `.env` / credentials | Never commit. Never log. Never pass as CLI args. |

## Further reading

| Doc | What it covers |
|-----|---------------|
| [docs/architecture.md](docs/architecture.md) | System diagram, data flows, infrastructure |
| [docs/domain-model.md](docs/domain-model.md) | All entities, relationships, evolution flow |
| [docs/conventions.md](docs/conventions.md) | Full coding standards and design tokens |
| [docs/adr/](docs/adr/) | Architecture Decision Records (4 so far) |
| [docs/runbooks/](docs/runbooks/) | Local dev setup, deployment |
| [CLAUDE.md](CLAUDE.md) | AI assistant instructions (superset of this doc) |
| [tasks/prd-akasa-mvp.md](tasks/prd-akasa-mvp.md) | Product requirements |
| [tasks/akasa-design-guide.md](tasks/akasa-design-guide.md) | Visual language reference |
