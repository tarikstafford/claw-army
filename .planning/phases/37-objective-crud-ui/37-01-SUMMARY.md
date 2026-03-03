---
phase: 37-objective-crud-ui
plan: 01
subsystem: ui
tags: [sveltekit, forms, server-actions, objectives, api]

# Dependency graph
requires:
  - phase: 35-execution-form-ui
    provides: Form + server action patterns (enhance, session token extraction, fail/redirect)
  - phase: 17-objectives-api
    provides: Objective type, read API functions in api.ts
provides:
  - /objectives/new route with 6-panel create form
  - +page.server.ts server action POSTing to execution service /objectives
  - updateObjective, archiveObjective, unarchiveObjective, createObjective helpers in api.ts
affects: [38-dna-timeline, objectives-detail-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SvelteKit server action with explicit App.Locals type annotation (no $types import)
    - Budget/runtime optional fields: empty string check before conversion, undefined omitted from JSON body
    - ENABLED badge toggle for multi-select tool allowlist (same as new-execution panel 07)

key-files:
  created:
    - services/ui/src/routes/objectives/new/+page.svelte
    - services/ui/src/routes/objectives/new/+page.server.ts
  modified:
    - services/ui/src/lib/api.ts

key-decisions:
  - "server action uses explicit App.Locals type annotation — consistent with pre-flight pattern, avoids SvelteKit type generation dependency"
  - "budget/runtime empty fields omitted from POST body entirely (not sent as 0 or null) — avoids defaulting to zero on backend"
  - "createObjective added to api.ts despite server-side usage — provides client-side API helper if future proxy is added"

patterns-established:
  - "Optional numeric fields: check raw string !== '' before converting to number, send undefined (omit) when blank"

requirements-completed: [OBJ-01]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 37 Plan 01: Create Objective Form Summary

**SvelteKit /objectives/new form with 6 panels (name, description, crew size, budget, runtime, tools), server action POSTing to execution service, and objective mutation helpers in api.ts**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T04:48:33Z
- **Completed:** 2026-03-03T04:50:33Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Added `updateObjective`, `archiveObjective`, `unarchiveObjective`, and `createObjective` to `api.ts` for future use by edit/archive flows
- Created `/objectives/new` Svelte page with 6 styled panels matching Akasa design language
- Created server action that validates name, extracts Auth.js session token from cookies, POSTs to `EXECUTION_SERVICE_URL/objectives`, and redirects to `/objectives/:id` on success
- Budget cap and runtime limit handle empty strings correctly — omitted from request body entirely rather than sent as 0

## Task Commits

1. **Task 1: Add objective mutation functions to api.ts and create the /objectives/new form with server action** - `5e28135` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `services/ui/src/lib/api.ts` - Added updateObjective, archiveObjective, unarchiveObjective, createObjective (Phase 37 mutations block)
- `services/ui/src/routes/objectives/new/+page.svelte` - 6-panel create form with enhance, tool allowlist toggles, error handling
- `services/ui/src/routes/objectives/new/+page.server.ts` - Server action: auth check, form parsing, session token extraction, fetch POST, redirect 303

## Decisions Made
- Server action uses explicit `App.Locals` type annotation (no `$types` import) — consistent with pre-flight pattern established in Phase 36-02
- Budget/runtime optional fields: raw string checked for empty before conversion, undefined omitted from JSON body — avoids sending 0 to backend
- `createObjective` added to api.ts as a client-side export for completeness, even though the actual creation goes through the server action (useful if an API proxy is added later)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/objectives/new` form complete and functional — ready for Phase 37 Plan 02 (edit/archive flows on objective detail page)
- `updateObjective`, `archiveObjective`, `unarchiveObjective` helpers in api.ts ready for use by server actions in Plan 02

---
*Phase: 37-objective-crud-ui*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: services/ui/src/routes/objectives/new/+page.svelte
- FOUND: services/ui/src/routes/objectives/new/+page.server.ts
- FOUND: services/ui/src/lib/api.ts (modified)
- FOUND: commit 5e28135
