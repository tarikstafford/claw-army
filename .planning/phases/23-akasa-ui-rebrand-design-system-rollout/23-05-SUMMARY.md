---
phase: 23-akasa-ui-rebrand-design-system-rollout
plan: 05
subsystem: ui
tags: [svelte, css-custom-properties, akasa-design-system, dark-mode, rebrand]

# Dependency graph
requires:
  - phase: 23-akasa-ui-rebrand-design-system-rollout plan 01
    provides: Akasa token system in app.css, layout with particle canvas and fonts

provides:
  - Akasa-styled objectives list page (42 CSS tokens, zero hex)
  - Akasa-styled objective detail page (77 CSS tokens, zero hex)
  - Fully migrated verdicts list page (32 CSS tokens, all old tokens removed)
  - Fully migrated verdict detail page (62 CSS tokens, all old tokens removed)

affects:
  - Phase 23 plans 06-07 (remaining pages — guide, admin, billing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Svelte {#each} syntax generates false-positive hex grep matches — verified by line inspection, not a color value"
    - "Status/class/verdict type badges use semantic Akasa tier colors: teal=running/promote/understudy, amber=stopped/demote/artisan, violet-bright=completed, rose=retire/retired, text-muted=queued/novice"
    - "Table headers: bg-3 background, text-faint color, font-mono, uppercase, 10px, 0.15em letter-spacing"
    - "Score/cost columns use font-mono; score values use amber (soul metric)"
    - "Live panel uses teal border (active indicator) + bg-card background; active bots = teal, budget burn = amber"
    - "confirm button uses --violet (primary action); reject button uses amber treatment (soul-mechanic correction, not error)"

key-files:
  created: []
  modified:
    - services/ui/src/routes/objectives/+page.svelte
    - services/ui/src/routes/objectives/[id]/+page.svelte
    - services/ui/src/routes/verdicts/+page.svelte
    - services/ui/src/routes/verdicts/[verdictId]/+page.svelte

key-decisions:
  - "[23-05] Objectives list converted from table to remain as table — original structure preserved, only CSS migrated to Akasa tokens"
  - "[23-05] Score column in objective detail run history table uses var(--amber) — soul metric (composite score) follows amber=soul-language convention"
  - "[23-05] Live panel border: 1px solid var(--teal) not var(--border) — teal border indicates active/live state; matches active-indicator pattern"
  - "[23-05] Verdict confirm button uses var(--violet) not var(--teal) — primary action buttons use violet; teal is reserved for liveness/active states"
  - "[23-05] Reject button uses amber treatment (amber-dim background, amber text) — rejection is a soul-mechanic correction, not an error state; amber is soul-mechanic intervention language"
  - "[23-05] status-completed badge uses violet-bright/violet-dim — completed executions are a positive outcome, maps to violet (signal/action) not teal (live) or amber (soul)"
  - "[23-05] Verdicts list card corners: 14px border-radius — matches Akasa card pattern from design guide exactly"

patterns-established:
  - "Pattern 1: Severity badges follow soul-mechanic semantic: strong=rose (critical soul risk), moderate=amber (soul intervention needed), weak=muted (low priority)"
  - "Pattern 2: Demote verdict type uses amber — soul-mechanic demotion is amber (intervention), not rose (retirement)"
  - "Pattern 3: Monitor/Maintain verdict types use violet-dim — administrative/watchful states use violet treatment"

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 23 Plan 05: Objectives + Verdicts Pages Akasa Restyle Summary

**Objectives list/detail pages fully rebranded from light-mode to Akasa dark theme (42 and 77 CSS tokens); verdicts list/detail pages completed migration with all old tokens replaced (32 and 62 CSS tokens), semantic verdict-type badge colors (Promote=teal, Retire=rose, Demote=amber), and reject button amber treatment**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T03:57:17Z
- **Completed:** 2026-02-23T04:01:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Objectives list page: full Akasa dark-mode restyle from scratch — Clash Display heading, JetBrains Mono table headers/badges/costs, tier-semantic status + class badges, zero hardcoded hex
- Objective detail page: full Akasa restyle — run history table with mono column headers, amber score column (soul metric), teal-border live panel, amber budget burn, per-tier DNA evolution badges
- Verdicts list page: completed migration removing all old tokens (`--text-secondary`, `--text-primary`, `--surface` fallbacks, `--border` fallbacks + all hardcoded hex), semantic verdict type badges (Promote=teal, Retire=rose, Demote=amber, Monitor/Maintain=violet-dim)
- Verdict detail page: removed `--signal` from confirm button, replaced all hardcoded hex (rose severity badges, amber moderate badges, challenge cards, metric items), semantic verdict/severity/status badge colors throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle objectives list and detail pages to Akasa dark theme** - `b9712ca` (feat)
2. **Task 2: Complete verdicts list and detail page migration to Akasa tokens** - `e8c6aff` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `services/ui/src/routes/objectives/+page.svelte` - Full Akasa restyle: 42 var(--) refs, zero hex, "Akasa" title
- `services/ui/src/routes/objectives/[id]/+page.svelte` - Full Akasa restyle: 77 var(--) refs, teal live panel, amber score, zero hex
- `services/ui/src/routes/verdicts/+page.svelte` - Completed migration: 32 var(--) refs, all old tokens removed, semantic badges
- `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` - Completed migration: 62 var(--) refs, --signal removed, semantic severity + verdict type colors

## Decisions Made
- Score column in run history table uses `var(--amber)` — composite score is a soul metric, amber is soul-language
- Live panel border uses `var(--teal)` — teal border signals active/live state (active-indicator pattern)
- Confirm verdict button uses `var(--violet)` — primary action buttons use violet, not teal (teal = liveness)
- Reject verdict button uses amber treatment — rejection is soul-mechanic correction, not an error; amber = intervention
- `status-completed` execution badge uses violet-bright/violet-dim — positive outcome maps to violet (signal)
- Verdicts list card uses 14px border-radius — matches Akasa card pattern from design guide exactly
- Demote verdict badge uses amber, Monitor/Maintain uses violet-dim — follows soul-mechanic semantic taxonomy

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The Svelte `{#each}` template syntax produces false-positive matches in `grep -E '#[0-9a-fA-F]{3,6}'` checks — documented in STATE.md decisions [23-03] and [23-04]. Verified by direct line inspection: all matches were Svelte syntax, not color values. Actual hex count is 0 in all four files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- 5 of 7 Phase 23 plans complete; all primary navigation hub pages are Akasa-themed
- Remaining: guide (plan 06), admin + billing (plan 07)
- Guide page is the heaviest remaining task (1,328 lines, "Claw Army" brand copy throughout)

---
*Phase: 23-akasa-ui-rebrand-design-system-rollout*
*Completed: 2026-02-23*
