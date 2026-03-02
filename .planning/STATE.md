# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v4.0 The Ring Leader — Phase 28: Ring Leader Agent Spawning

## Current Position

Phase: 28 of 32 (Ring Leader Agent Spawning)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-03-02 — Phase 28 Plan 01 complete (session JWT + agent session prompt builder)

Progress: [████░░░░░░] 44% v4.0

## Performance Metrics

**Velocity:**
- Total plans completed: 56 (v1.0 + v1.1 + v2.0 + v3.0 + v4.0 Phases 24-25)
- Average duration: 4.6 min
- Total execution time: 258 min

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
| Phase 25-orchestrator-demotion-and-ring-leader-core P02 | 2 | 1 tasks | 1 files |
| Phase 25-orchestrator-demotion-and-ring-leader-core P03 | 6 | 2 tasks | 2 files |
| Phase 26-soul-library-search-and-population-assembly P01 | 2 | 1 task | 1 file |
| Phase 26-soul-library-search-and-population-assembly P02 | 2 | 1 task | 1 file |
| Phase 26-soul-library-search-and-population-assembly P03 | 3 | 2 tasks | 3 files |
| Phase 27-budget-validation-and-population-sizing P01 | 2 | 2 tasks | 2 files |
| Phase 27-budget-validation-and-population-sizing P02 | 2 | 1 task | 2 files |
| Phase 28-ring-leader-agent-spawning P01 | 2 | 2 tasks | 2 files |

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
- [Phase 25]: All preflight validation checks run and errors accumulate (fail-all not fail-fast) so callers see full constraint picture in one response
- [Phase 25]: budgetCapCents=0 skips budget check to preserve v1.0 no-cap behavior; ESTIMATED_AGENT_COST_CENTS defaults to 50c (placeholder until Phase 27)
- [Phase 25]: Mission brief runId uses DB-generated UUID: insert ring_leader_runs first with empty brief, then update with full brief including runId
- [Phase 25]: POST /executions pre-flight validation runs synchronously before 201 response so failures return 400 with full constraint details without creating any DB rows
- [Phase 26-01]: pgvector <=> cosine distance applied in SQL WHERE clause at threshold 0.78; DB does the heavy lifting before app-layer filters
- [Phase 26-01]: Negative signal exclusion via LEFT JOIN + IS NULL — single SQL pass, no subquery
- [Phase 26-01]: drizzle db.execute<T> requires T extends Record<string, unknown>; raw query result interfaces must extend this constraint
- [Phase 26-01]: Campaign boost uses sibling-count proxy (souls with same parentSoulId) for lineage reuse detection; simpler than counting distinct executionIds
- [Phase 26-02]: Class priority sort uses numeric map (Artisan=0, Understudy=1, Novice=2) stable-sorted with finalRank tiebreaker within tier
- [Phase 26-02]: Pool shortfall (fewer than requiredPopulation selected) returns partial result; caller handles via pioneer path
- [Phase 26-02]: applyPreDeploymentMutation validates operation strictly; throws on non-substitution/amplification (SOUL-05)
- [Phase 26-03]: Pioneer population always 5 souls; archetype-derived when archetypes exist, scratch with 5 behavioral profiles otherwise
- [Phase 26-03]: Pool shortfall after selectFromPool triggers supplemental pioneer generation (not failure) — library path preferred but shortfalls handled gracefully
- [Phase 26-03]: Status assembling->spawning transitions inside assemblePopulation; spawner fires-and-forgets so spawnRingLeader returns immediately
- [Phase 26-03]: Mutation errors in high-complexity path are non-fatal; assembly continues with unmutated soul
- [Phase 27-01]: AGENT_COST_CENTS constants (Artisan=100c, Understudy=50c, Novice=30c) defined in budget-validator.ts (not shared-types) — implementation detail, not domain contract
- [Phase 27-01]: applyTieredReduction exported separately for standalone use; Tier 2 preserves first 3 souls (selection quality ordering already established by population-assembler)
- [Phase 27-01]: BudgetValidationResult.manifests always populated even when funded=false so callers can inspect maximally-reduced state
- [Phase 27]: BudgetShortfallError defined in assemble-population.ts (not budget-validator.ts) — pipeline error, not validation concern
- [Phase 27]: Budget shortfall DB write in assemblePopulation (not spawner) — assemblePopulation has all details at throw site
- [Phase 28]: null populationManifest returns empty manifests array (not 404) so assembling runs are still accessible with current status
- [Phase 28]: ManifestResponseSchema shared between both ring-leader endpoints for consistent response shape
- [Phase 28-01]: Session JWT module independent from orchestrator/jwt.ts — different concern (per-agent grants vs bot identity), separate evolution paths
- [Phase 28-01]: Constitution verification non-fatal: log WARN on missing INVIOLABLE directives, return constitutionVerified=false flag, spawner decides abort vs proceed
- [Phase 28-01]: Empty constitutionDirectives passes verification (pioneer souls may have no constitution yet)
- [Phase 28-01]: JWT subject format session:{soulId}:{taskId} unique and traceable per agent assignment
- [Phase 28-01]: JWT expiry = runtimeLimitSeconds + 300s buffer so JWT stays valid during post-agent cleanup/callbacks

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
Stopped at: Completed 28-01-PLAN.md — session JWT + agent session prompt builder with constitution verification
Resume file: None
