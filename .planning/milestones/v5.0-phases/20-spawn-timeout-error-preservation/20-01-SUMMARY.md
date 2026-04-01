---
phase: 20-spawn-timeout-error-preservation
plan: 01
subsystem: infra
tags: [bot-orchestrator, gce, bullmq, spawn-timeout, error-handling]

# Dependency graph
requires:
  - phase: 15-gce-bot-lifecycle
    provides: stopBot() function and spawn-timeout checker implemented in bot-orchestrator.ts
provides:
  - stopBot() with optional skipDbUpdate flag that prevents overwriting caller-written terminal state
  - spawn-timeout path that correctly preserves status:'failed' and errorMessage in the DB
affects:
  - Any future phase that adds new stopBot() call sites (use skipDbUpdate: true if caller pre-writes DB state)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Caller-controlled DB update skipping: pass options.skipDbUpdate=true when caller writes terminal DB state before delegating cleanup to a shared function"

key-files:
  created: []
  modified:
    - services/execution-service/src/orchestrator/bot-orchestrator.ts

key-decisions:
  - "[20-01] stopBot() skipDbUpdate option added as optional third param — existing callers unaffected (2-arg calls pass undefined, guard evaluates false, DB write proceeds as before)"
  - "[20-01] Only spawn-timeout call site passes skipDbUpdate:true — idle checker and all other callers continue writing status:'stopped' unconditionally"
  - "[20-01] publishBotStopped remains unconditional — event correctly signals VM termination regardless of which terminal status the bot ended with"

patterns-established:
  - "skipDbUpdate pattern: before delegating VM teardown to stopBot(), write terminal DB state first, then pass { skipDbUpdate: true } to prevent overwrite"

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 20 Plan 01: Spawn Timeout Error Preservation Summary

**stopBot() extended with skipDbUpdate option so spawn-timeout checker's 'failed' status and errorMessage survive VM teardown without being overwritten by stopBot's default status:'stopped' DB write.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-23T00:00:00Z
- **Completed:** 2026-02-23T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added optional `options?: { skipDbUpdate?: boolean }` third parameter to `stopBot()` with JSDoc explaining the intent
- Wrapped the `db.update(bots).set({ status: 'stopped', ... })` call in `if (!options?.skipDbUpdate)` guard
- Updated spawn-timeout call site to `stopBot(entry.botId, 'failed', { skipDbUpdate: true })` so the `status: 'failed'` and `errorMessage` written immediately before are never overwritten
- TypeScript compiles with zero errors; all existing callers (idle checker, etc.) are unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Add skipDbUpdate option to stopBot and wire spawn-timeout call site** - `f9e5358` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/execution-service/src/orchestrator/bot-orchestrator.ts` — stopBot() signature extended; DB write wrapped in conditional guard; spawn-timeout call site updated

## Decisions Made

- `skipDbUpdate` is an optional third param (not a required flag) so all existing callers are unaffected without any changes
- Only the spawn-timeout path passes `{ skipDbUpdate: true }` — it is the only call site that pre-writes a terminal DB state before delegating teardown
- `publishBotStopped` and `terminateBotVM` remain unconditional — the VM is still being terminated; only the DB status field must not be overwritten

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BOT-04 gap closed: timed-out bots now stay `status: 'failed'` with `errorMessage` intact in the DB
- The UI (already rendering `bot.errorMessage` for `status === 'failed'` bots in Phase 15-03) will display the timeout message without any frontend changes
- Phase 21 and 22 (remaining gap-closure phases) can proceed

## Self-Check

**Files modified exist:**
- `services/execution-service/src/orchestrator/bot-orchestrator.ts` — FOUND

**Commits verified:**
- `f9e5358` — fix(20-01): preserve failed status + errorMessage on spawn timeout — FOUND

## Self-Check: PASSED

---
*Phase: 20-spawn-timeout-error-preservation*
*Completed: 2026-02-23*
