---
phase: 17-objective-hub-ui
plan: 02
subsystem: ui
tags: [svelte5, sveltekit, typescript, objectives, navigation]

# Dependency graph
requires:
  - phase: 17-01
    provides: getObjectives API function, ObjectiveListItem type, GET /objectives endpoint

provides:
  - /objectives SvelteKit route — table of all saved objectives with status badges, stats, and nav links
  - Objectives nav link in +layout.svelte (first in nav-right, before Guide)

affects:
  - 17-03-objective-detail-page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Svelte 5 runes: $state, $effect with browser guard (matching billing page pattern)"
    - "ObjectiveListItem.bestBotClass.toLowerCase() for dynamic class-{class} CSS binding"

key-files:
  created:
    - services/ui/src/routes/objectives/+page.svelte
  modified:
    - services/ui/src/routes/+layout.svelte

key-decisions:
  - "Name column truncated to 50 chars with ellipsis — shorter than billing 60-char limit to fit class badge column"
  - "bestBotClass.toLowerCase() for CSS class binding — Artisan -> class-artisan, matching billing status badge pattern"
  - "No CSS variable conversion — kept hardcoded light-mode colors consistent with billing/+page.svelte"

patterns-established:
  - "Objectives nav link order: Objectives > Guide > Verdicts > Billing (objectives are primary v3.0 target)"
  - "class-badge pattern: inline-block, 9999px border-radius, uppercase, colored by class tier"

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 17 Plan 02: Objectives List Page and Nav Link Summary

**SvelteKit /objectives route with a full-column table (name linked to detail, last-run status badge, run count, dollar-formatted spend, class badge) and Objectives added as first nav link**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T09:00:10Z
- **Completed:** 2026-02-22T09:01:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `services/ui/src/routes/objectives/+page.svelte` with Svelte 5 runes pattern, table rendering all ObjectiveListItem fields, empty state, and loading/error states
- Each objective row is clickable via `<a href="/objectives/{obj.id}">` on the name column; names truncated to 50 chars
- Status badges (completed/failed/running/queued/stopped/paused) and class badges (novice/understudy/artisan/retired) with color coding
- Added `<a href="/objectives" class="nav-link">Objectives</a>` as first link in nav-right in `+layout.svelte`, before Guide

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /objectives list page** - `8f44442` (feat)
2. **Task 2: Add Objectives link to navigation bar** - `5f6297a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/ui/src/routes/objectives/+page.svelte` - New SvelteKit route: objectives list with table, badges, empty state (266 lines)
- `services/ui/src/routes/+layout.svelte` - Added Objectives nav link as first item in nav-right

## Decisions Made
- No CSS variable conversion: kept hardcoded light-mode colors (#6b7280, #374151 etc.) consistent with `billing/+page.svelte` to avoid visual inconsistency per plan spec
- Name truncated to 50 chars (plan spec), slightly shorter than billing's 60-char limit to accommodate class badge column
- `bestBotClass.toLowerCase()` used for dynamic CSS class binding (Artisan -> class-artisan) — same pattern as status badges using status-{status}

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /objectives list page complete and type-checked (0 errors, svelte-check passes)
- Objectives nav link visible in layout; routing to /objectives/:id already available for 17-03
- 17-03 (Objective detail page) can now be built: detail page at /objectives/[id] with getObjective, getObjectiveExecutions, getObjectiveStats already in api.ts

---
*Phase: 17-objective-hub-ui*
*Completed: 2026-02-22*

## Self-Check: PASSED

- services/ui/src/routes/objectives/+page.svelte: FOUND
- services/ui/src/routes/+layout.svelte: FOUND
- .planning/phases/17-objective-hub-ui/17-02-SUMMARY.md: FOUND
- Commit 8f44442 (feat(17-02): create /objectives list page): FOUND
- Commit 5f6297a (feat(17-02): add Objectives link to nav bar): FOUND
