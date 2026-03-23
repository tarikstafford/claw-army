---
phase: 03-design-system-components-and-motion
plan: 01
subsystem: ui
tags: [navbar, navigation, layout, design-system, mode-toggle]
dependency_graph:
  requires: [Phase 02 design tokens (--fo-*, --bo-* vars in app.css), mode.ts toggleMode API]
  provides: [NavBar.svelte component, refactored (app)/+layout.svelte]
  affects: [all authenticated app routes via (app) layout]
tech_stack:
  added: []
  patterns: [Svelte 5 runes $props/$state/$effect, :global(body.back-office) dual-world CSS overrides, fixed top nav replacing sidebar]
key_files:
  created:
    - services/ui/src/lib/components/NavBar.svelte
  modified:
    - services/ui/src/routes/(app)/+layout.svelte
decisions:
  - NavBar uses :global(body.back-office) scoped overrides for dual-world styling — avoids Svelte 5 reactivity issues with body class reads
  - Lifecycle toasts repositioned from top: 20px to top: 56px (NavBar 44px + 12px gap) to prevent overlap
  - onMount removed from layout — lifecycle SSE connect already uses $effect with browser guard
metrics:
  duration: 94s
  completed: "2026-03-23"
  tasks: 2
  files: 2
---

# Phase 03 Plan 01: NavBar Component and Layout Refactor Summary

NavBar component with gem-spin animation, 4 product-named tabs (INDRA/OFFICE/CHAT/SANCTUM), and FRONT OFFICE / BACK OFFICE mode toggle replaces v5 sidebar; (app) layout refactored to use top nav with correct 44px padding-top offset.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create NavBar.svelte component | 875cde0 | services/ui/src/lib/components/NavBar.svelte |
| 2 | Refactor (app) layout — replace sidebar with NavBar | 2b5a85f | services/ui/src/routes/(app)/+layout.svelte |

## Verification Results

1. `gem-spin` count in NavBar.svelte: 2 (keyframe def + animation ref) — PASS
2. `SANCTUM` count in NavBar.svelte: 1 — PASS
3. `sidebar` count in layout: 0 — PASS
4. `NavBar` count in layout: 2 (import + usage) — PASS
5. `padding-top: 44px` count in layout: 1 — PASS
6. svelte-check: 0 errors — PASS

## Success Criteria Met

- NavBar.svelte exists with full dual-world styling, 4 tabs, mode toggle, gem-spin logo animation
- (app)/+layout.svelte uses NavBar, sidebar fully removed, CDN fonts removed, content offset corrected
- Product naming applied: SANCTUM tab, FRONT OFFICE / BACK OFFICE toggle labels (DS-12)
- Tier colour tokens (--tier-junior, --tier-mid, --tier-senior) exist in app.css from Phase 2 (DS-09 satisfied)
- Agent identity tokens (--agent-indra, --agent-contr) exist in app.css from Phase 2 (DS-10 satisfied)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — NavBar routes (/indra, /office, /chat, /sanctum) are placeholder routes intentionally deferred to Phase 4 per D-02 and UI-SPEC. The NavBar renders correctly; route destinations are wired in Phase 4.

## Self-Check: PASSED

- NavBar.svelte exists: FOUND
- (app)/+layout.svelte modified: FOUND
- Task 1 commit 875cde0: FOUND
- Task 2 commit 2b5a85f: FOUND
