# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v4.0 The Ring Leader — ALL PHASES COMPLETE

## Current Position

Phase: 32 of 32 (Dashboard and Reporting) — COMPLETE
Plan: 4/4 complete
Status: Phase 32 verified and complete — all 9/9 must-haves passed
Last activity: 2026-03-02 — Phase 32 execution complete (4/4 plans, 9 commits)

Progress: [██████████] 100% v4.0

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
| Phase 28-ring-leader-agent-spawning P02 | 2 | 2 tasks | 2 files |
| Phase 28-ring-leader-agent-spawning P04 | 2 | 2 tasks | 4 files |
| Phase 29-real-time-execution-coordination P01 | 2 | 2 tasks | 3 files |
| Phase 29-real-time-execution-coordination P02 | 1 | 1 task | 1 file |
| Phase 29-real-time-execution-coordination P04 | 2 | 1 task | 1 file |
| Phase 29-real-time-execution-coordination P03 | 1 | 1 task | 1 file |
| Phase 29-real-time-execution-coordination P05 | 6 | 2 tasks | 2 files |
| Phase 30-run-synthesis P01 | 2 | 1 tasks | 1 files |
| Phase 30-run-synthesis P02 | 3 | 2 tasks | 5 files |
| Phase 30-run-synthesis P03 | 1 | 1 tasks | 1 files |
| Phase 31-ring-leader-fitness-scoring P01 | 1 | 1 tasks | 1 files |
| Phase 31-ring-leader-fitness-scoring P02 | 2 | 1 tasks | 1 files |
| Phase 31-ring-leader-fitness-scoring P03 | 2 | 2 tasks | 2 files |
| Phase 31-ring-leader-fitness-scoring P04 | 2 | 2 tasks | 2 files |
| Phase 32-dashboard-and-reporting P01 | 3 | 2 tasks | 5 files |
| Phase 32-dashboard-and-reporting P02 | 2 | 1 tasks | 1 files |
| Phase 32-dashboard-and-reporting P03 | 2 | 1 tasks | 1 files |
| Phase 32-dashboard-and-reporting P04 | 3 | 1 tasks | 1 files |

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
- [Phase 28-02]: sessionId in ActiveSession uses botId from spawnBot — OpenClaw sessions protocol unverified, botId is reliable identifier until sessions_list confirmed
- [Phase 28-02]: Upstream output injection originally returned empty array — resolved in 28-04 with ring_leader_task_id column and real collectUpstreamOutputs implementation
- [Phase 28-02]: executionId sourced from ring_leader_runs DB row (Option A) — preserves 2-arg assemblePopulation public interface unchanged
- [Phase 28-02]: Cycle detection in computeSpawnWaves dumps remaining tasks to single wave with WARN on malformed DAGs
- [Phase 28-04]: ringLeaderTaskId is varchar(255) nullable with no FK — mission brief taskIds are opaque strings not UUIDs referencing another table
- [Phase 28-04]: collectUpstreamOutputs is non-fatal (try/catch returns []) — upstream intelligence failure never blocks agent spawning
- [Phase 28-04]: Task row created after spawnBot succeeds with status=claimed; openclaw-dispatcher transitions to completed/failed and populates result
- [Phase 29-01]: activeIntervals Map decoupled from CoordinationHandle — handle.stop() calls stopCoordinationLoop which looks up interval by runId; avoids exposing intervalId on public interface
- [Phase 29-01]: objectiveDriftScore defaults to 0 and anomalies defaults to [] — Plan 29-04 computes real drift; modules append anomalies via ctx.runState.anomalies before persistence
- [Phase 29-01]: No-op CoordinationHandle returned if session registry not found at loop start — callers never need to null-check; error is logged
- [Phase 29-04]: Objective embedding cached per runId in module-level Map — avoids re-embedding same static string every poll cycle; cost optimization
- [Phase 29-04]: No-completed-outputs path sets drift to 0 (not null) — drift is unmeasurable without outputs; 0 is the neutral/aligned default
- [Phase 29-04]: Reanchoring debounce 2min — prevents signal flooding when drift stays elevated across consecutive poll cycles
- [Phase 29-04]: Per-task output truncated 500 chars, combined text capped 8000 chars — bounds embedding token cost without discarding outputs entirely
- [Phase 29-02]: Jaccard keyword-overlap heuristic at threshold=0.15 chosen for v1 — avoids embedding API calls on every poll cycle
- [Phase 29-02]: Intel-prefixed ringLeaderTaskId (intel:sourceTaskId:targetTaskId) reuses collectUpstreamOutputs pipeline without schema changes
- [Phase 29-02]: processedSessionsByRun Map prevents re-routing on subsequent poll cycles — each session routed exactly once per run
- [Phase 29-03]: Guardrail detection queries bots.errorMessage for keyword list; soul-driven (INVIOLABLE/constitution) triggers paused_for_review; context-driven triggers redistributed
- [Phase 29-03]: COORD-04 capacity redirection is advisory v1 — logs capacity_redirected event with recommendation but does not auto-spawn; future phase required for full automation
- [Phase 29-03]: processedFailures Set marks sessionId even when handler throws to prevent infinite retry loops across poll cycles
- [Phase 29-05]: budgetCap === 0 returns early from budget degradation — no-cap runs bypass the module entirely
- [Phase 29-05]: Hard-stop anomaly appended on every poll cycle when tier is hard_stop (not just on transition) — ensures loop termination detection across missed cycles
- [Phase 30-run-synthesis]: Single LLM call for all four synthesis qualitative fields; fallback synthesis persists with objectiveAchieved=false on LLM failure
- [Phase 30-run-synthesis]: Budget variance = budgetConsumedCents - budgetCapCents; recommendedLibraryWrites includes Artisan/Understudy souls on completed tasks only
- [Phase 30-02]: Synthesis is fire-and-forget from coordination loop; generateRunSynthesis handles its own DB persistence and status transition to completed
- [Phase 30-02]: ringLeaderSynthesis is optional/nullable in CouncilJobData and CouncilContext for backward compat with non-Ring-Leader executions
- [Phase 30-02]: Synthesis section prepended (not appended) to Performance Judge prompt to satisfy SYNTH-05 primary input requirement
- [Phase 30-03]: isRuntimeLimitReached() only evaluates when isRunComplete() is false — prevents double-firing of synthesis; single synthesis invocation per run guaranteed
- [Phase 31-01]: COORDINATION_WEIGHTS imported from @claw/shared-types (not redefined locally) — ensures coordination scoring stays consistent with domain contract
- [Phase 31-01]: Fallback scoring uses deterministic formulas: collectiveOutcome=completed/total, driftPrevention=1-driftScore (clamped 0-1), reallocationEffectiveness=0.5 neutral, budgetManagement=variance-based ratio; never throws
- [Phase 31-02]: SOUL_SELECTION_SCORER_MODEL env var with claude-sonnet-4-6 default; librarySearchQuality fallback = library ratio; qualitative dimensions default 0.5 neutral
- [Phase 31-03]: Promise.all for parallel scorer invocation — both scorers are independent, no reason to sequence them
- [Phase 31-03]: computeAndPersistFitness wraps entire body in try/catch, returns null on failure — run completion never blocked by fitness scoring
- [Phase 31-03]: Fitness chained after synthesis via .then() to ensure synthesis data available before scoring; handle.stop() called synchronously regardless
- [Phase 31-03]: mutationSuccessRate returns null if no mutations; formats as '0.000'-'1.000' string for numeric(4,3) DB column
- [Phase 31-04]: agent_classes reused for Ring Leaders (botId=soulId, taskCategory='ring_leader') — no new table or migration needed
- [Phase 31-04]: Qualifying run count for Artisan gate uses SQL avg of 5 JSONB soul_selection_score dimensions; only executes when basic gates pass
- [Phase 31-04]: Class progression failure is non-fatal — own try/catch separate from fitness try/catch; logs WARN, never propagates
- [Phase 32-01]: runState returns null (not 404) when ring_leader_run exists but coordination not started — UI can distinguish phases without error handling
- [Phase 32-01]: Ring Leader SSE events forwarded via existing per-connection subscription fan-out — RING_LEADER_EVENTS_TOPIC added to topicNames array in sse.ts
- [Phase 32-01]: fitness.compositeScore cast via Number() because Drizzle returns numeric column as string from ring_leader_fitness table
- [Phase 32-02]: Population manifest panel always renders (shows empty-state message) to preserve visual space for non-Ring-Leader executions
- [Phase 32-02]: Ring Leader state panel hidden entirely when runState is null — prevents empty skeleton for pre-coordination or non-Ring-Leader executions
- [Phase 32-02]: Drift color thresholds match DRIFT_REANCHORING_THRESHOLD: teal <0.20, amber 0.20-0.35, error >0.35
- [Phase 32-03]: isRLAlert check runs in SSE callback before feed push — alert flag set at ingestion not render time
- [Phase 32-03]: .event.ring-leader:not(.alert) scoping ensures error-red alert styling takes precedence over violet RL styling for critical events
- [Phase 32-03]: ring_leader_status_change formats as 'Ring Leader: fromStatus -> toStatus'; intelligence_routing truncates signalSummary at 80 chars inline
- [Phase 32-04]: synthesisData fetched with .catch(() => null) alongside report+leaderboard — non-Ring-Leader executions silently skip both panels
- [Phase 32-04]: Soul selection subtotal uses equal 20% per dimension (5 dimensions); coordination uses explicit 40/25/20/15% weights matching domain constants

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
Stopped at: Phase 32 verified — v4.0 milestone complete
Resume file: None
