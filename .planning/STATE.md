---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Paperclip Foundation
status: Phase complete — ready for verification
stopped_at: Completed 01-submodule-integration 01-02-PLAN.md
last_updated: "2026-03-23T10:30:24.308Z"
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Phase 01 — submodule-integration

## Current Position

Phase: 01 (submodule-integration) — EXECUTING
Plan: 2 of 2

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

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 5]: Paperclip API endpoint paths and auth mechanism unverified against live instance — must inspect `claw-paper-clip/server/` before implementing evolution routes
- [Pre-Phase 1]: pgvector extension must be confirmed on Cloud SQL before running migrations
- [Pre-Phase 1]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`

## Session Continuity

Last session: 2026-03-23T10:30:24.306Z
Stopped at: Completed 01-submodule-integration 01-02-PLAN.md
Resume file: None
