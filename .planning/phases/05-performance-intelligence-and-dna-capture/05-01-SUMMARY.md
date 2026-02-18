---
phase: 05-performance-intelligence-and-dna-capture
plan: 01
subsystem: database, api
tags: [drizzle, postgres, performance, scoring, telemetry, metrics]

# Dependency graph
requires:
  - phase: 04-control-plane-services
    provides: billing_events table with bot_id and amount_cents, telemetry table with bot_hours rows, completion-checker.ts that transitions executions to completed
  - phase: 02-core-execution-pipeline
    provides: tasks table with claimed_by_bot_id and attempt_count, executions table
  - phase: 03-bot-runtime-and-tool-gateway
    provides: tool_invocations table with bot_id, total_tokens, rejected, duration_ms
provides:
  - composite_score numeric(5,2) and tier varchar(10) nullable columns on bots table (migration 0002)
  - bots_composite_score_idx for leaderboard sorting
  - computeBotMetrics() — per-bot raw metric computation from tasks/billing_events/tool_invocations/telemetry
  - computeScoresForExecution() — cross-bot score normalization, telemetry storage, bots table update
  - runPerformancePipeline() — orchestrator hooking into completion-checker fire-and-forget
  - Four independently queryable telemetry rows per bot: success_rate_score, efficiency_score, cost_efficiency_score, stability_score
affects:
  - 05-02-plan (report-builder will add call in performance-engine.ts)
  - 05-03-plan (DNA capture will add call in performance-engine.ts)
  - any plan doing leaderboard queries (bots.composite_score and bots.tier now populated)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fire-and-forget .catch() after execution completion for non-blocking pipeline
    - cross-bot min/max normalization for relative scoring (guard: max===min returns 100)
    - idempotency guard via telemetry COUNT check before re-computing
    - env-var configurable score weights and tier thresholds with documented defaults

key-files:
  created:
    - packages/db/migrations/0002_melted_black_widow.sql
    - packages/db/migrations/meta/0002_snapshot.json
    - services/execution-service/src/performance/metrics-computer.ts
    - services/execution-service/src/performance/score-engine.ts
    - services/execution-service/src/performance/performance-engine.ts
  modified:
    - packages/db/src/schema/bots.ts
    - packages/db/migrations/meta/_journal.json
    - services/execution-service/src/orchestrator/completion-checker.ts

key-decisions:
  - "Read task counts from tasks table (claimed_by_bot_id) NOT from bots.tasksCompleted/tasksFailed which are always 0"
  - "Score weights (40/30/20/10) and tier thresholds (75/40) are env-var configurable — SCORE_WEIGHT_SUCCESS, SCORE_WEIGHT_EFFICIENCY, SCORE_WEIGHT_COST, SCORE_WEIGHT_STABILITY, TIER_HIGH_THRESHOLD, TIER_MEDIUM_THRESHOLD"
  - "Cross-bot min/max normalization with guard: if max===min, return 100 (everyone equal = give full credit)"
  - "Bots with 0 completed tasks get cost_efficiency_score=0 (no useful work at any cost)"
  - "Weights normalized to sum to 1 before composite calculation (handles non-100-summing env overrides)"

patterns-established:
  - "Pattern: fire-and-forget performance pipeline — runPerformancePipeline(id).catch(err => console.error()) after completion transition"
  - "Pattern: idempotency via telemetry COUNT check — skip if success_rate_score rows already exist for execution"
  - "Pattern: min/max cross-bot normalization with max===min guard returning 100"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 5 Plan 1: Performance Scoring Pipeline Summary

**Drizzle migration adding composite_score/tier to bots, four-component scoring pipeline (success_rate * 0.40 + efficiency * 0.30 + cost_efficiency * 0.20 + stability * 0.10) with cross-bot normalization, telemetry storage, and fire-and-forget hook from completion-checker**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T14:35:05Z
- **Completed:** 2026-02-18T14:38:14Z
- **Tasks:** 1 (single multi-step task)
- **Files modified:** 8

## Accomplishments

- Added `composite_score numeric(5,2)` and `tier varchar(10)` nullable columns to bots table with migration 0002_melted_black_widow.sql; index `bots_composite_score_idx` for leaderboard sorting
- Created metrics-computer.ts with 7 division-by-zero guards; reads task counts from tasks table (NOT bots.tasksCompleted which is always 0); queries tasks, billing_events, tool_invocations, and telemetry with Drizzle sql<number> template literals
- Created score-engine.ts with cross-bot min/max normalization for efficiency and cost_efficiency scores; idempotency guard prevents double-scoring; stores 4 telemetry rows per bot and updates bots.composite_score + bots.tier; all thresholds/weights env-var configurable
- Created performance-engine.ts as thin orchestrator with extension points for Plans 05-02 and 05-03
- Hooked runPerformancePipeline into completion-checker.ts with fire-and-forget .catch() — scoring failures are logged but never affect execution completed status

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration and performance scoring pipeline** - `35b16eb` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `packages/db/src/schema/bots.ts` — Added numeric import, compositeScore and tier nullable columns, bots_composite_score_idx index
- `packages/db/migrations/0002_melted_black_widow.sql` — Drizzle migration SQL: ALTER TABLE bots ADD COLUMN composite_score numeric(5,2); ALTER TABLE bots ADD COLUMN tier varchar(10); CREATE INDEX bots_composite_score_idx
- `services/execution-service/src/performance/metrics-computer.ts` — computeBotMetrics() from raw tables; 7 division-by-zero guards; idleRatio estimated from tool call duration vs bot_hours
- `services/execution-service/src/performance/score-engine.ts` — computeScoresForExecution() with idempotency guard, cross-bot normalization, telemetry insert (4 rows/bot), bots update; env-var configurable weights/thresholds
- `services/execution-service/src/performance/performance-engine.ts` — runPerformancePipeline() orchestrator; logs start/complete; placeholder for 05-02 and 05-03 additions
- `services/execution-service/src/orchestrator/completion-checker.ts` — Import of runPerformancePipeline; fire-and-forget .catch() call inside if (transitioned) block

## Decisions Made

- Read task counts from tasks table (claimed_by_bot_id) NOT from bots.tasksCompleted/tasksFailed — the plan explicitly flags these counters are always 0 (not maintained by current code)
- Score weights 40/30/20/10 are env-var configurable via SCORE_WEIGHT_SUCCESS, SCORE_WEIGHT_EFFICIENCY, SCORE_WEIGHT_COST, SCORE_WEIGHT_STABILITY; weights are normalized to sum to 1 before computation so non-100-summing overrides work correctly
- Tier thresholds configurable via TIER_HIGH_THRESHOLD (default 75) and TIER_MEDIUM_THRESHOLD (default 40)
- cross-bot min/max normalization: when max===min (all bots equal), returns 100 — gives full credit when the metric cannot differentiate bots
- Bots with zero completed tasks receive cost_efficiency_score=0 since no useful work was accomplished at any cost level

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Score weights and tier thresholds are pre-configured with sensible defaults and can be overridden via environment variables if desired.

## Next Phase Readiness

- Plan 05-02 (performance report builder) can be added by importing and calling in performance-engine.ts after the computeScoresForExecution() call
- Plan 05-03 (DNA capture) similarly hooks into performance-engine.ts
- bots.composite_score and bots.tier are now populated after every execution — leaderboard queries can begin in frontend/API work
- Concern (carried from STATE.md): composite score weights (40/30/20/10) are a reasoned starting point, not empirically validated — plan to iterate after first real execution data is collected

---
*Phase: 05-performance-intelligence-and-dna-capture*
*Completed: 2026-02-18*

## Self-Check: PASSED

All created files exist on disk. Task commit 35b16eb verified in git history.
