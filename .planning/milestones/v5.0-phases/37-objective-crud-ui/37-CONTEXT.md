# Phase 37: Objective CRUD UI - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create new objectives, edit existing ones, and archive objectives directly from the UI. Backend CRUD API is fully built (POST, GET, PATCH, DELETE on /objectives). This phase adds only the UI forms and client-side API functions to connect to those endpoints. No schema changes, no backend work.

</domain>

<decisions>
## Implementation Decisions

### Create objective flow
- Dedicated page at `/objectives/new` — consistent with existing `/new-execution` pattern
- Form shows all configurable fields: name, description, max bots, budget cap, runtime limit, allowed tools
- After creation, redirect to the new objective's detail page (`/objectives/:id`)
- Replace the "Deploy new crew" button on `/objectives` list with "New Objective" as primary CTA — deploying a crew happens from the objective detail page

### Edit objective flow
- Edit button on the detail page (`/objectives/:id`) switches the header area into an editable inline form with Save/Cancel buttons
- All fields are always editable — these are defaults for future launches, not execution configs. No locking after runs.
- Explicit save button — user makes changes, clicks Save. Clear commit point. Matches existing form patterns.
- Row actions on the list page too — each row gets a kebab menu (three dots) for quick edit/archive. Detail page also has edit.

### Archive behavior
- Archive only (soft delete) via PATCH isArchived=true — objective hidden from list but retained in DB. Run history preserved.
- Confirmation dialog before archiving: "Archive [objective name]? It will be hidden from your list." with Cancel/Archive buttons.
- Show archived toggle on `/objectives` — filter to reveal archived objectives, visually dimmed, with "Unarchive" action.
- Archive action available on both list (via kebab menu) and detail page.

### Form field defaults
- Default max bots: 5 (matches DB default)
- Budget and runtime pre-filled: $10.00 budget, 60 min runtime — matches /new-execution defaults. User can clear to leave null (no limit).
- Validation errors inline under each field (red text below specific field that failed)
- Tool allowlist uses the same ENABLED badge toggle pattern from /new-execution for consistency

### Claude's Discretion
- Loading states during form submission
- Exact form layout and spacing within the Akasa design system
- Error handling for API failures (toast vs inline)
- Kebab menu component implementation details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/new-execution/+page.svelte`: Form pattern with `enhance`, `$state` runes, LLM_PROVIDERS/CAMPAIGN_TYPES/AVAILABLE_TOOLS constants, tool toggle badges
- `$lib/api.ts`: `apiFetch<T>` helper, existing objective read functions (getObjectives, getObjective, getObjectiveExecutions, getObjectiveStats)
- `$lib/types.ts`: Objective, ObjectiveListItem, ObjectiveRun, ObjectiveStats types already defined
- Objectives list page: Table with status badges, class badges, cost formatting — all reusable patterns
- Objective detail page: Stats grid, section layout, launch button — edit form can integrate inline

### Established Patterns
- SvelteKit `enhance` + server actions for form submission (see /new-execution)
- `$state` runes for reactive form fields
- `$derived` for URL search params
- Akasa dark violet design system: 28 CSS tokens, var(--violet), var(--bg-card), var(--border), etc.
- Status/class badge pattern reused across multiple pages
- Auth: server actions read httpOnly session cookie and forward Bearer token to backend

### Integration Points
- `services/ui/src/lib/api.ts`: Add createObjective, updateObjective, archiveObjective functions
- `services/ui/src/routes/objectives/+page.svelte`: Add "New Objective" CTA, kebab menu per row, archived toggle
- `services/ui/src/routes/objectives/[id]/+page.svelte`: Add edit mode toggle, archive button
- `services/ui/src/routes/objectives/new/+page.svelte`: New route for create form
- Backend endpoints already registered: POST /, PATCH /:id (both require auth via verifyAuthToken)

</code_context>

<specifics>
## Specific Ideas

- Create form should mirror the density and feel of /new-execution — same input styling, same section grouping
- Tool toggle pattern: ENABLED badge on selected tools, consistent with existing execution form
- Kebab menu pattern for row actions (edit, archive) on the objectives table
- Inline edit on detail page should feel like switching to "edit mode" — not a jarring page change

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-objective-crud-ui*
*Context gathered: 2026-03-03*
