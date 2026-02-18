---
phase: 05-performance-intelligence-and-dna-capture
plan: 02
subsystem: api
tags: [drizzle-orm, fastify, typebox, analytics, reporting]

# Dependency graph
requires:
  - phase: 05-01-performance-scoring-pipeline
    provides: composite_score and tier columns on bots table, telemetry rows per bot

provides:
  - GET /executions/:id/report endpoint returning full PERF-06 summary
  - GET /executions/:id/leaderboard endpoint returning bots sorted by composite_score DESC
  - report-builder.ts module with buildExecutionReport() aggregating 11 execution metrics

affects: [phase-6-dna-capture, any future UI that consumes analytics APIs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - On-demand aggregation: report computed from DB queries each request, no pre-computation or caching
    - N+1 leaderboard enrichment: acceptable at MVP with maxBots=20 cap; documented for future JOIN optimization
    - sql`...` template literals for raw ORDER BY with NULLS LAST in Drizzle (Drizzle ORM cannot express NULLS LAST via orderBy() API alone)

key-files:
  created:
    - services/execution-service/src/performance/report-builder.ts
  modified:
    - services/execution-service/src/routes/executions.ts

key-decisions:
  - "N+1 leaderboard enrichment is acceptable for MVP (maxBots cap is 20); production optimization deferred"
  - "topPerformingBotId returns null when no bots in execution (no score set); avoids returning a bot with null composite_score as 'top performer'"
  - "sql template literal used for ORDER BY composite_score DESC NULLS LAST — Drizzle's orderBy(desc(...)) does not support NULLS LAST natively"

patterns-established:
  - "Report endpoints: always verify execution exists first, return 404 with { error: 'Execution not found' } before running expensive aggregations"
  - "Aggregation queries use COALESCE to guard against NULL sums, CAST to coerce pg numeric to JS number"

# Metrics
duration: 1min
completed: 2026-02-18
---

# Phase 5 Plan 2: Execution Report Builder and Analytics Endpoints Summary

**On-demand execution analytics via GET /executions/:id/report (PERF-06) and GET /executions/:id/leaderboard (PERF-07), powered by report-builder.ts aggregating bots, tasks, billing_events, telemetry, and tool_invocations**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-18T14:42:19Z
- **Completed:** 2026-02-18T14:43:56Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `report-builder.ts` with `buildExecutionReport()` computing 11 execution-level metrics from raw DB tables: totalBots, totalBotHours, totalCostCents, averageBotScore, topPerformingBotId, errorDistribution (task_failures + tool_rejections), costPerTaskCents, totalTasks, completedTasks, failedTasks
- Added `GET /executions/:id/report` with full TypeBox response schema and 404 guard for non-existent executions (PERF-06)
- Added `GET /executions/:id/leaderboard` returning bots ordered by composite_score DESC NULLS LAST, each enriched with per-bot task counts and bot-hours from telemetry (PERF-07)

## Task Commits

Each task was committed atomically:

1. **Task 1: Report builder and execution analytics routes** - `84592c4` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `services/execution-service/src/performance/report-builder.ts` - Aggregation module exporting `buildExecutionReport()` and `ExecutionReport` interface; queries bots, telemetry, billing_events, tasks, tool_invocations
- `services/execution-service/src/routes/executions.ts` - Added two new Fastify routes: `/:id/report` and `/:id/leaderboard`; added `telemetry`, `and`, `sql` imports; imported `buildExecutionReport` from report-builder

## Decisions Made

- **N+1 leaderboard enrichment:** The leaderboard route runs 3 queries per bot (completed tasks, failed tasks, bot-hours). This is documented as intentional and acceptable for MVP given the 20-bot maxBots cap. A single JOIN query is the production optimization path.
- **sql template for NULLS LAST:** Drizzle ORM's `orderBy(desc(bots.compositeScore))` does not support `NULLS LAST`. Used `sql\`\${bots.compositeScore} DESC NULLS LAST\`` to ensure null-scored bots sort last on both leaderboard and report's top-bot query.
- **topPerformingBotId null behavior:** Returns the first result of ORDER BY composite_score DESC NULLS LAST. If execution has no bots, result is null. If all bots have null scores, the returned bot has null composite_score — this is acceptable; the caller can check compositeScore.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 Plan 2 complete. Both analytics endpoints are ready for consumption.
- Phase 5 Plan 3 (DNA Capture) can proceed — it adds bot DNA snapshot storage for top-performing bots after execution.
- No blockers.

---
*Phase: 05-performance-intelligence-and-dna-capture*
*Completed: 2026-02-18*

## Self-Check: PASSED

- report-builder.ts: FOUND
- executions.ts (modified): FOUND
- 05-02-SUMMARY.md: FOUND
- Commit 84592c4: FOUND
