---
phase: 37-objective-crud-ui
plan: "02"
subsystem: ui
tags: [svelte, sveltekit, objectives, crud, inline-edit, archive, kebab-menu]

# Dependency graph
requires:
  - phase: 37-01
    provides: Create objective form at /objectives/new and api.ts mutation helpers
  - phase: 37-objective-crud-ui
    provides: Backend PATCH /objectives/:id with TypeBox schema and isArchived field
provides:
  - Inline edit mode on /objectives/[id] detail page via SvelteKit named actions
  - Archive/unarchive with confirmation dialog on detail page
  - Archive/unarchive from list page kebab menu without navigation
  - Backend GET /objectives now accepts ?archived=true query param
  - "Show archived" toggle on list page revealing dimmed archived objectives
  - New Objective CTA on list page (replaces "Deploy new crew")
affects: [38-dna-timeline, 39-soul-visibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SvelteKit named actions (?/update, ?/archive, ?/unarchive) used for all mutations
    - enhance() callback pattern — intercepts result to update local state, avoids page reload
    - Cross-route form action POST (list page POSTs to detail page's server action using browser cookie passthrough)
    - Lazy fetch for archived objectives — only loads on first toggle, then cached in component state

key-files:
  created:
    - services/ui/src/routes/objectives/[id]/+page.server.ts
  modified:
    - services/ui/src/routes/objectives/[id]/+page.svelte
    - services/ui/src/routes/objectives/+page.svelte
    - services/ui/src/lib/api.ts
    - services/execution-service/src/routes/objectives.ts

key-decisions:
  - "Cross-route action POST: list page POSTs to /objectives/:id?/archive using browser's session cookie — no separate list-page server.ts needed"
  - "Unarchive from list page calls fetch directly with FormData rather than SvelteKit enhance() — simpler and avoids needing a form element per archived row"
  - "Edit from kebab menu links to detail page (not deep-link into edit mode) — detail page must load data before entering edit mode"
  - "Lazy load archived objectives on first Show Archived toggle — avoids extra network request on initial list page load"

patterns-established:
  - "Named action CRUD pattern: page.server.ts with update/archive/unarchive actions, each extracting session cookie and calling EXECUTION_SERVICE_URL"
  - "Inline edit pattern: editMode boolean state variable, enterEditMode() copies current values to edit state, enhance() callback updates local data without navigation"
  - "Kebab menu pattern: openMenuId tracks which row has the open menu, $effect closes on outside click"
  - "Archive dialog pattern: showArchiveDialog / archivingObjectiveId + archivingObjectiveName state, form with POST action inside dialog"

requirements-completed: [OBJ-02, OBJ-03]

# Metrics
duration: ~45min (across two sessions with checkpoint)
completed: 2026-03-03
---

# Phase 37 Plan 02: Objective CRUD UI Summary

**Inline edit mode and archive/unarchive for objectives — detail page server actions with enhance() pattern, kebab row menu on list page, and backend archived filter query param**

## Performance

- **Duration:** ~45 min (split across two sessions with user verification checkpoint)
- **Started:** 2026-03-03T04:30:00Z (estimated)
- **Completed:** 2026-03-03T05:20:19Z
- **Tasks:** 3 (2 auto, 1 checkpoint:human-verify — approved)
- **Files modified:** 5

## Accomplishments

- Created `+page.server.ts` for the objective detail route with three named SvelteKit actions: `update`, `archive`, `unarchive` — each extracting the session cookie and calling the execution service PATCH endpoint
- Added inline edit mode to the detail page with `editMode` boolean state, `enterEditMode()` copying current values, and `enhance()` callback that updates local data in place without navigation
- Added archive confirmation dialog on both detail page and list page, with cross-route form action POST pattern (list page POSTs to detail page's actions using browser session cookie)
- Enhanced objectives list with kebab menu per row (View/Edit/Archive), "Show archived" toggle that lazy-loads archived objectives, and changed primary CTA to "New Objective"
- Extended backend `GET /objectives` to accept `?archived=true` query param for filtering archived vs active objectives

## Task Commits

Each task was committed atomically:

1. **Task 1: Add detail page server actions and inline edit mode with archive** - `4bc3fa2` (feat)
2. **Task 2: Enhance objectives list with kebab menu, archived toggle, and New Objective CTA** - `cda7564` (feat)
3. **Task 3: Verify complete Objective CRUD UI** - checkpoint:human-verify, user approved (no commit — verification only)

## Files Created/Modified

- `services/ui/src/routes/objectives/[id]/+page.server.ts` - Server actions: update (PATCH fields), archive (isArchived: true), unarchive (isArchived: false) — all require auth via session cookie
- `services/ui/src/routes/objectives/[id]/+page.svelte` - Added editMode state, enterEditMode(), enhance() update handler, archive dialog with confirmation, Edit/Archive buttons in header
- `services/ui/src/routes/objectives/+page.svelte` - Added kebab menu per row, archive confirmation dialog, "Show archived" toggle, lazy-loaded archived objectives section, Unarchive buttons, changed CTA to "New Objective"
- `services/ui/src/lib/api.ts` - Added `getArchivedObjectives()` function calling `GET /objectives?archived=true`
- `services/execution-service/src/routes/objectives.ts` - Added `?archived=true` querystring param support to GET / handler using conditional WHERE clause

## Decisions Made

- **Cross-route form action POST:** List page POSTs to `/objectives/:id?/archive` using browser's session cookie passthrough — avoids creating a separate +page.server.ts for the list page. SvelteKit allows this pattern and the session cookie is sent automatically.
- **Edit from kebab links to detail page, not deep-link into edit mode:** Detail page must load data first before entering edit mode; deep-linking would require URL state management adding complexity.
- **Lazy-load archived objectives:** Only fetches archived data when user first toggles "Show archived" — results cached in component state. Avoids extra network request on initial list page load.
- **Unarchive from list uses fetch with FormData directly:** Simpler than wrapping each archived row in a form element with enhance(); skips the need for a submit button per row.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all components followed established patterns from Phase 36-02 (pre-flight manifest UI) and Phase 37-01 (create objective form). The cross-route action POST pattern was explicitly called out in the plan as the preferred approach.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete Objective CRUD UI is functional: create (/objectives/new), read (detail page), update (inline edit), archive/unarchive (both list and detail pages)
- Phase 38 (DNA Timeline) can now be built as an enhancement to the objective detail page — the page is functional and the layout is established
- Phase 39 (Soul Visibility) has no dependencies on this plan but benefits from the objective detail page being complete

---
*Phase: 37-objective-crud-ui*
*Completed: 2026-03-03*
