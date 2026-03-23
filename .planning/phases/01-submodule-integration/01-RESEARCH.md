# Phase 1: Submodule Integration - Research

**Researched:** 2026-03-23
**Domain:** Git submodules, pnpm workspaces, Express extension points, Drizzle ORM migration coexistence
**Confidence:** HIGH

## Summary

This phase wires claw-paper-clip as a git submodule inside claw-army, spans the pnpm workspace across both repos, unifies their Postgres databases, and delivers a single `pnpm dev` command. It is entirely structural — no feature code, no UI changes.

The Paperclip repo is a live TypeScript ESM monorepo at `tarikstafford/claw-paper-clip`, currently at commit `944b35e`. It uses Express v4, Drizzle ORM with the `postgres` (Bun-style) driver, and has its own `createDb`/`applyPendingMigrations` system independent of `drizzle-kit migrate`. Akasa uses `pg` (node-postgres) and `drizzle-kit migrate`. Both use the `drizzle.__drizzle_migrations` table by default — this is the single most important conflict to resolve.

The Express extension point described in CONTEXT.md (D-07) does not yet exist in Paperclip's `createApp`. The `/api` catch-all 404 is mounted inside `createApp` before it returns, so Akasa routes cannot be added after the fact. The plan must include adding an `extraRoutes` option to Paperclip's `createApp` signature — this is a one-line patch to a file Akasa owns (its fork of claw-paper-clip).

**Primary recommendation:** Add `extraRoutes?: express.Router` parameter to `createApp` opts; mount it after the existing `/api` Router but before the 404 catch-all. This is the minimal-surface patch required.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Submodule lives at `paperclip/` (root level)
- **D-02:** pnpm workspace extended with glob `paperclip/packages/*`
- **D-03:** Keep existing `@claw/*` package names; both `@claw/*` and `@paperclipai/*` scopes coexist
- **D-04:** Single `public` Postgres schema, separate migration directories, no table prefixing
- **D-05:** Paperclip owns the DB connection pool; Akasa routes receive the pool via Express app context or DI
- **D-06:** Logical FKs between Akasa evolution tables and Paperclip tables (no `references()` constraints)
- **D-07:** Akasa routes mount via a plugin/extension hook — Paperclip exposes an `app.use()` extension point
- **D-08:** Akasa routes namespaced under `/api/akasa/*`
- **D-09:** Fastify execution-service fully replaced by Paperclip's Express; needed execution-service logic migrated into Akasa routes on Express. One backend process
- **D-10:** `pnpm dev` uses `pnpm --parallel --filter` — native pnpm, no extra dependency
- **D-11:** Docker infra kept separate — `docker compose up -d` first, then `pnpm dev`

### Claude's Discretion

- Exact pnpm workspace glob syntax and any needed `.npmrc` adjustments for the submodule
- Migration conflict detection approach (research Paperclip's migration tooling)
- How Paperclip's DB pool is exposed for Akasa consumption (depends on Paperclip's internal structure)
- Whether `@claw/source` custom condition extends to Paperclip packages or stays Akasa-only

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | claw-paper-clip added as git submodule at `paperclip/`, pinned to current commit | Git submodule mechanics verified; commit `944b35e` is HEAD on fork |
| SUB-02 | pnpm workspace spans both repos — Akasa code can import `@paperclipai/db`, `@paperclipai/shared`, `@paperclipai/adapters` | Paperclip packages confirmed: `@paperclipai/db`, `@paperclipai/shared`, `@paperclipai/adapter-*`; pnpm workspace glob pattern documented |
| SUB-03 | Shared Postgres DB — Paperclip's 55 tables + Akasa's evolution tables coexist with no migration conflicts | CRITICAL: both repos use `drizzle.__drizzle_migrations` — conflict resolution strategy documented below |
| SUB-04 | Paperclip's Express server as primary backend with Akasa evolution routes mounted alongside | CRITICAL: extension point does not yet exist in `createApp` — patch strategy documented |
| SUB-05 | Single `pnpm dev` that starts Express backend + SvelteKit frontend | `pnpm --parallel --filter` pattern documented; no extra orchestrator needed |
</phase_requirements>

## Standard Stack

### Core (Already Established — Do Not Re-Research)

| Library | Version | Purpose |
|---------|---------|---------|
| pnpm | 10.11.1 (current env) / 9.15.4 (Paperclip pinned) | Workspace + package management |
| Node.js | 22.16.0 (current env, ≥20 required by both repos) | Runtime |
| Express | 4.x (Paperclip's server) | HTTP server (primary backend) |
| Drizzle ORM | `^0.45.1` (Akasa) / `^0.38.4` (Paperclip) | ORM — version drift noted |
| TypeScript | 5.7.x | Both repos use `^5.7.x` |

### pnpm Workspace Extension

**Current `pnpm-workspace.yaml`:**
```yaml
packages:
  - 'packages/*'
  - 'services/*'
  - 'scripts'
```

**Target `pnpm-workspace.yaml`:**
```yaml
packages:
  - 'packages/*'
  - 'services/*'
  - 'scripts'
  - 'paperclip/packages/*'
  - 'paperclip/packages/adapters/*'
  - 'paperclip/packages/plugins/*'
  - 'paperclip/server'
```

The additional Paperclip sub-globs (`adapters/*`, `plugins/*`) are required because Paperclip's own `pnpm-workspace.yaml` uses them and without them the adapter/plugin packages won't be discovered as workspace members.

**Installation:**
```bash
git submodule add https://github.com/tarikstafford/claw-paper-clip.git paperclip
git submodule update --init --recursive
pnpm install
```

## Architecture Patterns

### Pattern 1: Git Submodule Pinning

**What:** Register Paperclip as a submodule at `paperclip/` and pin to the current HEAD commit.

**When to use:** This is SUB-01. Done once; updated manually when Paperclip changes are needed.

```bash
# Initial setup (run from claw-army root)
git submodule add https://github.com/tarikstafford/claw-paper-clip.git paperclip
# This pins to HEAD of default branch
# .gitmodules is created; submodule commit is recorded in the index

# Developer onboarding (after cloning claw-army)
git submodule update --init --recursive
```

**`.gitmodules` file that will be created:**
```ini
[submodule "paperclip"]
	path = paperclip
	url = https://github.com/tarikstafford/claw-paper-clip.git
```

### Pattern 2: `@claw/source` Condition for Akasa Packages Only

**What:** The `@claw/source` custom condition resolves Akasa workspace packages to `./src/index.ts` at dev time. This condition must NOT apply to Paperclip packages (they don't define it in their exports map).

**Recommendation:** Keep `@claw/source` condition in Akasa service `.npmrc` files only. Paperclip packages use standard `exports` with `"."` mapped to `"./src/index.ts"` directly in their package.json — pnpm resolves these via `workspace:*` links, so they resolve to source without needing a custom condition.

**Paperclip package export pattern (e.g., `@paperclipai/db`):**
```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

This default export works in dev without any custom condition. No `.npmrc` change needed for submodule consumption. Confidence: HIGH (verified in `packages/db/package.json`).

### Pattern 3: Akasa Express Extension Point (PATCH REQUIRED)

**What:** Paperclip's `createApp` mounts a catch-all `/api` 404 handler and `errorHandler` before returning `app`. Akasa routes added after `createApp` would never be reached.

**Root cause (verified in `server/src/app.ts` lines 226–284):**
```typescript
app.use("/api", api);                        // L226: Paperclip API routes
app.use("/api", (_req, res) => { /* 404 */ }); // L227: catch-all 404 — BLOCKS Akasa
// ...UI static/vite...
app.use(errorHandler);                        // L284: error handler
return app;                                   // L316
```

**Solution:** Add an optional `extraApiRouter` parameter to `createApp` opts and mount it BEFORE the 404 catch-all. This is a single-line patch to `paperclip/server/src/app.ts`:

```typescript
// Modified createApp signature (add one field to opts):
opts: {
  // ... existing fields ...
  extraApiRouter?: express.Router;  // ADD THIS
}

// Mount point (replace lines 226-227 with):
app.use("/api", api);
if (opts.extraApiRouter) {
  app.use("/api", opts.extraApiRouter);  // Akasa routes: /api/akasa/*
}
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});
```

**In Akasa's `startServer` fork (new file: `services/akasa-server/src/index.ts`):**
```typescript
import { createApp } from "../../paperclip/server/src/app.js";
import { akasaRouter } from "./routes/index.js";

const app = await createApp(db, {
  // ...existing paperclip opts...
  extraApiRouter: akasaRouter,
});
// No catch-all blockage; Akasa routes respond at /api/akasa/*
```

### Pattern 4: Database Migration Coexistence

**Critical finding:** Both Akasa (`@claw/db`) and Paperclip (`@paperclipai/db`) use `drizzle.__drizzle_migrations` as their migration journal table. Running both migration systems against the same database will cause journal collisions — each system will mark the other's migrations as "pending" or interpret the hash set incorrectly.

**Paperclip's migration system:** Custom `applyPendingMigrations()` in `packages/db/src/client.ts` that reads from `drizzle.__drizzle_migrations` using hash-based deduplication. It does NOT use `drizzle-kit migrate` for the actual apply step — it uses drizzle-orm's `migrate()` function.

**Akasa's migration system:** `drizzle-kit migrate` which also writes to `drizzle.__drizzle_migrations`.

**Resolution strategy:** Use Akasa's `drizzle-kit` with a different `migrationsTable` to separate the journal entries.

```typescript
// packages/db/drizzle.config.ts — ADD migrationsTable:
export default defineConfig({
  out: './migrations',
  schema: './src/schema/**/*.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env['DATABASE_URL']! },
  migrations: {
    table: '__akasa_migrations',   // DIFFERENT from Paperclip's __drizzle_migrations
    schema: 'drizzle',
  },
});
```

Akasa's `drizzle-kit migrate` will then write to `drizzle.__akasa_migrations`. Paperclip's `applyPendingMigrations()` will continue writing to `drizzle.__drizzle_migrations`. No collision.

**Migration run order for dev:**
1. Paperclip runs migrations first (55 tables in `public` schema)
2. Akasa runs migrations second (16 Akasa-specific tables added)

**Startup sequence in Akasa's server entry point:**
```typescript
// Run Paperclip migrations (auto, part of their startServer flow)
// Run Akasa migrations separately before createApp
await runAkasaMigrations(databaseUrl);  // calls drizzle-kit migrate programmatically
```

### Pattern 5: DB Pool Sharing

**How Paperclip exposes the pool:** Paperclip's `createDb(url)` in `packages/db/src/client.ts` returns a Drizzle instance backed by a `postgres()` connection pool (the `postgres` package, not `pg`). The `startServer()` function creates `db` and passes it to `createApp(db, opts)`.

**Akasa's current setup:** Uses `pg` (node-postgres) driver with `drizzle-orm/node-postgres`.

**Problem:** Akasa and Paperclip use different underlying Postgres drivers (`postgres` vs `pg`). If Akasa evolution routes use `@claw/db`'s `db` client, they maintain a separate connection pool with a different driver.

**Recommendation (matches D-05):** For Phase 1 (structural only), Akasa can maintain its own separate pool from `@claw/db` since no evolution routes are being wired yet. Phase 1 only needs to verify the workspace imports compile. Full pool sharing is a concern for Phase 5 (Evolution Routes). Document this as an open question.

**Alternative worth noting:** Akasa could switch its `packages/db` client to use the `postgres` package to match Paperclip. This eliminates driver divergence entirely and enables a single pool. Flag as Phase 5 decision.

### Pattern 6: Single `pnpm dev` Command

**What:** Use `pnpm --parallel --filter` to start both the Express backend (Paperclip + Akasa routes) and SvelteKit frontend concurrently.

```json
// Root package.json scripts (add):
{
  "scripts": {
    "dev": "pnpm --parallel --filter @paperclipai/server --filter @claw/ui dev",
    "db:generate": "pnpm --filter @claw/db generate",
    "db:migrate": "pnpm --filter @claw/db migrate"
  }
}
```

**Important:** The `--filter` flag in pnpm 10.x requires the package name, not the path. `@paperclipai/server` is the name in `paperclip/server/package.json`. `@claw/ui` is in `services/ui/package.json`.

**SvelteKit proxy:** The SvelteKit `vite.config.ts` proxy must point to the Paperclip Express port (default `3000` per Paperclip config) instead of the old Fastify `3001`.

### Recommended Project Structure After Phase 1

```
claw-army/
├── paperclip/               # Git submodule (claw-paper-clip fork)
│   ├── packages/
│   │   ├── db/             # @paperclipai/db — createDb, applyPendingMigrations
│   │   ├── shared/         # @paperclipai/shared — types, DeploymentMode, etc.
│   │   └── adapters/       # @paperclipai/adapter-* — claude-local, codex-local, etc.
│   └── server/             # @paperclipai/server — createApp (patched), startServer
├── packages/
│   └── db/                 # @claw/db — Akasa evolution schema, separate __akasa_migrations table
├── services/
│   ├── akasa-server/       # NEW: Akasa server entry point (calls createApp with extraApiRouter)
│   └── ui/                 # @claw/ui — SvelteKit frontend (proxy updated to Express port)
├── pnpm-workspace.yaml      # Extended with paperclip/packages/* globs
└── package.json             # Root dev script added
```

### Anti-Patterns to Avoid

- **Don't mount routes after `createApp` returns without the patch:** The `/api` 404 catch-all fires before Akasa routes would be reached.
- **Don't share `drizzle.__drizzle_migrations`:** Both Drizzle instances will corrupt each other's journal.
- **Don't add `@claw/source` condition to Paperclip packages:** They use default `"."` exports pointing to `./src/index.ts` already; adding `@claw/source` to their exports maps would require modifying Paperclip package.json files unnecessarily.
- **Don't run `pnpm install` inside the submodule separately:** pnpm hoists all dependencies at the workspace root. Running pnpm inside `paperclip/` creates a conflicting lockfile.
- **Don't add `paperclip/node_modules` to `.gitignore` at the claw-army level:** The `.gitignore` for claw-army already ignores `node_modules` at root. pnpm's symlink-based hoisting means `paperclip/node_modules` may be populated by the workspace root install — don't double-exclude.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Process orchestration for `pnpm dev` | Shell script with `&` and manual PIDs | `pnpm --parallel --filter` |
| Migration journal isolation | Custom migration tracking table | `drizzle-kit` `migrations.table` config option |
| Inter-process communication between UI and backend | Custom HTTP bridge | pnpm workspace dependency + proxy in `vite.config.ts` |
| Submodule version pinning | Manual SHA tracking in shell scripts | `git submodule` (SHA tracked in index automatically) |

## Common Pitfalls

### Pitfall 1: pnpm Version Mismatch

**What goes wrong:** Akasa uses pnpm 10.x (no explicit `packageManager` field in root `package.json`). Paperclip pins `"packageManager": "pnpm@9.15.4"`. pnpm corepack enforcement may reject the workspace install.

**Why it happens:** corepack enforces the `packageManager` field from the workspace root. When Paperclip's `package.json` becomes a workspace member, its `packageManager` field is visible.

**How to avoid:** Add `"packageManager": "pnpm@10.11.1"` to claw-army root `package.json`. This overrides Paperclip's nested declaration at the workspace root level. pnpm workspace root takes precedence over nested package declarations.

**Warning signs:** `ERR_PNPM_BAD_PM_VERSION` or corepack refusing to run.

### Pitfall 2: Migration Journal Collision (CRITICAL)

**What goes wrong:** Both `drizzle-kit migrate` (Akasa) and Paperclip's `applyPendingMigrations()` write to `drizzle.__drizzle_migrations`. If Akasa runs first, Paperclip sees a non-empty migration journal and may mis-classify its own migrations as already-applied.

**Why it happens:** Default `migrationsTable` is `__drizzle_migrations` in both systems.

**How to avoid:** Set `migrations.table: '__akasa_migrations'` in Akasa's `drizzle.config.ts` before running any migrations against the shared database.

**Warning signs:** `"Migrations incomplete"` error from Paperclip's startup, or Akasa tables missing after migration.

### Pitfall 3: `@paperclipai/server` Not Found by pnpm

**What goes wrong:** `pnpm --filter @paperclipai/server dev` fails because the package isn't discovered.

**Why it happens:** The `pnpm-workspace.yaml` glob `paperclip/packages/*` does NOT include `paperclip/server` — it's not inside `packages/`. Paperclip's own workspace config has `server` as a separate top-level entry.

**How to avoid:** Add `'paperclip/server'` as an explicit entry in `pnpm-workspace.yaml` (not just the glob).

**Warning signs:** `No package found for the provided filter` error from pnpm.

### Pitfall 4: TypeScript Resolution — `@paperclipai/db` Import Failing

**What goes wrong:** Akasa code imports `import { createDb } from '@paperclipai/db'` and TypeScript can't resolve the module.

**Why it happens:** Paperclip's `tsconfig.base.json` has `"moduleResolution": "NodeNext"`. Akasa's `tsconfig.base.json` also has `"moduleResolution": "NodeNext"` with `customConditions: ["@claw/source"]`. The `@claw/source` condition is not in Paperclip's exports map, so the condition resolves to the `default` export `./src/index.ts` — which works. However, if a service `.npmrc` sets `--conditions=@claw/source`, Node.js runtime resolution must also fall back to `default` for `@paperclipai/*` packages.

**How to avoid:** No code change needed — Node.js `--conditions` flag applies additional conditions but always falls back to `default`. Paperclip packages will resolve correctly.

**Warning signs:** TypeScript error `Cannot find module '@paperclipai/db'` — usually means the workspace glob is wrong, not a conditions issue.

### Pitfall 5: Express `app.use("/api", ...)` After `createApp` Silently Ignored

**What goes wrong:** Akasa adds routes after `createApp` returns. They appear to register but never respond — all requests return `{"error":"API route not found"}`.

**Why it happens:** The 404 catch-all at `app.use("/api", ...)` was registered before Akasa's routes, so it fires first.

**How to avoid:** Apply the `extraApiRouter` patch to `createApp` opts before writing any Akasa route code.

**Warning signs:** All `/api/akasa/*` requests return 404 with `{"error":"API route not found"}`.

### Pitfall 6: SvelteKit Dev Proxy Port Mismatch

**What goes wrong:** SvelteKit `vite.config.ts` still proxies to `http://localhost:3001` (old Fastify port). All `/api` calls from the UI fail in dev.

**Why it happens:** Paperclip's Express default port is `3000`, not `3001`.

**How to avoid:** Update `vite.config.ts` proxy target to `http://localhost:3000` during this phase.

**Warning signs:** 502/ECONNREFUSED errors in browser dev tools for any `/api` request.

### Pitfall 7: Akasa DB Schema Has `node-postgres` Driver; Paperclip Uses `postgres` Driver

**What goes wrong:** Akasa's `@claw/db` uses `drizzle-orm/node-postgres` (the `pg` package). Paperclip's `@paperclipai/db` uses `drizzle-orm/postgres-js` (the `postgres` package). Both connect to the same database but maintain separate pools. This is acceptable for Phase 1 (structural only) but becomes a design decision in Phase 5.

**Why it happens:** Historical driver choice divergence.

**How to avoid for Phase 1:** Don't attempt to share the pool — just confirm imports compile and both migrations run. Note as open question for Phase 5.

## Code Examples

Verified patterns from official sources:

### pnpm Workspace Glob for Nested Monorepo (Submodule)

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'services/*'
  - 'scripts'
  - 'paperclip/packages/*'
  - 'paperclip/packages/adapters/*'
  - 'paperclip/packages/plugins/*'
  - 'paperclip/packages/plugins/examples/*'
  - 'paperclip/server'
  - 'paperclip/cli'
```

Source: pnpm workspace docs + verified against `paperclip/pnpm-workspace.yaml` pattern.

### Drizzle Migration Table Isolation

```typescript
// packages/db/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/schema/**/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  migrations: {
    table: '__akasa_migrations',  // isolated from Paperclip's __drizzle_migrations
    schema: 'drizzle',
  },
});
```

Source: drizzle-kit `defineConfig` API — `migrations.table` is a supported option. HIGH confidence (official Drizzle docs pattern).

### Express Route Extension Point Patch

```typescript
// paperclip/server/src/app.ts — PATCH (2 lines changed)
export async function createApp(
  db: Db,
  opts: {
    // ...existing...
    extraApiRouter?: Router;  // ADD: optional Akasa router
  },
) {
  // ...existing setup...
  app.use("/api", api);
  if (opts.extraApiRouter) {           // ADD
    app.use("/api", opts.extraApiRouter);  // ADD: Akasa /api/akasa/* routes here
  }
  app.use("/api", (_req, res) => {     // EXISTING catch-all (unchanged)
    res.status(404).json({ error: "API route not found" });
  });
  // ...rest unchanged...
}
```

Source: Verified against `paperclip/server/src/app.ts` lines 52-317. HIGH confidence.

### Akasa Server Entry Point (new file)

```typescript
// services/akasa-server/src/index.ts
import { startServer } from "../../../paperclip/server/src/index.js";
// OR: create a thin wrapper that calls createApp with extraApiRouter
```

The simplest approach for Phase 1: create `services/akasa-server/` that re-exports `startServer` from Paperclip but passes `extraApiRouter`. In Phase 1 this router is empty — the goal is just proving the wiring compiles and starts.

### Root Package Dev Script

```json
{
  "scripts": {
    "dev": "pnpm --parallel --filter @paperclipai/server --filter @claw/ui dev"
  }
}
```

Note: Paperclip's `@paperclipai/server` `dev` script is `tsx src/index.ts`. SvelteKit's `@claw/ui` `dev` script is already configured. Both run concurrently with `--parallel`.

## Runtime State Inventory

This is a structural integration phase, not a rename/refactor. No runtime state inventory is required.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All services | Yes | 22.16.0 | — |
| pnpm | Workspace install | Yes | 10.11.1 | — |
| git | Submodule init | Yes | (system) | — |
| Docker | postgres + redis infra | Yes (docker-compose.dev.yml) | (system) | — |
| PostgreSQL | DB migrations | Yes (via Docker) | 16-alpine | — |
| Redis | BullMQ (execution-service legacy) | Yes (via Docker) | 7-alpine | — |
| claw-paper-clip GitHub | Submodule clone | Yes | fork at tarikstafford/claw-paper-clip | — |

**No missing dependencies.**

## Validation Architecture

> workflow.nyquist_validation key is absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Paperclip uses Vitest; Akasa execution-service uses Vitest) |
| Config file | None yet for `akasa-server` — Wave 0 gap |
| Quick run command | `pnpm --filter @claw/execution-service exec vitest run` (existing) |
| Full suite command | `pnpm -r exec vitest run` (after workspace integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-01 | `.gitmodules` file exists with correct `paperclip` entry | smoke | `test -f .gitmodules && git submodule status paperclip` | Wave 0 (shell check) |
| SUB-02 | `import { createDb } from '@paperclipai/db'` resolves in TS | type-check | `pnpm --filter @claw/db typecheck` + `tsc --noEmit` in akasa-server | ❌ Wave 0 |
| SUB-03 | Both migration sets apply with no conflict | smoke | `pnpm db:migrate` + inspect `drizzle.__drizzle_migrations` vs `drizzle.__akasa_migrations` row counts | ❌ Wave 0 |
| SUB-04 | Express starts and responds at `/api/akasa/health` | smoke | `curl http://localhost:3000/api/akasa/health` | ❌ Wave 0 |
| SUB-05 | `pnpm dev` starts both processes with one command | smoke | `pnpm dev` runs without error within 30s | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** TypeScript typecheck (`pnpm -r typecheck`)
- **Per wave merge:** Full suite (`pnpm -r exec vitest run`)
- **Phase gate:** Full suite green + all smoke checks pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/akasa-server/src/index.ts` — Akasa server entry point (SUB-04)
- [ ] `services/akasa-server/package.json` — package config with `dev` script
- [ ] Smoke test shell script — verifies git submodule, migrations, HTTP health (SUB-01 through SUB-05)
- [ ] Framework install: no new framework needed — existing Vitest + shell `curl` checks sufficient

## Open Questions

1. **Paperclip's Express port default**
   - What we know: Paperclip `config.ts` loads from `PAPERCLIP_PORT` or `PORT` env var; default is likely `3000` based on convention
   - What's unclear: Exact default port value not verified — need to inspect `server/src/config.ts` line that sets `port`
   - Recommendation: Read `config.ts` during Wave 0 (plan task); update SvelteKit proxy accordingly

2. **Akasa `execution-service` decommission scope**
   - What we know: D-09 says Fastify execution-service fully replaced; needed logic migrated to Express
   - What's unclear: Phase 1 only wires the structural shell — no Fastify migration code is written yet. Does Phase 1 remove `services/execution-service/` or just stop using it?
   - Recommendation: Phase 1 leaves `services/execution-service/` in place but removes it from the `pnpm dev` script. Decommission during Phase 5 (Evolution Routes) once all logic is migrated.

3. **Drizzle ORM version divergence (`^0.45.1` vs `^0.38.4`)**
   - What we know: Akasa uses `drizzle-orm@0.45.1`, Paperclip uses `drizzle-orm@0.38.4`. Both are ESM packages.
   - What's unclear: Whether pnpm workspace deduplification resolves to a single version or installs both. Breaking changes between 0.38 and 0.45 are possible.
   - Recommendation: Run `pnpm install` and check `pnpm-lock.yaml` for `drizzle-orm` deduplification. If two versions are installed, ensure each package uses its own (pnpm handles this with package isolation).

4. **`@claw/db` driver migration (Phase 5 decision)**
   - What we know: Akasa uses `pg` + `drizzle-orm/node-postgres`; Paperclip uses `postgres` + `drizzle-orm/postgres-js`. Two pools.
   - What's unclear: Phase 5 evolution routes need to use Paperclip's DB instance (D-05). Will Akasa routes need to switch to `postgres` driver, or will cross-driver DB access work?
   - Recommendation: Phase 1 structural work only — record this as a Phase 5 concern. Flag in PLAN.

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection — `paperclip/server/src/app.ts` — `createApp` signature and route mounting order verified
- Codebase direct inspection — `paperclip/packages/db/src/client.ts` — migration system (custom hash-based, `drizzle.__drizzle_migrations`)
- Codebase direct inspection — `paperclip/packages/db/package.json` — confirms `@paperclipai/db` name, workspace `*` protocol
- Codebase direct inspection — `packages/db/drizzle.config.ts` — Akasa migration config (no custom table — conflict confirmed)
- Codebase direct inspection — `pnpm-workspace.yaml` (both repos) — glob patterns verified
- Codebase direct inspection — `packages/db/src/schema/*.ts` + `paperclip/packages/db/src/schema/*.ts` — zero table name conflicts confirmed
- pnpm workspace docs (official) — `packages` glob patterns, `--parallel --filter` flags
- drizzle-kit `defineConfig` API — `migrations.table` option for custom migration table name

### Secondary (MEDIUM confidence)

- pnpm 10.x `packageManager` field behavior — workspace root overrides nested declarations (standard pnpm behavior, not independently verified against changelog)
- Paperclip default port — likely 3000 based on config structure but not explicitly confirmed from `config.ts` read

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from both codebases
- Architecture patterns: HIGH — derived from code inspection, not assumptions
- Pitfalls: HIGH — root causes verified against actual code paths
- Migration conflict: HIGH — both `drizzle.config.ts` files inspected; same default table confirmed

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (stable tooling; Paperclip submodule pinned to commit so version drift won't affect this research)
