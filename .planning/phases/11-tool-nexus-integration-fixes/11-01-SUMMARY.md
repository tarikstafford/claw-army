---
phase: 11-tool-nexus-integration-fixes
plan: "01"
subsystem: tool-nexus
tags: [bugfix, oauth, webhook, plugin, internal-api, test-stubs]
dependency_graph:
  requires: []
  provides: [oauth-redirect-fixed, plugin-path-fixed, webhook-dispatch-fixed, internal-endpoints]
  affects: [tool-nexus-e2e, credential-bridge]
tech_stack:
  added: []
  patterns: [lazy-singleton-db, router-factory-express, localhost-internal-api]
key_files:
  created:
    - packages/plugins/akasa-tool-nexus/src/__tests__/credential-bridge.test.ts
    - services/akasa-server/src/__tests__/internal-endpoint.test.ts
    - services/akasa-server/src/routes/internal.ts
  modified:
    - services/ui/src/routes/(app)/tools/belt/+page.svelte
    - services/ui/src/routes/(app)/tools/catalog/+page.svelte
    - services/akasa-server/src/index.ts
    - services/akasa-server/src/routes/webhooks.ts
    - services/akasa-server/src/routes/index.ts
decisions:
  - OAuth redirectUri must point to Express callback handler at /api/akasa/tool-connections/oauth/:toolId/callback, not the SvelteKit /tools page
  - Plugin path uses 3x ../ from services/akasa-server/src to reach project root (not 4x)
  - Webhook dispatch uses /api/agents/:id/wakeup with { source, triggerDetail, payload } body shape (Paperclip v2 API)
  - Internal endpoints rely on local_trusted mode for security (no auth tokens) — acceptable for localhost-only processes
  - Lazy Paperclip DB singleton in internalRouter to avoid connection overhead on unused endpoints
metrics:
  duration: 15 minutes
  completed: "2026-03-30T10:55:00Z"
  tasks: 3
  files: 7
---

# Phase 11 Plan 01: Tool Nexus Integration Fixes Summary

**One-liner:** Fixed three single-point-of-failure bugs (OAuth redirectUri, plugin install path, webhook dispatch endpoint) and added internal user-by-company and tool-credential HTTP endpoints that allow the Tool Nexus plugin worker to resolve credentials without direct DB access.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Create test stubs for credential-bridge and internal endpoints | 6d9a4c8 | credential-bridge.test.ts, internal-endpoint.test.ts |
| 1 | Fix OAuth redirectUri, plugin path, and webhook dispatch | 051e6c8 | belt/+page.svelte, catalog/+page.svelte, index.ts, webhooks.ts |
| 2 | Create internal user-by-company and tool-credential endpoints | bb4b1d5 | internal.ts, routes/index.ts |

## What Was Fixed

### Bug 1 — OAuth redirectUri (TOOL-01, TOOL-02)
Both `belt/+page.svelte` and `catalog/+page.svelte` had `redirectUri` pointing to `window.location.origin + '/tools'` (a SvelteKit page). The OAuth provider would redirect back to a page that has no handler, completing the OAuth flow silently without storing the tokens.

Fixed to: `window.location.origin + '/api/akasa/tool-connections/oauth/' + toolId + '/callback'`

This targets the Express callback handler (`GET /akasa/tool-connections/oauth/:toolId/callback`) via SvelteKit's `/api/...` reverse proxy.

### Bug 2 — Plugin Install Path
`services/akasa-server/src/index.ts` used 4x `../` to resolve the plugin path:
```
../../../../packages/plugins/akasa-tool-nexus
```
This goes above the project root. Fixed to 3x `../` which correctly reaches the project root from `services/akasa-server/src/`.

### Bug 3 — Webhook Dispatch (TOOL-07, TOOL-08)
`webhooks.ts` called the old Paperclip v1 heartbeat endpoint:
```
/api/companies/default/agents/:id/heartbeat
```
with body `{ context, payload }`. Fixed to the correct Paperclip v2 wakeup endpoint:
```
/api/agents/:id/wakeup
```
with body `{ source: 'webhook', triggerDetail: '...', payload }`.

### New Feature — Internal Endpoints (TOOL-03)
Created `services/akasa-server/src/routes/internal.ts` with two endpoints for the Tool Nexus plugin worker:

1. `GET /akasa/internal/user-by-company/:companyId` — translates Paperclip company UUID to BetterAuth userId by querying `company_memberships` in the Paperclip DB
2. `GET /akasa/internal/tool-credential/:userId/:toolId` — returns a valid (auto-refreshed) access token for the tool connection from the Akasa DB

These endpoints allow the plugin worker to resolve credentials without needing `@claw/db` or `DATABASE_URL` in the Paperclip plugin worker environment.

## Deviations from Plan

None — plan executed exactly as written.

## Test Stubs

Placeholder test files created at:
- `packages/plugins/akasa-tool-nexus/src/__tests__/credential-bridge.test.ts`
- `services/akasa-server/src/__tests__/internal-endpoint.test.ts`

These will be filled during Plan 02 execution when the credential-bridge implementation is updated to use the new internal endpoints.

## Known Stubs

None — no placeholders in functional code.

## Verification Results

1. Old `window.location.origin + '/tools'` redirectUri — 0 occurrences (PASS)
2. New `/api/akasa/tool-connections/oauth/` redirectUri — 2 occurrences: belt + catalog (PASS)
3. `'../../../packages/plugins/akasa-tool-nexus'` in index.ts — 1 occurrence (PASS)
4. `companies/default` in webhooks.ts — 0 occurrences (PASS)
5. `user-by-company` in internal.ts — 1 occurrence (PASS)
6. `tool-credential` in internal.ts — 1 occurrence (PASS)
7. Test stub files exist (PASS)
8. All 98 existing akasa-server tests pass (PASS)

## Self-Check: PASSED

All files exist and all commits verified.
