---
phase: 07-google-auth-gate
plan: "04"
subsystem: auth
tags: [sveltekit, auth.js, google-oauth, svelte5, runes, login-page, session]

# Dependency graph
requires:
  - phase: 07-03
    provides: "@auth/sveltekit installed with SvelteKitAuth Google provider; signIn/signOut exported from auth.ts; event.locals.auth() typed in app.d.ts"
provides:
  - "services/ui/src/routes/login/+page.svelte: dark-themed Google sign-in page with onclick handler redirecting to /new-execution"
  - "services/ui/src/routes/+layout.server.ts: session exposed to all layouts and pages via data.session"
  - "services/ui/src/routes/+layout.svelte: nav updated with 28px circular avatar, display name, Sign out button when authenticated; Deploy Crew CTA when logged out"
affects:
  - 07-05-PLAN.md (route protection — redirect to /login when no session)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "+layout.server.ts returns session from event.locals.auth() — makes session available in $page.data.session and all layout data props"
    - "Svelte 5 $derived(data.session) for reactive session in layout"
    - "Conditional nav rendering with {#if session?.user} — shows user info or Deploy Crew CTA"
    - "signIn('google', { redirectTo: '/new-execution' }) on login button onclick"
    - "signOut({ redirectTo: '/' }) on Sign out button onclick"

key-files:
  created:
    - services/ui/src/routes/login/+page.svelte
    - services/ui/src/routes/+layout.server.ts
  modified:
    - services/ui/src/routes/+layout.svelte

key-decisions:
  - "Deploy Crew CTA only shown when logged out — authenticated users see their user info instead of the CTA; avoids duplicate navigation paths"
  - "$derived for session — ensures reactivity if data changes without manual subscriptions"

patterns-established:
  - "Login page uses existing CSS variables exclusively (--surface-0/1/2/3, --border, --text-primary/secondary, --r-sm/md) — consistent with dark theme"
  - "All interactive elements use onclick attribute (not on:click) — consistent with Svelte 5 runes mode decision from Phase 06"

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 07 Plan 04: Login Page and Session Nav Summary

**Dark-themed /login page with Google OAuth button and nav updated to show 28px avatar, display name, and Sign out for authenticated users via +layout.server.ts session loader**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T08:39:34Z
- **Completed:** 2026-02-19T08:41:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `+layout.server.ts` that exposes `event.locals.auth()` session to all pages/layouts via `data.session`
- Created `login/+page.svelte` with dark-themed card, Claw Army brand, and Google OAuth button using Svelte 5 `onclick` handler
- Updated `+layout.svelte` to import `signOut`, destructure `data` from `$props()`, derive `session`, and conditionally render user avatar/name/sign-out or Deploy Crew CTA

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /login page and +layout.server.ts session loader** - `3f9cd41` (feat)
2. **Task 2: Update +layout.svelte nav to show authenticated user** - `0e3f0a1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/ui/src/routes/+layout.server.ts` - LayoutServerLoad returning `{ session: await event.locals.auth() }` — makes session available to all pages
- `services/ui/src/routes/login/+page.svelte` - Centered card with Claw Army SVG brand, heading, subtext, Google sign-in button with inline G SVG; calls `signIn('google', { redirectTo: '/new-execution' })`
- `services/ui/src/routes/+layout.svelte` - Added signOut import, data/session destructure via $props/$derived, conditional nav showing user avatar + name + Sign out (authenticated) or Deploy Crew CTA (logged out)

## Decisions Made
- **Deploy Crew CTA only shown when logged out:** Authenticated users see their user info (avatar, name, Sign out) instead of the CTA. No duplicate navigation paths.
- **$derived for session:** `let session = $derived(data.session)` ensures session stays reactive if layout data updates, consistent with Svelte 5 runes best practices.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required for this plan. Auth environment variables were documented in Plan 07-03.

## Next Phase Readiness
- Login page and session nav are complete — users can visit `/login`, authenticate via Google, and see their avatar/name in the nav after login
- Plan 07-05 can now implement route protection using `data.session` in server load functions to redirect unauthenticated users to `/login`
- No blockers

---
*Phase: 07-google-auth-gate*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: services/ui/src/routes/login/+page.svelte
- FOUND: services/ui/src/routes/+layout.server.ts
- FOUND: services/ui/src/routes/+layout.svelte
- FOUND: commit 3f9cd41 (feat(07-04): create /login page and +layout.server.ts session loader)
- FOUND: commit 0e3f0a1 (feat(07-04): update +layout.svelte nav with authenticated user display)
