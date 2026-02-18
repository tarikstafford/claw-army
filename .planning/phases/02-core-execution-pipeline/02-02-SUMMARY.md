---
phase: 02-core-execution-pipeline
plan: 02
subsystem: api
tags: [bullmq, ioredis, redis, postgres, drizzle, fastify, task-queue, planner]

# Dependency graph
requires:
  - phase: 02-01
    provides: execution-service scaffold with POST /executions, transitionExecution state machine, @claw/db tasks table

provides:
  - Deterministic stub planner (planObjective) that decomposes objectives into N parallel subtasks without LLM calls
  - BullMQ task queue module with lease semantics (30s lock, 15s stall check) and separated connection options
  - Async post-201 planning loop: Postgres task rows + BullMQ job creation + execution state transition to running

affects:
  - 02-03 (bot polling will consume tasks from BullMQ claw-tasks queue)
  - 02-04 (bot spawning needs taskId/executionId from the task rows created here)
  - 03-planning (real LLM planner replaces planObjective stub)

# Tech tracking
tech-stack:
  added: [bullmq@5, ioredis@5 (plain options object pattern to avoid dual-version type conflict)]
  patterns:
    - Dual-write: Postgres-first task creation then BullMQ enqueue (orphan-safe, reconcilable)
    - Separated BullMQ connections: queueConnection (default maxRetries) vs workerConnection (maxRetriesPerRequest=null)
    - setImmediate for non-blocking async trigger after HTTP reply
    - Plain { host, port } options objects passed to BullMQ instead of pre-constructed IORedis instances

key-files:
  created:
    - services/execution-service/src/services/planner.service.ts
    - services/execution-service/src/queue/task-queue.ts
  modified:
    - services/execution-service/src/routes/executions.ts

key-decisions:
  - "Pass plain { host, port } RedisOptions objects to BullMQ Queue/Worker instead of pre-constructed IORedis instances — avoids dual-version type conflict (bullmq@5 bundles ioredis@5.9.2, service has ioredis@5.9.3)"
  - "workerConnection uses maxRetriesPerRequest: null — mandatory for BullMQ workers to survive Redis reconnection without silently stopping"
  - "planObjective is a numbered-subtask stub (no LLM) intentionally — Phase 3 replaces with real decomposition"
  - "setImmediate over Promise.resolve().then() — both schedule microtasks after current tick, setImmediate is semantically clearer for 'after I/O'"

patterns-established:
  - "Dual-write pattern: insert DB row first, then enqueue job. Failure after DB insert but before enqueue leaves task in 'pending' — reconcilable by scanner"
  - "BullMQ connection options as plain objects: parse REDIS_URL into { host, port, password?, db? } struct, avoids IORedis version coupling"
  - "Worker factory with immediate error handler attach: createTaskWorker() always calls worker.on('error', ...) before returning"

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 2 Plan 02: Stub Planner and BullMQ Task Queue Summary

**Deterministic stub planner splits objectives into N subtasks, BullMQ queue with 30s lease semantics, and async POST /executions planning loop writing tasks to both Postgres and Redis**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18T08:59:18Z
- **Completed:** 2026-02-18T09:04:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `planObjective(objective, N)` produces N deterministic `PlannedTask` objects with numbered descriptions — no LLM calls, pure stub for Phase 2 verifiability
- BullMQ `claw-tasks` queue configured with 30s lockDuration, 15s stalledInterval, maxStalledCount=2, concurrency=1; separate connection options for queue vs worker
- POST /executions now triggers async planning after returning 201: inserts N task rows to Postgres, adds N jobs to BullMQ, transitions execution queued→running
- Integration verified: POST responds in 20ms, execution transitions to 'running' within 1s, 3 Postgres task rows, 3 BullMQ queue entries confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stub planner service and BullMQ task queue module** - `9ad1ec8` (feat)
2. **Task 2: Wire POST /executions to trigger async planning and task queuing** - `be794ea` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `services/execution-service/src/services/planner.service.ts` - planObjective() stub: returns N PlannedTask objects with numbered descriptions
- `services/execution-service/src/queue/task-queue.ts` - BullMQ Queue+Worker factory, TASK_QUEUE_NAME, connection constants, addTaskToQueue() wrapper
- `services/execution-service/src/routes/executions.ts` - POST handler with setImmediate async planning block; dual-write Postgres+BullMQ; queued→running transition

## Decisions Made
- **Plain options objects instead of IORedis instances for BullMQ:** bullmq@5 bundles ioredis@5.9.2 internally; execution-service has ioredis@5.9.3. Passing a pre-constructed IORedis instance from 5.9.3 to BullMQ's ConnectionOptions type (typed against 5.9.2) produces irresolvable structural type errors. Solution: parse REDIS_URL into a plain `{ host, port }` object — BullMQ creates its own connection, no version coupling.
- **maxRetriesPerRequest: null on workerConnection is mandatory:** Without this, IORedis defaults to maxRetriesPerRequest=3. When a BullMQ worker issues a blocking BRPOPLPUSH and Redis reconnects mid-block, the command fails all 3 retry attempts and the worker silently stops processing. null = infinite retries.
- **planObjective as numbered stub:** Phase 2 success criterion explicitly requires "verifiable without real LLM calls". The stub produces deterministic output, making integration tests reliable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed dual-version IORedis type incompatibility in BullMQ connection setup**
- **Found during:** Task 1 (Create stub planner service and BullMQ task queue module)
- **Issue:** Plan specified `new IORedis(REDIS_URL)` and `new IORedis(REDIS_URL, { maxRetriesPerRequest: null })` passed to Queue/Worker options. This produced `TS2322: Type 'Redis' is not assignable to type 'ConnectionOptions'` because bullmq@5 bundles ioredis@5.9.2 while execution-service depends on ioredis@5.9.3. The two IORedis versions' types are structurally incompatible at the `AbstractConnector.connecting` property.
- **Fix:** Removed IORedis import. Implemented `parseRedisUrl(url)` helper that returns a plain `{ host, port, password?, db? }` object. BullMQ accepts plain options objects as `ConnectionOptions` (it's a union type). BullMQ creates its own IORedis connections internally using its bundled version. `workerConnection` extends the parsed options with `maxRetriesPerRequest: null as null`.
- **Files modified:** `services/execution-service/src/queue/task-queue.ts`
- **Verification:** `pnpm --filter @claw/execution-service exec tsc --noEmit` exits 0
- **Committed in:** `9ad1ec8` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug / blocking issue)
**Impact on plan:** Required fix for TypeScript compilation — no scope creep, all exported contracts identical to plan spec.

## Issues Encountered
- Existing postgres container (`postgres-db-1`) running on port 5432 under a different compose project blocked docker-compose startup. Resolved by connecting directly to the existing container (it was the correct claw-army database, just started from a previous session).
- Execution service was already running on port 3001 (old version). Killed and restarted with updated code.

## User Setup Required
None - no external service configuration required. Uses existing docker-compose.dev.yml services (postgres + redis).

## Next Phase Readiness
- BullMQ `claw-tasks` queue is populated and ready for bot worker consumption (02-03)
- Task rows in Postgres with status 'pending' and executionId FK ready for bot claiming (02-04)
- planObjective stub ready for Phase 3 LLM replacement — same interface, just swap implementation

---
*Phase: 02-core-execution-pipeline*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/planner.service.ts
- FOUND: services/execution-service/src/queue/task-queue.ts
- FOUND: services/execution-service/src/routes/executions.ts
- FOUND: .planning/phases/02-core-execution-pipeline/02-02-SUMMARY.md
- FOUND: commit 9ad1ec8 (feat(02-02): add stub planner service and BullMQ task queue module)
- FOUND: commit be794ea (feat(02-02): wire POST /executions to trigger async planning and task queuing)
