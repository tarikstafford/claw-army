---
phase: 04-sveltekit-frontend-core
plan: 04
subsystem: ui
tags: [sveltekit, svelte5, betterauth, navigation, routing]

# Dependency graph
requires:
  - phase: 04-01
    provides: BetterAuth migration, SvelteKit route group structure
  - phase: 04-02
    provides: Paperclip API client, proxy retarget, INDRA/OFFICE/CHAT/SANCTUM pages
  - phase: 04-03
    provides: Design system, typography, Screenplay/Director's Cut worlds
provides:
  - Clean SvelteKit codebase with all old v5 routes removed
  - Custom error page with 404 handling and /indra link
  - Fixed marketing layout using BetterAuth session pattern
  - Human-verified end-to-end navigation across all 4 tabs
affects: [future-ui-phases, onboarding, auth-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BetterAuth session access via event.locals.session in +layout.server.ts"
    - "SvelteKit route groups (marketing)/ and (app)/ for layout isolation"
    - "Error page at (app)/+error.svelte handles 404 and generic errors"

key-files:
  created:
    - services/ui/src/routes/(app)/+error.svelte
  modified:
    - services/ui/src/routes/(marketing)/+layout.server.ts
    - services/ui/src/routes/(marketing)/+layout.svelte
    - services/ui/src/routes/(app)/indra/+page.svelte
  deleted:
    - services/ui/src/routes/(app)/dashboard/+page.svelte
    - services/ui/src/routes/(app)/executions/ (entire tree)
    - services/ui/src/routes/(app)/verdicts/ (entire tree)
    - services/ui/src/routes/(app)/objectives/ (entire tree)
    - services/ui/src/routes/(app)/souls/ (entire tree)
    - services/ui/src/routes/(app)/billing/+page.svelte
    - services/ui/src/routes/(app)/admin/+page.svelte
    - services/ui/src/routes/(app)/negative-signals/+page.svelte
    - services/ui/src/routes/(app)/category-benchmarks/+page.svelte
    - services/ui/src/routes/(app)/new-execution/ (entire tree)
    - services/ui/src/routes/(marketing)/login/+page.svelte
    - services/ui/src/lib/components/SoulInspectorPanel.svelte
    - services/ui/src/lib/components/SoulTierBadge.svelte
    - services/ui/src/lib/components/VerdictConfirmPanel.svelte

key-decisions:
  - "Marketing layout server updated to use event.locals.session (BetterAuth) not getServerSession (@auth/sveltekit)"
  - "Nav links updated to /indra and /auth — not /dashboard and /login (old v5 routes removed)"
  - "Old v5 components SoulInspectorPanel, SoulTierBadge, VerdictConfirmPanel deleted with routes — no reimport risk"
  - "INDRA page strict mode: explicit type annotations on filter callbacks required by noUncheckedIndexedAccess"

patterns-established:
  - "All new UI phases start from a clean baseline — dead routes are deleted, not kept for reference"
  - "BetterAuth: event.locals.session is the correct session accessor in SvelteKit server files"

requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07]

# Metrics
duration: 45min
completed: 2026-03-24
---

# Phase 04 Plan 04: SvelteKit Frontend Core — Cleanup and Verification Summary

**Deleted 13,604 lines of old v5 routes and 3 orphaned components, added error page with 404 handling, fixed BetterAuth migration gap in marketing layout, and human-verified all 14 navigation steps across INDRA, OFFICE, CHAT, and SANCTUM**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-24T07:18:52Z
- **Completed:** 2026-03-24T07:48:00Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 29 (4 modified, 25 deleted)

## Accomplishments

- Removed 11 old v5 route directories (dashboard, executions, verdicts, objectives, souls, billing, admin, negative-signals, category-benchmarks, new-execution, marketing/login) — 13,549 lines deleted
- Removed 3 orphaned v5 components (SoulInspectorPanel, SoulTierBadge, VerdictConfirmPanel) that had no callers after route deletion
- Created `(app)/+error.svelte` with "Nothing here. Head back to the briefing." for 404 and generic error fallback
- Fixed marketing layout server: was still calling `@auth/sveltekit` getServerSession — updated to BetterAuth `event.locals.session` pattern
- Fixed marketing layout nav links: `/dashboard` → `/indra`, `/login` → `/auth`
- TypeScript check passed with 0 errors after all changes
- Human E2E verification: all 14 steps passed (auth redirect, /auth page, OAuth flow, /indra, /office sub-nav, /chat, /sanctum, mode toggle, error page, no old backend requests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove old v5 routes and add error page** - `eaa684e` (feat)
2. **Task 2: Human verification — full Phase 4 navigation walkthrough** - approved by human

## Files Created/Modified

- `services/ui/src/routes/(app)/+error.svelte` - Created: custom 404/error page with "Nothing here" copy and /indra link
- `services/ui/src/routes/(marketing)/+layout.server.ts` - Fixed: BetterAuth session pattern (event.locals.session)
- `services/ui/src/routes/(marketing)/+layout.svelte` - Fixed: nav links updated to /indra and /auth
- `services/ui/src/routes/(app)/indra/+page.svelte` - Fixed: explicit type annotations for TypeScript strict mode

## Decisions Made

- Marketing layout was still using `@auth/sveltekit` getServerSession — updated to BetterAuth `event.locals.session` pattern to match the Phase 04-01 auth migration
- Nav links `/dashboard` and `/login` pointed to now-deleted routes — updated to `/indra` and `/auth`
- INDRA page filter callbacks needed explicit type annotations due to `noUncheckedIndexedAccess: true` strict mode setting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] BetterAuth migration gap in marketing layout**
- **Found during:** Task 1 (Remove old v5 routes)
- **Issue:** `services/ui/src/routes/(marketing)/+layout.server.ts` was still importing and calling `getServerSession` from `@auth/sveltekit`. Phase 04-01 migrated auth to BetterAuth, but this file was missed.
- **Fix:** Updated to use `event.locals.session` (BetterAuth pattern); removed `@auth/sveltekit` import
- **Files modified:** `services/ui/src/routes/(marketing)/+layout.server.ts`
- **Verification:** TypeScript check passed (0 errors)
- **Committed in:** eaa684e (Task 1 commit)

**2. [Rule 1 - Bug] Marketing layout nav links pointed to deleted routes**
- **Found during:** Task 1 (Remove old v5 routes)
- **Issue:** `(marketing)/+layout.svelte` had nav links to `/dashboard` (deleted) and `/login` (deleted)
- **Fix:** Updated to `/indra` (new INDRA route) and `/auth` (new BetterAuth route)
- **Files modified:** `services/ui/src/routes/(marketing)/+layout.svelte`
- **Verification:** Manual inspection; confirmed during human verification walkthrough
- **Committed in:** eaa684e (Task 1 commit)

**3. [Rule 1 - Bug] TypeScript strict mode errors in INDRA page filter callbacks**
- **Found during:** Task 1 verification step (`pnpm --filter @claw/ui check`)
- **Issue:** `noUncheckedIndexedAccess: true` caused TypeScript errors on array filter callbacks missing explicit type annotations
- **Fix:** Added explicit type annotations to filter callbacks in `(app)/indra/+page.svelte`
- **Files modified:** `services/ui/src/routes/(app)/indra/+page.svelte`
- **Verification:** TypeScript check: 0 errors
- **Committed in:** eaa684e (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 bugs)
**Impact on plan:** All three auto-fixes were necessary for correctness and build stability. No scope creep.

## Issues Encountered

None beyond the three auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 SvelteKit Frontend Core is complete: BetterAuth, Paperclip API proxy, all 4 tabs, design system, clean codebase
- Ready for Phase 5 (Paperclip agent dispatch integration): INDRA, OFFICE, CHAT routes are all wired to Paperclip endpoints — Phase 5 can build live data on top of the stub UI
- No blockers

## Self-Check: PASSED

- `services/ui/src/routes/(app)/+error.svelte` — FOUND
- `eaa684e` commit — FOUND in git log

---
*Phase: 04-sveltekit-frontend-core*
*Completed: 2026-03-24*
