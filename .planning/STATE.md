# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** Phase 3 — Bot Runtime and Tool Gateway (IN PROGRESS)

## Current Position

Phase: 3 of 6 (Bot Runtime and Tool Gateway) — COMPLETE
Plan: 3 of 3 in current phase — COMPLETE
Status: Phase 3 complete — bot-worker service with LLM reasoning loop, Tool Gateway proxy, upgraded planner, 24h JWTs
Last activity: 2026-02-18 — Phase 3 Plan 3 complete. bot-worker service created with BullMQ Worker, AI SDK 6 reasoning loop (stopWhen: stepCountIs(20)), thin HTTP callGateway() proxy. planObjective() upgraded to async LLM call. JWT expiry 15m -> 24h. BOT_IMAGE default updated to claw-bot-worker:latest.

Progress: [████████████] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 6.1 min
- Total execution time: 96 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4/4 | 31 min | 8 min |
| 02-core-execution-pipeline | 4/4 | 29 min | 7.3 min |
| 03-bot-runtime-and-tool-gateway | 3/3 | 36 min | 12 min |

**Recent Trend:**
- Last 5 plans: 02-04 (15 min), 03-01 (25 min), 03-02 (4 min), 03-03 (7 min)
- Trend: Phase 3 complete at 36 min total. Plans with complex Docker/TypeScript integration (03-01, 03-03) take longer; pure implementation (03-02) very fast.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Bot hosting — dockerode on GCE VM recommended over Cloud Run Jobs for MVP (faster lifecycle control, tighter per-bot management). Cloud Run Jobs is the long-term target but has latency trade-offs. NEEDS prototype validation in Phase 2.
- [Pre-Phase 1]: Task queue — BullMQ 5 on Redis recommended over Postgres row-level locking. If Redis is not yet available, Postgres locking is a valid fallback to reconcile in Phase 2.
- [Pre-Phase 1]: Single-tenant MVP, no auth complexity. No Stripe. Billing is metering and display only.
- [Phase 01-data-foundation]: moduleResolution: Bundler in packages/db tsconfig to fix drizzle-kit esbuild-register .js import incompatibility
- [Phase 01-data-foundation]: Integer cents for all monetary values (budgetCapCents, amountCents) - never float
- [Phase 01-data-foundation]: Extensionless imports in schema files for drizzle-kit esbuild-register CJS compatibility
- [Phase 01-data-foundation/01-02]: ESNext+Bundler moduleResolution applied to all new packages (shared-types, event-schemas, tool-contracts) for consistency and pnpm resolution compatibility
- [Phase 01-data-foundation/01-02]: result field optional on tool-contracts response schemas to support both success and error cases with a single type
- [Phase 01-data-foundation/01-02]: executionStatusSchema defined inline in execution-events.ts (not imported from @claw/shared-types) to keep event-schemas dep-free from shared-types
- [Phase 01-data-foundation/01-02]: z.record(z.string(), z.unknown()) for metadata fields — Zod v4 requires explicit key/value type args (unlike v3)
- [Phase 01-data-foundation/01-03]: deletion_protection = false on Cloud SQL — Terraform google provider 7.x defaults to true, blocking terraform destroy in dev
- [Phase 01-data-foundation/01-03]: Memorystore has no public IP by design — local dev uses Docker redis:7, GCP Redis is VPC-only
- [Phase 01-data-foundation/01-03]: Pub/Sub dead-letter + retry policy (10s-300s backoff, max 5 attempts) on all subscriptions for production reliability
- [Phase 01-data-foundation/01-04]: Python 3 http.server for gateway stub instead of nc loop -- nc has reconnect gap causing race condition in sequential test execution
- [Phase 01-data-foundation/01-04]: Test 3 (DNS resolution) is informational only -- Docker embedded DNS resolves external names on internal:true networks but TCP connections to resolved IPs are blocked
- [Phase 01-data-foundation/01-04]: Readiness probe added to egress-test.sh -- ensures gateway is accepting connections before tests run
- [Phase 02-core-execution-pipeline/02-01]: NODE_OPTIONS --conditions @claw/source required in tsx scripts to resolve @claw/db via internal packages strategy (tsx falls back to default export condition ./dist/index.js which doesn't exist without build step)
- [Phase 02-core-execution-pipeline/02-01]: transitionExecution defers transition path validation to Phase 3 -- Phase 2 only enforces atomic WHERE-clause guarding
- [Phase 02-core-execution-pipeline/02-01]: All Phase 2 runtime deps (bullmq, dockerode, jose, ioredis) installed upfront in execution-service to avoid repeated package.json changes across plans 02-02 through 02-04
- [Phase 02-core-execution-pipeline/02-02]: Pass plain { host, port } RedisOptions objects to BullMQ Queue/Worker instead of pre-constructed IORedis instances — avoids dual-version type conflict (bullmq@5 bundles ioredis@5.9.2, service has ioredis@5.9.3)
- [Phase 02-core-execution-pipeline/02-02]: workerConnection uses maxRetriesPerRequest: null — mandatory for BullMQ workers to survive Redis reconnection without silently stopping
- [Phase 02-core-execution-pipeline/02-02]: planObjective is a numbered-subtask stub (no LLM) intentionally — Phase 3 replaces with real LLM decomposition
- [Phase 02-core-execution-pipeline/02-03]: Plain RedisOptions objects for BullMQ QueueEvents connections (spread from queueConnection) — pre-constructed IORedis instances cause TS2322 type conflict between ioredis@5.9.2 (bullmq bundled) and ioredis@5.9.3 (direct dep)
- [Phase 02-core-execution-pipeline/02-03]: explicit Queue<TaskJobData, string, string> type params required — BullMQ 5.x ExtractNameType inference fails with plain interface DataType in strict TSC
- [Phase 02-core-execution-pipeline/02-03]: lastTaskClaimedAt refreshed for ALL bots in execution on QueueEvents 'active' — prevents sibling bots from idle-terminating while other bots process tasks in the same execution
- [Phase 02-core-execution-pipeline/02-03]: Zod-first publishing with console.error (no throw) — event pipeline failures must not crash the orchestrator
- [Phase 02-core-execution-pipeline/02-04]: NODE_OPTIONS=--conditions @claw/source must be set via ENV in Dockerfile — tsx inside containers can't find @claw/db source without it (no dist/ in dev)
- [Phase 02-core-execution-pipeline/02-04]: vitest.config.ts requires resolve.alias for @claw/* workspace packages — Vitest/Vite 7.x doesn't honor NODE_OPTIONS --conditions @claw/source for Vite module resolution
- [Phase 02-core-execution-pipeline/02-04]: host.docker.internal injected as DATABASE_URL/REDIS_URL for bot containers — allows containers in bot-internal network to reach host postgres/redis on macOS/Windows Docker Desktop
- [Phase 02-core-execution-pipeline/02-04]: bot-internal Docker network must be pre-created: docker network create bot-internal
- [Phase 03-bot-runtime-and-tool-gateway/03-01]: BOT_JWT_SECRET is required at tool-gateway startup — fails hard (throws/exits) if missing, unlike execution-service which uses a dev fallback
- [Phase 03-bot-runtime-and-tool-gateway/03-01]: Loose TypeBox body schema (Type.Partial) + strict Zod per-tool validation — enables JWT preHandler to fire before schema validation rejects body with 400
- [Phase 03-bot-runtime-and-tool-gateway/03-01]: Dedicated ioredis connection for rate-limiter-flexible (not shared with BullMQ), enableOfflineQueue:false for fail-fast behavior
- [Phase 03-bot-runtime-and-tool-gateway/03-01]: consume-after-return pattern for token rate limiting — checkTokenRateLimit does zero-cost pre-check, consumeTokens called post-dispatch in Plan 03-02
- [Phase 03-bot-runtime-and-tool-gateway/03-01]: Audit log failures swallowed (console.error only) to never crash the request handler
- [Phase 03-bot-runtime-and-tool-gateway/03-01]: @claw/tool-contracts only exports via main entry (no sub-path exports) — import from '@claw/tool-contracts' not '@claw/tool-contracts/src/llm-call'
- [Phase 03-bot-runtime-and-tool-gateway/03-02]: AI SDK 6 usage fields are inputTokens/outputTokens (not promptTokens/completionTokens) — mapped to contract names at executeLlmCall boundary
- [Phase 03-bot-runtime-and-tool-gateway/03-02]: URL.hostname (not .host) for fetch_url allowlist — .host includes port, enabling bypass via credentialed URL injection
- [Phase 03-bot-runtime-and-tool-gateway/03-02]: path.basename() for write_file path sanitization — strips all directory components regardless of OS separator
- [Phase 03-bot-runtime-and-tool-gateway/03-02]: consume-after-return TOKEN_RATE_LIMIT is swallowed in route handler — current llm_call already returned; next call blocked by pre-check
- [Phase 03-bot-runtime-and-tool-gateway]: AI SDK 6 uses inputSchema (not parameters) for tool() — FlexibleSchema accepts Zod v4 directly
- [Phase 03-bot-runtime-and-tool-gateway]: Local Zod schemas in bot-worker reasoning-loop to avoid Zod v4 enum type mismatch with AI SDK internal types
- [Phase 03-bot-runtime-and-tool-gateway]: planObjective LLM direct call (not via Tool Gateway) per decision #3; JSON fallback prevents pipeline stall
- [Phase 03-bot-runtime-and-tool-gateway]: lockDuration 300s on BullMQ Worker for LLM reasoning loops; 30s stub-bot default causes false stalled-job failures

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5 watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Plan to iterate after first real execution data is collected.
- [Phase 3+ watch]: Any new service or Dockerfile using @claw/db or other internal packages must add NODE_OPTIONS --conditions @claw/source (ENV in Dockerfile, flag in tsx scripts).
- [Phase 3+ watch]: E2E tests requiring Docker bots need bot-internal network pre-created and claw-stub-bot:latest image built. Document in new service READMEs.
- [Deferred]: GCP resources (Cloud SQL, Memorystore, Pub/Sub, VPC, Artifact Registry) not yet provisioned. Terraform config is valid and committed. Run terraform apply when GCP project is ready.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 03-03-PLAN.md — bot-worker service with AI SDK 6 reasoning loop and Tool Gateway proxy, plus execution-service planner LLM upgrade. 2 tasks, 2 commits. Phase 3 complete. Ready for Phase 4 (real-time and observability).
Resume file: None
