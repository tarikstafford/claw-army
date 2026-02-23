---
phase: 19-run-view-enhancements
plan: 02
subsystem: ui
tags: [drizzle, typebox, svelte5, verdicts, soul-tiers, inline-panel, bots, report]

# Dependency graph
requires:
  - phase: 19-run-view-enhancements
    provides: per-bot live stats (P01), execution detail page with bot cards
  - phase: 18-soul-inspector
    provides: SoulTierBadge component, soul inspector slide-in pattern
  - phase: 17-objective-hub-ui
    provides: execution report page foundation, VerdictDetail type
provides:
  - soulTierDistribution field in ExecutionReport (backend + frontend)
  - GET /executions/:id/pending-verdicts endpoint (Promote/Retire+pending filtered)
  - VerdictConfirmPanel.svelte reusable slide-in panel (verdict/userId/onResolved/onClose)
  - Soul Tier Distribution section on post-run report page
  - Amber pulsing Verdict button on bot cards with pending verdicts
  - Inline verdict confirmation without navigation, refreshes on resolution
affects: [executions-report, executions-live-view, verdict-confirmation, soul-inspector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VerdictConfirmPanel uses onResolved() callback pattern — never goto() from inline panels
    - arrivedAt set to Date.now() at component mount in let declaration (not $effect) — data already loaded via prop
    - Pending verdicts polling at 10s interval (slower than bots 5s) with terminal-state guard
    - soul tier distribution query uses inArray(agentClasses.botId, botIds) guarded by botIds.length > 0 per [18-02]

key-files:
  created:
    - services/ui/src/lib/components/VerdictConfirmPanel.svelte
  modified:
    - services/execution-service/src/performance/report-builder.ts
    - services/execution-service/src/routes/executions.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/routes/executions/[id]/report/+page.svelte
    - services/ui/src/routes/executions/[id]/+page.svelte

key-decisions:
  - "[19-02] VerdictConfirmPanel calls onResolved() instead of goto() — inline panel must not navigate away from run detail view"
  - "[19-02] arrivedAt initialized in let declaration (not $effect) — verdict data passed as prop so timing starts at component mount"
  - "[19-02] Pending verdicts polling at 10s vs bots at 5s — verdicts change less frequently than bot status"
  - "[19-02] pending-verdicts endpoint filters verdictType IN ('Promote','Retire') — only promotion-path verdicts require human confirmation"

patterns-established:
  - "VerdictConfirmPanel slide-in follows SoulInspectorPanel CSS patterns: backdrop + fixed aside panel + slideIn animation"
  - "Inline confirmation panels use onResolved/onClose prop callbacks, never internal navigation"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 19 Plan 02: Run View Enhancements Summary

**Soul tier distribution on post-run report + inline verdict confirmation panel (VerdictConfirmPanel) wired into run detail view via new /pending-verdicts endpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T17:02:14Z
- **Completed:** 2026-02-22T17:05:47Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Extended `buildExecutionReport` with step 9: soul tier distribution via `agentClasses` batch query grouped by `currentClass`, guarded by `botIds.length > 0` per decision [18-02]
- Added `GET /executions/:id/pending-verdicts` endpoint returning Promote/Retire+pending verdicts with full evidence columns, `weightedConfidenceScore` cast to Number per [17-01]
- Created `VerdictConfirmPanel.svelte` — slide-in panel extracted from verdicts page, using `onResolved()` callback instead of `goto()`, with light-mode color scheme matching the run detail view
- Soul Tier Distribution section added to report page between Execution Summary and Bot Leaderboard, using existing `SoulTierBadge` component with counts
- Run detail view now shows amber pulsing "Verdict" button on bot cards with pending verdicts; clicking opens `VerdictConfirmPanel` inline, refreshes both pendingVerdicts and bots on resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: soulTierDistribution + pending-verdicts endpoint + frontend types/API** - `0d6e792` (feat)
2. **Task 2: VerdictConfirmPanel + soul tier on report + inline verdict highlights** - `09097db` (feat)

## Files Created/Modified
- `services/execution-service/src/performance/report-builder.ts` - Added agentClasses import, inArray import, soulTierDistribution to ExecutionReport interface, step 9 query with botIds guard
- `services/execution-service/src/routes/executions.ts` - Extended /:id/report TypeBox schema with soulTierDistribution; added /:id/pending-verdicts route before /all
- `services/ui/src/lib/types.ts` - Extended ExecutionReport with soulTierDistribution; added ExecutionPendingVerdict type alias
- `services/ui/src/lib/api.ts` - Added ExecutionPendingVerdict import; added getExecutionPendingVerdicts function
- `services/ui/src/lib/components/VerdictConfirmPanel.svelte` - New reusable slide-in panel with verdict/userId/onResolved/onClose props, light-mode styling
- `services/ui/src/routes/executions/[id]/report/+page.svelte` - Added Soul Tier Distribution section with SoulTierBadge + count, CSS for tier-distribution/tier-item/tier-count
- `services/ui/src/routes/executions/[id]/+page.svelte` - Added VerdictConfirmPanel import, pendingVerdicts/selectedVerdict state, 10s polling $effect, getPendingVerdictForBot helper, Verdict button on bot cards, inline VerdictConfirmPanel with onResolved refresh, pulse-verdict CSS animation

## Decisions Made
- VerdictConfirmPanel calls `onResolved()` callback — never `goto('/verdicts')` — so inline verdict panel stays within the run detail context
- `arrivedAt` initialized at let declaration time (`Date.now()`) not in `$effect` — verdict data is passed as a prop, already loaded, so timing correctly starts at panel mount
- Pending verdicts poll at 10s vs bots at 5s — verdict changes are low-frequency, don't need aggressive polling
- `/:id/pending-verdicts` filters by `verdictType IN ('Promote', 'Retire')` — only promotion-path verdicts require explicit human confirmation; Maintain/Monitor/Demote are auto-processed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Shell glob expansion blocked `git add` for paths containing `[id]` — solved by quoting file paths with double quotes in the git add command

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 complete. All run view enhancement plans (P01 + P02) shipped.
- Post-run report now shows soul tier distribution alongside existing metrics and leaderboard.
- Users can confirm/reject pending verdicts directly from the run detail view without context-switching to the verdicts page.
- Both TypeScript compilation targets (execution-service + ui) pass with no errors.

## Self-Check: PASSED
