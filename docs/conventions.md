# Coding Conventions — Akasa

> Standards and patterns enforced across the codebase.

## TypeScript

### Module System
- **ESM everywhere** — `"type": "module"` in all package.json files
- **`node:` prefix** for all Node.js builtins (`node:crypto`, `node:net`, `node:http`)
- **Strict mode** — `strict: true`, `noUncheckedIndexedAccess: true`
- **`@claw/source` custom condition** — workspace packages resolve to `./src/index.ts` in dev (no build step)

### Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Files (TS) | `kebab-case.ts` | `soul-generator.ts` |
| Files (Svelte) | `PascalCase.svelte` | `IdentityCard.svelte` |
| Variables/functions | `camelCase` | `compositeScore` |
| Types/interfaces | `PascalCase` | `CouncilVerdict` |
| Constants | `SCREAMING_SNAKE_CASE` | `BOT_STATUSES` |
| DB tables | `snake_case` | `bot_souls` |

### Exports
- **Named exports only** — never `export default`
- **`export function` declarations** for public module exports
- **`import type`** for type-only imports; inline `type` keyword when mixing values and types
- **Barrel exports** — every package has `src/index.ts` that re-exports with `export *`

### Import Order
1. Node builtins (`node:*`)
2. External packages
3. Workspace packages (`@claw/*`)
4. Relative imports

### Types
- **Enums as string unions** — never use the `enum` keyword
  ```typescript
  type BotStatus = 'spawning' | 'idle' | 'working' | 'stopping' | 'stopped' | 'failed';
  const BOT_STATUSES = ['spawning', 'idle', 'working', 'stopping', 'stopped', 'failed'] as const;
  ```
- **Domain entities as `interface`** — `interface Bot { ... }`
- **Input types as `Omit<>`** — `type NewBot = Omit<Bot, 'id' | 'createdAt'>`
- **DB row types from Drizzle** — `type Bot = typeof bots.$inferSelect`

### Functions
- **Arrow functions** for inline callbacks and Fastify route handlers
- **`async/await` everywhere** — no `.then()` chains
- **`Promise.allSettled`** for parallel ops where individual failures shouldn't block

### Error Handling
- No custom error classes — use plain `Error` with descriptive messages
- **Try/catch** with structured logging: `(err as Error).message`
- **Fire-and-forget `.catch()`** for non-critical side effects
- **Fail-open** for Redis operations — log and allow through
- **Fastify routes**: `reply.code(404).send({ error: 'Bot not found' })`

## Frontend (SvelteKit + Svelte 5)

### Runes
- `$props()`, `$state()`, `$derived()`, `$effect()`, `{@render children()}`
- Use `$derived.by()` for computed values that need function bodies (e.g., d3 layouts)
- Never use `$effect()` for layout computations — use `$derived.by()` instead

### Styling
- **Pure CSS** with custom properties, scoped `<style>` blocks
- **No Tailwind**, no CSS modules, no component library
- Two worlds: Front Office (`--fo-*`) and Back Office (`--bo-*`)
- `body.back-office` class switches worlds; Front Office is default

### Fonts
- **Cormorant Garamond** — display/headlines (16px minimum)
- **DM Sans** — body/UI text (default)
- **Press Start 2P** — labels/tags only (6-8px, never larger except MetricTile 20px exception)

### Data Fetching
- `lib/api.ts` (`apiFetch` wrapper) → `/api/...` proxy → backend
- **No global state library** — local `$state()` + SvelteKit load functions
- Real-time via SSE/WebSocket stores

## Backend (Fastify v5)

### Route Schemas
- TypeBox (`@sinclair/typebox`) for request/response validation
- Type provider: `@fastify/type-provider-typebox`

### Database
- Drizzle ORM with `node-postgres` driver
- Schema files: `packages/db/src/schema/*.ts` (one file per table)
- Migrations: `packages/db/migrations/` (SQL files from Drizzle Kit)

### Logging
- Route handlers: Fastify's Pino logger (`fastify.log.info/error/warn`)
- Application logic: `console.log/error/warn` with `[module-name]` prefix
  ```typescript
  console.error('[bot-orchestrator] Failed to launch VM:', { botId, error: (err as Error).message });
  ```

## Git

### Commit Messages
Follow conventional commits:
```
type(scope): description

feat(evolution): add soul dimension radar chart
fix(ui): correct badge color in Back Office mode
docs(phase-13): complete phase execution
```

### Branch Naming
```
feat/description
fix/description
docs/description
```

## Design System Tokens

### Front Office (Screenplay)
Light/warm palette: cream, plum, gold. Default world (no body class needed).
Token prefix: `--fo-*`

### Back Office (Director's Cut)
Dark palette: near-black (#06050E), violet, amber, teal, rose. Evolution and technical views.
Token prefix: `--bo-*`
Activated via `body.back-office` class.

### Semantic Colors
- **Violet** — coordination, evolution
- **Amber** — karma, compounding value
- **Teal** — execution, active work
- **Rose** — contractors, tools, external

### Product Naming
| Use | Don't Use |
|-----|-----------|
| Sanctum | Dashboard |
| The Chronicle | Audit trail |
| The Record | Soul storage |
| Karma | Score |
| work | run |
