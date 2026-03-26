---
phase: 08-evolution-dashboard
plan: 03
subsystem: evolution-dashboard
tags: [frontend, svelte, d3-hierarchy, evolution, components]
dependency_graph:
  requires:
    - 08-01 (evolution dashboard API routes and UI scaffold)
  provides:
    - BotTimeline component (chronological event list with color-coded dots)
    - LineageTree component (d3-hierarchy SVG visualization)
    - ExperimentLedger component (run-by-run table with score delta coloring)
    - BenchmarkCard component (pioneer amber treatment)
    - bot-detail-page-wired
    - benchmarks-page-wired
  affects:
    - services/ui/src/routes/(app)/evolution/[botId]/+page.svelte
    - services/ui/src/routes/(app)/evolution/benchmarks/+page.svelte
tech_stack:
  added: []
  patterns:
    - d3-hierarchy tree layout in $derived.by() (not $effect)
    - flat-chain-to-nested-tree conversion for lineage data
    - inline tooltip via $state selectedNode + positioned div
    - CSS pseudo-element ::before for vertical timeline track
decisions:
  - "d3-hierarchy layout computed in $derived.by() not $effect() — reactive derived value prevents stale layout on prop change"
  - "Flat soul chain converted to nested tree via buildTree() before hierarchy() — API returns root-first flat array, d3 needs nested structure"
  - "Inline tooltip preferred over SlidePanel for lineage node info — read-only soul inspection, no form flows needed"
  - "BenchmarkCard always shows pioneer treatment (3px amber left border) — every benchmark has a pioneer by definition"
  - "border-left shorthand used for pioneer border to override default border-radius on left side"
key_files:
  created:
    - services/ui/src/lib/components/evolution/BotTimeline.svelte
    - services/ui/src/lib/components/evolution/LineageTree.svelte
    - services/ui/src/lib/components/evolution/ExperimentLedger.svelte
    - services/ui/src/lib/components/evolution/BenchmarkCard.svelte
  modified:
    - services/ui/src/routes/(app)/evolution/[botId]/+page.svelte
    - services/ui/src/routes/(app)/evolution/benchmarks/+page.svelte
metrics:
  duration_minutes: 8
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  completed_date: "2026-03-26"
---

# Phase 08 Plan 03: Bot Detail Visualization Components and Benchmarks Page Summary

**One-liner:** Four evolution visualization components (BotTimeline with color-coded track dots, LineageTree with d3-hierarchy SVG and interactive node tooltip, ExperimentLedger table with delta coloring, BenchmarkCard with amber pioneer treatment) wired into bot detail and benchmarks pages.

## What Was Built

### Task 1: BotTimeline, LineageTree, ExperimentLedger components

**BotTimeline.svelte (DASH-02):**
- Renders events as a `<ul>` list with 2px CSS `::before` vertical track line using `--bo-border`
- Each event has an 8px colored dot: `verdict` = `--bo-violet`, `class_transition` = `--bo-amber`, `dna_capture` = `--bo-teal`
- EVENT_COLORS and VERDICT_COLORS const maps for consistent coloring
- Event content shows summary (DM Sans 13px), verdict badge (Press Start 2P 7px) or class transition text or DNA score
- Timestamp in DM Sans 11px `--bo-caption`
- Row hover: `background: rgba(236, 232, 255, 0.04)`, transition 0.15s ease
- Empty state: "No events recorded" heading + "This agent has not completed a council evaluation yet." body

**LineageTree.svelte (DASH-03):**
- Imports `{ hierarchy, tree }` from `d3-hierarchy`
- `buildTree()` converts flat root-first chain to nested structure for d3-hierarchy
- Layout computed in `$derived.by()` — reactive, no `$effect()` needed
- SVG 480×240 with `role="img"` and `aria-label="Soul lineage tree"`
- Links rendered as `<line>` elements with `--bo-border` stroke
- Nodes have `role="button"` and `tabindex="0"` for keyboard navigation
- Archetype nodes: `stroke: var(--bo-amber)` | Pioneer nodes: `stroke: var(--bo-amber)` + `fill: rgba(251, 191, 36, 0.15)`
- Default node: `fill: var(--bo-card)`, `stroke: var(--bo-vb)`, 1.5px
- Hover/focus: stroke changes to `--bo-violet` via CSS
- Inline tooltip with `role="tooltip"` shows label, generation, archetype/pioneer tags
- Section hidden entirely when `nodes.length === 0`

**ExperimentLedger.svelte (DASH-04):**
- `<table>` with `<th scope="col">` headers (7 columns: Run Date, Score, Delta, Verdict, Status, Mutation, Outcome)
- Table header: Press Start 2P 6px, `--bo-faint`, letter-spacing 0.10em
- `formatDelta()` function: positive → `+x.xx` in `--bo-teal`, negative → `x.xx` in `--bo-rose`, null/NaN → `—` in `--bo-faint`
- Verdict tags: Press Start 2P 7px with VERDICT_COLORS map
- Outcome: KEEP = `--bo-teal`, DISCARD = `--bo-rose`, PENDING = `--bo-faint`
- Empty state: "No runs recorded" / "Experiment data will appear after the first execution completes."

### Task 2: BenchmarkCard and page wiring

**BenchmarkCard.svelte (DASH-05, DASH-07):**
- Pioneer treatment: `border-left: 3px solid var(--bo-amber)` on every card (all benchmarks have a pioneer)
- "PIONEER" badge: Press Start 2P 7px, `--bo-amber` text, amber background and border
- "First in {taskCategory} · {formatted date}" caption in DM Sans 11px `--bo-caption`
- Score and confirmed run count in middle row
- Bottom row: `CONFIRMED` tag in Press Start 2P 6px `--bo-teal` if mature, or italic thin-data caption if `thinDataFlag`

**[botId]/+page.svelte:**
- Imports LineageTree, BotTimeline, ExperimentLedger
- Section 1 (Soul Lineage): only rendered when `data.lineage.length > 0`; SVG wrapped in `--bo-card` container
- Section 2 (Evolution Timeline): always rendered with BotTimeline
- Section 3 (Experiment Ledger): always rendered with ExperimentLedger
- Section headings: Cormorant Garamond 18px weight 600

**benchmarks/+page.svelte:**
- Imports BenchmarkCard
- Empty state: "No benchmarks established" / "Run executions to establish pioneer baselines per task category."
- Benchmark list: `gap: var(--space-md)` between BenchmarkCard rows

## Commits

| Hash | Message |
|------|---------|
| c2f8ef5 | feat(08-03): build BotTimeline, LineageTree, and ExperimentLedger components |
| 5f74cb3 | feat(08-03): build BenchmarkCard component and wire bot detail + benchmarks pages |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are fully implemented with real data wiring. The data arrives from Plan 01's API endpoints via `page.server.ts` Promise.allSettled calls, and components render actual data or their documented empty states.

## Self-Check: PASSED

- services/ui/src/lib/components/evolution/BotTimeline.svelte — FOUND
- services/ui/src/lib/components/evolution/LineageTree.svelte — FOUND
- services/ui/src/lib/components/evolution/ExperimentLedger.svelte — FOUND
- services/ui/src/lib/components/evolution/BenchmarkCard.svelte — FOUND
- services/ui/src/routes/(app)/evolution/[botId]/+page.svelte — FOUND (modified)
- services/ui/src/routes/(app)/evolution/benchmarks/+page.svelte — FOUND (modified)
- Commits c2f8ef5 and 5f74cb3 verified in git log
