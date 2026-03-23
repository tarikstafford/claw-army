# Phase 1: Submodule Integration - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire claw-paper-clip as a git submodule inside claw-army with a unified pnpm workspace, shared Postgres database, and a single `pnpm dev` command that starts the full stack (Express backend + SvelteKit frontend). This phase delivers the foundation — no feature code, no routes, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Submodule Placement & Workspace Wiring
- **D-01:** Submodule lives at `paperclip/` (root level) — flat, simple, top-level directory
- **D-02:** pnpm workspace extended with glob `paperclip/packages/*` so Akasa can import `@paperclipai/db`, `@paperclipai/shared`, `@paperclipai/adapters` via workspace resolution
- **D-03:** Keep existing `@claw/*` package names — no rename to `@akasa/*`. Both `@claw/*` and `@paperclipai/*` coexist with different scopes

### Database Unification
- **D-04:** Single `public` Postgres schema with separate migration directories — Paperclip runs its own migrations, Akasa runs Drizzle migrations. No table prefixing; table names are already distinct
- **D-05:** Paperclip owns the database connection pool at runtime. Akasa routes receive the pool/client via Express app context or dependency injection — one connection pool, no duplication
- **D-06:** Logical foreign keys between Akasa evolution tables and Paperclip tables — plain ID columns, no `references()` constraints. Matches existing claw-army pattern and avoids migration ordering headaches

### Express Server Mounting
- **D-07:** Akasa routes mount via a plugin/extension hook — Paperclip exposes an `app.use()` extension point, Akasa registers a router. Paperclip doesn't need to know Akasa's routes
- **D-08:** Akasa routes namespaced under `/api/akasa/*` — clear brand separation from Paperclip's `/api/v1/*`. No collision risk
- **D-09:** Fastify execution-service fully replaced by Paperclip's Express as THE backend. Needed execution-service logic migrated into Akasa routes on Express. One backend process

### Dev Command Orchestration
- **D-10:** `pnpm dev` uses `pnpm --parallel --filter` to start both Express backend and SvelteKit frontend. Native pnpm, no extra dependency
- **D-11:** Docker infra (Postgres, Redis) kept separate — users run `docker compose up -d` first, then `pnpm dev`. Matches existing workflow

### Claude's Discretion
- Exact pnpm workspace glob syntax and any needed `.npmrc` adjustments for the submodule
- Migration conflict detection approach (researcher to investigate Paperclip's migration tooling)
- How Paperclip's DB pool is exposed for Akasa consumption (depends on Paperclip's internal structure)
- Whether `@claw/source` custom condition extends to Paperclip packages or stays Akasa-only

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `tasks/prd-akasa-mvp.md` — Full product requirements document, defines evolution engine, Tool Nexus, and all domain concepts
- `.planning/PROJECT.md` — v6.0 architecture decision: Path C (submodule), shared DB, one backend

### Design System (for awareness, not this phase)
- `tasks/akasa-design-guide.md` — v1 visual language reference
- `tasks/akasa-design-guide-v2.md` — v2 design guide (Front Office/Back Office worlds)

### Existing Codebase
- `pnpm-workspace.yaml` — Current workspace config (packages/*, services/*, scripts)
- `package.json` — Root package.json (minimal, two scripts)
- `packages/db/src/schema/` — All 16 Akasa Drizzle schema files
- `docker-compose.dev.yml` — Dev infrastructure config

### Paperclip (must be read after submodule is cloned)
- `paperclip/packages/` — Paperclip's internal packages (db, shared, adapters)
- `paperclip/server/` — Express server entry point and route structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pnpm-workspace.yaml` — extend with Paperclip glob, don't rewrite
- `packages/db/` — Drizzle ORM setup with `@claw/source` custom condition pattern
- `docker-compose.dev.yml` — existing Postgres + Redis config, shared with Paperclip

### Established Patterns
- `@claw/source` custom condition for dev-time TypeScript resolution without build step
- `.npmrc` with `node-options=--conditions=@claw/source` per service
- Logical FK pattern (no `references()`) for cross-table relationships
- `"type": "module"` ESM everywhere

### Integration Points
- `pnpm-workspace.yaml` — must add `paperclip/packages/*` glob
- Root `package.json` — must add `dev` script with `pnpm --parallel --filter`
- `.gitmodules` — new file for submodule config
- Database — Paperclip's migrations run alongside Akasa's Drizzle migrations

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-submodule-integration*
*Context gathered: 2026-03-23*
