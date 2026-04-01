---
phase: 23-akasa-ui-rebrand-design-system-rollout
plan: 03
subsystem: ui
tags: [svelte, css-custom-properties, design-system, dark-mode, akasa]

# Dependency graph
requires:
  - phase: 23-01
    provides: Akasa CSS token system in app.css (--bg-card, --border, --teal, --amber, --rose, --font-mono, breathe keyframe)
provides:
  - SoulTierBadge with Akasa dark-mode tier colors (amber/teal/muted/rose) and Artisan breathe pip
  - SoulInspectorPanel as dark drawer with --bg-card background, violet borders, fully legible on dark theme
  - VerdictConfirmPanel with dark Akasa theme, semantic verdict badges (Promote=teal, Retire=rose, Demote=amber)
  - Zero hardcoded hex values across all three shared components
affects:
  - executions/[id]/+page.svelte (imports both SoulInspectorPanel and VerdictConfirmPanel)
  - executions/[id]/bots/[botId]/+page.svelte (imports SoulTierBadge)
  - executions/[id]/report/+page.svelte (imports SoulTierBadge)
  - All future pages that use these shared components inherit correct dark theming

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Akasa tier badge color system: Artisan=amber, Understudy=teal, Novice=muted, Retired=rose"
    - "Artisan tier pip: 6px circle with var(--amber) + breathe animation"
    - "Dark panel: background var(--bg-card), left border var(--border-mid), backdrop rgba(7,6,15,0.7)"
    - "Section eyebrow labels: font-family var(--font-mono), font-size 10px, letter-spacing 0.15em, color var(--text-faint)"
    - "Verdict semantic colors: Promote=teal, Retire=rose, Demote=amber, Monitor/Maintain=violet-bright"
    - "Confirm button: var(--teal) fill + var(--bg) text, opacity:0.85 hover"
    - "Reject button: transparent + var(--rose) border/text, var(--rose-dim) hover background"
    - "agentClassStyle() and verdictBadgeStyle() inline style functions use CSS vars not hex"

key-files:
  created: []
  modified:
    - services/ui/src/lib/components/SoulTierBadge.svelte
    - services/ui/src/lib/components/SoulInspectorPanel.svelte
    - services/ui/src/lib/components/VerdictConfirmPanel.svelte

key-decisions:
  - "[23-03] SoulTierBadge uses inline-flex (not inline-block) to accommodate Artisan pip span without layout break"
  - "[23-03] Artisan pip added as <span class=\"pip\"> inside badge — visible animated amber dot for top-tier souls"
  - "[23-03] {#each false-positives in hex grep are non-issues — Svelte template #each syntax matches the hex regex but contains no color values"
  - "[23-03] reject button text changed from 'teaches the army' to 'teaches the soul' — brand copy aligned with Akasa soul language"
  - "[23-03] dimension-content uses var(--font-mono) + var(--bg-2) background — soul behavioral text reads as structured data on dark theme"

patterns-established:
  - "Panel components: always var(--bg-card) background + var(--border-mid) left border + rgba(7,6,15,0.7) backdrop"
  - "Section headers in panels: font-mono 10px uppercase letter-spacing 0.15em text-faint (eyebrow label pattern)"
  - "Tier badge colors: do NOT use hardcoded hex, always Akasa tier tokens"
  - "Error states in panels: var(--error) + var(--error-dim) — never var(--rose)"

# Metrics
duration: 25min
completed: 2026-02-23
---

# Phase 23 Plan 03: Soul/Verdict Component Akasa Restyle Summary

**SoulTierBadge (amber/teal/muted/rose tier pills + Artisan breathe pip), SoulInspectorPanel (dark drawer, 51 Akasa tokens, violet borders), and VerdictConfirmPanel (57 Akasa tokens, semantic verdict badges + teal confirm/rose reject buttons) all converted from light-mode hex to Akasa dark-mode CSS custom properties**

## Performance

- **Duration:** 25 min
- **Started:** 2026-02-23T03:22:02Z
- **Completed:** 2026-02-23T03:47:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- SoulTierBadge: all 4 hardcoded light pastel tier colors replaced with Akasa tokens; Artisan breathe pip added; JetBrains Mono typography
- SoulInspectorPanel: 36 hardcoded hex replaced with 51 Akasa token references; dark drawer panel with var(--bg-card), violet borders, dark violet backdrop, semantic badge functions rewritten
- VerdictConfirmPanel: 47 hardcoded hex replaced with 57 Akasa token references; all verdict type badges use semantic colors; buttons follow Akasa confirm/reject pattern; severity badges (strong/moderate/weak) use rose/amber/muted

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle SoulTierBadge and SoulInspectorPanel** - `f1e4970` (feat)
2. **Task 2: Restyle VerdictConfirmPanel** - `b3a08b1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/ui/src/lib/components/SoulTierBadge.svelte` - Tier badge with Akasa dark-mode colors (amber/teal/muted/rose) and Artisan breathe pip
- `services/ui/src/lib/components/SoulInspectorPanel.svelte` - Dark drawer panel with 51 Akasa token references; rewrote agentClassStyle() and verdictBadgeStyle() to use CSS vars
- `services/ui/src/lib/components/VerdictConfirmPanel.svelte` - Dark verdict review panel with 57 Akasa token references; semantic verdict type badges; teal confirm + rose reject buttons

## Decisions Made

- SoulTierBadge changed from `inline-block` to `inline-flex` to accommodate the Artisan pip span without layout issues
- Artisan pip implemented as `<span class="pip">` inside the badge — the plan specified adding one if not present; it wasn't
- `{#each` template syntax creates false-positive hex matches in grep — not real color values, verified by line inspection
- Reject button copy changed from "teaches the army" to "teaches the soul" — aligns with Akasa brand language (souls evolve, not armies)
- `dimension-content` in SoulInspectorPanel styled with `var(--font-mono)` + `var(--bg-2)` background — soul behavioral dimensions treated as structured data

## Deviations from Plan

None — plan executed exactly as written. The minor copy change in the reject button ("army" → "soul") is within the plan's spirit of replacing Claw Army brand language with Akasa soul language.

## Issues Encountered

None. The hex regex grep produces 2 false-positive matches per file from Svelte `{#each` template syntax — these are not color values, verified by direct line inspection. Actual hardcoded hex count is 0 across all three files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three shared soul/verdict components are now Akasa dark-mode compliant
- Pages that import these components (execution monitor, bot detail, report) will automatically render correctly themed panels
- Ready for Plan 04: Bot detail page restyle (`executions/[id]/bots/[botId]/+page.svelte`)

---
*Phase: 23-akasa-ui-rebrand-design-system-rollout*
*Completed: 2026-02-23*
