---
phase: 11-tool-nexus-integration-fixes
plan: "02"
subsystem: tool-nexus
tags: [bugfix, credential-bridge, plugin-config, http-only, rebuild]
dependency_graph:
  requires: [internal-endpoints]
  provides: [credential-bridge-http-only, plugin-port-config, invocation-logger-http-only, fresh-plugin-bundle]
  affects: [tool-nexus-e2e, plugin-worker-runtime]
tech_stack:
  added: []
  patterns: [http-only-plugin-services, plugin-config-system, fire-and-forget-http-logging]
key_files:
  created: []
  modified:
    - packages/plugins/akasa-tool-nexus/src/services/credential-bridge.ts
    - packages/plugins/akasa-tool-nexus/src/services/invocation-logger.ts
    - packages/plugins/akasa-tool-nexus/src/worker.ts
    - packages/plugins/akasa-tool-nexus/src/manifest.ts
    - packages/plugins/akasa-tool-nexus/esbuild.config.mjs
    - services/akasa-server/src/index.ts
    - services/akasa-server/src/routes/internal.ts
decisions:
  - credential-bridge second param renamed from userId to companyId — reflects what connectors actually pass (Paperclip company UUID not BetterAuth userId)
  - _akasaPortRef() exported from credential-bridge as a getter for invocation-logger to share the same port without circular dependency
  - invocation-logger refactored to HTTP (POST /akasa/internal/log-invocation) — same pattern as credential-bridge, no @claw/db in plugin bundle
  - @claw/db and @claw/akasa-server removed from esbuild external list — they must not be imported in plugin worker (would fail silently at runtime)
  - postPluginConfig called in all install paths (fresh install, already-ready, already-in-registry) so akasaPort is always set
  - pluginDbId uses the UUID id field (not pluginKey) for the config POST URL — critical: Paperclip config endpoint requires DB UUID
  - dist/worker.js is gitignored — not committed but verified exists with grep -c @claw/db = 0
metrics:
  duration: 15 min
  completed: "2026-03-30"
  tasks_completed: 2
  files_modified: 7
---

# Phase 11 Plan 02: Credential-Bridge HTTP Refactor Summary

**One-liner:** HTTP-only credential resolution in plugin worker via two-step company→user→token chain with port config plumbing and fresh bundle rebuild.

## What Was Built

Refactored the Tool Nexus plugin's credential resolution layer to eliminate all direct database access from the plugin worker context. The plugin worker spawned by Paperclip has no `DATABASE_URL` in its environment — any `@claw/db` import would call `drizzle(process.env['DATABASE_URL']!)` and fail silently. The fix routes all DB queries through `akasa-server`'s internal HTTP endpoints.

### credential-bridge.ts — Complete Rewrite

- **Removed**: All `@claw/db`, `drizzle-orm`, and `token-manager` imports
- **Added**: `setAkasaPort(port: string)` export and `_akasaPort` module variable (defaults to `'3100'`)
- **Added**: `_akasaPortRef()` getter export for use by invocation-logger
- **Added**: `resolveUserId(companyId)` — HTTP GET `/akasa/internal/user-by-company/:companyId`
- **Added**: `fetchToolCredential(userId, toolId)` — HTTP GET `/akasa/internal/tool-credential/:userId/:toolId`
- **Changed**: `resolveCredential(toolId, companyId)` — second param renamed from `userId` to `companyId`

### invocation-logger.ts — HTTP Refactor

- **Removed**: `@claw/db` and `toolInvocationLogs` imports
- **Added**: HTTP POST to `/akasa/internal/log-invocation` (new endpoint in internal.ts)
- Shares `_akasaPortRef()` from credential-bridge for consistent port discovery

### worker.ts — Plugin Config Wiring

- **Added**: `setAkasaPort` import from credential-bridge
- **Added**: `ctx.config.get()` call in `setup()` to read `akasaPort` from plugin config
- **Added**: `onConfigChanged()` handler for live port updates

### manifest.ts — Schema Declaration

- **Added**: `instanceConfigSchema` with `akasaPort` field (type: string, default: '3100')

### esbuild.config.mjs — External Cleanup

- **Removed**: `@claw/db`, `@claw/akasa-server`, `drizzle-orm` from external list
- Only `@paperclipai/plugin-sdk` and `@paperclipai/shared` remain externalized (Paperclip runtime provides these)

### akasa-server/src/index.ts — Config Post Wiring

- **Added**: `postPluginConfig(port, pluginDbId)` function — POSTs `{ configJson: { akasaPort: String(port) } }` to `/api/plugins/:pluginDbId/config`
- **Updated**: `ensureToolNexusPlugin` now tracks `pluginDbId` (the UUID `id` field) in all three code paths and calls `postPluginConfig` in each

### akasa-server/src/routes/internal.ts — Log Invocation Endpoint

- **Added**: `POST /akasa/internal/log-invocation` — inserts a row into `tool_invocation_logs` via akasa-server's direct DB connection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] invocation-logger.ts also had @claw/db dependency**
- **Found during**: Task 2 (rebuild attempt — `grep -c "@claw/db" dist/worker.js` returned 1)
- **Issue**: `invocation-logger.ts` imported `@claw/db` directly, same root cause as credential-bridge
- **Fix**: Refactored invocation-logger to use HTTP POST to a new `/akasa/internal/log-invocation` endpoint added to internal.ts; added `_akasaPortRef()` getter to credential-bridge for port sharing; removed `@claw/db` from esbuild external list so bundler would catch remaining imports
- **Files modified**: `packages/plugins/akasa-tool-nexus/src/services/invocation-logger.ts`, `services/akasa-server/src/routes/internal.ts`, `packages/plugins/akasa-tool-nexus/src/services/credential-bridge.ts`, `packages/plugins/akasa-tool-nexus/esbuild.config.mjs`
- **Commit**: included in Task 2 commit

## Self-Check

### Files Exist
- credential-bridge.ts: FOUND
- worker.ts: FOUND
- manifest.ts: FOUND
- index.ts: FOUND
- internal.ts: FOUND
- invocation-logger.ts: FOUND
- dist/worker.js: EXISTS (gitignored, not committed)

### Commits
- a826904: feat(11-02): refactor credential-bridge to HTTP-only and add port config plumbing
- 717e9ed: feat(11-02): POST plugin config after install and rebuild plugin bundle

### Test Results
- 103/103 akasa-server tests pass (vitest run)
- Zero @claw/db references in dist/worker.js bundle

## Self-Check: PASSED
