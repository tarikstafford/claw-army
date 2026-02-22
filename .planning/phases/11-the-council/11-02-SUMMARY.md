---
phase: 11-the-council
plan: "02"
subsystem: api
tags: [bullmq, drizzle-orm, council, llm-evaluation, worker, aggregation]

# Dependency graph
requires:
  - phase: 11-the-council plan 01
    provides: council-queue.ts (COUNCIL_QUEUE_NAME, CouncilJobData, CouncilContext, councilQueue), performance-judge.ts, soul-analyst.ts, devils-advocate.ts
  - phase: 08-database-schema-and-shared-types
    provides: council_verdicts table, bots.soulId, bot_souls schema
  - phase: 10-decision-trace-collection
    provides: decision_traces rows for context loading
provides:
  - BullMQ council worker processor (councilProcessor) — loads context, runs 3 judges in parallel, aggregates, persists verdict
  - startCouncilWorker() — exported function to start the council worker with concurrency=5, rate-limit=10/min
  - enqueueCouncilJobs() — fire-and-forget enqueue in completion-checker (one job per bot)
  - Full async Council evaluation pipeline complete (CNCL-01 through CNCL-06)
affects:
  - 12-confirmation-gate (reads council_verdicts.requiresHumanConfirmation, verdictType, status)
  - Phase 14 UI (reads council_verdicts for display)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Council worker: BullMQ Worker with 5min lockDuration + 60s setInterval lock renewal (mirrors openclaw-dispatcher)"
    - "Parallel judge execution: Promise.all([runPerformanceJudge, runSoulAnalyst, runDevilsAdvocate]) — no inter-judge visibility"
    - "Weighted verdict aggregation: VERDICT_VALUES numeric map + weighted average + VERDICT_FROM_VALUE lookup"
    - "Fire-and-forget pipeline extension: enqueueCouncilJobs().catch() after runPerformancePipeline().catch() in completion-checker"
    - "Rate limiter on council worker: limiter: { max: 10, duration: 60_000 } to protect LLM provider limits"

key-files:
  created:
    - services/execution-service/src/queue/council-worker.ts
  modified:
    - services/execution-service/src/orchestrator/completion-checker.ts
    - services/execution-service/src/main.ts

key-decisions:
  - "VERDICT_VALUES map (Promote=4, Maintain=3, Monitor=2, Demote=1, Retire=0) enables weighted average verdict type computation — clean and extensible"
  - "Clamping weighted verdict value to 0-4 range before VERDICT_FROM_VALUE lookup prevents out-of-bounds access with noUncheckedIndexedAccess"
  - "Lock renewal every 60s (not shorter) since 3 parallel LLM calls take 30-90s total — no need to renew more frequently than once per LLM round"
  - "enqueueCouncilJobs is NOT exported — internal to completion-checker, enforcing the fire-and-forget contract at the module boundary"
  - "councilQueue.addBulk used instead of individual queue.add() calls — atomic bulk enqueue is cleaner and reduces round-trips"

patterns-established:
  - "Worker processor: loadContext -> Promise.all judges -> aggregateVerdicts -> db.insert -> log metrics"
  - "Lock renewal pattern: setInterval in try block, clearInterval in finally block (identical to openclaw-dispatcher)"
  - "Fire-and-forget extension pattern: place new async work after existing fire-and-forget block with .catch() guard"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 11 Plan 02: The Council Summary

**BullMQ council worker wiring three LLM judges via Promise.all, 50/35/15 weighted aggregation, council_verdicts persistence, and fire-and-forget enqueue in completion-checker — completing the full async Council evaluation pipeline (CNCL-01 through CNCL-06)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T01:56:13Z
- **Completed:** 2026-02-22T01:58:57Z
- **Tasks:** 2
- **Files modified:** 1 created, 2 modified

## Accomplishments

- Council worker processor (`council-worker.ts`) loads context from DB (bot metrics, soul content, decision traces, telemetry), runs all three judges via `Promise.all` (CNCL-02 independence), aggregates with 50/35/15 weights (CNCL-05), and persists to `council_verdicts` (CNCL-06)
- Completion checker (`completion-checker.ts`) enqueues one council job per bot fire-and-forget immediately after the performance pipeline — execution result delivery never blocked (CNCL-01)
- Main.ts starts the council worker alongside the dispatcher and shuts it down gracefully on SIGTERM/SIGINT
- Soul Analyst disagreement rate logged as a console metric per job (CNCL-04)
- Strong Devil's Advocate argument deterministically sets `requiresHumanConfirmation=true` via `hasUnresolvedDevilsAdvocate = devil.strongUnresolvedArgument` (CNCL-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create council worker processor with context loading, parallel judges, aggregation, and persistence** - `68e3e81` (feat)
2. **Task 2: Integrate council enqueue into completion-checker and start worker in main.ts** - `46e9c6a` (feat)

## Files Created/Modified

- `services/execution-service/src/queue/council-worker.ts` - BullMQ Worker: loadCouncilContext, councilProcessor (Promise.all judges), aggregateVerdicts (50/35/15 weights), startCouncilWorker export
- `services/execution-service/src/orchestrator/completion-checker.ts` - Added enqueueCouncilJobs() and fire-and-forget call after performance pipeline
- `services/execution-service/src/main.ts` - Import startCouncilWorker, start councilWorker, add councilWorker.close() to shutdown

## Decisions Made

- `VERDICT_VALUES` numeric map (Promote=4 to Retire=0) + weighted average + `VERDICT_FROM_VALUE` array lookup — clean bidirectional mapping for weighted verdict aggregation
- `Math.max(0, Math.min(4, Math.round(weightedVerdictValue)))` clamp prevents out-of-bounds access on the `VERDICT_FROM_VALUE` array with `noUncheckedIndexedAccess` enabled
- Lock renewal set to every 60 seconds — generous buffer since 3 parallel LLM calls complete well within that window
- `enqueueCouncilJobs` is not exported — enforces fire-and-forget usage at the module boundary; callers cannot accidentally `await` it
- `councilQueue.addBulk` instead of individual `add()` calls — single atomic bulk enqueue per execution

## Deviations from Plan

None - plan executed exactly as written. TypeScript compiled cleanly on first attempt for both tasks.

## Issues Encountered

None — both tasks completed without issues.

## User Setup Required

The plan frontmatter documents that `GOOGLE_GENERATIVE_AI_API_KEY` is required for the Devil's Advocate judge (uses Google Gemini). This key must be added to the GCE VM environment (`claw-app-dev`) before the council worker can process jobs. See plan frontmatter `user_setup` section for details.

No additional configuration was added in this plan.

## Next Phase Readiness

- Full async Council evaluation pipeline is complete (CNCL-01 through CNCL-06)
- `council_verdicts` rows are created with `status: 'pending'` and `requiresHumanConfirmation` flag set
- Phase 12 (Confirmation Gate) can now read `council_verdicts.requiresHumanConfirmation` to surface pending verdicts requiring human review
- `GOOGLE_GENERATIVE_AI_API_KEY` must be set on `claw-app-dev` VM before council worker can run in production

## Self-Check: PASSED

- FOUND: services/execution-service/src/queue/council-worker.ts
- FOUND: services/execution-service/src/orchestrator/completion-checker.ts
- FOUND: services/execution-service/src/main.ts
- FOUND: .planning/phases/11-the-council/11-02-SUMMARY.md
- FOUND commit: 68e3e81 (Task 1 — council worker processor)
- FOUND commit: 46e9c6a (Task 2 — completion-checker + main.ts)
- TypeScript: CLEAN (zero errors)

---
*Phase: 11-the-council*
*Completed: 2026-02-22*
