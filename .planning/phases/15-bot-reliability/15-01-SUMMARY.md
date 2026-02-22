---
phase: 15-bot-reliability
plan: "01"
subsystem: infra
tags: [gce, startup-script, bash, drizzle, postgres, error-handling]

# Dependency graph
requires: []
provides:
  - errorMessage column on bots table (error_message TEXT, nullable, idempotent migration)
  - Hardened GCE startup script with idempotent Node.js and OpenClaw installation
  - Startup script success POST payload with success:true, internalIp, port, gatewayToken, openclawVersion
  - Startup script failure POST payload with success:false, error (human-readable) at every failure point
  - EXIT trap + FAILURE_REASON variable pattern for structured error reporting from shell
affects:
  - 15-02 (ready handler — consumes new success/error payload shape and writes errorMessage to DB)
  - bot-orchestrator (spawnBot flow — bots now report structured failure reasons)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent shell installs: wrap apt-get/npm with command -v guard before executing"
    - "Trap-based failure reporting: FAILURE_REASON + EXIT trap + post_failure() function"
    - "Structured ready payload: {success, internalIp, port, gatewayToken, openclawVersion} on success; {success, error} on failure"

key-files:
  created:
    - packages/db/migrations/0008_add_error_message_to_bots.sql
  modified:
    - packages/db/src/schema/bots.ts
    - services/execution-service/src/orchestrator/gce-bot-launcher.ts

key-decisions:
  - "Migration location: packages/db/migrations/ (not src/migrations/) — follows drizzle.config.ts out:./migrations setting"
  - "Remove set -e in favor of explicit error checks — allows trap to fire and post_failure() to execute rather than silent crash"
  - "Double-validation of openclaw binary: command -v check + --version execution, captures version string for success payload"

patterns-established:
  - "Idempotent install guard: if ! command -v <tool> &>/dev/null; then install; fi"
  - "Failure trap pattern: set FAILURE_REASON then exit 1, trap fires post_failure on EXIT"

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 15 Plan 01: Bot Reliability Foundation Summary

**GCE startup script hardened with idempotent Node.js/OpenClaw installs, trap-based failure reporting via {success:false,error} POST to /bots/:botId/ready, and new error_message TEXT column on the bots table**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T07:05:49Z
- **Completed:** 2026-02-22T07:13:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added nullable `errorMessage` (`error_message`) text column to bots schema with idempotent migration using `IF NOT EXISTS`
- Replaced `set -euo pipefail` with `set -uo pipefail` + explicit error checks so the EXIT trap can fire `post_failure()` rather than crashing silently
- Wrapped Node.js and OpenClaw installations in `command -v` idempotency guards — re-running the script on an already-configured VM skips redundant installs
- Added `post_failure()` function and EXIT trap that POSTs `{success: false, error: "..."}` to `/bots/:botId/ready` on any failure
- Set `FAILURE_REASON` with human-readable strings at all five failure points (Node.js, OpenClaw npm, Secret Manager, onboard command, health check timeout)
- Updated success POST to include `{success: true, internalIp, port, gatewayToken, openclawVersion}` — ready handler (Plan 02) can now distinguish success from failure and record the failure reason

## Task Commits

Each task was committed atomically:

1. **Task 1: Add errorMessage column to bots schema + migration** - `ac8e1b0` (feat)
2. **Task 2: Harden GCE startup script** - `1f393d2` (feat)

## Files Created/Modified
- `packages/db/src/schema/bots.ts` - Added `errorMessage: text('error_message')` nullable column; imported `text` from drizzle-orm/pg-core
- `packages/db/migrations/0008_add_error_message_to_bots.sql` - `ALTER TABLE bots ADD COLUMN IF NOT EXISTS error_message TEXT`
- `services/execution-service/src/orchestrator/gce-bot-launcher.ts` - Rewrote startup script template with idempotent installs, trap-based error handling, structured success/failure payloads

## Decisions Made
- Migration file placed in `packages/db/migrations/` (not `src/migrations/` as stated in plan) — drizzle.config.ts specifies `out: './migrations'`, so this is the correct directory for drizzle-generated and hand-written migrations
- Removed `set -e` in favor of explicit `|| { FAILURE_REASON="..."; exit 1; }` blocks — this is required because `set -e` causes the script to exit before the EXIT trap can run `post_failure()`
- Added binary validation step after install (`command -v openclaw` + `openclaw --version`) as a distinct check from the idempotency guard, ensuring the binary actually runs before proceeding to onboard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration directory corrected from src/migrations/ to migrations/**
- **Found during:** Task 1 (Add errorMessage column to bots schema + migration)
- **Issue:** Plan specified `packages/db/src/migrations/0008_add_error_message_to_bots.sql` but drizzle.config.ts sets `out: './migrations'` and all 8 existing migrations are in `packages/db/migrations/`
- **Fix:** Created migration at `packages/db/migrations/0008_add_error_message_to_bots.sql` — the correct drizzle output directory
- **Files modified:** `packages/db/migrations/0008_add_error_message_to_bots.sql`
- **Verification:** File exists in correct location, drizzle will pick it up on next migration run
- **Committed in:** ac8e1b0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking — wrong path in plan)
**Impact on plan:** Necessary correction; no scope creep. The migration is functionally identical — just placed where drizzle expects it.

## Issues Encountered
None — both TypeScript compilations passed cleanly on first attempt.

## User Setup Required
None - no external service configuration required. Migration will need to be run against the Cloud SQL instance before Plan 02 is deployed.

## Next Phase Readiness
- Plan 02 (ready handler hardening) can now consume the `{success, error}` payload shape from the startup script
- `errorMessage` column is ready in the schema for Plan 02's `/bots/:botId/ready` handler to write failure reasons
- Both packages compile cleanly; no breaking changes to existing interfaces

---
*Phase: 15-bot-reliability*
*Completed: 2026-02-22*

## Self-Check: PASSED

All files present, commits verified, content checks passed (10/10).
- FOUND: packages/db/src/schema/bots.ts
- FOUND: packages/db/migrations/0008_add_error_message_to_bots.sql
- FOUND: services/execution-service/src/orchestrator/gce-bot-launcher.ts
- FOUND: .planning/phases/15-bot-reliability/15-01-SUMMARY.md
- FOUND commit ac8e1b0 (Task 1)
- FOUND commit 1f393d2 (Task 2)
- PASS: errorMessage in bots.ts
- PASS: IF NOT EXISTS in migration
- PASS: command -v guards (node + openclaw)
- PASS: post_failure function + FAILURE_REASON variable
- PASS: success:true and success:false payloads
