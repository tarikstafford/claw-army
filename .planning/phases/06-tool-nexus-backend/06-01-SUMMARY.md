---
phase: 06-tool-nexus-backend
plan: "01"
subsystem: tool-nexus-backend
tags: [tool-nexus, credential-encryption, token-refresh, rate-limiting, crud-routes]
dependency_graph:
  requires: []
  provides: [tool-connections-schema, credential-encryption, token-manager, rate-limiter, tool-connections-crud-api]
  affects: [akasa-server, packages/db]
tech_stack:
  added: []
  patterns:
    - AES-256-GCM credential encryption via node:crypto (no external packages)
    - Proactive OAuth token refresh within 5-minute expiry window
    - In-memory per-user per-tool rate limiter (Map-based buckets)
    - Express Router factory pattern for CRUD endpoints
key_files:
  created:
    - packages/db/src/schema/tool-connections.ts
    - packages/db/src/schema/tool-invocation-logs.ts
    - packages/db/migrations/akasa/0012_tool_nexus_tables.sql
    - services/akasa-server/src/services/credential-encryption.ts
    - services/akasa-server/src/services/token-manager.ts
    - services/akasa-server/src/middleware/tool-rate-limiter.ts
    - services/akasa-server/src/routes/tool-connections.ts
    - services/akasa-server/src/__tests__/credential-encryption.test.ts
    - services/akasa-server/src/__tests__/token-manager.test.ts
  modified:
    - packages/db/src/schema/index.ts
    - services/akasa-server/src/routes/index.ts
decisions:
  - AES-256-GCM IV stored as hex (not base64) to follow hex-everywhere convention in this codebase
  - TOOL_ENCRYPTION_KEY falls back to PAPERCLIP_SECRETS_MASTER_KEY — avoids requiring a second env var in dev/CI
  - In-memory rate limiter Map is acceptable for single-process akasa-server; Redis migration path documented in code comment
  - Hard delete for tool connections (not soft delete) — simplicity wins; connections can be re-added
  - eslint-disable-next-line any on db.update().set() — Drizzle's partial update type is not inferrable from a Record<string, unknown>; this is a known Drizzle limitation
  - Pre-existing TSC errors in Paperclip submodule and workspace packages are out-of-scope — confirmed they pre-existed before this plan
metrics:
  duration: 309s
  completed: "2026-03-24T12:12:14Z"
  tasks_completed: 2
  files_changed: 11
---

# Phase 06 Plan 01: Tool Nexus Backend Data Foundation Summary

AES-256-GCM credential store with proactive OAuth refresh, per-user per-tool rate limiting, full CRUD API for tool connections, and invocation audit log schema.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | DB schema + migration + credential encryption + token manager + rate limiter | d6e8bc3 |
| 2 | Tool connection CRUD routes + mount on akasa-server | ee989a4 |

## What Was Built

### DB Schema

Two new Drizzle tables in `packages/db/src/schema/`:

**`tool_connections`** — stores per-user per-tool OAuth and API key credentials with:
- Encrypted access token, refresh token, and API key fields (ciphertext + IV + auth tag)
- `keyVersion` column for future AES key rotation
- `tokenExpiresAt` for proactive OAuth refresh
- `rateLimitResetAt` for rate limit state tracking
- Unique constraint on `(userId, toolId)` — one connection per tool per user

**`tool_invocation_logs`** — immutable audit log with:
- `toolId`, `action`, `agentId` (nullable), `userId`, `connectionId`
- `latencyMs`, `success`, `errorMessage`
- `requestSummary` and `responseSummary` (first 500 chars each)

### SQL Migration

`0012_tool_nexus_tables.sql` creates both tables with 4 performance indexes.

### Credential Encryption (`credential-encryption.ts`)

- `encryptCredential(plaintext)` → `{ ciphertext, iv, tag, keyVersion }` using `node:crypto` AES-256-GCM
- `decryptCredential({ ciphertext, iv, tag })` → plaintext (throws on tamper)
- Random 12-byte IV per encryption (ciphertexts differ for same input)
- Key loaded from `TOOL_ENCRYPTION_KEY` (base64) or `PAPERCLIP_SECRETS_MASTER_KEY` fallback

### Token Manager (`token-manager.ts`)

- `getValidToken(connectionId, refreshFn)` — single entry point for both `api_key` and `oauth` connections
- For api_key: decrypt and return immediately
- For OAuth: compare `tokenExpiresAt` against now + 5 minutes; if within window, call `refreshFn`, re-encrypt, persist
- On refresh failure: set `status='expired'` in DB and re-throw
- Provider refresh factories: `refreshHubSpotToken()`, `refreshGoogleToken()`, `refreshSlackToken()` — factory pattern, read client ID/secret from env

### Rate Limiter Middleware (`tool-rate-limiter.ts`)

- `toolRateLimiter(opts?)` — Express middleware factory
- Defaults: 100 req/60s per `${userId}:${toolId}` key
- In-memory Map with bucket reset at window boundary
- On limit exceeded: fire-and-forget DB update sets `status='rate_limited'`, returns 429 `{ error, retryAfter }`
- Fail-open if userId/toolId not extractable from request

### CRUD Routes (`routes/tool-connections.ts`)

Mounted at `/akasa/tool-connections`:

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List user's connections (encrypted fields stripped) |
| POST | / | Create OAuth or API key connection |
| DELETE | /:id | Hard delete connection |
| PATCH | /:id/refresh | Re-encrypt updated OAuth tokens |
| POST | /:id/test | Verify credential decryption |
| GET | /:id/logs | Latest 100 invocation logs |

All routes: try/catch → 500 `{ error: message }`. Encrypted fields always omitted from responses.

## Deviations from Plan

**[Rule 1 - Bug] Migration file numbered 0012, not 0003**

The plan specified `0003_tool_nexus_tables.sql` but the existing migration in `packages/db/migrations/akasa/` is already at `0011_add_paperclip_agent_id.sql`. Used `0012` to avoid conflict.

**[Out of scope] Pre-existing TSC errors in Paperclip submodule**

`pnpm --filter akasa-server exec tsc --noEmit` reports errors in `../../paperclip/server/src/**` and `../../packages/db/src/index.ts` (missing `.js` extensions). Confirmed pre-existing before this plan via `git stash` check. Out-of-scope; documented in deferred-items if needed.

## Test Results

```
Test Files  7 passed (7)
Tests       58 passed (58)
```

New tests: 10 (5 credential-encryption + 5 token-manager)
Pre-existing tests: 48 — all still passing.

## Known Stubs

None. All API routes are wired to real DB operations. The rate limiter's in-memory store is intentional (single-process acceptable per plan spec) with a documented Redis migration path.

## Self-Check: PASSED

Files verified:
- packages/db/src/schema/tool-connections.ts — FOUND
- packages/db/src/schema/tool-invocation-logs.ts — FOUND
- packages/db/migrations/akasa/0012_tool_nexus_tables.sql — FOUND
- services/akasa-server/src/services/credential-encryption.ts — FOUND
- services/akasa-server/src/services/token-manager.ts — FOUND
- services/akasa-server/src/middleware/tool-rate-limiter.ts — FOUND
- services/akasa-server/src/routes/tool-connections.ts — FOUND
- services/akasa-server/src/__tests__/credential-encryption.test.ts — FOUND
- services/akasa-server/src/__tests__/token-manager.test.ts — FOUND

Commits verified:
- d6e8bc3 — feat(06-tool-nexus-backend-01): DB schema, migration, credential encryption...
- ee989a4 — feat(06-tool-nexus-backend-01): tool connection CRUD routes...
