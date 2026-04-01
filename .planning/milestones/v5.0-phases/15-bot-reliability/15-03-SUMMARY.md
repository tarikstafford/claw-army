---
phase: 15-bot-reliability
plan: "03"
subsystem: execution-service,ui
tags: [bullmq, dispatcher, completion-checker, svelte, bot-lifecycle, error-surfacing]

# Dependency graph
requires:
  - 15-02 (errorMessage in GET /by-execution/:executionId response, errorMessage written on all bot failure paths)
provides:
  - Dispatcher calls checkExecutionCompletion fire-and-forget after each task success (snappier execution completion)
  - Dispatcher calls checkExecutionCompletion fire-and-forget after each task failure (terminal tasks trigger completion check)
  - Connection-level failures during dispatch write errorMessage to the bot DB row
  - Full round-trip logged end-to-end with durationMs (BOT-05)
  - ExecutionBot interface includes errorMessage: string | null (BOT-06)
  - Failed bot cards display inline error message in red below the stats row (BOT-06)
  - Failed bots visually distinct from stopped bots (red border + pink background vs faded opacity)
affects:
  - Production debuggability: operators can see why bots failed from the execution detail UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget completion check after task terminal state: checkExecutionCompletion(executionId).catch()"
    - "Connection-level failure detection by error message substring ('not connected', 'Connection closed')"
    - "Conditional error message display: {#if bot.status === 'failed' && bot.errorMessage}"
    - "CSS -webkit-line-clamp for 3-line truncation of long error messages"

key-files:
  created: []
  modified:
    - services/execution-service/src/queue/openclaw-dispatcher.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/routes/executions/[id]/+page.svelte

key-decisions:
  - "checkExecutionCompletion called fire-and-forget (not awaited) — completion check is non-blocking, failures logged but don't affect task result"
  - "Connection-level errorMessage uses substring matching ('not connected', 'Connection closed') — aligns with openclaw-client error messages from Plan 15-02"
  - "bot-stopped class no longer applied to failed bots — failed bots need distinct visual treatment (red) not faded treatment"

patterns-established:
  - "Terminal task hook: after any task reaches completed/failed, fire-and-forget checkExecutionCompletion for snappy execution finalization"
  - "Layered error visibility: errorMessage written at infrastructure level (startup script, /ready handler, dispatcher) surfaces in UI bot cards"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 15 Plan 03: Dispatch Round-Trip Validation + UI Error Surfacing Summary

**Dispatcher now calls checkExecutionCompletion after each task completion (success or failure) for snappy execution finalization, connection-level dispatch failures write errorMessage to the bot row, and the execution detail UI renders inline red error messages on failed bot cards with distinct visual treatment**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T07:15:18Z
- **Completed:** 2026-02-22T07:16:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Imported `checkExecutionCompletion` into `openclaw-dispatcher.ts` — eliminates reliance solely on the 5s polling interval for execution finalization after tasks complete
- Added fire-and-forget `checkExecutionCompletion(executionId)` call in the task success path — execution completes within milliseconds of the last task, not up to 5s later
- Added fire-and-forget `checkExecutionCompletion(executionId)` call in the task failure catch block — failed tasks are terminal, so they too trigger completion checking
- Added connection-level errorMessage write: if the task fails with `'not connected'` or `'Connection closed'` in the error message, `bot.errorMessage` is updated with a human-readable description — surfaces WebSocket drop-outs during task execution
- Added round-trip log line: `'Round-trip complete — task sent, completed, bot released to idle'` with `taskId`, `botId`, `executionId`, and `durationMs` (BOT-05 evidence)
- Added `errorMessage: string | null` field to `ExecutionBot` interface in `services/ui/src/lib/types.ts` — TypeScript now enforces the field shape across the UI
- Added conditional error message rendering in `+page.svelte` bot card: `{#if bot.status === 'failed' && bot.errorMessage}` renders a `<div class="bot-error-msg">` below the stats row
- Added `.bot-error-msg` CSS: `font-size: 0.72rem`, `color: #b91c1c`, `background: #fef2f2`, `border: 1px solid #fecaca`, 3-line `-webkit-line-clamp` truncation for long error strings
- Added `.bot-card.bot-failed` CSS: `border-left: 3px solid #dc2626`, `background: #fef2f2` — failed bots are visually distinct from stopped bots (which fade with `opacity: 0.65`)
- Fixed `class:bot-stopped` binding: was `bot.status === 'stopped' || bot.status === 'failed'`, now only `bot.status === 'stopped'` — failed bots no longer inherit the faded look

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden dispatcher — completion checker integration + round-trip validation** - `22bea69` (feat)
2. **Task 2: Surface bot error messages in UI bot cards** - `f7f08bb` (feat)

## Files Created/Modified

- `services/execution-service/src/queue/openclaw-dispatcher.ts` - Added checkExecutionCompletion import, fire-and-forget calls after task success + failure, round-trip log, connection-level errorMessage write in catch block
- `services/ui/src/lib/types.ts` - Added `errorMessage: string | null` to `ExecutionBot` interface
- `services/ui/src/routes/executions/[id]/+page.svelte` - Added bot-failed class binding, bot-error-msg conditional render, CSS for .bot-card.bot-failed and .bot-error-msg, fixed bot-stopped to exclude failed

## Decisions Made

- `checkExecutionCompletion` called fire-and-forget (not awaited): completion checking is non-critical to task dispatch. Failures are logged but must not affect whether the task result is returned to BullMQ.
- Connection-level errorMessage detection uses substring matching on `'not connected'` and `'Connection closed'` — these match the error messages emitted by `openclaw-client.ts` (from Plan 15-02), keeping the detection tightly coupled to the client's actual error strings.
- `bot-stopped` class binding corrected to exclude `failed` bots — failed bots require a distinct visual treatment (red border + pink background) to signal actionable errors, not the neutral "this bot is done" faded appearance of stopped bots.

## Deviations from Plan

None — plan executed exactly as written. All verification checks passed on first attempt.

## Issues Encountered

None — both TypeScript compilations passed cleanly on first attempt.

## User Setup Required

None — changes deploy with their respective services (execution-service + UI).

## Next Phase Readiness

- Phase 15 (Bot Reliability) complete: all 3 plans executed.
- The full error visibility chain is closed: startup script failure → /ready handler writes errorMessage → UI bot card renders it.
- Connection-level dispatch failures during task execution now also write errorMessage — all bot failure modes surface to operators.
- Phase 16 can proceed.

---
*Phase: 15-bot-reliability*
*Completed: 2026-02-22*

## Self-Check: PASSED

All files present, commits verified, content checks passed (13/13).
- FOUND: services/execution-service/src/queue/openclaw-dispatcher.ts
- FOUND: services/ui/src/lib/types.ts
- FOUND: services/ui/src/routes/executions/[id]/+page.svelte
- FOUND: .planning/phases/15-bot-reliability/15-03-SUMMARY.md
- FOUND commit 22bea69 (Task 1)
- FOUND commit f7f08bb (Task 2)
- PASS: checkExecutionCompletion imported and called in dispatcher
- PASS: Round-trip complete log in dispatcher success path
- PASS: errorMessage write in dispatcher catch block
- PASS: errorMessage: string | null in ExecutionBot interface
- PASS: bot.errorMessage rendered in +page.svelte
- PASS: .bot-error-msg CSS class in +page.svelte
- PASS: .bot-card.bot-failed CSS class in +page.svelte
