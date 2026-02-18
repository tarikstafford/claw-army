# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** Phase 2 — Core Execution Pipeline

## Current Position

Phase: 2 of 6 (Core Execution Pipeline)
Plan: 3 of 4 in current phase
Status: Executing
Last activity: 2026-02-18 — Phase 2 Plan 3 complete. Bot orchestrator (dockerode spawn/stop), in-memory bot registry, HS256 JWT minting (jose), Pub/Sub event publisher with Zod validation, idle checker, and QueueEvents listener.

Progress: [██████▒░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 6.4 min
- Total execution time: 45 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4/4 | 31 min | 8 min |
| 02-core-execution-pipeline | 3/4 | 14 min | 4.7 min |

**Recent Trend:**
- Last 5 plans: 01-04 (15 min), 02-01 (3 min), 02-02 (5 min), 02-03 (6 min)
- Trend: Fast — Phase 2 plans lightweight on top of established Phase 1 foundation

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 watch]: GCP bot hosting topology (Cloud Run Jobs vs GCE/dockerode) is the single most consequential unresolved architectural fork. Recommend a prototype to validate Cloud Run Jobs API latency under concurrent bot spawning before Phase 2 commits to either path.
- [Phase 3 watch]: Tool Gateway auth patterns and bot JWT rotation strategy are MEDIUM confidence. May need targeted research during Phase 3 planning.
- [Phase 5 watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Plan to iterate after first real execution data is collected.
- [Phase 2+ watch]: Services that import @claw/event-schemas or @claw/tool-contracts will need Zod as a runtime dependency in their own package.json. execution-service already has zod installed.
- [Phase 2+ watch]: Any new service using @claw/db or other internal packages must add NODE_OPTIONS --conditions @claw/source to its tsx scripts.
- [Deferred]: GCP resources (Cloud SQL, Memorystore, Pub/Sub, VPC, Artifact Registry) not yet provisioned. Terraform config is valid and committed. Run terraform apply when GCP project is ready. Does NOT block Phase 2 (Phase 2 uses local docker-compose.dev.yml).

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 02-03-PLAN.md — bot orchestrator, registry, JWT, event publisher. Ready for 02-04.
Resume file: None
