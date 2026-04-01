---
phase: 07-google-auth-gate
plan: "01"
subsystem: ui

tags: [sveltekit, adapter-vercel, adapter-static, ssr, vercel]

# Dependency graph
requires:
  - phase: 06-ui-command-center
    provides: SvelteKit UI with adapter-static SPA mode as baseline
provides:
  - SvelteKit UI configured for adapter-vercel with full server runtime
  - hooks.server.ts, +page.server.ts, +layout.server.ts can execute at request time
  - /api/:path* proxy rewrite preserved for execution-service
  - SPA fallback (/(.*) → /200.html) removed, enabling Auth.js server routes
affects:
  - 07-02 (Auth.js server files depend on this server runtime)
  - 07-03 (Auth.js config and Google OAuth callback routing depends on no SPA fallback)

# Tech tracking
tech-stack:
  added:
    - "@sveltejs/adapter-vercel ^6.3.2"
  patterns:
    - "Vercel serverless function per route via adapter-vercel"
    - "SSR enabled globally — no ssr=false in root layout"

key-files:
  created: []
  modified:
    - services/ui/package.json
    - services/ui/svelte.config.js
    - services/ui/vercel.json
    - services/ui/src/routes/+layout.js

key-decisions:
  - "adapter-vercel replaces adapter-static — adapter-static produces only static HTML; hooks.server.ts and server load functions never execute at request time in that mode"
  - "SPA fallback rewrite (/(.*) → /200.html) removed — with adapter-vercel, Vercel native routing handles unknown paths; the fallback would intercept Auth.js server routes like /auth/callback/google"
  - "outputDirectory removed from vercel.json — adapter-vercel manages its own output directory, the field conflicts"
  - "export const ssr = false removed from +layout.js — SSR required for Auth.js server load functions to run on every request"

patterns-established:
  - "adapter-vercel with no options — default config, no custom output dir or edge functions"
  - "vercel.json keeps only /api/:path* proxy, no SPA-specific fields"

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 07 Plan 01: Migrate SvelteKit to adapter-vercel for Server Runtime Summary

**Swapped @sveltejs/adapter-static for @sveltejs/adapter-vercel, removed SPA fallback rewrite, and enabled SSR — giving Auth.js server files (hooks.server.ts, +page.server.ts) a real Vercel serverless runtime to execute in.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T00:00:00Z
- **Completed:** 2026-02-19
- **Tasks:** 1/1
- **Files modified:** 5 (package.json, svelte.config.js, vercel.json, +layout.js, pnpm-lock.yaml)

## Accomplishments

- Removed `@sveltejs/adapter-static` and installed `@sveltejs/adapter-vercel ^6.3.2`
- Updated `svelte.config.js` to use `adapter()` from `@sveltejs/adapter-vercel` — enables Vercel serverless functions per route
- Cleaned `vercel.json`: removed SPA fallback `/(.*) → /200.html` and `outputDirectory` field; preserved `/api/:path*` proxy to execution-service at `http://34.136.15.56:3001/:path*`
- Removed `export const ssr = false` from `+layout.js` — server-side rendering now available globally
- `pnpm run check` exits 0 with no adapter-related errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap adapter-static for adapter-vercel and update build config** - `26cab71` (chore)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `services/ui/package.json` - Removed adapter-static, added adapter-vercel ^6.3.2
- `services/ui/svelte.config.js` - Changed import and adapter() call to adapter-vercel
- `services/ui/vercel.json` - Removed SPA fallback rewrite and outputDirectory; kept /api proxy
- `services/ui/src/routes/+layout.js` - Removed ssr=false, replaced with SSR-enabled comment module
- `pnpm-lock.yaml` - Updated lockfile reflecting adapter swap

## Decisions Made

- `adapter-static` produces a bare HTML shell — `hooks.server.ts` and `+layout.server.ts` never run at request time in static mode. `adapter-vercel` creates real serverless functions so server files execute on every request. This is a hard requirement for Auth.js.
- The SPA fallback rewrite `/(.*) → /200.html` was necessary for client-side routing with `adapter-static` but would catch Auth.js's `/auth/callback/google` route before it reaches the Vercel serverless handler. Removed with `adapter-vercel` since Vercel handles unknown paths natively.
- `outputDirectory: "build"` was a static-adapter artifact. `adapter-vercel` manages its own `.vercel/output` directory and this field causes conflicts.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — `pnpm run check` completed with 0 errors. One pre-existing CSS warning (`appearance` property in `new-execution/+page.svelte` line 406) was present before this plan and is unrelated to the adapter change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Server runtime is available: `hooks.server.ts`, `+page.server.ts`, and `+layout.server.ts` will execute on every Vercel request
- `/api/:path*` proxy to execution-service is preserved
- Auth.js server files (`src/hooks.server.ts`, `src/routes/auth/[...auth]/+server.ts`, `src/routes/login/+page.server.ts`) can now be added in Plans 02 and 03
- No blockers — ready to proceed to 07-02

---
*Phase: 07-google-auth-gate*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: services/ui/package.json
- FOUND: services/ui/svelte.config.js
- FOUND: services/ui/vercel.json
- FOUND: services/ui/src/routes/+layout.js
- FOUND: .planning/phases/07-google-auth-gate/07-01-SUMMARY.md
- FOUND commit: 26cab71 (chore(07-01): swap adapter-static for adapter-vercel, enable SSR)
