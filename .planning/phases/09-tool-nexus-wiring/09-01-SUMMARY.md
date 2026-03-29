---
phase: 09-tool-nexus-wiring
plan: 01
subsystem: api
tags: [paperclip, plugin-sdk, tool-nexus, hubspot, slack, google-sheets, typescript, tsc]

# Dependency graph
requires:
  - phase: 06-tool-nexus-backend
    provides: akasa-tool-nexus plugin source (worker.ts, connectors, manifest)
  - phase: 05-evolution-routes
    provides: akasa-server index.ts startup pattern with evolution polling
provides:
  - packages/plugins/akasa-tool-nexus/dist/worker.js compiled plugin entry point
  - services/akasa-server/src/index.ts ensureToolNexusPlugin() startup hook
  - Idempotent plugin install via Paperclip HTTP API at server startup
affects: [10-decision-trace-wiring, agents-invoking-tools, tool-dispatch-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "plugin-install-at-startup: fire-and-forget call to POST /api/plugins/install after server.listen()"
    - "idempotent-plugin-check: GET /api/plugins first, skip if pluginKey already ready"
    - "dist-existence-guard: accessSync check before install attempt, warn and skip on miss"

key-files:
  created:
    - packages/plugins/akasa-tool-nexus/dist/worker.js
  modified:
    - services/akasa-server/src/index.ts
    - packages/plugins/akasa-tool-nexus/tsconfig.json

key-decisions:
  - "Plugin install via Paperclip HTTP API (POST /api/plugins/install) not private loader import — authReady: local_trusted mode allows unauthenticated install calls from localhost"
  - "fire-and-forget void ...catch() pattern for plugin install — server never crashes on install failure"
  - "tsconfig.json rootDir: ./src + paths pointing to .d.ts files — required to produce dist/worker.js at correct location (fixes tsc rootDir computation with cross-package path aliases)"
  - "Built @claw/db dist/ and pointed plugin tsconfig paths to .d.ts files — avoids rootDir violation from pulling TypeScript source files outside src/ into compilation"

patterns-established:
  - "Plugin startup install: check GET /api/plugins, skip if ready, install if not, handle 'already installed' conflict, fire-and-forget with .catch()"
  - "tsconfig cross-package paths: point to .d.ts type files not .ts source files to maintain rootDir integrity"

requirements-completed: [TOOL-01, TOOL-06]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 09 Plan 01: Tool Nexus Wiring — Plugin Build and Startup Install

**Tool Nexus plugin compiled to dist/worker.js and wired into akasa-server startup via idempotent Paperclip HTTP API install hook**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T~14:34Z
- **Completed:** 2026-03-29T~14:39Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Built `packages/plugins/akasa-tool-nexus/dist/worker.js` from TypeScript source (HubSpot, Slack, Google Sheets connectors compiled)
- Added `ensureToolNexusPlugin()` to `services/akasa-server/src/index.ts` — fires after `server.listen()` resolves
- Install is idempotent: checks `GET /api/plugins` first, skips if `akasa.tool-nexus` is already `ready`
- Install is non-fatal: fire-and-forget `void ...catch()` so plugin failure never crashes the server
- Graceful skip if `dist/worker.js` not present (dev without pre-build)
- Fixed `tsconfig.json` to produce output at correct `dist/worker.js` path

## Task Commits

Each task was committed atomically:

1. **Task 1: Build plugin dist and add startup install hook** - `adf19fd` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `packages/plugins/akasa-tool-nexus/dist/worker.js` — Compiled plugin entry point (gitignored, built from source)
- `services/akasa-server/src/index.ts` — Added `ensureToolNexusPlugin()` function + call after server.listen()
- `packages/plugins/akasa-tool-nexus/tsconfig.json` — Added `rootDir: ./src`, changed `paths` to point to `.d.ts` type files

## Decisions Made

- Plugin install uses Paperclip's own HTTP API (`POST /api/plugins/install` with `isLocalPath: true`) rather than importing private plugin-loader internals — `local_trusted` deployment mode allows unauthenticated localhost calls to pass `assertBoard` check
- Fire-and-forget invocation pattern — plugin install failure logs an error but never prevents the server from starting or serving requests
- `dist/worker.js` existence is checked via `accessSync` before attempting install — graceful warning and skip in dev without pre-build step

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsconfig.json missing rootDir caused wrong output path**
- **Found during:** Task 1 (Build plugin dist)
- **Issue:** Without `rootDir: "./src"`, tsc computed the common ancestor of all compiled files (including cross-package path-aliased sources) as the root, outputting `dist/packages/plugins/akasa-tool-nexus/src/worker.js` instead of `dist/worker.js`
- **Fix:** Added `"rootDir": "./src"` to tsconfig.json AND updated `paths` entries to reference pre-compiled `.d.ts` declaration files instead of `.ts` source files (which would violate `rootDir` constraint). Also built `@claw/db` to produce `dist/index.d.ts` for type resolution
- **Files modified:** `packages/plugins/akasa-tool-nexus/tsconfig.json`
- **Verification:** `pnpm --filter @claw/plugin-tool-nexus build` succeeds, `dist/worker.js` exists at correct location
- **Committed in:** `adf19fd` (Task 1 commit)

**2. [Rule 3 - Blocking] Paperclip submodule not initialized in worktree**
- **Found during:** Task 1 (initial install attempt)
- **Issue:** Worktree was at a different commit than main (151 commits behind), missing `services/akasa-server` and `packages/plugins`. Submodule `paperclip` was not checked out in the worktree.
- **Fix:** Fast-forwarded worktree to main (ancestor merge, no conflicts). Added git objects alternates to worktree's submodule git dir to allow checkout. Built `@paperclipai/plugin-sdk` from paperclip submodule source.
- **Files modified:** None (infrastructure fix)
- **Verification:** `ls services/akasa-server/` confirms directory exists; `ls packages/plugins/` confirms plugin directory exists
- **Committed in:** N/A (infrastructure setup, not code change)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary to enable build completion. No scope creep.

## Issues Encountered

- Worktree was 151 commits behind main — fast-forwarded before execution (no code conflicts)
- Paperclip git submodule objects not accessible from worktree — resolved via git alternates file pointing to main repo's object store

## Known Stubs

None — `dist/worker.js` is real compiled output from the three connector implementations (HubSpot, Slack, Google Sheets).

## Next Phase Readiness

- Tool Nexus plugin will be installed into Paperclip runtime on next `akasa-server` startup
- Agents can now discover HubSpot, Slack, Google Sheets tools via `toolDispatcher.listToolsForAgent()`
- Phase 09 Plan 02 (webhook routing rule evaluation) is ready to proceed — depends on `webhooks.ts` which is unchanged

---
*Phase: 09-tool-nexus-wiring*
*Completed: 2026-03-29*
