---
phase: 01-submodule-integration
plan: 02
subsystem: infra
tags: [express, akasa-server, proxy, sveltekit, paperclip-integration]

# Dependency graph
requires:
  - 01-01 (submodule registered, workspace wired)
provides:
  - paperclip/server/src/app.ts patched with extraApiRouter option
  - services/akasa-server package with full startup sequence
  - /api/akasa/health endpoint wired through Paperclip's Express
  - SvelteKit dev proxy targeting Express on port 3100
  - Unified pnpm dev command starting both processes in parallel
affects:
  - All future phases adding Akasa evolution routes (pass via extraApiRouter)
  - SvelteKit UI (all /api/* requests now proxy through to Express)

# Tech tracking
tech-stack:
  added:
    - services/akasa-server (new @claw/akasa-server package)
  patterns:
    - Approach B: akasa-server replicates Paperclip startup sequence without patching startServer
    - extraApiRouter pattern: Express Router passed at createApp call time, mounted at /api between Paperclip routes and 404 catch-all
    - Vite dev proxy: /api/* forwarded to Express backend (port 3100)
    - Parallel dev: pnpm --parallel --filter runs both services concurrently

key-files:
  created:
    - services/akasa-server/package.json
    - services/akasa-server/.npmrc
    - services/akasa-server/tsconfig.json
    - services/akasa-server/src/index.ts
    - services/akasa-server/src/routes/index.ts
  modified:
    - paperclip/server/src/app.ts (submodule — extraApiRouter field + mount logic)
    - package.json (added dev script)
    - services/ui/vite.config.ts (added /api proxy)

key-decisions:
  - "Approach B (replicate startup sequence): akasa-server imports createApp directly rather than calling startServer — preserves Paperclip's startServer as unmodified while letting Akasa control the extraApiRouter injection"
  - "Port 3100 not 3000: Paperclip's actual default port is 3100 (config.ts line 217). Plan assumed 3000 — corrected to match real config"
  - "akasa-server requires DATABASE_URL (no embedded postgres support): complexity of startServer's embedded postgres path unnecessary for dev workflow with docker-compose"

patterns-established:
  - "Pattern 3: Akasa route extension via extraApiRouter — all future evolution routes added to akasaRouter in services/akasa-server/src/routes/"
  - "Pattern 4: SvelteKit UI talks to Paperclip Express via /api proxy — no direct browser-to-backend connections"

requirements-completed: [SUB-04, SUB-05]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 01 Plan 02: Akasa Server Integration and Dev Proxy Summary

**Paperclip's Express createApp patched with extraApiRouter extension point; akasa-server service scaffolded to replicate startup sequence with Akasa routes mounted at /api/akasa/*; SvelteKit dev proxy wired to Express port 3100; pnpm dev starts both in parallel**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T10:26:53Z
- **Completed:** 2026-03-23T10:29:05Z
- **Tasks:** 2
- **Files modified:** 7 (including paperclip submodule)

## Accomplishments

- `paperclip/server/src/app.ts` patched with minimal 4-line change: `extraApiRouter?: Router` field in opts type + `if (opts.extraApiRouter) { app.use("/api", opts.extraApiRouter); }` between Paperclip routes and 404 catch-all
- `services/akasa-server/` created as a complete `@claw/akasa-server` pnpm package with `src/index.ts` and `src/routes/index.ts`
- `akasa-server` startup sequence: loads Paperclip config → applies Paperclip migrations → creates DB → calls `createApp` with `extraApiRouter: akasaRouter` → sets up WebSocket server → listens on port
- Health check route at `/api/akasa/health` returns `{status: "ok", service: "akasa", timestamp: "..."}`
- Root `package.json` has `dev` script running both `@claw/akasa-server` and `@claw/ui` in parallel via `pnpm --parallel --filter`
- SvelteKit `vite.config.ts` proxies all `/api/*` requests to `http://localhost:3100` (Express backend)

## Task Commits

Each task was committed atomically:

1. **Task 1: Patch Paperclip createApp and create akasa-server service** - `9701650` (feat)
2. **Task 2: Unified dev command and SvelteKit proxy** - `e8cf714` (feat)

Note: The submodule `paperclip` was also committed internally at `91f3611` to record the `app.ts` patch.

## Files Created/Modified

- `paperclip/server/src/app.ts` (submodule) — Added `extraApiRouter?: Router` to opts type; added mount logic between `/api` and 404 catch-all
- `services/akasa-server/package.json` — Package manifest: name `@claw/akasa-server`, type module, dev script with tsx watch
- `services/akasa-server/.npmrc` — `node-options=--conditions=@claw/source` for dev-time TS resolution
- `services/akasa-server/tsconfig.json` — NodeNext module resolution, strict mode, noUncheckedIndexedAccess
- `services/akasa-server/src/routes/index.ts` — `akasaRouter` with `/akasa/health` GET endpoint
- `services/akasa-server/src/index.ts` — Startup sequence: loadConfig → applyPendingMigrations → createDb → createApp with extraApiRouter → setupLiveEventsWebSocketServer → listen
- `package.json` — Added `dev` script: `pnpm --parallel --filter @claw/akasa-server --filter @claw/ui dev`
- `services/ui/vite.config.ts` — Added `/api` proxy to `http://localhost:3100` with `changeOrigin: true`

## Decisions Made

- **Approach B (replicate startup sequence, not patch startServer):** The plan required not importing `startServer` from Paperclip. `akasa-server/src/index.ts` replicates the essential startup steps (config → migrations → db → createApp → websocket → listen) with `extraApiRouter: akasaRouter` injected at the `createApp` call. This keeps Paperclip's `startServer` completely unmodified.
- **DATABASE_URL required in akasa-server:** The full `startServer` handles embedded postgres, which requires ~300 lines of complex logic (port detection, cluster initialization, etc.). Since the dev workflow uses `docker-compose`, requiring `DATABASE_URL` is the correct constraint for akasa-server. Attempting to replicate embedded postgres support would be scope creep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Port corrected from 3000 to 3100**
- **Found during:** Task 2 (verifying proxy target)
- **Issue:** Plan's example specified `target: 'http://localhost:3000'` but Paperclip's `config.ts` line 217 shows `port: Number(process.env.PORT) || fileConfig?.server.port || 3100`. The plan itself noted to verify and adjust.
- **Fix:** Used port 3100 in `vite.config.ts` proxy target. This matches Paperclip's actual default port.
- **Files modified:** `services/ui/vite.config.ts`
- **Committed in:** e8cf714 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — incorrect port assumption in plan)
**Impact on plan:** Necessary correction. Using port 3000 would mean the proxy silently fails to reach the Express backend. Port 3100 is the correct target.

## Known Stubs

None — the health check endpoint fully implements its stated behavior. No data is stubbed.

## Next Phase Readiness

- `pnpm dev` from root will start Express backend (port 3100) + SvelteKit (port 5173) in parallel
- SvelteKit dev proxy forwards all `/api/*` to Express — `http://localhost:5173/api/akasa/health` proxies to Express and returns `{status: "ok"}`
- All future Akasa evolution routes should be added to `services/akasa-server/src/routes/` and registered on `akasaRouter`
- Phase 2 (Design System tokens) and subsequent phases can build on this backend foundation

## Self-Check: PASSED

- `.planning/phases/01-submodule-integration/01-02-SUMMARY.md` — FOUND (this file)
- `services/akasa-server/package.json` — FOUND
- `services/akasa-server/src/index.ts` — FOUND
- `services/akasa-server/src/routes/index.ts` — FOUND
- `paperclip/server/src/app.ts` contains `extraApiRouter` — VERIFIED
- Commit `9701650` (Task 1) — VERIFIED
- Commit `e8cf714` (Task 2) — VERIFIED

---
*Phase: 01-submodule-integration*
*Completed: 2026-03-23*
