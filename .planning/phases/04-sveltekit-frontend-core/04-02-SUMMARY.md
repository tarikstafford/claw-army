---
phase: 04-sveltekit-frontend-core
plan: 02
subsystem: ui
tags: [sveltekit, office, agents, issues, goals, projects, svelte5, ssr]

# Dependency graph
requires:
  - 04-01 (BetterAuth session, companyId in layout, api.ts, proxy)
provides:
  - OFFICE layout with sticky 160px sub-nav (AGENTS/ISSUES/GOALS/PROJECTS)
  - Agent list/detail/create pages at /office/agents/**
  - Issues list/detail with comment posting at /office/issues/**
  - Goals list/detail at /office/goals/**
  - Projects list/detail at /office/projects/**
affects:
  - 04-03 (INDRA/CHAT/SANCTUM pages — same layout pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OFFICE sub-nav layout: sticky 160px sidebar + flex-1 content, active via $page.url.pathname.startsWith"
    - "All data loaded SSR via +page.server.ts load: await parent() for companyId, fetch, error() on non-OK"
    - "Comment posting: SvelteKit form action with enhance() for progressive enhancement"
    - "Promise.allSettled for parallel issue + comments fetch in issue detail load"
    - "Older comments collapsed via Accordion component (>5 threshold)"
    - ":global(body.back-office) overrides in every scoped style block"

key-files:
  created:
    - services/ui/src/routes/(app)/office/+layout.svelte
    - services/ui/src/routes/(app)/office/+page.server.ts
    - services/ui/src/routes/(app)/office/agents/+page.server.ts
    - services/ui/src/routes/(app)/office/agents/+page.svelte
    - services/ui/src/routes/(app)/office/agents/[id]/+page.server.ts
    - services/ui/src/routes/(app)/office/agents/[id]/+page.svelte
    - services/ui/src/routes/(app)/office/agents/new/+page.svelte
    - services/ui/src/routes/(app)/office/issues/+page.server.ts
    - services/ui/src/routes/(app)/office/issues/+page.svelte
    - services/ui/src/routes/(app)/office/issues/[id]/+page.server.ts
    - services/ui/src/routes/(app)/office/issues/[id]/+page.svelte
    - services/ui/src/routes/(app)/office/goals/+page.server.ts
    - services/ui/src/routes/(app)/office/goals/+page.svelte
    - services/ui/src/routes/(app)/office/goals/[id]/+page.server.ts
    - services/ui/src/routes/(app)/office/goals/[id]/+page.svelte
    - services/ui/src/routes/(app)/office/projects/+page.server.ts
    - services/ui/src/routes/(app)/office/projects/+page.svelte
    - services/ui/src/routes/(app)/office/projects/[id]/+page.server.ts
    - services/ui/src/routes/(app)/office/projects/[id]/+page.svelte
  modified: []

key-decisions:
  - "Task 1 files (agents pages + office layout) were already committed by the parallel 04-03 agent in commit 7787ad4 — this plan's agent verified acceptance criteria and proceeded to Tasks 2-3"
  - "Issues table priority column shows — because the Paperclip Issue type has no priority field — acceptable gap, not a stub"
  - "Comment form uses enhance() from $app/forms for progressive enhancement — consistent with plan spec"
  - "Promise.allSettled used for issue+comments parallel fetch — individual comment fetch failure shows empty comments rather than breaking the issue detail"

requirements-completed: [UI-03, UI-04]

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 04 Plan 02: OFFICE Sub-Routes — Agent, Issue, Goal, Project Pages Summary

**OFFICE layout with sticky sub-nav and 10 page files covering agent management, issue tracking with comments, goals, and projects — all SSR via Paperclip API proxy**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-24T07:00:00Z
- **Completed:** 2026-03-24T07:07:50Z
- **Tasks:** 3
- **Files created:** 19

## Accomplishments

- OFFICE layout with sticky 160px sub-nav (AGENTS/ISSUES/GOALS/PROJECTS), active state via `$page.url.pathname.startsWith`, Front/Back Office dual-theme support
- `/office` redirects to `/office/agents` via 303
- Agent list: MechanicCard grid (3 columns, auto-fill), status tags, empty state, "Add agent" CTA
- Agent detail: status dot, tier badge, adapter display, metadata, back navigation
- Agent create: form with name/description/adapter fields, client-side POST to Paperclip API, redirect on success
- Issues list: table layout with status, title, priority, assignee, created columns; sortable; empty state
- Issue detail: body, status badge, metadata, comments (older collapsed via Accordion), comment posting via SvelteKit form action + enhance
- Goals list: card layout with status color-coding, empty state
- Goal detail: title, description, status, metadata
- Projects list: card layout with description and creation date, empty state
- Project detail: title, description, metadata

## Task Commits

1. **Task 1: OFFICE layout + agents pages** — Committed by parallel 04-03 agent in `7787ad4` (verified OK)
2. **Task 2: Issues pages (list + detail with comments)** - `28ba6eb`
3. **Task 3: Goals and projects pages** - `4abf862`

## Files Created

**OFFICE layout:**
- `services/ui/src/routes/(app)/office/+layout.svelte` — sticky sub-nav, 160px, active state
- `services/ui/src/routes/(app)/office/+page.server.ts` — redirect to /office/agents

**Agents:**
- `services/ui/src/routes/(app)/office/agents/+page.server.ts`
- `services/ui/src/routes/(app)/office/agents/+page.svelte` — MechanicCard grid
- `services/ui/src/routes/(app)/office/agents/[id]/+page.server.ts`
- `services/ui/src/routes/(app)/office/agents/[id]/+page.svelte` — detail with badges
- `services/ui/src/routes/(app)/office/agents/new/+page.svelte` — create form

**Issues:**
- `services/ui/src/routes/(app)/office/issues/+page.server.ts`
- `services/ui/src/routes/(app)/office/issues/+page.svelte` — table view
- `services/ui/src/routes/(app)/office/issues/[id]/+page.server.ts` — addComment action
- `services/ui/src/routes/(app)/office/issues/[id]/+page.svelte` — comments + form

**Goals:**
- `services/ui/src/routes/(app)/office/goals/+page.server.ts`
- `services/ui/src/routes/(app)/office/goals/+page.svelte`
- `services/ui/src/routes/(app)/office/goals/[id]/+page.server.ts`
- `services/ui/src/routes/(app)/office/goals/[id]/+page.svelte`

**Projects:**
- `services/ui/src/routes/(app)/office/projects/+page.server.ts`
- `services/ui/src/routes/(app)/office/projects/+page.svelte`
- `services/ui/src/routes/(app)/office/projects/[id]/+page.server.ts`
- `services/ui/src/routes/(app)/office/projects/[id]/+page.svelte`

## Decisions Made

- Task 1 files were already committed by the parallel 04-03 agent — verified all acceptance criteria passed before proceeding to Tasks 2-3
- Issues table priority column shows `—` — Paperclip `Issue` type has no priority field; gap is acceptable, not a data stub
- `Promise.allSettled` used for issue + comments parallel fetch — comment failure shows empty list rather than breaking the page
- Comment form uses `enhance()` from `$app/forms` — progressive enhancement as specified in plan

## Deviations from Plan

### Auto-fixed Issues

None.

### Parallel Agent Overlap

**Task 1 files committed by 04-03 parallel agent:**
- **Found during:** Initial file creation (attempted writes to existing files, git status showed no changes)
- **Issue:** The 04-03 CHAT agent had already created all Task 1 files (OFFICE layout + agents pages) in commit `7787ad4` as preparation work
- **Resolution:** Verified all Task 1 acceptance criteria passed against the committed files; proceeded directly to Tasks 2-3
- **Impact:** None — files meet all acceptance criteria

## Known Stubs

None. All data is loaded server-side via Paperclip API fetch in `+page.server.ts` load functions. Priority field in issues table shows `—` because the API type has no priority property (not a stub — it's a missing feature in the API contract).

## Next Phase Readiness

- OFFICE sub-navigation functional with all 4 sections
- Agent CRUD pattern established for use by future phases
- Comment posting via form action pattern available for reuse
- Goals/projects detail pattern ready for data enrichment in future phases

---
*Phase: 04-sveltekit-frontend-core*
*Completed: 2026-03-24*
