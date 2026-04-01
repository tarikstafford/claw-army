---
phase: 14-ui-extensions
plan: 03
subsystem: ui
tags: [svelte, sveltekit, sse, eventsource, notifications, toast, lifecycle]

# Dependency graph
requires:
  - phase: 14-02
    provides: Global SSE endpoint GET /events/lifecycle emitting soul_promoted, soul_demoted, soul_retired, pioneer_detected events
  - phase: 12-02
    provides: Verdicts inbox page with 15-second polling loadData() function

provides:
  - LifecycleNotification TypeScript interface in services/ui/src/lib/types.ts
  - connectLifecycleSSE() SSE client function in services/ui/src/lib/sse.ts
  - Global lifecycle toast container in +layout.svelte (all pages, max 5, 8s auto-dismiss)
  - New-verdict arrival banner in verdicts/+page.svelte (5s auto-dismiss, count comparison)

affects:
  - Any future UI work that needs to display soul lifecycle events
  - Future notification system evolution

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE event-type array + for-loop addEventListener pattern (same as connectSSE/connectBotLogs) extended for lifecycle events"
    - "Toast stack with $state array, crypto.randomUUID id, setTimeout auto-dismiss, slice(0,5) cap"
    - "previousCount sentinel (null = initial load, number = comparison enabled) prevents false positives on first load"

key-files:
  created: []
  modified:
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/sse.ts
    - services/ui/src/routes/+layout.svelte
    - services/ui/src/routes/verdicts/+page.svelte

key-decisions:
  - "connectLifecycleSSE follows exact same EventSource + typed-listener pattern as connectSSE and connectBotLogs — no new patterns introduced"
  - "Toast notifications cap at 5 and auto-dismiss at 8s to prevent UI clutter during high-velocity lifecycle events"
  - "previousCount=null on first load prevents false positive new-verdict banners on page mount"
  - "verdicts/[verdictId]/+page.svelte left untouched per plan instruction — Phase 12 work preserved"

patterns-established:
  - "Global layout-level SSE subscription: $effect with browser guard, connectX() returning cleanup fn, return () => cleanup?()"
  - "Toast stack pattern: state array of (T & { id: string }), prepend + slice(0,N), setTimeout dismiss"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 14 Plan 03: Frontend SSE Lifecycle Notifications Summary

**Global soul lifecycle toast notifications via EventSource in +layout.svelte and new-verdict arrival banner on verdicts inbox, completing UIEX-03 frontend and UIEX-02**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T00:06:01Z
- **Completed:** 2026-02-22T00:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `LifecycleNotification` TypeScript interface added to shared types (soul_promoted, soul_demoted, soul_retired, pioneer_detected with optional fromClass/toClass for promotions)
- `connectLifecycleSSE()` function in sse.ts connects to `/api/events/lifecycle` and dispatches typed events via the same EventSource pattern as existing SSE clients
- +layout.svelte wires SSE in a `$effect`, maintains a toast stack (max 5, 8s auto-dismiss), with color-coded icons (UP/DN/RT/P1) and dismiss button
- verdicts/+page.svelte tracks `previousCount` across polling intervals and shows a green banner when new verdicts arrive (auto-dismisses after 5s)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add LifecycleNotification type and connectLifecycleSSE client function** - `7b40da3` (feat)
2. **Task 2: Add global lifecycle toast to layout and new-verdict notification to verdicts page** - `3551dc4` (feat)

## Files Created/Modified
- `services/ui/src/lib/types.ts` - Added LifecycleNotification interface with soul event fields
- `services/ui/src/lib/sse.ts` - Added LIFECYCLE_EVENT_TYPES constant and connectLifecycleSSE() export
- `services/ui/src/routes/+layout.svelte` - Global toast container with SSE effect, icon/color helpers, dismiss logic
- `services/ui/src/routes/verdicts/+page.svelte` - previousCount state, banner state, new-verdict detection in loadData(), banner template and CSS

## Decisions Made
- connectLifecycleSSE follows the exact same EventSource + typed-listener pattern as connectSSE and connectBotLogs — no new patterns introduced, consistency maintained
- Toast notifications cap at 5 visible at once and auto-dismiss at 8s to prevent UI clutter during high-velocity lifecycle events
- previousCount initialized to null so the first load never triggers a false positive banner
- verdicts/[verdictId]/+page.svelte was not modified (Phase 12 work preserved per plan spec)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UIEX-03 (frontend lifecycle notifications) fully satisfied — connected users see real-time soul lifecycle toasts on all pages
- UIEX-02 (verdict arrival notifications) satisfied — new-verdict banner appears on inbox page between polling intervals
- Phase 14 plans complete (01: enhanced leaderboard, 02: lifecycle SSE backend, 03: lifecycle SSE frontend)
- Production deployment via `vercel deploy --prod` from repo root when ready

## Self-Check: PASSED

All files exist. All commits verified (7b40da3, 3551dc4).

---
*Phase: 14-ui-extensions*
*Completed: 2026-02-22*
