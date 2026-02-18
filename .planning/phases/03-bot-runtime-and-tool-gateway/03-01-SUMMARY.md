---
phase: 03-bot-runtime-and-tool-gateway
plan: 01
subsystem: api
tags: [fastify, jwt, drizzle, postgres, redis, rate-limiter-flexible, zod, tool-gateway, ioredis]

requires:
  - phase: 01-data-foundation
    provides: Drizzle DB client, executions and bots table schemas
  - phase: 02-core-execution-pipeline
    provides: JWT minting pattern (mintBotJwt/verifyBotJwt), bot JWT payload shape (botId, executionId)

provides:
  - tool_invocations Drizzle table schema with 14 columns, 3 indexes, FK constraints
  - Drizzle migration 0001_cooing_squadron_supreme.sql applied to PostgreSQL
  - @claw/tool-gateway Fastify service on port 3002
  - POST /tool.invoke with full enforcement pipeline (auth, allowlist, rate limit, Zod validation, audit log)
  - GET /health endpoint (unauthenticated)
  - JWT verify-only middleware via @fastify/jwt (BOT_JWT_SECRET required)
  - Per-bot Redis rate limiting: 60 calls/min and 100k tokens/min via rate-limiter-flexible
  - Tool allowlist enforcement via executions.allowed_tools Drizzle query
  - Audit log writer (writeAuditLog) — inserts to tool_invocations, non-throwing
  - Tool dispatch stubs returning 501 (Plan 03-02 fills in implementations)

affects:
  - 03-02-bot-runtime-tool-implementations
  - Any future phase that invokes tools via tool-gateway
  - Billing and telemetry phases that query tool_invocations for token usage

tech-stack:
  added:
    - fastify@^5.7.4 (tool-gateway)
    - "@fastify/jwt@^9.1.0"
    - "@fastify/rate-limit@^10.3.0"
    - "@fastify/type-provider-typebox@^6.1.0"
    - "@sinclair/typebox@^0.34.48"
    - rate-limiter-flexible@^5.0.3
    - fastify-plugin@^5.0.1
    - ioredis@^5.9.3 (tool-gateway dedicated Redis connection)
    - jose@^6.1.3 (tool-gateway)
    - zod@^4.3.6 (tool-gateway)
  patterns:
    - JWT verify-only via @fastify/jwt with fastify-plugin (decorate fastify.authenticate)
    - preHandler auth gate that returns 401 before route handler runs
    - Loose TypeBox body schema with strict Zod per-tool validation downstream
    - RateLimiterRedis.consume() throws RateLimiterRes on limit — must catch by instanceof
    - consumeTokens uses consume-after-return pattern (called AFTER tool returns)
    - Audit log is fire-and-forget: wrapped in try/catch, never throws
    - All Redis connections for rate limiting are separate from BullMQ connections

key-files:
  created:
    - packages/db/src/schema/tool-invocations.ts
    - packages/db/migrations/0001_cooing_squadron_supreme.sql
    - services/tool-gateway/package.json
    - services/tool-gateway/tsconfig.json
    - services/tool-gateway/src/main.ts
    - services/tool-gateway/src/app.ts
    - services/tool-gateway/src/middleware/auth.ts
    - services/tool-gateway/src/middleware/rate-limit.ts
    - services/tool-gateway/src/services/audit-log.ts
    - services/tool-gateway/src/services/allowlist.ts
    - services/tool-gateway/src/routes/tool-invoke.ts
  modified:
    - packages/db/src/schema/index.ts (added tool-invocations export)
    - pnpm-lock.yaml (new dependencies)

key-decisions:
  - "BOT_JWT_SECRET is required — auth plugin throws and process exits if missing (unlike execution-service which falls back to dev secret)"
  - "Loose TypeBox body schema (Type.Partial) at route level + strict Zod per-tool validation inside handler — ensures JWT preHandler fires before schema validation rejects the request"
  - "Dedicated ioredis connection for rate limiting (not shared with BullMQ) using enableOfflineQueue:false for fail-fast behavior"
  - "Rate limiter uses consume-after-return pattern for tokens — checkTokenRateLimit does a zero-cost pre-check, consumeTokens is called post-dispatch (Plan 03-02)"
  - "Tool dispatch stubs return 501 — Plan 03-02 plugs in real implementations without touching the enforcement pipeline"
  - "Audit log failures are swallowed (console.error only) to never crash the request handler"

patterns-established:
  - "Fastify plugin pattern: fastify-plugin wraps @fastify/jwt registration and fastify.authenticate decoration"
  - "Tool request pipeline order: JWT auth -> allowlist -> call rate limit -> token pre-check -> Zod validation -> dispatch -> audit log"
  - "Required field guard at handler entry: check toolName/botId/executionId/invocationId before any DB/Redis calls"

duration: 25min
completed: 2026-02-18
---

# Phase 3 Plan 01: Tool Gateway Enforcement Pipeline Summary

**Fastify POST /tool.invoke enforcement pipeline: JWT auth, tool allowlist (executions.allowed_tools), per-bot Redis rate limiting (60 calls/100k tokens per min), Zod v4 schema validation, and audit logging to a new tool_invocations PostgreSQL table**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-18T00:00:00Z
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 11 created, 2 modified

## Accomplishments

- `tool_invocations` DB table with 14 columns, 3 indexes, FK constraints to executions and bots — migration generated and applied
- `@claw/tool-gateway` Fastify service starts on port 3002, health endpoint responds 200
- POST /tool.invoke enforces: 401 (no JWT), 403 (disallowed tool), 429 (rate limit), 422 (Zod validation failure), 501 (stub dispatch) — all rejection paths write audit log rows

## Task Commits

1. **Task 1: Add tool_invocations DB table and generate migration** - `7c4eb17` (feat)
2. **Task 2: Scaffold Tool Gateway service with full enforcement pipeline** - `fa71d54` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/db/src/schema/tool-invocations.ts` — Drizzle table definition with all 14 columns, indexes, FKs, and inferred types
- `packages/db/src/schema/index.ts` — Added `export * from './tool-invocations'`
- `packages/db/migrations/0001_cooing_squadron_supreme.sql` — Applied migration
- `services/tool-gateway/package.json` — New workspace package @claw/tool-gateway
- `services/tool-gateway/tsconfig.json` — Extends base tsconfig, module: ESNext, moduleResolution: Bundler
- `services/tool-gateway/src/main.ts` — Entry point, dotenv, buildApp(), listen on port 3002
- `services/tool-gateway/src/app.ts` — Fastify app factory with TypeBoxTypeProvider, auth plugin, routes
- `services/tool-gateway/src/middleware/auth.ts` — @fastify/jwt registration, fastify.authenticate decorator, fails hard if BOT_JWT_SECRET missing
- `services/tool-gateway/src/middleware/rate-limit.ts` — callsLimiter (60/60s), tokensLimiter (100k/60s), checkCallRateLimit, consumeTokens, checkTokenRateLimit
- `services/tool-gateway/src/services/audit-log.ts` — writeAuditLog Drizzle insert with truncation, non-throwing
- `services/tool-gateway/src/services/allowlist.ts` — checkAllowlist queries executions.allowedTools via Drizzle
- `services/tool-gateway/src/routes/tool-invoke.ts` — POST /tool.invoke full pipeline

## Decisions Made

- **BOT_JWT_SECRET is required at startup** — unlike execution-service which has a dev fallback, the tool gateway is the security boundary so it throws and exits if the secret is missing
- **Loose TypeBox + strict Zod hybrid** — TypeBox `Type.Partial` at route level passes body validation even for empty bodies, enabling the JWT preHandler to run first (return 401 before 400)
- **Dedicated Redis for rate limiting** — separate IORedis connection with `enableOfflineQueue: false` for fast failure, not shared with BullMQ to avoid type conflicts
- **consume-after-return pattern for tokens** — `consumeTokens` is called post-llm_call (Plan 03-02), `checkTokenRateLimit` does a zero-cost pre-check before dispatch to avoid wasting calls on bots already over limit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import path for @claw/tool-contracts schemas**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** Plan specified importing from `@claw/tool-contracts/src/llm-call` etc. but the package only exports via `@claw/tool-contracts` main (no sub-path exports configured)
- **Fix:** Changed all three imports to `import { llmCallRequestSchema, fetchUrlRequestSchema, writeFileRequestSchema } from '@claw/tool-contracts'`
- **Files modified:** services/tool-gateway/src/routes/tool-invoke.ts
- **Verification:** `tsc --noEmit` passed with no errors
- **Committed in:** fa71d54 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added required field guard before pipeline execution**
- **Found during:** Task 2 (implementing route handler with optional TypeBox fields)
- **Issue:** Using `Type.Partial` for the body schema means all fields are `string | undefined`. Need to guard against missing required fields before passing to allowlist/rate-limit checks (which expect `string`)
- **Fix:** Added explicit null guard at handler entry: `if (!toolName || !botId || !executionId || !invocationId)` returning 422 — this also correctly narrows TypeScript types to `string`
- **Files modified:** services/tool-gateway/src/routes/tool-invoke.ts
- **Verification:** TypeScript strict mode passes, undefined fields return 422 before any downstream calls
- **Committed in:** fa71d54 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing critical guard)
**Impact on plan:** Both auto-fixes necessary for correct TypeScript compilation and safe runtime behavior. No scope creep.

## Issues Encountered

- **Docker not running initially** — Docker daemon was not running when migration was attempted. Fixed by starting Docker Desktop and waiting for container readiness. Migration succeeded on retry.
- **Zod v4 UUID validator rejects non-v4 UUIDs** — Initial test UUIDs used all-zeros format (`00000000-0000-0000-0000-000000000001`) which fails Zod v4's strict UUID regex. Used Python's `uuid.uuid4()` to generate valid test UUIDs for final verification.

## User Setup Required

None — no external service configuration required beyond what Phase 2 established. The tool-gateway reads `BOT_JWT_SECRET`, `DATABASE_URL`, and `REDIS_URL` from env (same as execution-service pattern).

## Next Phase Readiness

- Tool Gateway service is fully operational: enforcement pipeline (auth, allowlist, rate limit, Zod validation, audit log) is complete
- Tool dispatch stubs return 501 — Plan 03-02 only needs to plug in `llm_call`, `fetch_url`, and `write_file` implementations
- `tool_invocations` table is live in PostgreSQL, ready to receive audit records from Plan 03-02
- Rate limiting Redis keys are scoped per-bot (`rl:calls:{botId}` and `rl:tokens:{botId}`)

## Self-Check: PASSED

All 12 files created/modified confirmed on disk. Both task commits (7c4eb17, fa71d54) verified in git log.

---
*Phase: 03-bot-runtime-and-tool-gateway*
*Completed: 2026-02-18*
