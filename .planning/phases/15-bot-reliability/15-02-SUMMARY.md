---
phase: 15-bot-reliability
plan: "02"
subsystem: execution-service
tags: [fastify, websocket, bot-lifecycle, error-handling, spawn-timeout, openclaw]

# Dependency graph
requires:
  - 15-01 (errorMessage column on bots table, success/failure payload shape from startup script)
provides:
  - /ready handler that parses success/failure payloads and writes errorMessage on failure
  - WebSocket liveness validation after connect() before transitioning bot to idle
  - Spawn timeout checker that catches VMs that never call /ready
  - errorMessage written on all failure paths (connect failure, liveness failure, spawn timeout, VM launch failure)
  - errorMessage exposed in GET /by-execution/:executionId response
affects:
  - 15-03 (UI can now read errorMessage from GET /by-execution/:executionId — BOT-06)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Success/failure discriminated union body schema: Type.Union([Type.Object({success: Literal(true), ...}), Type.Object({success: Literal(false), error})])"
    - "WebSocket liveness post-connect check: client.isConnected guard after connect() before status transition"
    - "Spawn timeout via setInterval polling botRegistry for entries where openclawClient===null and internalIp===null past SPAWN_TIMEOUT_MS"

key-files:
  created: []
  modified:
    - services/execution-service/src/routes/bots.ts
    - services/execution-service/src/orchestrator/bot-orchestrator.ts
    - services/execution-service/src/main.ts

key-decisions:
  - "Return 200 for failure payload receipt — VM completed its job by reporting failure; ACK is correct HTTP semantics here"
  - "Liveness check placed between connect() and registry update — ensures we never register a stale client as openclawClient in the entry"
  - "Spawn timeout uses botRegistry (not DB query) — avoids DB polling every 30s; registry is the authoritative in-process state for spawning bots"

patterns-established:
  - "All bot failure paths write errorMessage: body.error, connect failure, liveness failure, spawn timeout, VM launch failure"
  - "Discriminated union TypeBox body with Literal(true)/Literal(false) discriminants for typed payload parsing"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 15 Plan 02: Ready Handler Hardening + Spawn Timeout Summary

**Updated /ready handler accepts success/failure discriminated union payloads with WebSocket liveness validation, and added spawn timeout checker that catches VMs that never call back — all bot failure paths now write a descriptive errorMessage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T07:10:12Z
- **Completed:** 2026-02-22T07:12:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Updated `/bots/:botId/ready` body schema to `Type.Union([SuccessBody, FailureBody])` using TypeBox discriminated union — `success: Literal(true)` vs `success: Literal(false)`
- Failure payload path (`success: false`): writes `errorMessage: body.error` + `status: 'failed'` to DB, returns `200 { ok: true }` to acknowledge receipt, no WebSocket connection attempted
- Added `isConnected` liveness check after `client.connect()`: if connection opened and immediately closed (token mismatch, gateway crash), writes `errorMessage: 'WebSocket connected but immediately disconnected...'` + sets `status: 'failed'`
- Updated `connect()` failure catch to write `errorMessage` with the full `wsUrl` + error message (previously only wrote `status: 'failed'` with no errorMessage)
- Added `errorMessage` field to `GET /by-execution/:executionId` response schema and select projection — UI can now surface this in Plan 03
- Added `SPAWN_TIMEOUT_MS` (default 10 min) and `SPAWN_CHECK_INTERVAL_MS` (default 30s) constants to `bot-orchestrator.ts`
- Added `startSpawnTimeoutChecker()`: polls `botRegistry` every 30s for entries where `openclawClient === null` and `internalIp === null` past the timeout, then writes `errorMessage: 'Spawn timeout — VM did not call /ready within Xm...'` and calls `stopBot()` to terminate the stale VM
- Added `stopSpawnTimeoutChecker()` for graceful shutdown
- Updated `spawnBot` catch block to write `errorMessage: 'GCE VM launch failed: ...'` (previously only wrote `status: 'failed'`)
- Wired `spawnTimer` into `main.ts`: started after `dispatcherWorker`, stopped in `shutdown()` via `stopSpawnTimeoutChecker(spawnTimer)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update /ready handler for success/failure payload + WebSocket liveness check** - `0f46de1` (feat)
2. **Task 2: Add spawn timeout checker to bot-orchestrator + wire into main.ts** - `7c9b84c` (feat)

## Files Created/Modified

- `services/execution-service/src/routes/bots.ts` - Updated POST /ready body schema to discriminated union, added failure path, liveness check, errorMessage writes; added errorMessage to GET /by-execution response
- `services/execution-service/src/orchestrator/bot-orchestrator.ts` - Added SPAWN_TIMEOUT_MS/SPAWN_CHECK_INTERVAL_MS constants, startSpawnTimeoutChecker/stopSpawnTimeoutChecker functions, errorMessage in spawnBot catch block
- `services/execution-service/src/main.ts` - Imported and wired spawnTimer with start + stop in shutdown()

## Decisions Made

- Return `200 { ok: true }` for failure payload receipt — the VM did its job by reporting failure; ACKing is correct HTTP semantics (prevents the VM from retrying and spamming /ready)
- Liveness check (`client.isConnected`) placed immediately after `connect()` resolves and before any registry mutation — ensures we never register a stale WebSocket client as the active `openclawClient`
- Spawn timeout uses in-memory `botRegistry` polling rather than a DB query — avoids a DB hit every 30s across all spawning bots; the registry is the authoritative in-process source of truth for currently-spawning bots

## Deviations from Plan

None — plan executed exactly as written. All 6 verification checks passed on first attempt.

## Issues Encountered

None — TypeScript compiled cleanly on every attempt.

## User Setup Required

None — no external service configuration required. Changes deploy with the execution-service.

## Next Phase Readiness

- Plan 03 (UI error surfacing — BOT-06) can now read `errorMessage` from `GET /by-execution/:executionId`
- All bot failure paths covered with descriptive errorMessage — production debugging significantly improved

---
*Phase: 15-bot-reliability*
*Completed: 2026-02-22*

## Self-Check: PASSED

All files present, commits verified, content checks passed (11/11).
- FOUND: services/execution-service/src/routes/bots.ts
- FOUND: services/execution-service/src/orchestrator/bot-orchestrator.ts
- FOUND: services/execution-service/src/main.ts
- FOUND: .planning/phases/15-bot-reliability/15-02-SUMMARY.md
- FOUND commit 0f46de1 (Task 1)
- FOUND commit 7c9b84c (Task 2)
- PASS: failure payload handling (success:false) in bots.ts
- PASS: isConnected liveness check in bots.ts
- PASS: errorMessage write on failure in bots.ts
- PASS: SPAWN_TIMEOUT_MS constant in bot-orchestrator.ts
- PASS: startSpawnTimeoutChecker exported from bot-orchestrator.ts
- PASS: startSpawnTimeoutChecker called in main.ts
- PASS: stopSpawnTimeoutChecker called in main.ts shutdown()
