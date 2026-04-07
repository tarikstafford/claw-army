---
phase: 13-agent-intelligence-views
plan: "03"
subsystem: ui
tags: [evolution, org-map, d3-hierarchy, fleet-topology]
dependency_graph:
  requires: ["13-01"]
  provides: ["fleet-org-map-page", "org-tab-nav"]
  affects: ["evolution-layout"]
tech_stack:
  added: []
  patterns: ["d3-hierarchy $derived.by()", "horizontal tree layout", "cubic bezier SVG paths"]
key_files:
  created:
    - services/ui/src/lib/components/evolution/OrgMap.svelte
    - services/ui/src/routes/(app)/evolution/org/+page.svelte
    - services/ui/src/routes/(app)/evolution/org/+page.server.ts
  modified:
    - services/ui/src/routes/(app)/evolution/+layout.svelte
decisions:
  - "Horizontal LTR tree layout (height-first size) for better org chart readability"
  - "Dynamic SVG height computed from leaf count (28px per leaf, min 300)"
  - "Fleet root node rendered as label only (no circle) per spec Pitfall 6"
  - "void goto() prevents unhandled promise linting — async navigation handled properly"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 4
---

# Phase 13 Plan 03: Fleet Org Map Summary

Interactive d3-hierarchy fleet topology page at /evolution/org with category->class->agent tree, class color-coded nodes, and click-to-navigate agent interaction.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ORG tab to evolution layout | 1c907e9 | +layout.svelte |
| 2 | Create OrgMap component, org page, and page loader | 809c619 | OrgMap.svelte, +page.svelte, +page.server.ts |

## What Was Built

**OrgMap.svelte** — d3-hierarchy based fleet topology visualization:
- Horizontal left-to-right tree layout using `tree().size([height, width])` (height-first)
- Dynamic SVG height: `Math.max(300, leaves * 28)` prevents cramping on large fleets
- Layout computed in `$derived.by()` — reactive derived value, not `$effect()`
- Cubic bezier link paths: `M{sy},{sx} C{mid},{sx} {mid},{tx} {ty},{tx}`
- Node type differentiation: fleet (label only), category (filled violet circle), class_tier (stroked circle, class color), agent (stroked circle, clickable)
- CLASS_COLORS matches FleetOverview exactly: Artisan=--bo-amber, Understudy=--bo-vb, Novice=--bo-muted, Retired=--bo-faint
- Agent nodes: `role="button"`, `tabindex="0"`, keyboard handler (Enter/Space), `goto(/evolution/{botId})`
- Empty state: "No agents in fleet" when data has no children

**org/+page.server.ts** — Minimal loader:
- Calls `parent()` for session check
- Fetches `/api/akasa/evolution/org`
- Returns `{ orgData: null }` on failure (graceful degradation)

**+layout.svelte** — Added 4th tab:
- `{ href: '/evolution/org', label: 'ORG' }` added to evolutionTabs
- Existing `isTabActive` startsWith logic handles it correctly

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — OrgMap is wired to real data from `/api/akasa/evolution/org` (built in Plan 01). The page gracefully falls back to empty state if the endpoint returns non-2xx.

## Self-Check: PASSED

- services/ui/src/lib/components/evolution/OrgMap.svelte — FOUND
- services/ui/src/routes/(app)/evolution/org/+page.svelte — FOUND
- services/ui/src/routes/(app)/evolution/org/+page.server.ts — FOUND
- Commit 1c907e9 — FOUND
- Commit 809c619 — FOUND
