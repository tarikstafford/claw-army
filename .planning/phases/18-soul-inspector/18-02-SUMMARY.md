---
phase: 18-soul-inspector
plan: 02
subsystem: ui
tags: [soul, badge, component, svelte, monitoring, leaderboard, bot-detail]
dependency_graph:
  requires:
    - packages/db (agentClasses table)
    - services/execution-service/src/routes/bots.ts (existing by-execution handler + soul endpoint from 18-01)
    - services/ui/src/lib/types.ts (ExecutionBot interface)
    - services/ui/src/lib/components/SoulInspectorPanel.svelte (18-01 created $lib/components/ directory)
    - services/ui/src/lib/api.ts (getBotSoul() added in 18-01)
  provides:
    - agentClass field in GET /bots/by-execution/:executionId response (batch inArray lookup)
    - agentClass field on ExecutionBot TypeScript interface
    - SoulTierBadge.svelte reusable colored pill badge component
    - Soul tier badges in all 3 bot card contexts (monitoring, leaderboard, detail)
  affects:
    - services/ui/src/routes/executions/[id]/+page.svelte
    - services/ui/src/routes/executions/[id]/report/+page.svelte
    - services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
tech_stack:
  added: []
  patterns:
    - Same CLASS_RANK precedence map pattern (Artisan=3>Understudy=2>Novice=1>Retired=0) used in batch monitoring lookup
    - botIds.length > 0 guard before inArray query prevents invalid empty IN clause in PostgreSQL
    - Lightweight botAgentClass $state + $effect in bot detail page fetches soul data once without opening inspector
key_files:
  created:
    - services/ui/src/lib/components/SoulTierBadge.svelte
  modified:
    - services/execution-service/src/routes/bots.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/routes/executions/[id]/+page.svelte
    - services/ui/src/routes/executions/[id]/report/+page.svelte
    - services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
decisions:
  - "[18-02] inArray guarded with botIds.length > 0 check — PostgreSQL rejects empty IN () clause; guard prevents SQL error when execution has no bots yet"
  - "[18-02] Bot detail page uses separate botAgentClass $state + $effect to fetch agentClass — badge visible immediately without user opening inspector panel"
  - "[18-02] Report leaderboard class-badge span replaced with SoulTierBadge component — eliminates duplicated CSS; same hex values, single source of truth"
metrics:
  duration: 3 min
  completed: 2026-02-22T09:43:43Z
  tasks_completed: 2
  files_modified: 5
---

# Phase 18 Plan 02: SoulTierBadge Summary

**SoulTierBadge colored pill component (Novice/Understudy/Artisan/Retired) rendered in monitoring bot cards, leaderboard rows, and bot detail page — backed by extended monitoring endpoint with batch agentClass lookup.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-22T09:41:34Z
- **Completed:** 2026-02-22T09:43:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended `GET /bots/by-execution/:executionId` to return `agentClass` per bot using batch inArray query with CLASS_RANK precedence map
- Created `SoulTierBadge.svelte` — compact pill badge with 4 tier-specific color schemes, renders nothing for null (graceful handling)
- Replaced the raw `class-badge` span in the leaderboard table with the reusable SoulTierBadge component
- Added soul tier badge to monitoring bot cards (from `ExecutionBot.agentClass`), leaderboard rows (from `LeaderboardEntry.agentClass`), and bot detail page (from `getBotSoul()` lightweight fetch)

## Task Commits

1. **Task 1: Extend monitoring endpoint + update ExecutionBot type** - `b30758a` (feat)
2. **Task 2: Create SoulTierBadge + integrate into all 3 bot card contexts** - `d83f062` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `services/ui/src/lib/components/SoulTierBadge.svelte` - Reusable colored pill badge for Novice/Understudy/Artisan/Retired tiers
- `services/execution-service/src/routes/bots.ts` - Extended `by-execution` handler with batch agentClass lookup; added `inArray` import
- `services/ui/src/lib/types.ts` - Added `agentClass` field to `ExecutionBot` interface
- `services/ui/src/routes/executions/[id]/+page.svelte` - Import SoulTierBadge + render in `.bot-card-top` per bot
- `services/ui/src/routes/executions/[id]/report/+page.svelte` - Import SoulTierBadge + replace raw class-badge span in leaderboard table
- `services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte` - Import getBotSoul + SoulTierBadge, fetch botAgentClass in $effect, render in `.bot-status-row`

## Decisions Made

- `inArray` guarded with `botIds.length > 0` — PostgreSQL rejects `IN ()` with empty array; guard prevents SQL error during executions with no bots
- Bot detail page uses a separate lightweight `botAgentClass $state` populated by a `getBotSoul()` `$effect` — badge is visible immediately on page load without the user opening the full inspector drawer
- Replaced the `class-badge` span in `report/+page.svelte` with `SoulTierBadge` component — eliminates CSS duplication (identical hex values in both places); SoulTierBadge is now the single source of truth

## Deviations from Plan

None — plan executed exactly as written. Option A (preferred) for bot detail page integration was used as specified (18-01 was already complete, providing `getBotSoul()`).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 18 (Soul Inspector) is complete — SOUL-01 through SOUL-04 all satisfied
- Phase 19 can proceed; soul tier badges are visible across all bot card surfaces without any additional wiring
- `SoulTierBadge` component is available for reuse in any future UI context

## Self-Check: PASSED

All files confirmed on disk:
- services/ui/src/lib/components/SoulTierBadge.svelte — FOUND
- services/execution-service/src/routes/bots.ts — FOUND
- services/ui/src/lib/types.ts — FOUND
- services/ui/src/routes/executions/[id]/+page.svelte — FOUND
- services/ui/src/routes/executions/[id]/report/+page.svelte — FOUND
- services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte — FOUND
- .planning/phases/18-soul-inspector/18-02-SUMMARY.md — FOUND

All commits verified in git history:
- b30758a — FOUND
- d83f062 — FOUND

---
*Phase: 18-soul-inspector*
*Completed: 2026-02-22*
