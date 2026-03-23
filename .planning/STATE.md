---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Paperclip Foundation
status: Phase complete — ready for verification
stopped_at: Completed Phase 03 Plan 02 — 5 Back Office design system components (MechanicCard, Accordion, SlidePanel, Modal, KarmaCallout)
last_updated: "2026-03-23T16:56:15.893Z"
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Phase 03 — design-system-components-and-motion

## Current Position

Phase: 03 (design-system-components-and-motion) — EXECUTING
Plan: 3 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 01-submodule-integration P01 | 2 | 2 tasks | 4 files |
| Phase 01 P02 | 2 | 2 tasks | 7 files |
| Phase 02-design-system-tokens-and-typography P01 | 2 | 2 tasks | 5 files |
| Phase 02-design-system-tokens-and-typography P02 | 2 | 3 tasks | 26 files |
| Phase 03-design-system-components-and-motion P01 | 94s | 2 tasks | 2 files |
| Phase 03-design-system-components-and-motion P03 | 67s | 2 tasks | 2 files |
| Phase 03-design-system-components-and-motion P02 | 10 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

All v1.0–v5.0 architectural decisions archived in PROJECT.md Key Decisions table.

v6.0 key architectural decisions:

- Path C (submodule): claw-paper-clip imported as git submodule, not merged — preserves repo independence
- Paperclip's Express server = primary backend; Akasa mounts evolution routes alongside it
- SvelteKit replaces Paperclip's React UI entirely — one frontend, two-world design system
- Design system: Front Office (`--fo-*`) and Back Office (`--bo-*`) tokens; `body.back-office` class toggle; Front Office is default
- Old token names (`--h-*`, `--d-*`, `--ak-*`) must be removed atomically before new component work begins (Pitfall 3)
- Tool Nexus connectors as Paperclip plugins — OAuth with key versioning mandatory before first credential is persisted (Pitfall 5)
- Phase 2 (DS tokens) before Phase 4 (UI) — zombie token risk if incremental
- [Phase 01-submodule-integration]: strictPeerDependencies: false added to handle cross-repo zod v3/v4 and drizzle-orm version mismatches between Akasa and Paperclip workspaces
- [Phase 01-submodule-integration]: Akasa migration journal renamed to __akasa_migrations — fresh v6.0 database assumed, no row migration from __drizzle_migrations needed
- [Phase 01]: Approach B (replicate startup sequence): akasa-server imports createApp directly rather than calling startServer — preserves Paperclip startServer as unmodified while letting Akasa control the extraApiRouter injection
- [Phase 01]: Port 3100 not 3000: Paperclip default port is 3100 (config.ts), not 3000 as assumed in plan — SvelteKit proxy target corrected accordingly
- [Phase 02]: Clean slate app.css replacement — no backward compat shims for v5 tokens (D-01)
- [Phase 02]: Semantic aliases default to Front Office in :root, overridden to Back Office in body.back-office block (D-02)
- [Phase 02]: localStorage 'akasa-mode' key with blocking inline script in app.html for zero-flash mode persistence (D-03)
- [Phase 02-design-system-tokens-and-typography]: guide/+page.svelte required explicit migration pass — initial grep on 300-line limit missed tokens below line 300
- [Phase 03]: NavBar uses :global(body.back-office) scoped overrides for dual-world styling — avoids Svelte 5 reactivity issues with body class reads
- [Phase 03-design-system-components-and-motion]: ChatBubble sender label uses 5px Press Start 2P per design guide §6.8 — design-guide-prescribed exception to 6-8px rule
- [Phase 03-design-system-components-and-motion]: MetricTile value uses 20px Press Start 2P per §6.9 — only exception to 6-8px label rule for large display numbers
- [Phase 03-design-system-components-and-motion]: MetricTile background literal #fff (not --fo-card) per design guide §6.9 verbatim
- [Phase 03-02]: All 5 Back Office components use --bo-* tokens directly (world-native per D-03), no cross-world color usage
- [Phase 03-02]: Accordion max-height transition (not GPU height) is spec-prescribed exception per DS-11 motion contract
- [Phase 03-02]: Modal uses {#if open} for conditional render; SlidePanel uses translateX — both avoid display:none anti-pattern

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 5]: Paperclip API endpoint paths and auth mechanism unverified against live instance — must inspect `claw-paper-clip/server/` before implementing evolution routes
- [Pre-Phase 1]: pgvector extension must be confirmed on Cloud SQL before running migrations
- [Pre-Phase 1]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`

## Session Continuity

Last session: 2026-03-23T16:56:15.891Z
Stopped at: Completed Phase 03 Plan 02 — 5 Back Office design system components (MechanicCard, Accordion, SlidePanel, Modal, KarmaCallout)
Resume file: None
