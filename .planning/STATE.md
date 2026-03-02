# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v4.0 The Ring Leader — Phase 25: Orchestrator Demotion and Ring Leader Core

## Current Position

Phase: 25 of 32 (Orchestrator Demotion and Ring Leader Core)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-03-02 — Plan 25-01 complete (task-graph-parser + planner.service update, 2 tasks, tsc clean)

Progress: [█░░░░░░░░░] 11% v4.0

## Performance Metrics

**Velocity:**
- Total plans completed: 53 (v1.0 + v1.1 + v2.0 + v3.0 + v4.0 Phase 24)
- Average duration: 4.7 min
- Total execution time: 247 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01–07 (v1.0 + v1.1) | 25/25 | 147 min | 5.9 min |
| 08–14 (v2.0) | 19/19 | 55 min | 2.9 min |
| 15–23 (v3.0) | 29/29 | 95 min | 3.3 min |

**Recent Trend:**
- v3.0 plans averaged 3.3 min — incremental targeted additions.
- Trend: Stable

*Updated after each plan completion*
| Phase 24-ring-leader-schema-and-shared-types P01 | 2 | 2 tasks | 5 files |
| Phase 24-ring-leader-schema-and-shared-types P02 | 2 | 2 tasks | 4 files |
| Phase 25-orchestrator-demotion-and-ring-leader-core P01 | 3 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

All v1.0–v3.0 architectural decisions archived in PROJECT.md Key Decisions table.

**v4.0 architectural context (pre-planning):**
- Ring Leader subsumes soul-generator.ts Path A (library search) and Path B (archetype generation)
- OpenClaw communication: currently sendTask + event callbacks only — sessions_send/sessions_list need to be built or worked around for real-time coordination
- Existing tables in place: bot_souls, council_verdicts, dna_store, negative_signal_register, decision_traces, agent_classes, category_benchmarks
- Phase 24 must add Ring Leader-specific columns without touching existing evolution tables
- [Phase 24-01]: No circular FK from executions.ring_leader_run_id back to ring_leader_runs; logical reference pattern used instead
- [Phase 24-01]: JSONB used for all Ring Leader domain documents (missionBrief, populationManifest, runState, synthesis, scoring breakdowns) to avoid schema churn as types evolve
- [Phase 24-02]: Used `import type` for UUID/Cents in ring-leader.ts (zero runtime overhead); all numerical constants exported to prevent magic numbers in downstream phases
- [Phase 24-02]: Zod event schemas follow same discriminated union pattern as soul-lifecycle-events.ts for consistency
- [Phase 25]: resolveModel extracted to lib/resolve-model.ts to avoid duplication between planner.service.ts and task-graph-parser.ts
- [Phase 25]: planObjective (flat) kept for backward compat; planObjectiveAsTaskGraph is new structured export; route handler migration deferred to plan 25-03
- [Phase 25]: validateTaskGraphDAG exported standalone from task-graph-parser.ts so plan 25-02 pre-flight can use it without re-importing the parser

### Pending Todos

None.

### Blockers/Concerns

- [Production]: Confirm pgvector extension enabled on Cloud SQL before running migrations 0003–0007.
- [Production]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [Production]: Verify OpenClaw WebSocket run_task schema accepts extra soul fields or requires prompt-prefix injection.
- [Production]: Configure Cloud Scheduler to POST /admin/cleanup/decision-traces for 90-day TTL enforcement.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.
- [v4.0]: OpenClaw sessions_send and sessions_list APIs are unverified — Phase 29 (coordination) may need workarounds if these RPC methods are unavailable.
- [v4.0]: Ring Leader entity is a new conceptual layer — clarify whether it runs as a BullMQ worker, a long-running service process, or an OpenClaw agent before Phase 25 planning.

## Session Continuity

Last session: 2026-03-02
Stopped at: Plan 25-01 complete — task-graph-parser.ts + validateTaskGraphDAG + planObjectiveAsTaskGraph + resolve-model.ts. Ready for plan 25-02 (pre-flight validation).
Resume file: None
