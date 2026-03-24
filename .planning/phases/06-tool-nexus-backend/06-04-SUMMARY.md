---
phase: 06-tool-nexus-backend
plan: "04"
subsystem: akasa-server/oauth-flow
tags: [oauth, tool-connections, credential-encryption, express-routes]
dependency_graph:
  requires: [06-01, 06-02, 06-03]
  provides: [oauth-authorization-code-flow, oauth-provider-configs]
  affects: [tool-connections-crud]
tech_stack:
  added: []
  patterns: [oauth-authorization-code-flow, base64url-state-encoding, upsert-on-conflict]
key_files:
  created:
    - services/akasa-server/src/services/oauth-providers.ts
    - services/akasa-server/src/routes/oauth-flow.ts
    - services/akasa-server/src/__tests__/oauth-flow.test.ts
  modified:
    - services/akasa-server/src/routes/index.ts
decisions:
  - base64url encodes JSON state (userId+toolId+redirectUri) — avoids separate session/cache for CSRF state; server-only use
  - upsert pattern: try insert first, catch unique violation, fallback to update — consistent with tool-connections.ts approach
  - next(err) not called after redirect on token exchange failure — Express 5 double-response guard; error is logged then redirected
  - google-sheets uses extraAuthorizeParams for access_type=offline+prompt=consent — provider-specific config rather than hardcoded in route
metrics:
  duration_minutes: 15
  completed_date: "2026-03-24T16:13:24Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 06 Plan 04: OAuth Flow Routes Summary

OAuth authorization code flow added to Tool Nexus backend — browser-initiated start/callback routes for HubSpot, Slack, and Google Sheets, reusing existing credential encryption and tool_connections persistence infrastructure.

## What Was Built

Two new Express routes mounted at `/akasa/tool-connections`:

- `GET /oauth/:toolId/start` — redirects the user's browser to the provider's authorization page with state-encoded context
- `GET /oauth/:toolId/callback` — exchanges the returned authorization code for tokens, encrypts them via `encryptCredential()`, and upserts a `tool_connections` row

Provider configs centralized in `oauth-providers.ts` with correct authorize/token URLs, scopes, env var names, and optional extra authorize params.

## Commits

| Hash | Message |
|------|---------|
| 1393847 | feat(06-04): OAuth provider config and authorization code flow routes |
| 0e4f718 | test(06-04): OAuth flow route tests — 9 tests covering start/callback routes |

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create OAuth provider config and flow routes | 1393847 | oauth-providers.ts, oauth-flow.ts, routes/index.ts |
| 2 | Tests for OAuth flow routes (TDD) | 0e4f718 | __tests__/oauth-flow.test.ts |

## Test Results

- 9 new tests, all passing
- Full suite: 73 tests passing (9 new + 64 existing)
- Coverage: start route (redirect construction, missing params, unknown provider, missing env vars), callback route (token exchange, encryption, DB upsert, success redirect, missing code), Slack's ok:true response format

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- oauth-providers.ts: FOUND
- oauth-flow.ts: FOUND
- oauth-flow.test.ts: FOUND
- 06-04-SUMMARY.md: FOUND
- Commit 1393847: FOUND
- Commit 0e4f718: FOUND
