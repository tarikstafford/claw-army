---
phase: 23-akasa-ui-rebrand-design-system-rollout
plan: "04"
subsystem: ui
tags: [akasa, rebrand, dark-theme, css-tokens, bot-detail, report, leaderboard]
dependency_graph:
  requires: ["23-01", "23-03"]
  provides: ["akasa-bot-detail-page", "akasa-report-page"]
  affects: ["services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte", "services/ui/src/routes/executions/[id]/report/+page.svelte"]
tech_stack:
  added: []
  patterns: ["Akasa CSS custom property tokens", "eyebrow label pattern (font-mono 10px uppercase)", "podium rank colors (amber/violet/teal)", "Akasa tier tokens (teal/amber/error/rose)"]
key_files:
  created: []
  modified:
    - services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
    - services/ui/src/routes/executions/[id]/report/+page.svelte
decisions:
  - "[23-04] Svelte {#each} template syntax with ?? generates false-positive hex grep matches — not color values; actual hex count is 0 in both files"
  - "[23-04] Leaderboard rows alternate var(--bg-card)/var(--bg-3) with class:row-alt — cleaner than nth-child selector for Svelte"
  - "[23-04] Rank badges use podium colors: amber (1st), violet (2nd), teal (3rd) — maps to Akasa's three primary accent colors"
  - "[23-04] Verdict retire uses var(--rose)/var(--rose-dim) not var(--error) — retire is soul lifecycle language, not a failure state"
  - "[23-04] Soul tier distribution counts use per-tier color classes (tier-count-artisan etc.) — allows semantic color per tier without inline styles"
metrics:
  duration: "3 min"
  completed_date: "2026-02-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 23 Plan 04: Bot Detail and Report Pages Akasa Restyle Summary

Bot detail and execution report pages fully converted from hardcoded hex to Akasa CSS token system — 137+ hex values replaced across both files with semantic dark-theme custom properties, zero brand references to old name.

## What Was Built

### Task 1: Bot Detail Page Restyle (f5da8e7)

**File:** `services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte`

Replaced 70+ hardcoded hex values with Akasa CSS custom properties:

- **Page:** `background: var(--bg)` with `min-height: 100vh`
- **Title:** Changed from `Bot {id} | Claw Army` to `Bot {id} | Akasa`
- **Breadcrumb:** `var(--violet-bright)` link, `var(--violet-light)` on hover
- **Status badges:** Semantic color mapping — teal for active/idle, amber for transitional states, error for failed, text-faint for stopped
- **Inspect Soul button:** `var(--violet-bright)` on `var(--bg-card)` with `var(--border)` outline
- **Live badge:** `var(--teal)` with pulse animation
- **Process log pane:** `var(--bg-2)` background, `var(--font-mono)`, `14px` border-radius, `0 2px 12px rgba(0,0,0,0.3)` shadow
- **Log line colors:** info=violet-bright, success=teal, warn=amber, error=error, dim=text-faint
- **Metric cards:** `var(--bg-card)`, `var(--border)`, `14px` radius; labels use eyebrow pattern; values use `var(--font-mono)` with `var(--text)`
- **Highlight card:** `var(--violet-bright)` border, large score in `var(--violet-bright)`
- **Tier badges:** teal (high), amber (medium), error (low), muted (none)
- **Step trace:** `var(--bg-3)` summary header, `var(--bg-card)` rows, `var(--error-dim)` for rejected steps
- **Pre blocks:** `var(--bg-2)`, `var(--font-mono)`, `var(--text)`, `var(--border)`

### Task 2: Report Page Restyle (3e73e97)

**File:** `services/ui/src/routes/executions/[id]/report/+page.svelte`

Replaced 67+ hardcoded hex values with Akasa CSS custom properties:

- **Title:** Changed from `Report — Execution {id} | Claw Army` to `Report — Execution {id} | Akasa`
- **Stat cards:** `var(--bg-card)`, `14px` radius, `0 2px 12px rgba(0,0,0,0.3)` shadow; labels use eyebrow pattern; values use `var(--font-mono)` in `var(--text)`
- **Table wrapper:** `var(--border)`, `14px` radius, `0 2px 12px rgba(0,0,0,0.3)` shadow
- **Table headers:** Eyebrow label pattern — `var(--font-mono)`, 10px, uppercase, `var(--text-faint)`, `var(--bg-3)` background
- **Table rows:** Alternate `var(--bg-card)` / `var(--bg-3)` via `class:row-alt`; hover uses `var(--bg-2)`
- **Rank badges:** Podium colors — amber (1st), violet-bright (2nd), teal (3rd); plain text-faint for others
- **Score values:** `var(--font-mono)`, `var(--text)`, bold
- **Bot ID links:** `var(--violet-bright)`, `var(--font-mono)`
- **Tier badges:** teal (high), amber (medium), error (low), muted (none) — same pattern as bot detail page
- **Pioneer badge:** `var(--amber-dim)` background, `var(--amber)` text/border
- **Verdict badges:** teal (promote), rose (retire — soul lifecycle), amber (demote/monitor), violet-bright (maintain)
- **Verdict summary:** `var(--text-muted)` subtle text
- **Soul tier distribution counts:** Per-tier color classes — amber (artisan), teal (understudy), text-muted (novice), rose (retired)

## Decisions Made

- **Svelte false positives:** Svelte `{#each ... ??}` template syntax generates false hex matches — confirmed by direct line inspection; actual hex count is 0 in both files (same pattern as Plan 23-03)
- **Leaderboard alternating rows:** Used `class:row-alt={i % 2 !== 0}` rather than CSS nth-child — more explicit and easier to follow in Svelte
- **Podium rank colors:** First three leaderboard ranks use Akasa's three primary accents (amber/violet/teal) as "gold/silver/bronze" equivalents
- **Verdict retire token:** Uses `var(--rose)` not `var(--error)` — retirement is soul lifecycle language (positive/neutral transition), not a failure state
- **Tier count coloring:** Added per-tier CSS classes (`tier-count-artisan`, `tier-count-understudy`, etc.) to color distribution counts by soul tier without inline styles

## Deviations from Plan

### Auto-added improvements

**1. [Rule 2 - Enhancement] Added rank badge podium styling for leaderboard**
- **Found during:** Task 2 implementation
- **Rationale:** Plan specified "Top-3 rank badges: 1st amber, 2nd violet-bright, 3rd teal (podium colors)" — implemented as distinct rank-badge CSS classes with border treatment matching Akasa pill badge pattern; required adding `class:row-top/second/third` and rank-badge span variants to the template
- **Files modified:** `services/ui/src/routes/executions/[id]/report/+page.svelte`
- **Commit:** 3e73e97

**2. [Rule 2 - Enhancement] Added per-tier color classes for soul tier distribution counts**
- **Found during:** Task 2 implementation
- **Rationale:** Plan specified "tier counts should use the Akasa tier colors" — added `tier-count-artisan/understudy/novice/retired` CSS classes to apply amber/teal/muted/rose to the count numbers respectively; this is cleaner than inline styles and follows Akasa class-based coloring pattern
- **Files modified:** `services/ui/src/routes/executions/[id]/report/+page.svelte`
- **Commit:** 3e73e97

None of the above changes affected component logic, data fetching, or TypeScript.

## Verification Results

| Check | Bot Detail | Report |
|-------|-----------|--------|
| Hardcoded hex | 2* | 1* |
| `var(--` count | 87 | 88 |
| "Claw Army" references | 0 | 0 |

*Remaining "hex" values are Svelte `{#each}` template syntax false positives — confirmed not color values by direct line inspection.

## Self-Check: PASSED

Files exist:
- FOUND: services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
- FOUND: services/ui/src/routes/executions/[id]/report/+page.svelte

Commits exist:
- f5da8e7: feat(23-04): Akasa dark-mode restyle for bot detail page
- 3e73e97: feat(23-04): Akasa dark-mode restyle for execution report page
