---
phase: 03-design-system-components-and-motion
plan: 03
subsystem: ui
tags: [svelte5, design-system, front-office, animation, components]
dependency_graph:
  requires: [02-design-system-tokens-and-typography]
  provides: [ChatBubble, MetricTile]
  affects: [phase-04-front-office-pages]
tech_stack:
  added: []
  patterns: [svelte5-runes, scoped-css-custom-properties, gpu-composited-animation]
key_files:
  created:
    - services/ui/src/lib/components/ChatBubble.svelte
    - services/ui/src/lib/components/MetricTile.svelte
  modified: []
decisions:
  - ChatBubble sender label uses 5px Press Start 2P per design guide §6.8 verbatim (not the general 6-8px rule)
  - MetricTile value uses 20px Press Start 2P per design guide §6.9 — only exception to the 6-8px label rule
  - MetricTile background is literal #fff not --fo-card (design guide §6.9 prescribes white verbatim)
  - typing-bounce animation uses translateY only (GPU-composited, no layout reflow)
  - Components are world-native Front Office only — no --bo-* tokens used
metrics:
  duration: 67s
  completed_date: 2026-03-23
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements: [DS-08, DS-11, DS-12]
---

# Phase 03 Plan 03: Design System Components and Motion — ChatBubble and MetricTile Summary

**One-liner:** Front Office ChatBubble (user/agent variants with staggered typing animation) and MetricTile (flat-shadow card with 3 Press Start 2P typography exceptions) per design guide §6.8-6.9.

## What Was Built

Two Svelte 5 components implementing the Front Office native display patterns from the Akasa v2 design guide.

### ChatBubble.svelte
- User variant: `--fo-plum` background, white text, right-aligned (`align-self: flex-end`)
- Agent variant: `--fo-bg2` background, `--ink` text, left-aligned (`align-self: flex-start`)
- Typing indicator: 3 bouncing dots using GPU-composited `translateY(-5px)` keyframe animation at 1.1s duration
- Staggered animation delays: 0.18s (dot 2), 0.36s (dot 3) for realistic typing feel
- Sender label: Press Start 2P at 5px with 0.08em letter-spacing (design guide §6.8 exception)
- Accessibility: `aria-label="Agent is typing"` on typing indicator container
- Supports 3 content modes: `text` prop, `typing` indicator, or Svelte 5 `children` snippet

### MetricTile.svelte
- White background (`#fff` literal per spec) with flat offset shadow (`box-shadow: 2px 2px 0 var(--fo-bg3)`)
- Press Start 2P at 20px for metric value display (only exception to 6-8px label rule)
- Press Start 2P at 5px for metric label with 0.10em letter-spacing (§6.9 exception)
- DM Sans at 10px for optional sub text (§6.9 exception)
- Padding: 12px 14px (14px is a design-guide component constant, not a spacing token)
- `--fo-rule` border color

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both components are complete presentational implementations. Consumers in Phase 4 must pass "karma" as the label prop to MetricTile to comply with DS-12 product naming (component is presentational and does not enforce naming).

## Self-Check: PASSED

- `services/ui/src/lib/components/ChatBubble.svelte` — FOUND
- `services/ui/src/lib/components/MetricTile.svelte` — FOUND
- Commit `edd4bda` (ChatBubble) — FOUND
- Commit `c1ee1bd` (MetricTile) — FOUND
