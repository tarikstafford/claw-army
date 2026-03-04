---
phase: 42-landing-portal-separation
plan: 01
subsystem: ui

tags: [sveltekit, route-groups, svelte5, layouts, navigation, sse]

# Dependency graph
requires:
  - phase: 40-landing-page-and-platform-polish
    provides: Landing page and portal UI that was refactored into route groups

provides:
  - SvelteKit route group separation — (marketing) for public pages, (app) for authenticated portal
  - ParticleCanvas reusable component extracted from root layout
  - Minimal marketing nav (logo + Login/Signup only) at / and /login
  - Full portal nav (all 7 management links + Deploy crew + SSE toasts) for all /app/* routes
  - Session load scoped to (app) group only — no auth check on landing page

affects:
  - Future marketing pages should be placed under (marketing)/ route group
  - Future portal pages should be placed under (app)/ route group
  - Any new layouts inheriting from root should be aware of bare-shell root layout

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SvelteKit route groups ((marketing)/ and (app)/) for layout isolation
    - Reusable self-contained animation component (ParticleCanvas.svelte)
    - Group-scoped CSS imports — each group layout imports app.css independently
    - Session load scoped to portal group via (app)/+layout.server.ts

key-files:
  created:
    - services/ui/src/lib/components/ParticleCanvas.svelte
    - services/ui/src/routes/(marketing)/+layout.svelte
    - services/ui/src/routes/(marketing)/+page.svelte
    - services/ui/src/routes/(marketing)/+page.server.ts
    - services/ui/src/routes/(marketing)/login/+page.svelte
    - services/ui/src/routes/(app)/+layout.svelte
    - services/ui/src/routes/(app)/+layout.server.ts
  modified:
    - services/ui/src/routes/+layout.svelte

key-decisions:
  - "Route groups (marketing)/ and (app)/ used for layout isolation — SvelteKit route groups do not affect URL structure, preserving all existing URLs"
  - "Root +layout.svelte stripped to bare shell (renders children only, no CSS import) — each group layout imports app.css independently to avoid double-loading"
  - "ParticleCanvas extracted as self-contained component with no props — encapsulates canvas element, particle logic, animation loop, and scoped styles"
  - "Session load moved from root layout.server.ts to (app)/+layout.server.ts — landing page gets no auth check overhead"
  - "SSE lifecycle toasts remain exclusive to (app)/+layout.svelte — marketing visitors never see portal notifications"

patterns-established:
  - "Route group isolation: Each SvelteKit route group has its own layout with its own CSS import, nav, and data loading"
  - "Self-contained animation components: ParticleCanvas owns its canvas element + all particle logic, requires no props"

requirements-completed:
  - PORTAL-01

# Metrics
duration: 45min
completed: 2026-03-04
---

# Phase 42 Plan 01: Landing/Portal Separation Summary

**SvelteKit route groups split public landing (/ and /login) from authenticated portal (/objectives etc.) — marketing nav shows logo+Login/Signup only, portal nav shows full 7-link management bar with SSE toasts, particle canvas renders on both**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-04T00:00:00Z
- **Completed:** 2026-03-04T00:45:00Z
- **Tasks:** 3 (including 1 human-verify checkpoint)
- **Files modified:** 8

## Accomplishments

- Extracted `ParticleCanvas.svelte` as a reusable, fully self-contained component from the monolithic root layout
- Created `(marketing)/` route group with minimal nav (logo + Login + Sign up) for landing and login pages
- Created `(app)/` route group with full portal nav (7 management links + Deploy crew + Platform live pill + SSE lifecycle toasts) for all authenticated pages
- Stripped root `+layout.svelte` to a bare 3-line shell — no nav, no CSS, no SSE; everything lives in group layouts
- Scoped session auth load to `(app)/+layout.server.ts` — public landing page no longer triggers unnecessary session check
- Human verification confirmed visual separation: minimal nav on landing, full nav on portal, particles on both

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract ParticleCanvas component and restructure routes into groups** - `1cfb15b` (feat)
2. **Task 2: Create group-specific layouts and strip root layout** - `86a26bf` (feat)
3. **Task 3: Verify visual separation between landing and portal** - checkpoint:human-verify (approved — no code commit)

## Files Created/Modified

- `services/ui/src/lib/components/ParticleCanvas.svelte` - Reusable particle canvas animation; self-contained with class Particle, animation loop, and scoped canvas styles
- `services/ui/src/routes/(marketing)/+layout.svelte` - Minimal marketing layout: ParticleCanvas + logo + Login/Signup nav only; no portal links, no SSE
- `services/ui/src/routes/(marketing)/+page.svelte` - Landing page (moved from root)
- `services/ui/src/routes/(marketing)/+page.server.ts` - Landing page server load (moved from root)
- `services/ui/src/routes/(marketing)/login/+page.svelte` - Login page (moved from root login/ dir)
- `services/ui/src/routes/(app)/+layout.svelte` - Full portal layout: ParticleCanvas + 7-link management nav + Deploy crew + SSE lifecycle toast system
- `services/ui/src/routes/(app)/+layout.server.ts` - Session load for portal routes only (moved from root)
- `services/ui/src/routes/+layout.svelte` - Stripped to bare shell (3 lines: script props + render children)

## Decisions Made

- Route groups `(marketing)/` and `(app)/` used for layout isolation — SvelteKit route groups do not affect URL structure, so all existing URLs remain unchanged
- Root `+layout.svelte` stripped to bare shell with no CSS import — each group layout imports `../../app.css` independently to avoid double-loading
- `ParticleCanvas` extracted as a self-contained component with no props — it owns its canvas element, particle logic, animation loop, and scoped `:global(canvas#particles)` styles
- Session load moved from root `+layout.server.ts` to `(app)/+layout.server.ts` — landing page has no auth overhead
- SSE lifecycle toasts remain exclusive to `(app)/+layout.svelte` — marketing visitors never see portal notifications

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route group separation complete and human-verified
- Any future marketing pages (e.g., pricing, about) should be added under `(marketing)/` to inherit the minimal nav
- Any future portal pages should be added under `(app)/` to inherit the full nav + SSE toasts
- No blockers for subsequent phases

---
*Phase: 42-landing-portal-separation*
*Completed: 2026-03-04*
