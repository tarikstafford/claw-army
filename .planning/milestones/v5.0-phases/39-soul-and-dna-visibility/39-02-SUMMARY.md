---
phase: 39-soul-and-dna-visibility
plan: 02
subsystem: ui, api
tags: [fastify, svelte, drizzle, decision-traces, negative-signals, soul-visibility]

# Dependency graph
requires:
  - phase: 39-01
    provides: soul library + category benchmarks endpoints and UI patterns used in this plan
provides:
  - GET /decision-traces/:botId — paginated decision attribution records per bot
  - GET /negative-signals — paginated failed/retired soul register with soul metadata join
  - Decision Traces toggle section on bot detail page
  - /negative-signals page with failure type filter chips and table
  - Negative Signals nav link
affects:
  - future soul analytics phases
  - bot performance analysis UX

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Promise.all for parallel data + count queries in Fastify routes
    - LEFT JOIN raw SQL on bot_souls for taskCategory/generation in negative signals route
    - $state toggle with first-load guard (tracesLoaded flag) for on-demand section loading
    - dt- and ns- CSS prefix conventions for new UI sections to avoid style collision

key-files:
  created:
    - services/execution-service/src/routes/decision-traces.ts
    - services/execution-service/src/routes/negative-signals.ts
    - services/ui/src/routes/negative-signals/+page.svelte
  modified:
    - services/execution-service/src/app.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
    - services/ui/src/routes/+layout.svelte

key-decisions:
  - "Decision traces route uses parallel Promise.all for data + count queries — same pattern as other pagination endpoints"
  - "Negative signals LEFT JOIN uses raw SQL alias (bs.task_category) — consistent with souls.ts agentClass/compositeScore join pattern"
  - "Bot detail page uses tracesLoaded flag to avoid re-fetching on hide/show toggle — avoids redundant network requests"
  - "attributionConfidence returned as string from Drizzle (numeric type) — frontend uses parseFloat() to display as percentage"

patterns-established:
  - "tracesLoaded flag pattern: load on first toggle, skip on subsequent toggles"
  - "dt- prefix for all decision trace CSS classes; ns- prefix for all negative signals CSS classes"

requirements-completed: [SOUL-02, SOUL-03]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 39 Plan 02: Decision Trace Viewer and Negative Signal Register Summary

**Fastify GET /decision-traces/:botId and GET /negative-signals endpoints with Svelte bot detail trace viewer and /negative-signals filter table — soul attribution visibility complete**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-03T10:23:23Z
- **Completed:** 2026-03-03T10:26:41Z
- **Tasks:** 2
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- Two new Fastify route plugins: decision traces with botId filtering and pagination; negative signals with failureType filter + soul metadata LEFT JOIN
- Decision Traces section added to bot detail page — toggle reveals rows with decision type badge (violet/teal/amber), directive reference, attribution confidence as %, outcome badge (success/failure/partial), timestamp, and Load More
- New /negative-signals page with filter chips (All / retirement / budget_overrun / guardrail_violation / quality_floor_breach), table view with failure type badges, task category, generation, truncated directive failure summary, registered date, and execution link
- Nav bar Signals link added after Benchmarks

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend endpoints for decision traces and negative signals** - `8b9d816` (feat)
2. **Task 2: Decision trace section on bot detail + Negative signals UI page + nav link** - `98827de` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/execution-service/src/routes/decision-traces.ts` — GET /:botId paginated endpoint, parallel data+count queries
- `services/execution-service/src/routes/negative-signals.ts` — GET / with failureType filter and LEFT JOIN bot_souls for taskCategory/generation
- `services/execution-service/src/app.ts` — registered decisionTracesRoutes and negativeSignalsRoutes
- `services/ui/src/lib/types.ts` — DecisionTraceEntry, DecisionTracesResponse, NegativeSignalEntry, NegativeSignalsResponse
- `services/ui/src/lib/api.ts` — getBotDecisionTraces(), getNegativeSignals()
- `services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte` — Decision Traces toggle section with badge styles
- `services/ui/src/routes/negative-signals/+page.svelte` — full filter chip + table page
- `services/ui/src/routes/+layout.svelte` — Signals nav link

## Decisions Made
- Decision traces route uses parallel Promise.all for data + count queries — consistent with other pagination endpoints
- Negative signals LEFT JOIN uses raw SQL alias (bs.task_category) — consistent with souls.ts agentClass/compositeScore join pattern
- Bot detail page uses tracesLoaded flag to avoid re-fetching on hide/show toggle
- attributionConfidence returned as string from Drizzle (numeric type) — frontend uses parseFloat() to display as percentage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in services/execution-service/src/routes/billing.ts (pre_flight status not in schema union) — out of scope per deviation rules. Logged to deferred items. New files compile cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All SOUL requirements (01-04) complete — Phase 39 fully executed
- Ready for Phase 40 or milestone wrap-up
- Production: ensure decision_traces and negative_signal_register tables exist (migrations 0008-0010 may need manual application per MEMORY.md)

---
*Phase: 39-soul-and-dna-visibility*
*Completed: 2026-03-03*

## Self-Check: PASSED

All created files verified on disk. Both task commits verified in git log.
