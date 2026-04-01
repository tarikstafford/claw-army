---
phase: 23-akasa-ui-rebrand-design-system-rollout
plan: 01
subsystem: ui
tags: [svelte, css-custom-properties, design-system, rebrand, akasa]

# Dependency graph
requires: []
provides:
  - Akasa CSS token system in app.css (28 tokens: --bg, --violet, --amber, --teal, --rose, --error, font vars)
  - Particle canvas nav background with frosted glass on scroll
  - Global font loading (Clash Display, Inter, JetBrains Mono) via layout svelte:head
  - Akasa-branded landing page with aurora blobs, glitch text, scroll-reveal sections
  - Akasa-branded login page with violet accent dark theme
  - Objectives nav link as first item in right nav section
affects:
  - 23-02 (objectives page restyling)
  - 23-03 (run detail page)
  - 23-04 (new-execution wizard)
  - 23-05 (verdicts pages)
  - 23-06 (guide and billing pages)
  - 23-07 (bot detail and report pages)
  - all subsequent pages that import from app.css

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS custom property token system with semantic naming (--bg, --violet, --amber, --teal, --rose, --error)
    - Particle canvas in fixed position via layout module-scope class, z-index 1 behind z-index 2 main
    - Frosted nav with .stuck class toggled on scroll (window.scrollY > 40)
    - Scroll reveal via .r / .r.on IntersectionObserver pattern with .d1-.d5 delay classes
    - Glitch text via ::before/::after with clip-path animation and mix-blend-mode: screen

key-files:
  created: []
  modified:
    - services/ui/src/app.css
    - services/ui/src/routes/+layout.svelte
    - services/ui/src/routes/+page.svelte
    - services/ui/src/routes/login/+page.svelte

key-decisions:
  - "--error/#f87171 and --error-dim tokens added for form validation and API failure states; --rose reserved for retirement/soul language only"
  - "Font link tags placed in layout svelte:head (not per-page) for global availability across all routes"
  - "Objectives nav link placed first in right nav section (before Guide, Verdicts, Billing) per v3.0 nav order"
  - "Particle canvas Particle class defined at module scope to avoid Svelte nested-class performance warning"
  - "improvement/ui landing page font links removed from svelte:head since layout now handles global font loading"

patterns-established:
  - "Token naming: --error for validation failures, --rose for retirement/soul language (distinct semantic purposes)"
  - "Nav frosting: add stuck class on scrollY > 40, remove on scroll back to top"
  - "Particle system: 130 particles, 5 color channels (violet 3 shades, amber, teal), module-scope class definition"

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 23 Plan 01: Akasa Design System Foundation Summary

**Akasa token system (28 CSS vars, --error added) + particle canvas nav + Clash Display fonts globally loaded + full Akasa landing and login pages from improvement/ui branch**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-23T00:06:29Z
- **Completed:** 2026-02-23T00:12:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced entire app.css with Akasa token system — all 28+ CSS custom properties, zero old tokens (--canvas, --signal, --surface-*, --text-primary, etc.) remaining
- Added --error/#f87171 and --error-dim tokens for form validation and API failure states (plan spec)
- Layout now renders Akasa logo with animated diamond SVG, particle canvas background at z-index 1, frosted glass nav on scroll, and global font loading for Clash Display, Inter, JetBrains Mono
- Nav includes Objectives as first link (before Guide, Verdicts, Billing) per v3.0 nav order
- Landing page is the full Akasa hero — aurora blobs, glitch text, scroll-reveal sections (Consent, Problem, How, Soul, Payoff, Humans, Agents, Access, Footer)
- Login page shows Akasa branding with violet accent dark theme — zero "Claw Army" references in all 4 modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace app.css with Akasa token system** - `39f8fc3` (feat)
2. **Task 2: Merge Akasa layout, landing page, and login page from improvement/ui** - `1de30e8` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `services/ui/src/app.css` - Complete Akasa token system replacing old Claw Army tokens
- `services/ui/src/routes/+layout.svelte` - Akasa nav with particle canvas, frosted glass, global fonts, objectives link
- `services/ui/src/routes/+page.svelte` - Full Akasa landing page (hero, aurora blobs, all sections)
- `services/ui/src/routes/login/+page.svelte` - Akasa-branded login with violet dark theme

## Decisions Made
- `--error` (#f87171) and `--error-dim` added to app.css for form validation/API failures; `--rose` reserved for retirement/soul language only — distinct semantic purposes prevent token confusion in subsequent plans
- Font `<link>` tags placed in `+layout.svelte` `<svelte:head>` for global font availability across all routes; removed duplicate font tags from `+page.svelte` `<svelte:head>`
- Objectives nav link placed first in `<ul class="nav-links">` matching v3.0 nav order: Objectives, Guide, Verdicts, Billing
- `Particle` class defined in `<script lang="ts" module>` block to avoid Svelte 5's nested-class performance warning

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The `improvement/ui` branch was available at `remotes/origin/improvement/ui` after fetching. Font link tags in the landing page `<svelte:head>` were removed as instructed since the layout now handles global font loading.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Token system is live and available to all pages via CSS custom property inheritance
- Layout shell renders correctly with particle canvas, frosted nav, and Akasa logo
- Plans 23-02 through 23-07 can now proceed to restyle individual pages using the established token system
- No blockers

## Self-Check: PASSED

- FOUND: services/ui/src/app.css
- FOUND: services/ui/src/routes/+layout.svelte
- FOUND: services/ui/src/routes/+page.svelte
- FOUND: services/ui/src/routes/login/+page.svelte
- FOUND: .planning/phases/23-akasa-ui-rebrand-design-system-rollout/23-01-SUMMARY.md
- COMMIT 39f8fc3: feat(23-01): replace app.css with Akasa token system
- COMMIT 1de30e8: feat(23-01): merge Akasa layout, landing page, and login from improvement/ui

---
*Phase: 23-akasa-ui-rebrand-design-system-rollout*
*Completed: 2026-02-23*
