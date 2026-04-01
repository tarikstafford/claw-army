---
phase: 19-run-view-enhancements
plan: 01
subsystem: ui
tags: [drizzle, typebox, svelte5, sse, bots, monitoring, live-stats]

# Dependency graph
requires:
  - phase: 18-soul-inspector
    provides: agentClass field on /by-execution endpoint, SoulTierBadge component
  - phase: 17-objective-hub-ui
    provides: objective hub page with live panel and activity feed
provides:
  - Extended /by-execution endpoint with currentTaskDescription, toolCallCount, tokenBurnRate per bot
  - Bot cards in live monitoring view showing task description, tool call count, and token burn rate
  - Objective hub activity feed enriched with formatEventDetail() and View full run link
affects: [executions-live-view, objective-hub, bot-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server-side tokenBurnRate computation (totalTokens / activeMinutes) guarded by >= 1 min threshold
    - Batch DB lookups with botIds.length > 0 guard for all inArray() calls (decision 18-02 pattern)

key-files:
  created: []
  modified:
    - services/execution-service/src/routes/bots.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/routes/executions/[id]/+page.svelte
    - services/ui/src/routes/objectives/[id]/+page.svelte

key-decisions:
  - "[19-01] tokenBurnRate returned as null when bot has been active < 1 minute — avoids misleading spikes from early tool calls"
  - "[19-01] currentTaskDescription query uses tasks WHERE status='claimed' (not 'working') — claimed is the in-progress state in the task lifecycle"
  - "[19-01] toolCallCount excludes rejected=true invocations — counts only productive tool calls"

patterns-established:
  - "Bot card stat rows use bot-card-stats and bot-live-stats classes — consistent small-font row layout"
  - "formatEventDetail() function is defined identically in both executions and objectives pages — single canonical implementation, not abstracted"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 19 Plan 01: Run View Enhancements Summary

**Per-bot live stats (task description, tool call count, tok/min) in bot cards via extended /by-execution endpoint; objective hub activity feed enriched with formatEventDetail() and View full run link**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T16:57:44Z
- **Completed:** 2026-02-22T17:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended `/bots/by-execution/:executionId` with three new fields: currentTaskDescription, toolCallCount, tokenBurnRate — computed via three new batch DB queries with inArray guards
- Bot cards in the live monitoring view now show: current task description (indigo-tinted box, 2-line clamp, only when working), tool call count, and token burn rate (or "- tok/min" if < 1 min active)
- Objective hub activity feed upgraded from bare event type to formatEventDetail() output (matching executions detail page) with a "View full run" link pointing to the active run

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend /by-execution endpoint + frontend types** - `10056c1` (feat)
2. **Task 2: Bot card rendering + objective hub enrichment** - `a4031ea` (feat)

## Files Created/Modified
- `services/execution-service/src/routes/bots.ts` - Added tasks import, sql import, 3 new TypeBox schema fields, 3 batch DB lookups, updated return mapping with computed tokenBurnRate
- `services/ui/src/lib/types.ts` - Extended ExecutionBot interface with currentTaskDescription, toolCallCount, tokenBurnRate
- `services/ui/src/routes/executions/[id]/+page.svelte` - Added bot-task-desc and bot-live-stats elements inside bot card loop; added CSS classes
- `services/ui/src/routes/objectives/[id]/+page.svelte` - Added formatEventDetail() function, replaced activity-type span with activity-detail span, added View full run link and CSS

## Decisions Made
- tokenBurnRate returned as null when bot has been active < 1 minute to avoid misleading spikes from early tool calls
- currentTaskDescription query uses `tasks WHERE status='claimed'` — claimed is the in-progress state in the task lifecycle
- toolCallCount excludes `rejected=true` invocations — counts only productive tool calls, matching user mental model

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- pnpm required for TypeScript checks (project uses workspace pnpm config, npx tsc resolves incorrectly)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 Plan 01 complete. Run view enhancements shipped.
- Bot cards now give users real-time visibility into what each bot is doing.
- Objective hub activity feed is now informative without requiring navigation to the full run view.

## Self-Check: PASSED
- `services/execution-service/src/routes/bots.ts` — EXISTS, contains currentTaskDescription and tokenBurnRate
- `services/ui/src/lib/types.ts` — EXISTS, contains tokenBurnRate in ExecutionBot interface
- `services/ui/src/routes/executions/[id]/+page.svelte` — EXISTS, contains bot.currentTaskDescription rendering
- `services/ui/src/routes/objectives/[id]/+page.svelte` — EXISTS, contains formatEventDetail
- Commits `10056c1` and `a4031ea` — VERIFIED via git log
- TypeScript compilation passes for both execution-service and ui — VERIFIED

---
*Phase: 19-run-view-enhancements*
*Completed: 2026-02-22*
