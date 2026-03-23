---
phase: 02-design-system-tokens-and-typography
plan: 01
subsystem: ui
tags: [design-system, css-tokens, typography, fonts, dark-mode]
dependency_graph:
  requires: []
  provides: [DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07]
  affects: [services/ui/src/app.css, services/ui/src/app.html, services/ui/src/routes/+layout.svelte, services/ui/src/lib/mode.ts]
tech_stack:
  added:
    - "@fontsource/cormorant-garamond ^5.2.11"
    - "@fontsource-variable/dm-sans ^5.2.8"
    - "@fontsource/press-start-2p ^5.2.7"
  patterns:
    - "CSS custom properties two-world token system (--fo-*/--bo-*)"
    - "body.back-office class toggle for mode switching"
    - "localStorage blocking script for zero-flash mode persistence"
    - "@fontsource self-hosted fonts imported in root layout"
key_files:
  created:
    - services/ui/src/lib/mode.ts
  modified:
    - services/ui/src/app.css
    - services/ui/src/app.html
    - services/ui/src/routes/+layout.svelte
    - services/ui/package.json
decisions:
  - "Clean slate app.css replacement — no backward compatibility shims for v5 tokens (D-01)"
  - "Semantic aliases (--bg, --card, --text, --border) default to Front Office in :root, overridden in body.back-office (D-02)"
  - "localStorage 'akasa-mode' key with blocking inline script in app.html for zero-flash (D-03)"
  - "Cormorant Garamond weights 300/400/600 + italic via individual weight imports (not /index.css) to avoid loading unused weights"
  - "DM Sans via @fontsource-variable/dm-sans variable font — single file covers full weight axis"
metrics:
  duration: "2 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 01: Design System Tokens and Typography Summary

**One-liner:** Complete v2 CSS token system with Front Office/Back Office two-world tokens, self-hosted Cormorant Garamond/DM Sans/Press Start 2P via @fontsource, blocking localStorage mode script, and setMode()/getMode()/toggleMode() utility.

## What Was Built

### Task 1: Font Packages and app.css Token System

Replaced the v5.0 `app.css` entirely with the v2 token system:

**Front Office raw tokens:** `--fo-bg` (#F5F2EC cream), `--fo-bg2/3`, `--fo-card`, `--fo-border`, `--fo-rule` (rgba), `--ink` (#0E0D0B), `--muted` (#7A766D), plum family (`--fo-plum/plum-m/plum-p`), gold family (`--fo-gold/gold-l/gold-p`)

**Back Office raw tokens:** `--bo-bg` (#06050E), `--bo-card`, `--bo-border/bhi` (rgba violet), full 5-step opacity scale: `--bo-text` (1.0), `--bo-muted` (0.52), `--bo-caption` (0.42), `--bo-faint` (0.24), `--bo-ghost` (0.14), plus `--bo-violet`, `--bo-vb`, `--bo-amber`, `--bo-teal`, `--bo-rose`

**Shared tokens:** Model tier colors (junior/mid/senior), agent identity colors (indra/mira/kael/asha/contr), utility error tokens

**Spacing scale:** `--space-xs` (4px) through `--space-3xl` (60px) — replaces v5's `--s-1` through `--s-12`

**Radius scale:** `--radius-sm/md/lg/xl`

**Font variables:** `--font-display` (Cormorant Garamond), `--font-body` (DM Sans), `--font-label` (Press Start 2P), `--font-mono` (system fallback)

**Semantic aliases:** `--bg/bg2/bg3/card/border/rule/text/text-muted/accent/accent-m/accent-dim/karma` — default to `--fo-*` in `:root`, overridden to `--bo-*` in `body.back-office` block

Installed three @fontsource packages.

### Task 2: Font Imports, Blocking Script, mode.ts

**+layout.svelte:** 7 font CSS imports — Cormorant Garamond weights 300/300i/400/400i/600, DM Sans variable index, Press Start 2P 400; plus app.css import.

**app.html:** Inline blocking `<script>` placed as first child of `<body>`, before `%sveltekit.body%`. Reads `localStorage.getItem('akasa-mode')`, adds `body.back-office` class if value is `'back-office'`. Wrapped in `try/catch` for private browsing.

**mode.ts:** Exports `setMode(mode: AkasaMode)`, `getMode()`, and `toggleMode()`. Uses `'akasa-mode'` localStorage key (matching blocking script). All DOM operations wrapped in `try/catch` for private browsing safety.

## Verification Results

| Check | Result |
|-------|--------|
| `--fo-bg: #F5F2EC` present in app.css | PASS |
| `--bo-bg: #06050E` present in app.css | PASS |
| All 5 Back Office opacity levels defined | PASS |
| Spacing scale xs→3xl defined | PASS |
| Radius scale sm→xl defined | PASS |
| Font vars (display/body/label) present | PASS |
| `body.back-office` override block present | PASS |
| 7 @fontsource imports in +layout.svelte | PASS |
| Blocking script before sveltekit.body | PASS |
| setMode/getMode/toggleMode exported | PASS |
| Vite build passes | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan is infrastructure only (tokens, fonts, mode utility). No UI rendering or data flow.

## Self-Check: PASSED

Files created/modified:
- `services/ui/src/app.css` — FOUND
- `services/ui/src/app.html` — FOUND
- `services/ui/src/routes/+layout.svelte` — FOUND
- `services/ui/src/lib/mode.ts` — FOUND

Commits:
- `b04772f` feat(02-01): install fontsource packages and write complete v2 CSS token system — FOUND
- `a00b60e` feat(02-01): add font imports, blocking mode script, and setMode() utility — FOUND
