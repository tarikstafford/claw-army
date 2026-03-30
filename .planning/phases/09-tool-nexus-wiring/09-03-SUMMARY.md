---
phase: 09-tool-nexus-wiring
plan: 03
subsystem: infra
tags: [typescript, esbuild, paperclip-plugin, tool-nexus, tsconfig]

requires:
  - phase: 09-tool-nexus-wiring/01
    provides: Tool Nexus plugin source code and startup install hook
  - phase: 06-tool-nexus-backend
    provides: Plugin connector source files, credential-bridge, invocation-logger
provides:
  - Reproducible plugin build producing dist/worker.js via esbuild
  - tsconfig.json paths pointing to existing .ts source files for type resolution
  - esbuild.config.mjs following Paperclip plugin SDK bundler pattern
affects: [tool-nexus-wiring, akasa-server-startup]

tech-stack:
  added: [esbuild]
  patterns: [esbuild-bundler-for-plugins, tsc-noEmit-typecheck-only]

key-files:
  created:
    - packages/plugins/akasa-tool-nexus/esbuild.config.mjs
  modified:
    - packages/plugins/akasa-tool-nexus/tsconfig.json
    - packages/plugins/akasa-tool-nexus/package.json

key-decisions:
  - "Switch from tsc to esbuild for plugin build — tsc rootDir violation with cross-package .ts path resolution is unfixable without removing rootDir; esbuild bundles correctly with workspace externals"
  - "Externalize @claw/db, @claw/akasa-server, drizzle-orm in esbuild — resolved at runtime via pnpm workspace, not bundled into plugin"
  - "tsconfig.json paths corrected from non-existent .d.ts to existing .ts source files — moduleResolution: Bundler resolves types without requiring built declarations"

patterns-established:
  - "Plugin build pattern: esbuild.config.mjs for JS output, tsc --noEmit for type-checking"
  - "Workspace externals pattern: @claw/* packages externalized in esbuild, resolved at runtime"

requirements-completed: [TOOL-01, TOOL-06, TOOL-07]

duration: 173s
completed: 2026-03-30
---

# Phase 09 Plan 03: Tool Nexus Plugin Build Fix Summary

**Fixed Tool Nexus plugin build by switching from tsc to esbuild bundler and correcting tsconfig.json paths to reference existing .ts source files**

## Performance

- **Duration:** 173s
- **Started:** 2026-03-30T05:59:03Z
- **Completed:** 2026-03-30T06:01:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- tsconfig.json paths corrected from non-existent .d.ts files to existing .ts source files
- Plugin build switched from tsc (which hit rootDir violations) to esbuild following Paperclip plugin SDK pattern
- dist/worker.js produced successfully (22KB, contains definePlugin entry point)
- Build is reproducible — clean rebuild from scratch produces identical output

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix tsconfig.json paths to reference existing source files** - `8c10420` (fix)
2. **Task 2: Build plugin and verify dist/worker.js is produced** - `6af115c` (feat)

## Files Created/Modified
- `packages/plugins/akasa-tool-nexus/tsconfig.json` - Fixed paths block to point to .ts source files; added noEmit:true
- `packages/plugins/akasa-tool-nexus/esbuild.config.mjs` - New esbuild config following Paperclip plugin SDK pattern
- `packages/plugins/akasa-tool-nexus/package.json` - Build script changed to esbuild; added typecheck script; esbuild devDependency
- `pnpm-lock.yaml` - Updated with esbuild dependency

## Decisions Made
- **tsc to esbuild switch:** tsc with rootDir: ./src cannot compile when paths reference .ts files outside src/ — even removing declaration/declarationMap flags does not fix TS6059 errors. Esbuild bundles the entry point correctly, externalizing workspace packages for runtime resolution. This follows the exact pattern used by Paperclip's own example plugins.
- **Workspace externals:** @claw/db, @claw/akasa-server, @paperclipai/plugin-sdk, and drizzle-orm are externalized in the esbuild config since they are available at runtime via pnpm workspace resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched build toolchain from tsc to esbuild**
- **Found during:** Task 2 (Build plugin and verify dist/worker.js)
- **Issue:** Removing declaration/declarationMap from tsconfig was insufficient — tsc still enforces rootDir against all files in the program graph (including path-resolved .ts files). Every file from @claw/db and @claw/akasa-server triggered TS6059.
- **Fix:** Created esbuild.config.mjs following Paperclip plugin SDK bundler pattern (same approach as plugin-authoring-smoke-example). Changed build script from `tsc` to `node esbuild.config.mjs`. Added `noEmit: true` to tsconfig for type-checking only.
- **Files modified:** tsconfig.json, package.json, esbuild.config.mjs (new)
- **Verification:** `pnpm --filter @claw/plugin-tool-nexus build` exits 0; dist/worker.js exists and contains definePlugin
- **Committed in:** 6af115c

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Build toolchain change was necessary — tsc fundamentally cannot handle cross-package .ts path resolution with rootDir constraint. Esbuild is the established pattern in the Paperclip plugin ecosystem.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plugin build produces dist/worker.js — ensureToolNexusPlugin() accessSync guard will pass on next akasa-server start
- Plugin can be installed via Paperclip HTTP API on server startup
- All three connectors (HubSpot, Slack, Google Sheets) compiled into worker bundle

## Known Stubs
None.

---
*Phase: 09-tool-nexus-wiring*
*Completed: 2026-03-30*
