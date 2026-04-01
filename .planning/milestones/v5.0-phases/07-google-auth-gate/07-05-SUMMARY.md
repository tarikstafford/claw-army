---
phase: 07-google-auth-gate
plan: "05"
subsystem: auth
tags: [sveltekit, auth.js, server-action, form-action, use-enhance, route-guard]

# Dependency graph
requires:
  - phase: 07-02
    provides: execution-service JWT verification middleware (bearer token validation)
  - phase: 07-03
    provides: "@auth/sveltekit handle hook, locals.auth(), Auth.js session cookie infrastructure"
provides:
  - "services/ui/src/routes/new-execution/+page.server.ts: load auth guard + actions.default form submission"
  - "/new-execution protected route — unauthenticated users redirected to /login"
  - "Auth.js session token forwarded as Authorization: Bearer to execution-service POST /executions"
  - "Form submission converted from client-side createExecution() to SvelteKit server action"
affects:
  - 07-06-PLAN.md (end-to-end auth integration test — tests this route guard and form action)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PageServerLoad + Actions pattern: load() guards route, actions.default() handles form POST"
    - "event.cookies.get() for httpOnly Auth.js session token extraction (not readable client-side)"
    - "Cookie dual-lookup: __Secure-authjs.session-token (HTTPS prod) then authjs.session-token (HTTP dev)"
    - "use:enhance for progressive enhancement: submitting state via callback, reset:false preserves input"
    - "form.$props() + $derived(form?.error) for ActionData server error propagation to UI"
    - "formData.getAll('allowedTools') with {#each allowedTools} hidden inputs for multi-value serialization"

key-files:
  created:
    - services/ui/src/routes/new-execution/+page.server.ts
  modified:
    - services/ui/src/routes/new-execution/+page.svelte

key-decisions:
  - "Server action (not client fetch) for execution creation — httpOnly cookie requires server-side access; client JS cannot read Auth.js session token"
  - "budgetCapDollars to budgetCapCents conversion moved to server action (Math.round(dollars * 100)) — consistent with integer cents decision from Phase 01"
  - "redirect(303, '/login') not wrapped in try/catch — SvelteKit redirects throw internally; catching them would swallow the redirect silently"
  - "allowedTools serialized as multiple hidden inputs ({#each allowedTools}) with formData.getAll() — standard multi-value form pattern"
  - "update({ reset: false }) in enhance callback — prevents form clearing on fail() response so user can correct and resubmit"

patterns-established:
  - "All server load functions and actions in protected routes call event.locals.auth() and redirect(303, '/login') if unauthenticated"
  - "Session token extraction always tries HTTPS cookie name first (__Secure- prefix), then HTTP fallback"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 07 Plan 05: New Execution Route Guard Summary

**+page.server.ts auth guard and form action added to /new-execution — session token extracted from httpOnly cookie and forwarded as Bearer token to execution-service; form converted from client-side createExecution() to use:enhance server action**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T08:43:10Z
- **Completed:** 2026-02-19T08:45:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `+page.server.ts` with `load()` auth guard (redirects unauthenticated users to /login) and `actions.default` form handler
- Server action extracts Auth.js session token from httpOnly cookie (dual-lookup for HTTPS/HTTP environments) and forwards as `Authorization: Bearer` header to execution-service
- Converted `+page.svelte` from client-side `createExecution()` / `goto()` pattern to SvelteKit `use:enhance` server action with `method="POST"`
- All form inputs now have `name` attributes; `allowedTools` serialized via `{#each allowedTools}` hidden inputs
- Server error messages (`fail()`) propagate to UI via `ActionData` prop and `$derived(form?.error)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create +page.server.ts with auth guard and form action** - `94538a5` (feat)
2. **Task 2: Update +page.svelte to use server action instead of handleSubmit** - `17f92b8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/ui/src/routes/new-execution/+page.server.ts` - Auth guard in load(), form action in actions.default() with cookie extraction, fetch to EXECUTION_SERVICE_URL, fail()/redirect() responses
- `services/ui/src/routes/new-execution/+page.svelte` - Removed goto/createExecution imports, added enhance/$props()/ActionData, form method="POST" with use:enhance, name attributes on all inputs, hidden inputs for allowedTools, error via $derived(form?.error)

## Decisions Made
- **Server action over client fetch:** The session token lives in an httpOnly cookie. Client-side JavaScript cannot read httpOnly cookies. The server action runs on the server where `event.cookies.get()` is available. This is the only secure way to include the auth token in the request to execution-service.
- **redirect(303) not in try/catch:** SvelteKit's `redirect()` function throws a special `Redirect` instance internally. Wrapping it in a try/catch block would swallow the redirect and the user would not be navigated. The fetch try/catch is scoped specifically to network errors from the execution-service call.
- **update({ reset: false }):** Without `reset: false`, SvelteKit's default `update()` behavior clears the form on fail() responses. Setting `reset: false` preserves the user's input so they can see the error and correct their submission without re-entering all fields.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — `EXECUTION_SERVICE_URL` is already documented in `services/ui/.env.example` from Plan 07-03. The server action will return a 500 with a clear error message if it is not set.

## Next Phase Readiness
- `/new-execution` is fully protected: unauthenticated users get redirected, authenticated users can submit with Bearer token forwarding
- Plan 07-06 (end-to-end auth integration test) can now test the full flow: login -> /new-execution load guard -> form submit -> execution-service auth validation
- No blockers

---
*Phase: 07-google-auth-gate*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: services/ui/src/routes/new-execution/+page.server.ts
- FOUND: services/ui/src/routes/new-execution/+page.svelte
- FOUND: .planning/phases/07-google-auth-gate/07-05-SUMMARY.md
- FOUND: commit 94538a5 (feat(07-05): create +page.server.ts with auth guard and form action)
- FOUND: commit 17f92b8 (feat(07-05): convert +page.svelte form to use:enhance server action)
