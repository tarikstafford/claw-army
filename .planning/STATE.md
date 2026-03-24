---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Paperclip Foundation
status: Ready to plan
stopped_at: Completed Phase 04 Plan 04 — SvelteKit frontend core cleanup and human verification
last_updated: "2026-03-24T07:27:14.562Z"
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Phase 04 — sveltekit-frontend-core

## Current Position

Phase: 5
Plan: Not started

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
| Phase 04-sveltekit-frontend-core P01 | 6 | 3 tasks | 12 files |
| Phase 04-sveltekit-frontend-core P03 | 201s | 3 tasks | 6 files |
| Phase 04-sveltekit-frontend-core P02 | 10 | 3 tasks | 19 files |
| Phase 04-sveltekit-frontend-core P04 | 45 | 2 tasks | 29 files |

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
- [Phase 04-sveltekit-frontend-core]: Cookie forwarding replaces Bearer token in API proxy — BetterAuth manages session cookies natively; proxy copies cookie header verbatim to Paperclip Express
- [Phase 04-sveltekit-frontend-core]: hooks.server.ts resolves session via GET PAPERCLIP_URL/api/auth/get-session with cookie forwarding; locals.session is null by default (not auth() function)
- [Phase 04-sveltekit-frontend-core]: INDRA fleet stats use null-safe field mapping with -- fallback per UI-SPEC (show -- not zero when data unavailable)
- [Phase 04-sveltekit-frontend-core]: Chat messages fetched client-side only (not SSR) because thread selection is interactive
- [Phase 04-sveltekit-frontend-core]: Optimistic UI for chat send - replace optimistic message with confirmed on success, restore input on failure
- [Phase 04-sveltekit-frontend-core]: Task 1 files committed by parallel 04-03 agent in 7787ad4 — verified acceptance criteria passed, proceeded to Tasks 2-3
- [Phase 04-sveltekit-frontend-core]: Promise.allSettled for issue+comments parallel fetch — comment failure shows empty list rather than breaking page
- [Phase 04-sveltekit-frontend-core]: Marketing layout BetterAuth migration gap fixed — event.locals.session replaces getServerSession(@auth/sveltekit)
- [Phase 04-sveltekit-frontend-core]: Nav links updated /dashboard→/indra and /login→/auth after v5 route deletion

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 5]: Paperclip API endpoint paths and auth mechanism unverified against live instance — must inspect `claw-paper-clip/server/` before implementing evolution routes
- [Pre-Phase 1]: pgvector extension must be confirmed on Cloud SQL before running migrations
- [Pre-Phase 1]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`

## Session Continuity

Last session: 2026-03-24T07:19:54.304Z
Stopped at: Completed Phase 04 Plan 04 — SvelteKit frontend core cleanup and human verification
Resume file: None
