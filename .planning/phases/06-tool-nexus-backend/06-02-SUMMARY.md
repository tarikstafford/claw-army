---
phase: 06-tool-nexus-backend
plan: 02
subsystem: tool-nexus-plugin
tags: [plugin, connector, hubspot, slack, google-sheets, audit-logging, credential-bridge]
dependency_graph:
  requires: ["06-01"]
  provides: ["@claw/plugin-tool-nexus", "registerHubSpotTools", "registerSlackTools", "registerGoogleSheetsTools", "logInvocation", "resolveCredential"]
  affects: ["agents-via-paperclip-tool-sdk"]
tech_stack:
  added:
    - "@claw/plugin-tool-nexus workspace package"
    - "drizzle-orm 0.45.1 (direct dep in plugin)"
  patterns:
    - "Paperclip definePlugin() lifecycle with ctx.tools.register()"
    - "ctx.http.fetch() for all outbound HTTP (plugin-system tracing)"
    - "resolveCredential() wrapping getValidToken() via @claw/akasa-server workspace export"
    - "Fire-and-forget logInvocation() wrapping db.insert() with try/catch"
    - "TDD: tests written before implementation for invocation-logger"
key_files:
  created:
    - packages/plugins/akasa-tool-nexus/package.json
    - packages/plugins/akasa-tool-nexus/tsconfig.json
    - packages/plugins/akasa-tool-nexus/vitest.config.ts
    - packages/plugins/akasa-tool-nexus/src/constants.ts
    - packages/plugins/akasa-tool-nexus/src/manifest.ts
    - packages/plugins/akasa-tool-nexus/src/worker.ts
    - packages/plugins/akasa-tool-nexus/src/services/invocation-logger.ts
    - packages/plugins/akasa-tool-nexus/src/services/credential-bridge.ts
    - packages/plugins/akasa-tool-nexus/src/connectors/hubspot.ts
    - packages/plugins/akasa-tool-nexus/src/connectors/slack.ts
    - packages/plugins/akasa-tool-nexus/src/connectors/google-sheets.ts
    - packages/plugins/akasa-tool-nexus/src/__tests__/invocation-logger.test.ts
  modified:
    - pnpm-workspace.yaml (added packages/plugins/*)
    - services/akasa-server/package.json (added @claw/source exports for token-manager)
    - pnpm-lock.yaml
decisions:
  - "moduleResolution: Bundler (not NodeNext) for the plugin tsconfig — matches monorepo convention and avoids .js extension requirement in relative imports"
  - "Path aliases in tsconfig for @claw/db, @claw/akasa-server, @paperclipai/shared (dist d.ts) — avoids upstream source TS errors and rootDir violations"
  - "Added @claw/source exports to akasa-server/package.json for workspace-linking token-manager — avoids fragile relative cross-service imports"
  - "resolveCredential() returns { token, connectionId } tuple so connectors can pass connectionId to logInvocation without a second DB query"
  - "Used companyId as userId proxy in ToolRunContext — PluginToolRunContext exposes companyId/agentId but not a direct userId field"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_created: 12
  files_modified: 3
---

# Phase 06 Plan 02: Akasa Tool Nexus Plugin Summary

Akasa Tool Nexus Paperclip plugin with 3 connectors (HubSpot, Slack, Google Sheets) — 7 agent-discoverable tools via plugin SDK with credential resolution from Akasa's tool_connections table and invocation audit logging.

## What Was Built

### Plugin Package (`@claw/plugin-tool-nexus`)

New workspace package at `packages/plugins/akasa-tool-nexus/` added to pnpm-workspace.yaml.

**Manifest** declares 7 tools and 2 webhooks:
- HubSpot: create-contact, search-contacts, create-deal
- Slack: send-message, list-channels
- Google Sheets: read-range, append-row
- Webhook endpoints: hubspot-webhook, slack-events

**Worker** (`src/worker.ts`) uses `definePlugin()` from `@paperclipai/plugin-sdk` and calls all three connector registration functions in `setup()`.

### Credential Bridge (`src/services/credential-bridge.ts`)

Bridges Paperclip plugin context to Akasa's `tool_connections` table:
- Queries `tool_connections` by `(userId, toolId)` and validates `status = 'connected'`
- Calls `getValidToken()` from `@claw/akasa-server/services/token-manager` with provider-specific refresh functions
- Returns `{ token, connectionId }` tuple for use in connectors

**Critical:** All connectors call `resolveCredential()` — never `ctx.secrets.resolve()`. Paperclip secrets is a separate store that does not contain Akasa tool_connections data.

### Invocation Logger (`src/services/invocation-logger.ts`)

Writes audit rows to `tool_invocation_logs` with truncation at 500 chars for request/response summaries. Fire-and-forget: DB errors are caught and console.error'd but never re-thrown.

### Connectors (3 files, 7 tools total)

Each connector exports `register*Tools(ctx: PluginContext): Promise<void>` that calls `ctx.tools.register()` for each tool.

**Tool handler pattern:**
1. `resolveCredential(toolId, companyId)` → decrypted OAuth/API token + connectionId
2. `ctx.http.fetch(url, { headers: { Authorization: `Bearer ${token}` } })` — never global fetch
3. `logInvocation()` on both success and failure paths
4. Returns `{ content, data }` on success, `{ error }` on failure — never throws

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added @claw/source exports to akasa-server package.json**
- Found during: Task 1 (credential-bridge implementation)
- Issue: `@claw/akasa-server` had no `exports` field, blocking workspace import of token-manager
- Fix: Added `"./services/token-manager"` and `"./services/credential-encryption"` export paths with `@claw/source` condition
- Files modified: `services/akasa-server/package.json`
- Commit: fc8c2d6

**2. [Rule 3 - Blocking Issue] Path alias configuration for @paperclipai/shared dist**
- Found during: Task 1 (TypeScript compilation)
- Issue: `@paperclipai/shared` exports point to source `.ts` files; `project-mentions.ts` has a pre-existing upstream type error that blocked `tsc --noEmit`
- Fix: Built `@paperclipai/shared` and `@paperclipai/plugin-sdk` packages; added path alias in plugin tsconfig pointing to `dist/*.d.ts` files
- Files modified: `packages/plugins/akasa-tool-nexus/tsconfig.json`
- Commit: fc8c2d6

**3. [Rule 3 - Blocking Issue] moduleResolution: Bundler instead of NodeNext**
- Found during: Task 1 (TypeScript compilation)
- Issue: `moduleResolution: NodeNext` requires `.js` extensions in all relative imports; `@claw/db` source files don't have them
- Fix: Changed to `moduleResolution: Bundler` to match monorepo convention (per KEY DECISIONS)
- Files modified: `packages/plugins/akasa-tool-nexus/tsconfig.json`
- Commit: fc8c2d6

## Verification Results

```
TypeScript: OK (npx tsc --noEmit — 0 errors)

Test Files  1 passed (1)
Tests       3 passed (3)
  - inserts a row with correct fields
  - truncates requestSummary and responseSummary to 500 chars
  - does not throw when db insert fails (fire-and-forget)
```

## Self-Check: PASSED

- packages/plugins/akasa-tool-nexus/src/manifest.ts — FOUND
- packages/plugins/akasa-tool-nexus/src/worker.ts — FOUND
- packages/plugins/akasa-tool-nexus/src/connectors/hubspot.ts — FOUND
- packages/plugins/akasa-tool-nexus/src/connectors/slack.ts — FOUND
- packages/plugins/akasa-tool-nexus/src/connectors/google-sheets.ts — FOUND
- packages/plugins/akasa-tool-nexus/src/services/invocation-logger.ts — FOUND
- packages/plugins/akasa-tool-nexus/src/services/credential-bridge.ts — FOUND
- Commit fc8c2d6 — FOUND
- Commit 5554ca6 — FOUND
