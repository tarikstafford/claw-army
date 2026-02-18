# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** Phase 6 — UI Command Center

## Current Position

Phase: 6 of 6 (UI Command Center) — IN PROGRESS
Plan: 3 of 5 in current phase — COMPLETE
Status: Phase 6 Plan 3 complete — Live Execution View at /executions/[id] with SSE activity feed, 5s polled metrics panel (active bots/bot-hours/budget remaining/estimated cost), color-coded status banner, and red-border guardrail event distinction.
Last activity: 2026-02-19 — Phase 6 Plan 3 complete. Created services/ui/src/routes/executions/[id]/+page.svelte (392 lines). TypeScript clean (316 files, 0 errors). 1 task, 1 commit (5d75e99).

Progress: [██████████████████████] 88%

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: 5.2 min
- Total execution time: 139 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4/4 | 31 min | 8 min |
| 02-core-execution-pipeline | 4/4 | 29 min | 7.3 min |
| 03-bot-runtime-and-tool-gateway | 4/4 | 53 min | 13 min |
| 04-control-plane-services | 3/3 | 11 min | 3.7 min |
| 05-performance-intelligence-and-dna-capture | 3/3 | 8 min | 2.7 min |
| 06-ui-command-center | 3/5 | 9 min | 3 min |

**Recent Trend:**
- Last 5 plans: 05-03 (4 min), 06-01 (3 min), 06-02 (3 min), 06-03 (3 min)
- Trend: Consistent 3 min per plan — SvelteKit UI components and routes completing in ~3 min each.

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
- [Phase 03-bot-runtime-and-tool-gateway/03-04]: Alpine Docker images require ca-certificates for Node.js native fetch() HTTPS support — apk add ca-certificates in Dockerfile
- [Phase 03-bot-runtime-and-tool-gateway/03-04]: Rate limiter fail-open on Redis connection errors — non-RateLimiterRes errors return allowed:true with console.error, never 500
- [Phase 03-bot-runtime-and-tool-gateway/03-04]: Test bot container: install curl/nslookup on default network before switching to bot-internal — apk cannot download on internal network
- [Phase 03-bot-runtime-and-tool-gateway/03-04]: Docker Desktop VPN-Kit intercepts HTTPS — use host-based gateway for E2E tests (system CAs work), not containerized gateway
- [Phase 04-control-plane-services/04-01]: Pub/Sub topic env vars default to Terraform naming without env suffix — emulator auto-creates topics on first publish, local dev works without suffix
- [Phase 04-control-plane-services/04-01]: IORedis singleton in execution.service.ts uses enableOfflineQueue: true (default) — write-path should queue on slow Redis, not fail fast (contrast: rate-limiter uses enableOfflineQueue:false for fail-fast)
- [Phase 04-control-plane-services/04-01]: Budget key initialization is non-fatal (try/catch, log only) — billing engine handles missing keys gracefully (no cap = allow all spending per GARD-01 Lua script design)
- [Phase 04-control-plane-services/04-01]: budget:spend initialized explicitly to 0 — ensures monitoring key exists before any spend occurs; INCRBY would create on non-existent key but explicit SET is clearer
- [Phase 04-control-plane-services/04-02]: Rate violation detection uses Postgres tool_invocations COUNT/SUM queries (not rate-limiter-flexible internal Redis keys) — internal key format is implementation detail that could change across versions
- [Phase 04-control-plane-services/04-02]: Deny-list uses per-key SETEX guardrail:denied:{botId} (not SADD to a set) for automatic TTL expiration without manual cleanup
- [Phase 04-control-plane-services/04-02]: Guardrail Watchdog starts globally in main.ts (not per-execution like idle checker) — rate/loop violations are per-bot concerns; one watchdog covers all active bots
- [Phase 04-control-plane-services/04-02]: Idle timeout guardrail_triggered action is 'terminated' (not 'revoked') — idle bots are stopped cleanly, not deny-listed; they won't make future requests
- [Phase 04-control-plane-services/04-03]: Two separate Pub/Sub subscriptions in Billing Engine — billing-events-sub (handleBillingMessage) and bot-lifecycle-billing-sub (handleBotLifecycleMessage) — bot lifecycle events have type: bot_started/bot_stopped NOT type: billing_event
- [Phase 04-control-plane-services/04-03]: bot-lifecycle-billing-sub uses different name from Guardrail Watchdog's bot-lifecycle-sub so each service maintains independent cursor/position on the same topic
- [Phase 04-control-plane-services/04-03]: Pub/Sub emulator guard in E2E tests — check PUBSUB_EMULATOR_HOST availability before calling publish functions to avoid 60s connection timeouts
- [Phase 04-control-plane-services/04-03]: TODO (Production) — Terraform needs to add bot-lifecycle-billing-sub subscription to bot-lifecycle topic; emulator auto-creates it locally
- [Phase 05-performance-intelligence-and-dna-capture/05-01]: Task counts read from tasks table (claimed_by_bot_id) NOT from bots.tasksCompleted/tasksFailed — these counter columns are always 0 (not maintained by current bot runtime code)
- [Phase 05-performance-intelligence-and-dna-capture/05-01]: Score weights (40/30/20/10) and tier thresholds (75/40) are env-var configurable — SCORE_WEIGHT_SUCCESS, SCORE_WEIGHT_EFFICIENCY, SCORE_WEIGHT_COST, SCORE_WEIGHT_STABILITY, TIER_HIGH_THRESHOLD, TIER_MEDIUM_THRESHOLD
- [Phase 05-performance-intelligence-and-dna-capture/05-01]: Cross-bot min/max normalization with guard: if max===min, return 100 (all bots equal = give full credit, prevents NaN)
- [Phase 05-performance-intelligence-and-dna-capture/05-01]: Bots with 0 completed tasks get cost_efficiency_score=0 — no useful work done at any cost
- [Phase 05-performance-intelligence-and-dna-capture/05-01]: Weights normalized to sum to 1 before composite calculation so non-100-summing env overrides work correctly
- [Phase 05-performance-intelligence-and-dna-capture/05-02]: N+1 leaderboard enrichment is acceptable for MVP (maxBots cap is 20); production optimization deferred — use single JOIN/subquery when bot counts grow
- [Phase 05-performance-intelligence-and-dna-capture/05-02]: sql template literal used for ORDER BY composite_score DESC NULLS LAST — Drizzle's orderBy(desc(...)) does not support NULLS LAST natively
- [Phase 05-performance-intelligence-and-dna-capture/05-03]: Elite condition 2 uses strict > (not >=): compositeScore > executionAvgScore * (1 + DNA_ABOVE_AVERAGE_PCT/100)
- [Phase 05-performance-intelligence-and-dna-capture/05-03]: SC#5 E2E test calls identifyAndCaptureDna directly (not runPerformancePipeline) — score-engine idempotency guard would skip re-scoring but DNA capture is version-incremented
- [Phase 05-performance-intelligence-and-dna-capture/05-03]: argumentPatterns extraction enforces PII isolation at code level: only Object.keys(requestSummary), never values
- [Phase 06-ui-command-center/06-01]: buildApp() converted to async — required to await app.register() for @fastify/cors and @fastify/sse; main.ts updated to await buildApp()
- [Phase 06-ui-command-center/06-01]: Per-connection Pub/Sub subscription strategy (Option A): 4 subscriptions per SSE connection on execution/task/bot/guardrail topics; simpler than EventEmitter fan-out for MVP
- [Phase 06-ui-command-center/06-01]: Dual disconnect cleanup in SSE route: reply.sse.onClose() + request.raw.on('close') with cleanedUp boolean guard for abnormal TCP disconnects
- [Phase 06-ui-command-center/06-01]: subscription.delete() wrapped in .catch(() => {}) for Pub/Sub emulator compatibility — non-fatal in local dev, required for GCP quota hygiene
- [Phase 06-ui-command-center/06-01]: Redis-authoritative live budget: metrics.ts reads budget:spend:{id} and budget:cap:{id} from Redis; DB billing_events is audit trail not live counter
- [Phase 06-ui-command-center/06-01]: Correlated subselects in billing.ts: single SELECT with sql template subqueries across billing_events/telemetry/tasks — avoids N+1 for history endpoint
- [Phase 06-ui-command-center/06-02]: UI self-contained types: types.ts defines its own interfaces instead of importing from @claw/shared-types — avoids workspace resolution complexity in Vite/SvelteKit build
- [Phase 06-ui-command-center/06-02]: Svelte 5 event handlers: onchange/onsubmit attributes instead of deprecated on:change/on:submit directives — consistent with Svelte 5 runes mode
- [Phase 06-ui-command-center/06-02]: SPA mode via +layout.js ssr=false + adapter-static 200.html fallback — handles client-side routing without per-route SSR opt-out
- [Phase 06-ui-command-center/06-03]: page.params.id ?? '' null-coalescing required until svelte-kit sync runs and generates [id] route types — sync must run before svelte-check passes for dynamic routes
- [Phase 06-ui-command-center/06-03]: Dual $effect pattern (separate effects for SSE vs polling) instead of single effect — enables independent cleanup and avoids re-establishing SSE on every metrics poll update
- [Phase 06-ui-command-center/06-03]: Terminal state guard in SSE and polling effects — prevents reconnecting SSE or re-enabling polling for already-completed/failed/stopped executions

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5 watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Plan to iterate after first real execution data is collected.
- [Phase 3+ watch]: Any new service or Dockerfile using @claw/db or other internal packages must add NODE_OPTIONS --conditions @claw/source (ENV in Dockerfile, flag in tsx scripts).
- [Phase 3+ watch]: E2E tests requiring Docker bots need bot-internal network pre-created and claw-stub-bot:latest image built. Document in new service READMEs.
- [Deferred]: GCP resources (Cloud SQL, Memorystore, Pub/Sub, VPC, Artifact Registry) not yet provisioned. Terraform config is valid and committed. Run terraform apply when GCP project is ready.
- [Production]: Terraform needs to add bot-lifecycle-billing-sub subscription to bot-lifecycle topic for Billing Engine to receive bot_started/bot_stopped events in GCP.

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 06-03-PLAN.md — Live Execution View at /executions/[id]: SSE activity feed (connectSSE, newest-first, max 100 events), 5s polled metrics panel (active bots, bot-hours, budget remaining, estimated cost), color-coded status banner (running/completed/failed/paused/queued), red-border guardrail event distinction, terminal-state guard stops polling/SSE. 1 task, 1 commit (5d75e99). TypeScript clean (316 files, 0 errors). Phase 6 Plan 3 of 5 complete.
Resume file: None
