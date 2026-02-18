---
phase: 02-core-execution-pipeline
plan: 03
subsystem: orchestration
tags: [dockerode, bullmq, jose, jwt, pubsub, google-cloud-pubsub, redis, ioredis]

requires:
  - phase: 02-01
    provides: execution-service Fastify scaffold with POST /executions and transitionExecution state machine
  - phase: 01-data-foundation
    provides: @claw/db (bots table, executions table), @claw/event-schemas (Zod schemas for bot/task/execution events)

provides:
  - "Bot registry: in-memory Map<botId, BotEntry> tracking active containers with lastTaskClaimedAt for idle detection"
  - "JWT module: mintBotJwt/verifyBotJwt (HS256, 15-min expiry) using jose library"
  - "Event publisher: Pub/Sub publish for bot_started, bot_stopped, execution_status_changed, task_claimed, task_completed with Zod validation"
  - "Bot orchestrator: spawnBot (dockerode container create/start with 512MB/1CPU/AutoRemove), stopBot, spawnBotsForExecution with max_bots enforcement"
  - "Idle checker: setInterval ORCH-05 implementation terminating bots idle for 5+ minutes"
  - "QueueEvents listener: refreshes lastTaskClaimedAt for all execution bots on BullMQ 'active' events"

affects:
  - 02-04-execution-lifecycle
  - 03-bot-runtime

tech-stack:
  added:
    - "dockerode@4.0.9 — Docker container create/start/stop/inspect via Unix socket"
    - "jose@6.1.3 — HS256 JWT signing and verification (ESM-native, no Node crypto dependency)"
    - "@google-cloud/pubsub@5.2.3 — Pub/Sub event publishing with emulator support via PUBSUB_EMULATOR_HOST"
    - "bullmq@5.69.3 QueueEvents — event listener for 'active' job events"
  patterns:
    - "Plain RedisOptions spread for BullMQ connections: avoids IORedis dual-version type conflict (bullmq bundles ioredis@5.9.2, service has ioredis@5.9.3)"
    - "Zod-first event publishing: parse() validates before Buffer.from(JSON.stringify()) — errors logged but not thrown to prevent orchestrator crash"
    - "Postgres-first bot lifecycle: insert bot row before container creation; mark failed in catch block before rethrowing"
    - "lastTaskClaimedAt shared across execution bots: when any task becomes active, reset timer for all bots in that execution to prevent premature idle termination"
    - "AutoRemove: true on all containers — no explicit container.remove() needed; catch 409/304 on stop()"

key-files:
  created:
    - "services/execution-service/src/orchestrator/bot-registry.ts"
    - "services/execution-service/src/orchestrator/jwt.ts"
    - "services/execution-service/src/orchestrator/bot-orchestrator.ts"
    - "services/execution-service/src/events/publisher.ts"
  modified:
    - "services/execution-service/src/queue/task-queue.ts"
    - "services/execution-service/src/services/planner.service.ts"

key-decisions:
  - "Plain RedisOptions objects for BullMQ connections instead of pre-constructed IORedis instances — avoids TSC type conflict from dual ioredis versions in pnpm store"
  - "explicit Queue<TaskJobData, string, string> type parameter to resolve BullMQ 5.x NameType ExtractNameType inference ambiguity in strict TSC"
  - "getBot() directly imported (not dynamic import) in stopBot — fixes incorrect dynamic import pattern from initial draft"
  - "botRegistry imported at module level in startIdleChecker — avoids unnecessary dynamic imports in hot interval path"
  - "Spread queueConnection for QueueEvents dedicated connection — queueConnection is a plain object, spreading is correct; IORedis.duplicate() not applicable"

patterns-established:
  - "Bot spawn: insert Postgres row first ('spawning'), then create container, then update row ('idle') — failure updates to 'failed' before rethrow"
  - "Lifecycle event publishing: Zod parse -> JSON Buffer -> pubsub.topic().publishMessage() — errors swallowed (console.error only)"
  - "Idle detection: two-tier (QueueEvents resets lastTaskClaimedAt for all execution bots; setInterval checks registry every 30s)"

duration: 6min
completed: 2026-02-18
---

# Phase 2 Plan 3: Bot Orchestrator, Registry, JWT, and Event Publisher Summary

**Bot orchestrator with dockerode container spawn (512MB/1CPU/AutoRemove), in-memory registry, HS256 JWT minting via jose, Pub/Sub event publisher with Zod validation, and 5-minute idle termination via QueueEvents-refreshed lastTaskClaimedAt**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-18T08:59:37Z
- **Completed:** 2026-02-18T09:05:38Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Bot registry (in-memory Map with register/unregister/get/count) provides single process-local source of truth for active containers
- JWT module mints 15-minute HS256 tokens with botId+executionId payload; verifyBotJwt extracts and validates; injected as BOT_JWT container env var
- Event publisher validates all events with @claw/event-schemas Zod schemas before publishing to Pub/Sub; errors logged but not thrown
- Bot orchestrator completes full spawn lifecycle: UUID, JWT, Postgres insert, dockerode createContainer+start+inspect, Postgres update, registry register, bot_started event
- Idle checker runs every 30 seconds, terminates bots that have not had any task activity for 5 minutes (ORCH-05)
- QueueEvents 'active' listener resets lastTaskClaimedAt for all bots in an execution when any task becomes active — prevents sibling bots from being prematurely idle-terminated

## Task Commits

1. **Task 1: Create bot registry, JWT module, and Pub/Sub event publisher** - `2d8ecff` (feat)
2. **Task 2: Create bot orchestrator with dockerode spawn, max_bots enforcement, and idle termination** - `0a68492` (feat)

## Files Created/Modified

- `services/execution-service/src/orchestrator/bot-registry.ts` — BotEntry interface, botRegistry Map, register/unregister/getBot/getBotsForExecution/getActiveBotCount
- `services/execution-service/src/orchestrator/jwt.ts` — mintBotJwt/verifyBotJwt using jose SignJWT/jwtVerify; BOT_JWT_SECRET env var with dev fallback warning
- `services/execution-service/src/orchestrator/bot-orchestrator.ts` — spawnBot, stopBot, spawnBotsForExecution, startIdleChecker, stopIdleChecker, startQueueEventListener, stopQueueEventListener
- `services/execution-service/src/events/publisher.ts` — publishBotStarted/Stopped/ExecutionStatusChanged/TaskClaimed/TaskCompleted; BOT_EVENTS_TOPIC/EXECUTION_EVENTS_TOPIC/TASK_EVENTS_TOPIC constants
- `services/execution-service/src/queue/task-queue.ts` — Fixed IORedis dual-version type conflict: replaced IORedis instances with parseRedisUrl() plain objects; explicit Queue<TaskJobData, string, string> type params
- `services/execution-service/src/services/planner.service.ts` — Staged previously-untracked file from 02-02 partial work

## Decisions Made

- **Plain RedisOptions for BullMQ connections:** pnpm store has both ioredis@5.9.2 (bundled by bullmq) and ioredis@5.9.3 (direct dep). Passing pre-constructed `new IORedis()` instances causes TS2322 type incompatibility on the `connecting` protected property. Using plain `{ host, port, maxRetriesPerRequest }` objects avoids this — BullMQ constructs its own IORedis internally from options.
- **Explicit Queue generic types:** BullMQ 5.x `ExtractNameType<DataTypeOrJob, DefaultNameType>` inference fails with strict TypeScript when DataTypeOrJob is a plain interface (not a Job subtype). Explicit `Queue<TaskJobData, string, string>` resolves.
- **Zod-first publishing (no throw):** Event publishing errors use console.error only — orchestrator must not crash due to observability pipeline failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed IORedis dual-version TypeScript type conflict in task-queue.ts**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Existing task-queue.ts used `new IORedis()` instances passed as BullMQ `ConnectionOptions`. pnpm store contains both ioredis@5.9.2 (bullmq's bundled dep) and ioredis@5.9.3 (execution-service direct dep). TypeScript errors TS2322 on the `AbstractConnector.connecting` protected property — the two IORedis class instances are not assignable to each other.
- **Fix:** Replaced IORedis instances with a `parseRedisUrl()` function that returns plain `{ host, port, password?, db?, maxRetriesPerRequest? }` objects. BullMQ accepts plain RedisOptions and constructs its own IORedis instances internally. Also added explicit `Queue<TaskJobData, string, string>` type parameters to fix TS2345 NameType inference.
- **Files modified:** `services/execution-service/src/queue/task-queue.ts`
- **Verification:** `pnpm --filter @claw/execution-service exec tsc --noEmit` exits 0
- **Committed in:** `2d8ecff` (Task 1 commit)

**2. [Rule 3 - Blocking] Staged task-queue.ts and planner.service.ts from partial plan 02-02 work**
- **Found during:** Pre-execution git status check
- **Issue:** plan 02-02 partially executed (planner.service.ts written but not committed; task-queue.ts existed with prior content but also untracked). Plan 02-03 imports `queueConnection`, `TASK_QUEUE_NAME`, `TaskJobData` from `../queue/task-queue` which is a 02-02 artifact — blocking compilation.
- **Fix:** Reviewed existing files, fixed task-queue.ts type errors, and staged both files as part of Task 1 commit.
- **Files modified:** `services/execution-service/src/queue/task-queue.ts`, `services/execution-service/src/services/planner.service.ts`
- **Verification:** tsc --noEmit exits 0 after fix
- **Committed in:** `2d8ecff` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes essential for TypeScript compilation. No scope creep — fixed existing broken state and type compatibility issues.

## Issues Encountered

- `npx tsx -e` does not support top-level await (uses older esbuild that targets CJS). Workaround: use project-local `pnpm --filter @claw/execution-service exec tsx <file>` with `.mts` extension files for smoke tests.
- Dynamic import in stopBot initial draft was incorrect pattern — corrected to use statically imported `getBot` function.

## User Setup Required

None — no external service configuration required. Docker Desktop must be running for container operations (already running per smoke test). Pub/Sub uses emulator in local dev via PUBSUB_EMULATOR_HOST.

## Next Phase Readiness

- All four modules (bot-orchestrator, bot-registry, jwt, publisher) compile and are ready for Plan 02-04 to wire into the execution lifecycle
- JWT smoke test verified: mintBotJwt produces valid tokens, verifyBotJwt decodes correctly
- Docker client connects to Docker Desktop (confirmed via docker.info())
- Bot registry CRUD operations verified via smoke test
- Plan 02-04 will call spawnBotsForExecution from POST /executions handler and wire the idle checker to the execution lifecycle

---
*Phase: 02-core-execution-pipeline*
*Completed: 2026-02-18*
