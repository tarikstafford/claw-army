---
phase: 03-design-system-components-and-motion
plan: 02
subsystem: ui
tags: [svelte, svelte5, css-custom-properties, design-system, back-office, animation]

# Dependency graph
requires:
  - phase: 03-design-system-components-and-motion
    provides: Back Office CSS tokens (--bo-*, --radius-*, --font-*) defined in app.css

provides:
  - MechanicCard component with hover lift (translateY -2px) and expandable CTA
  - Accordion component with max-height 0.3s ease transition and color-coded variant support
  - KarmaCallout component with amber diamond prefix and rgba background
  - SlidePanel component with cubic-bezier(0.16, 1, 0.3, 1) slide-in from right
  - Modal component with backdrop-filter blur overlay and click-to-dismiss

affects:
  - phases using Back Office UI components (Phase 4+, Phase 8+)
  - Evolution Dashboard
  - Soul Inspector, Verdict Confirm, Council panels

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Props-first Svelte 5 API ($props() destructuring with explicit type annotation)
    - Snippet children pattern for body content injection ({@render children()})
    - CSS custom property inheritance via inline style binding (--acc-color: {color})
    - max-height 0/600px transition for accordion expand (spec-approved non-GPU exception)
    - transform-based show/hide for SlidePanel (translateX GPU composited)
    - {#if open} for Modal conditional render (no display:none)

key-files:
  created:
    - services/ui/src/lib/components/MechanicCard.svelte
    - services/ui/src/lib/components/Accordion.svelte
    - services/ui/src/lib/components/KarmaCallout.svelte
    - services/ui/src/lib/components/SlidePanel.svelte
    - services/ui/src/lib/components/Modal.svelte
  modified: []

key-decisions:
  - "All 5 components use --bo-* tokens directly (world-native) per D-03 — no cross-world color usage"
  - "Accordion body uses max-height transition not height (spec-prescribed exception per DS-11)"
  - "Modal uses {#if open} for conditional render, SlidePanel uses translateX — different contexts require different show/hide patterns"
  - "KarmaCallout diamond symbol hardcoded in component template (&#9670;) — not passed via prop"
  - "SlidePanel and Modal share identical close button spec (26x26px circle, same colors, hover: --bo-violet)"

patterns-established:
  - "Back Office component pattern: props-first API, --bo-* tokens only, scoped <style> block"
  - "Snippet injection: children: Snippet prop with {@render children()} in body"
  - "Dynamic color token: CSS custom property set inline via style='--acc-color: {color}'"
  - "Overlay components close on background click with stopPropagation on content box"

requirements-completed: [DS-08, DS-11]

# Metrics
duration: 10min
completed: 2026-03-23
---

# Phase 03 Plan 02: Design System Components and Motion Summary

**5 Back Office-native Svelte 5 components with GPU-composited motion: MechanicCard hover lift, Accordion max-height transition, SlidePanel cubic-bezier slide-in, Modal backdrop-blur overlay, KarmaCallout amber diamond**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-23T16:45:00Z
- **Completed:** 2026-03-23T16:55:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- MechanicCard with `translateY(-2px)` hover lift, Press Start 2P 5px CTA (design guide exception), `padding: 18px 20px` component constant
- Accordion with `max-height 0.3s ease` expand transition, `--acc-color` CSS custom property for dynamic color binding, `rotate(180deg)` arrow
- KarmaCallout with `--bo-amber` text and diamond prefix (`&#9670;`), `rgba(251, 191, 36, 0.10)` background
- SlidePanel with `transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)` from right, positioned `top: 44px` below NavBar, `z-index: 200`
- Modal with `backdrop-filter: blur(8px)`, `z-index: 9000`, overlay click-to-dismiss with `stopPropagation` on box, `role="dialog"` + `aria-modal`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MechanicCard, Accordion, and KarmaCallout components** - `d46750c` (feat)
2. **Task 2: Create SlidePanel and Modal components** - `80f0276` (feat)

## Files Created/Modified

- `services/ui/src/lib/components/MechanicCard.svelte` - Expandable Back Office card with hover lift, Press Start 2P tag/CTA, Cormorant Garamond title
- `services/ui/src/lib/components/Accordion.svelte` - Collapsible section with color-coded border/label, max-height transition, Snippet body
- `services/ui/src/lib/components/KarmaCallout.svelte` - Amber diamond-prefixed callout block, inline-flex layout
- `services/ui/src/lib/components/SlidePanel.svelte` - Fixed right slide-in panel, 380px width, cubic-bezier transition, Snippet body
- `services/ui/src/lib/components/Modal.svelte` - Full-screen blur overlay modal, 560px box, stopPropagation close, Snippet body

## Decisions Made

- All components use `--bo-*` CSS tokens exclusively (world-native per D-03) — no hardcoded hex except fixed design-guide-prescribed literals (`#080714` panel bg, `#0D0C1E` modal bg)
- Accordion uses `max-height` transition (not GPU `height`) — spec-prescribed exception per DS-11 motion contract
- SlidePanel uses `translateX` (GPU composited) vs Modal using `{#if open}` (no transition needed on mount) — correct patterns per design guide §11 anti-patterns
- `--acc-color` CSS custom property set via inline style binding allows Accordion color to propagate through scoped CSS without `:global()` leakage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 Back Office components available for use in Phase 4+ feature pages
- Components import via `$lib/components/[Name].svelte`
- Each component self-contained with scoped CSS — no global stylesheet additions required
- No `display: none` anti-pattern used in any component

---
*Phase: 03-design-system-components-and-motion*
*Completed: 2026-03-23*
