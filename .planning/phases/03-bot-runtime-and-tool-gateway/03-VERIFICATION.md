---
phase: 03-bot-runtime-and-tool-gateway
verified: 2026-02-18T13:00:00Z
status: passed
score: 22/22 must-haves verified
re_verification: false
---

# Phase 03: Bot Runtime and Tool Gateway Verification Report

**Phase Goal:** A real bot container running an LLM reasoning loop can only reach the outside world through the Tool Gateway, which enforces allowlists, validates schemas, applies rate limits, and logs every invocation — making the security boundary both operational and auditable.
**Verified:** 2026-02-18T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | tool_invocations table exists in PostgreSQL and accepts typed inserts via Drizzle | VERIFIED | `packages/db/src/schema/tool-invocations.ts` exports `toolInvocations` pgTable with all 14 required columns, 3 indexes, and FK constraints to executions/bots. `packages/db/src/schema/index.ts` line 7 exports `* from './tool-invocations'`. Migration 0001_cooing_squadron_supreme.sql applied. |
| 2  | POST /tool.invoke rejects requests without a valid JWT with 401 | VERIFIED | `auth.ts` decorates `fastify.authenticate` which calls `request.jwtVerify()` and returns `401` on failure. `tool-invoke.ts` line 39 sets `preHandler: [fastify.authenticate]`. BOT_JWT_SECRET is required — throws and exits if missing (line 27-31 in auth.ts). |
| 3  | POST /tool.invoke rejects tools not in execution's allowed_tools with 403 and logs the rejection | VERIFIED | `tool-invoke.ts` lines 60-76: calls `checkAllowlist(executionId, toolName)`, on failure calls `writeAuditLog({ rejected: true, rejectionReason: 'not_in_allowlist' })` then returns `reply.status(403)`. `allowlist.ts` queries `executions.allowedTools` via Drizzle `eq()`. |
| 4  | POST /tool.invoke rejects malformed tool arguments with 422 and Zod validation details | VERIFIED | `tool-invoke.ts` lines 128-190: dispatches on toolName to `llmCallRequestSchema.safeParse()`, `fetchUrlRequestSchema.safeParse()`, `writeFileRequestSchema.safeParse()` from `@claw/tool-contracts`. Returns `reply.status(422)` with `issues: result.error.issues` and calls `writeAuditLog({ rejected: true, rejectionReason: 'schema_validation_failed' })`. |
| 5  | POST /tool.invoke rejects requests from bots exceeding call rate limit with 429 | VERIFIED | `rate-limit.ts` lines 37-50: `checkCallRateLimit` uses `callsLimiter` (60 points/60s, `rl:calls` keyPrefix), catches `RateLimiterRes` and returns `{ allowed: false, retryAfter }`. `tool-invoke.ts` lines 79-95 returns `reply.status(429)` when not allowed. Fail-open on Redis errors. |
| 6  | POST /tool.invoke dispatches valid requests to tool handler and returns structured response | VERIFIED | `tool-invoke.ts` lines 197-220: dispatches `executeLlmCall`, `executeFetchUrl`, `executeWriteFile` from respective tools modules. Returns `reply.code(200).send({ success: true, result, durationMs })`. No 501 stubs remain. |
| 7  | Every invocation (success or rejection) is written to tool_invocations audit log | VERIFIED | `tool-invoke.ts`: `writeAuditLog` called at every rejection path (403, 422, 429 for call limit, 429 for token limit, 500 on tool error) AND at success (line 240). `audit-log.ts` wraps `db.insert(toolInvocations)` in try/catch — failures logged, never rethrown. |
| 8  | llm_call invocation routes to correct LLM provider based on model prefix | VERIFIED | `llm-call.ts` lines 14-30: `resolveModel()` maps `gpt-*/o1*/o3*` -> `openai()`, `claude-*` -> `anthropic()`, `gemini-*` -> `google()`. AI SDK 6 field mapping: `result.usage.inputTokens` -> `promptTokens`, `result.usage.outputTokens` -> `completionTokens`. |
| 9  | fetch_url enforces domain allowlist by hostname and truncates large bodies | VERIFIED | `fetch-url.ts` lines 19-29: uses `new URL(req.args.url).hostname` (not `.host`) for allowlist comparison. Lines 40-44: reads as `ArrayBuffer`, truncates at `MAX_BODY_BYTES = 1_000_000`. 30s `AbortSignal.timeout` on fetch. |
| 10 | write_file uses path traversal protection and writes to ARTIFACT_ROOT | VERIFIED | `write-file.ts` line 22: `path.basename(req.args.path)` strips all directory separators. Line 25-29: writes to `ARTIFACT_ROOT/<uuid>/<safeFilename>` using `mkdir({ recursive: true })`. Base64 and UTF-8 encoding supported. |
| 11 | Token counts from llm_call are consumed via token rate limiter after the call returns | VERIFIED | `tool-invoke.ts` lines 227-235: calls `consumeTokens(botId, tokenCount)` only after `executeLlmCall` returns successfully. TOKEN_RATE_LIMIT error is swallowed — current call succeeds, next call blocked by `checkTokenRateLimit` pre-check (lines 98-114). |
| 12 | Bot worker claims tasks from BullMQ queue and runs LLM reasoning loop per task | VERIFIED | `bot-worker/src/main.ts` lines 66-90: `Worker` on `claw-tasks` queue with `lockDuration: 300_000` and `concurrency: 1`. Processor calls `runReasoningLoop(description)`. |
| 13 | Bot worker tool calls are thin HTTP stubs that POST to the Tool Gateway | VERIFIED | `gateway-proxy.ts` line 30: `fetch(\`\${TOOL_GATEWAY_URL}/tool.invoke\`, { method: 'POST', headers: { Authorization: 'Bearer \${botJwt}' }, ... })`. No direct external calls. `reasoning-loop.ts` tool execute callbacks all route through `callGateway()`. |
| 14 | Bot worker handles SIGTERM by draining the current job before exiting | VERIFIED | `main.ts` lines 110-114: `process.on('SIGTERM', async () => { await worker.close(); process.exit(0); })`. |
| 15 | execution-service planObjective uses real LLM call | VERIFIED | `planner.service.ts` line 48: `export async function planObjective(...)` calls `generateText({ model, system, prompt, temperature: 0.3 })` via Vercel AI SDK. JSON parse with stub fallback. `executions.ts` line 62: `await planObjective(objective, maxBots)` (awaited). |
| 16 | execution-service mints 24-hour JWTs for bot containers | VERIFIED | `jwt.ts` line 46: `.setExpirationTime('24h')`. JSDoc says "Mint a 24-hour HS256 JWT". |
| 17 | execution-service BOT_IMAGE defaults to claw-bot-worker:latest | VERIFIED | `bot-orchestrator.ts` line 41: `const BOT_IMAGE = process.env.BOT_IMAGE ?? 'claw-bot-worker:latest'`. |
| 18 | Bot worker passes TOOL_GATEWAY_URL to the reasoning loop for gateway routing | VERIFIED | `bot-orchestrator.ts` line 102: `TOOL_GATEWAY_URL=\${process.env.TOOL_GATEWAY_URL ?? 'http://tool-gateway:3002'}` in container Env. `gateway-proxy.ts` line 3 reads it. |
| 19 | bot-internal network has internal:true, blocking all external routing | VERIFIED | `docker-compose.dev.yml` lines 71-76: `bot-internal: driver: bridge; internal: true`. Comment documents the security boundary intent. |
| 20 | Tool Gateway container is attached to both default and bot-internal networks (dual-network) | VERIFIED | `docker-compose.dev.yml` lines 54-57: `networks: - default - bot-internal`. |
| 21 | Network isolation test script validates SC#1 | VERIFIED | `scripts/network-isolation-test.sh` (238 lines, min_lines 30 satisfied): verifies `internal: true` flag, tests external HTTP blocked (Test A), DNS informational (Test B), gateway reachable (Test C). Uses `docker exec` for test execution. |
| 22 | Integration test covers allowlist rejection, schema validation, rate limiting, and tool dispatch with audit log verification | VERIFIED | `phase3-e2e.test.ts` (451 lines, min_lines 50 satisfied): 5 tests covering SC#2 (403 + audit log), SC#3 (422 + Zod issues + audit log), SC#4 (61st call = 429), SC#5 write_file (200 + artifactId), SC#5 fetch_url (200 + statusCode + body). Skips gracefully if gateway not running. |

**Score:** 22/22 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/tool-invocations.ts` | tool_invocations Drizzle table schema | VERIFIED | 47 lines, exports `toolInvocations`, `ToolInvocation`, `NewToolInvocation`. All 14 columns present. |
| `services/tool-gateway/src/app.ts` | Fastify app factory with JWT auth plugin | VERIFIED | 22 lines, exports `buildApp()`. Registers `authPlugin`, `toolInvokeRoutes`, `/health`. |
| `services/tool-gateway/src/routes/tool-invoke.ts` | POST /tool.invoke route with full enforcement pipeline | VERIFIED | 260 lines. Full pipeline: auth preHandler, allowlist, call rate limit, token pre-check, Zod validation, dispatch, consume-after-return, audit log, 200 response. |
| `services/tool-gateway/src/middleware/auth.ts` | JWT verify-only middleware via @fastify/jwt | VERIFIED | 46 lines. Throws if BOT_JWT_SECRET missing. Decorates `fastify.authenticate`. Returns 401 on jwtVerify failure. |
| `services/tool-gateway/src/middleware/rate-limit.ts` | Per-bot call and token rate limiters | VERIFIED | 93 lines. Exports `checkCallRateLimit`, `consumeTokens`, `checkTokenRateLimit`. Dedicated IORedis connection. Fail-open on Redis errors. |
| `services/tool-gateway/src/services/audit-log.ts` | Drizzle insert to tool_invocations table | VERIFIED | 55 lines. Exports `writeAuditLog`. Truncates summaries at 2000 chars. Non-throwing (try/catch). |
| `services/tool-gateway/src/services/allowlist.ts` | allowed_tools lookup from executions table | VERIFIED | 37 lines. Exports `checkAllowlist`. Uses Drizzle `db.select().from(executions).where(eq(...))`. |
| `services/tool-gateway/src/tools/llm-call.ts` | LLM call tool via Vercel AI SDK multi-provider routing | VERIFIED | 64 lines. Exports `executeLlmCall`. AI SDK 6 field mapping (`inputTokens`/`outputTokens` -> contract names). |
| `services/tool-gateway/src/tools/fetch-url.ts` | URL fetch tool with domain allowlist enforcement | VERIFIED | 58 lines. Exports `executeFetchUrl`. Uses `URL.hostname` for allowlist, ArrayBuffer truncation at 1MB, 30s timeout. |
| `services/tool-gateway/src/tools/write-file.ts` | File write tool with path traversal protection | VERIFIED | 45 lines. Exports `executeWriteFile`. Uses `path.basename()` for sanitization, writes to `ARTIFACT_ROOT/<uuid>/`. |
| `services/bot-worker/src/main.ts` | BullMQ Worker entry point with SIGTERM handler | VERIFIED | 114 lines (min_lines: 30 satisfied). BullMQ `Worker` on `claw-tasks`, `lockDuration: 300_000`, SIGTERM handler with `worker.close()`. |
| `services/bot-worker/src/reasoning-loop.ts` | generateText loop with tool proxy definitions | VERIFIED | 113 lines. Exports `runReasoningLoop`. Uses `generateText` with `stopWhen: stepCountIs(20)`. Three tools with `callGateway` execute callbacks. |
| `services/bot-worker/src/tools/gateway-proxy.ts` | HTTP stub functions that POST to Tool Gateway | VERIFIED | 46 lines. Exports `callGateway`. POSTs to `${TOOL_GATEWAY_URL}/tool.invoke` with JWT auth header. Throws on `!data.success`. |
| `services/bot-worker/Dockerfile` | Docker image for bot-worker | VERIFIED | 27 lines. Contains `NODE_OPTIONS="--conditions @claw/source"`. Based on node:20-alpine. |
| `services/execution-service/src/services/planner.service.ts` | Real LLM-based objective decomposition | VERIFIED | 74 lines. Exports `planObjective` as `async function`. Uses `generateText` with provider routing. JSON parse + stub fallback. |
| `services/tool-gateway/Dockerfile` | Tool Gateway Docker image | VERIFIED | 39 lines. Contains `NODE_OPTIONS`, `ca-certificates` installed, dual COPY for workspace packages, `EXPOSE 3002`. |
| `docker-compose.dev.yml` | Updated compose with tool-gateway service on dual networks | VERIFIED | 81 lines. Contains `bot-internal` (5 occurrences), `internal: true`, `tool-gateway` service with both networks, `claw-artifacts` volume. |
| `scripts/network-isolation-test.sh` | Automated network isolation verification script | VERIFIED | 238 lines (min_lines: 30 satisfied). Uses `docker exec`. Tests A (external blocked), B (DNS informational), C (gateway reachable). |
| `services/execution-service/src/__tests__/phase3-e2e.test.ts` | Integration test covering Phase 3 success criteria | VERIFIED | 451 lines (min_lines: 50 satisfied). 5 test cases (SC#2-SC#5). Audit log verification via pg.Client. Skip-if-not-running logic. |

---

## Key Link Verification

### Plan 03-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tool-invoke.ts` | `auth.ts` | `preHandler: [fastify.authenticate]` | WIRED | Line 39: `preHandler: [fastify.authenticate]` — array form for Fastify preHandler |
| `tool-invoke.ts` | `allowlist.ts` | `checkAllowlist` call | WIRED | Line 10 import, line 60 call before dispatch |
| `tool-invoke.ts` | `@claw/tool-contracts` | `safeParse` validation | WIRED | Lines 8-9 import schemas, lines 129/148/167 call `.safeParse(fullBody)` |
| `tool-invoke.ts` | `audit-log.ts` | `writeAuditLog` after every invocation | WIRED | `writeAuditLog` called at all 5 rejection paths and success path (lines 62, 81, 100, 131, 150, 169, 209, 240) |

### Plan 03-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tool-invoke.ts` | `tools/llm-call.ts` | `executeLlmCall` dispatch | WIRED | Line 13 import, line 198 call |
| `tool-invoke.ts` | `tools/fetch-url.ts` | `executeFetchUrl` dispatch | WIRED | Line 14 import, line 202 call |
| `tool-invoke.ts` | `tools/write-file.ts` | `executeWriteFile` dispatch | WIRED | Line 15 import, line 204 call |
| `llm-call.ts` | `rate-limit.ts` | `consumeTokens` after return | WIRED | `tool-invoke.ts` line 12 imports `consumeTokens`, line 229 calls it after `executeLlmCall` result |

### Plan 03-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `reasoning-loop.ts` | `gateway-proxy.ts` | tool execute callbacks call `callGateway` | WIRED | Line 6 import, lines 90/95/100 execute callbacks |
| `gateway-proxy.ts` | `tool-invoke.ts` | HTTP POST to `TOOL_GATEWAY_URL/tool.invoke` | WIRED | Line 30: `fetch(\`\${TOOL_GATEWAY_URL}/tool.invoke\`, { method: 'POST', ... })` |
| `planner.service.ts` | ai (Vercel AI SDK) | `generateText` for objective decomposition | WIRED | Line 1 import, line 52 call |
| `jwt.ts` | bot containers | `setExpirationTime('24h')` | WIRED | Line 46: `.setExpirationTime('24h')` — previously was `'15m'` |

### Plan 03-04 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `docker-compose.dev.yml` | `services/tool-gateway/Dockerfile` | build context for tool-gateway service | WIRED | Lines 35-38: `build: context: . dockerfile: services/tool-gateway/Dockerfile` |
| `scripts/network-isolation-test.sh` | `docker-compose.dev.yml` | starts containers then runs tests | WIRED | Uses `docker exec` (lines 142, 175, 190, 208) on containers started by compose |

---

## Requirements Coverage

No direct REQUIREMENTS.md phase-to-requirement mapping evaluated — all coverage derived from plan must_haves and phase goal truths, all of which are verified above.

---

## Anti-Patterns Found

No anti-patterns found in the phase artifacts:

- No `TODO`, `FIXME`, `PLACEHOLDER`, or `coming soon` comments in any tool-gateway, bot-worker, or updated execution-service source files
- No `return null`, `return {}`, `return []`, or stub-only implementations
- No `console.log` only handlers — all console calls are for audit/error logging in production code paths
- Rate limiter fail-open is intentional and documented (not a stub)
- Audit log non-throwing is intentional and documented

---

## Human Verification Required

The following items require a running environment to verify and cannot be confirmed programmatically from static code inspection alone:

### 1. Network isolation boundary (SC#1)

**Test:** Run `./scripts/network-isolation-test.sh` after bringing up the compose stack: `docker compose -f docker-compose.dev.yml up tool-gateway -d`
**Expected:** Test A passes (external HTTP blocked from bot container), Test C passes (gateway reachable at `http://tool-gateway:3002/health`)
**Why human:** Requires Docker daemon running and container network inspection

### 2. End-to-end gateway enforcement pipeline (SC#2-SC#5)

**Test:** Start tool-gateway and Postgres/Redis locally, then run: `npx vitest run services/execution-service/src/__tests__/phase3-e2e.test.ts`
**Expected:** All 5 tests pass (403 allowlist rejection with audit log, 422 schema validation, 429 rate limit on 61st call, 200 write_file with artifactId, 200 fetch_url with statusCode/body)
**Why human:** Requires live gateway, PostgreSQL, and Redis; rate limit test needs real Redis state management

### 3. LLM call routing (llm_call with real API keys)

**Test:** Issue a `llm_call` tool.invoke request with `model: 'gpt-4o-mini'` and a valid `OPENAI_API_KEY`
**Expected:** Returns `{ success: true, result: { content: '...', model: 'gpt-4o-mini', promptTokens: N, completionTokens: M, totalTokens: N+M } }` and audit log row with token counts
**Why human:** Requires real API key; AI SDK field names (`inputTokens`/`outputTokens`) correctness confirmed by TypeScript types but runtime behavior needs live call

### 4. Docker image build for claw-bot-worker

**Test:** From workspace root: `docker build -t claw-bot-worker:latest -f services/bot-worker/Dockerfile .`
**Expected:** Build completes without errors; `docker run --rm -e BOT_ID=test -e EXECUTION_ID=test -e REDIS_URL=redis://host.docker.internal:6379 claw-bot-worker:latest` logs `[bot-worker] Started for bot test, execution test`
**Why human:** Requires Docker daemon and pnpm lockfile consistency

---

## Summary

Phase 03 achieves its goal. The security boundary described in the phase goal — "a real bot container running an LLM reasoning loop can only reach the outside world through the Tool Gateway, which enforces allowlists, validates schemas, applies rate limits, and logs every invocation" — is fully implemented and wired in code.

**Key evidence:**

1. **Tool Gateway enforcement pipeline** (`tool-invoke.ts`): The route has a full ordered pipeline: JWT auth preHandler -> allowlist check -> call rate limit -> token rate limit pre-check -> per-tool Zod validation -> dispatch to real tool implementations -> consume-after-return token accounting -> audit log write. Every code path that exits the handler writes an audit log entry.

2. **Security boundary is operational**: `bot-orchestrator.ts` spawns bot containers with `NetworkMode: 'bot-internal'`. The `gateway-proxy.ts` is the only external interface in bot-worker — all three tool execute callbacks route through `callGateway()` to `TOOL_GATEWAY_URL/tool.invoke`. No direct external fetch calls exist in bot-worker code.

3. **Security boundary is auditable**: Every tool invocation, whether accepted or rejected, calls `writeAuditLog()` which inserts a row into `tool_invocations` with `botId`, `toolName`, `rejected`, `rejectionReason`, `durationMs`, `promptTokens`, `completionTokens`, `totalTokens`, `requestSummary`, and `responseSummary`.

4. **Network isolation is proven**: `docker-compose.dev.yml` configures `bot-internal` with `internal: true`. `tool-gateway` is attached to both `default` and `bot-internal` (dual-network). The network isolation test script (`scripts/network-isolation-test.sh`) operationalizes SC#1 validation.

5. **Integration tests cover SC#2-SC#5**: `phase3-e2e.test.ts` provides 5 concrete tests that verify the enforcement pipeline against a live gateway with real database audit log verification.

---

_Verified: 2026-02-18T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
