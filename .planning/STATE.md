---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Paperclip Foundation
status: roadmap_complete
stopped_at: null
last_updated: "2026-03-23T00:00:00.000Z"
last_activity: 2026-03-23 — Roadmap created, 8 phases, 46/46 requirements mapped
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v6.0 Paperclip Foundation — Phase 1: Submodule Integration

## Current Position

Phase: 1 of 8 (Submodule Integration)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-23 — Roadmap defined, 8 phases covering 46 requirements

Progress: [░░░░░░░░░░] 0%

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

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 5]: Paperclip API endpoint paths and auth mechanism unverified against live instance — must inspect `claw-paper-clip/server/` before implementing evolution routes
- [Pre-Phase 1]: pgvector extension must be confirmed on Cloud SQL before running migrations
- [Pre-Phase 1]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`

## Session Continuity

Last session: 2026-03-23
Stopped at: Roadmap created — ready to plan Phase 1
Resume file: None
