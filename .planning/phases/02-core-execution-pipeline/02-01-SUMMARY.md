---
phase: 02-core-execution-pipeline
plan: 01
subsystem: api
tags: [fastify, typebox, drizzle-orm, postgresql, execution-service, state-machine, typescript, monorepo]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "@claw/db with Drizzle executions table, $inferSelect types, internal packages strategy"
provides:
  - "@claw/execution-service pnpm workspace package at services/execution-service/"
  - "POST /executions endpoint: creates execution row in Postgres, returns 201 with executionId+status"
  - "GET /executions/:id endpoint: returns full execution record or 404"
  - "transitionExecution() atomic state machine via UPDATE...WHERE...RETURNING"
  - "createExecution(), getExecution(), transitionExecution() exported from execution.service.ts"
  - "buildApp() Fastify factory with TypeBoxTypeProvider for typed request/response schemas"
  - "All Phase 2 runtime dependencies installed (bullmq, dockerode, jose, ioredis, etc.)"
affects: [02-02-planner, 02-03-task-queue, 02-04-bot-orchestrator, 03-tool-gateway, 04-metering, 05-frontend]

# Tech tracking
tech-stack:
  added:
    - fastify@5.7.4 (HTTP server framework with TypeScript-first schema validation)
    - "@fastify/type-provider-typebox@6.1.0 (TypeBox type provider for Fastify)"
    - "@sinclair/typebox@0.34.48 (JSON Schema type builder for route schemas)"
    - bullmq@5.69.3 (Redis-backed task queue — installed for Phase 2, used in 02-02+)
    - dockerode@4.0.9 (Docker API client — installed for Phase 2, used in 02-04)
    - jose@6.1.3 (JWT — installed for Phase 2, used in Phase 3)
    - ioredis@5.9.3 (Redis client — installed for Phase 2, used in 02-02+)
    - "@google-cloud/pubsub@5.2.3 (Pub/Sub client — installed for Phase 2)"
    - zod@4.3.6 (schema validation — needed by @claw/event-schemas at runtime)
  patterns:
    - Fastify with TypeBoxTypeProvider for end-to-end typed route schemas
    - FastifyPluginAsyncTypebox pattern for route plugin registration
    - Atomic state machine transitions via Drizzle UPDATE...WHERE...RETURNING
    - NODE_OPTIONS --conditions @claw/source for internal packages resolution in tsx

key-files:
  created:
    - services/execution-service/package.json (@claw/execution-service with all Phase 2 deps)
    - services/execution-service/tsconfig.json (extends tsconfig.base.json, ESNext+Bundler)
    - services/execution-service/src/app.ts (buildApp() Fastify factory with TypeBoxTypeProvider)
    - services/execution-service/src/main.ts (server startup on PORT 3001)
    - services/execution-service/src/routes/executions.ts (POST / and GET /:id route handlers)
    - services/execution-service/src/services/execution.service.ts (createExecution, getExecution, transitionExecution)
  modified:
    - pnpm-lock.yaml (updated with all new package dependencies)

key-decisions:
  - "NODE_OPTIONS --conditions @claw/source required in dev/start scripts for tsx to resolve @claw/db internal packages (tsx uses node's ESM resolver which falls back to default export path ./dist/index.js which doesn't exist)"
  - "transitionExecution does NOT validate transition paths in Phase 2 — only atomic WHERE-clause guarding; transition validation map deferred to Phase 3"
  - "budgetCapCents defaults to 0 and runtimeLimitSeconds defaults to 3600 when not provided in POST body"
  - "All Phase 2 runtime deps installed upfront in execution-service to avoid repeated package.json changes across plans 02-02 through 02-04"

patterns-established:
  - "Fastify route plugin pattern: FastifyPluginAsyncTypebox with Type.Object schemas on body/params/response"
  - "Drizzle atomic transition pattern: UPDATE...WHERE(id AND status)...RETURNING to detect concurrent overwrites"
  - "noUncheckedIndexedAccess safe pattern: check result.length before accessing result[0]"
  - "Internal packages runtime pattern: NODE_OPTIONS --conditions @claw/source for tsx execution"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 2 Plan 01: Execution Service — Fastify App with POST /executions and GET /executions/:id Summary

**Fastify execution service with TypeBox-typed POST /executions (201 + executionId) and GET /executions/:id (200/404), backed by atomic Drizzle UPDATE...WHERE...RETURNING state machine transitions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T08:53:00Z
- **Completed:** 2026-02-18T08:56:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- @claw/execution-service pnpm workspace package initialized with all Phase 2 runtime dependencies (fastify, typebox, bullmq, dockerode, jose, ioredis installed upfront for plans 02-02 through 02-04)
- POST /executions creates a Postgres execution row with status "queued" and returns 201 with executionId; GET /executions/:id returns the full record or 404 — both verified live against local PostgreSQL
- transitionExecution() implements atomic state machine using Drizzle UPDATE...WHERE(id AND fromStatus)...RETURNING, returns boolean to signal if transition succeeded (race condition safe)

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize execution-service package and Fastify app scaffold** - `077f39a` (feat)
2. **Task 2: Implement execution service, state machine, and route handlers** - `2f1b1c5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/execution-service/package.json` - @claw/execution-service with fastify, typebox, drizzle-orm, bullmq, dockerode, jose, ioredis, @google-cloud/pubsub, pg, dotenv dependencies; dev/start scripts with NODE_OPTIONS --conditions @claw/source
- `services/execution-service/tsconfig.json` - Extends tsconfig.base.json with ESNext+Bundler moduleResolution (same pattern as packages/db)
- `services/execution-service/src/app.ts` - buildApp() Fastify factory with TypeBoxTypeProvider; registers executionsRoutes and /health endpoint
- `services/execution-service/src/main.ts` - Server startup on PORT 3001 (env-configurable), loads dotenv/config
- `services/execution-service/src/routes/executions.ts` - POST / and GET /:id handlers using FastifyPluginAsyncTypebox with Type.Object schemas
- `services/execution-service/src/services/execution.service.ts` - createExecution, getExecution, transitionExecution using Drizzle ORM
- `pnpm-lock.yaml` - Updated with 128 new package resolutions

## Decisions Made

- **NODE_OPTIONS --conditions @claw/source in scripts**: tsx's ESM resolver uses the `default` export condition which points to `./dist/index.js` (non-existent). Adding `--conditions @claw/source` to NODE_OPTIONS makes tsx use the `@claw/source` export condition pointing to `./src/index.ts`. This is required for any service using the internal packages strategy with tsx.
- **All Phase 2 deps installed upfront**: bullmq, dockerode, jose, ioredis, @google-cloud/pubsub installed in package.json now so plans 02-02 through 02-04 don't need to modify package.json. Reduces friction and keeps dependency management centralized.
- **transitionExecution defers path validation**: The function only enforces atomic WHERE-clause guarding. Phase 3 will add a state map validating legal transition paths (e.g., queued→running is valid; completed→running is not).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added NODE_OPTIONS --conditions @claw/source to dev/start scripts**
- **Found during:** Task 2 (service startup verification)
- **Issue:** tsx ESM resolver resolves `@claw/db` via its `default` export condition to `./dist/index.js`, which does not exist (internal packages strategy uses source-level `.ts` files). Service exits with ERR_MODULE_NOT_FOUND on startup without this fix.
- **Fix:** Updated `dev` and `start` scripts in package.json to prefix with `NODE_OPTIONS="--conditions @claw/source"`, enabling tsx to resolve `@claw/db` via its `@claw/source` export condition pointing to `./src/index.ts`.
- **Files modified:** services/execution-service/package.json
- **Verification:** Service started successfully, all three endpoints (POST /executions, GET /executions/:id, GET /health) returned correct responses
- **Committed in:** 2f1b1c5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — internal packages runtime resolution)
**Impact on plan:** Required deviation. Without this fix, the service cannot start. The NODE_OPTIONS approach is consistent with how tsx handles custom export conditions and is the standard workaround for internal packages strategies. No scope creep.

## Issues Encountered

- Existing `postgres-db-1` Docker container running on port 5432 (from Phase 1 with `postgres:password` credentials) conflicted with `docker-compose.dev.yml` which attempts to bind port 5432. Used the existing running container instead of starting a new one via docker-compose. Created `services/execution-service/.env` (gitignored) with the correct DATABASE_URL for the existing container.

## User Setup Required

None — the service connects to the existing local PostgreSQL container from Phase 1. The `.env` file is gitignored and created locally during verification.

## Next Phase Readiness

- execution-service runs and both endpoints are verified against local PostgreSQL
- transitionExecution is available for use by the planner (02-02), task queue (02-03), and bot orchestrator (02-04)
- All Phase 2 runtime deps (bullmq, dockerode, jose, ioredis) are installed and ready for use in subsequent plans
- Watch: Each new service that uses @claw/db or other internal packages must add NODE_OPTIONS --conditions @claw/source to its tsx scripts

## Self-Check: PASSED

All 6 created files verified present on disk. Both task commits (077f39a, 2f1b1c5) verified in git log. TypeScript compiles with zero errors. POST /executions returned 201, GET /executions/:id returned 200, GET nonexistent returned 404.

---
*Phase: 02-core-execution-pipeline*
*Completed: 2026-02-18*
