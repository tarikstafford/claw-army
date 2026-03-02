# Roadmap: Claw Bot Army

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-02-19)
- ✅ **v1.1 Google Auth Gate** — Phase 7 (shipped 2026-02-19)
- ✅ **v2.0 The SOUL System** — Phases 8-14 (shipped 2026-02-22)
- ✅ **v3.0 Bot Reliability & UX Overhaul** — Phases 15-23 (shipped 2026-02-23)
- 🚧 **v4.0 The Ring Leader** — Phases 24-32 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: Data Foundation (4/4 plans) — completed 2026-02-18
- [x] Phase 2: Core Execution Pipeline (4/4 plans) — completed 2026-02-18
- [x] Phase 3: Bot Runtime and Tool Gateway (4/4 plans) — completed 2026-02-19
- [x] Phase 4: Control Plane Services (3/3 plans) — completed 2026-02-19
- [x] Phase 5: Performance Intelligence and DNA Capture (3/3 plans) — completed 2026-02-19
- [x] Phase 6: UI Command Center (5/5 plans) — completed 2026-02-19

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v1.1 Google Auth Gate (Phase 7) — SHIPPED 2026-02-19</summary>

- [x] Phase 7: Google Auth Gate (6/6 plans) — completed 2026-02-19

See `.planning/milestones/v1.1-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0 The SOUL System (Phases 8-14) — SHIPPED 2026-02-22</summary>

- [x] Phase 8: Database Schema and Shared Types (2/2 plans) — completed 2026-02-21
- [x] Phase 9: Soul Generation and Dispatch Integration (3/3 plans) — completed 2026-02-21
- [x] Phase 10: Decision Trace Collection (2/2 plans) — completed 2026-02-22
- [x] Phase 11: The Council (2/2 plans) — completed 2026-02-22
- [x] Phase 12: Human Confirmation Gate (2/2 plans) — completed 2026-02-22
- [x] Phase 13: God Layer and Agent Class System (4/4 plans) — completed 2026-02-22
- [x] Phase 14: UI Extensions (4/4 plans) — completed 2026-02-22

See `.planning/milestones/v2.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v3.0 Bot Reliability & UX Overhaul (Phases 15-23) — SHIPPED 2026-02-23</summary>

- [x] Phase 15: Bot Reliability (3/4 plans — 15-04 gap promoted to Phase 20) — completed 2026-02-23
- [x] Phase 16: Named Objectives Data Model (3/3 plans) — completed 2026-02-22
- [x] Phase 17: Objective Hub UI (3/3 plans) — completed 2026-02-22
- [x] Phase 18: Soul Inspector (2/2 plans) — completed 2026-02-22
- [x] Phase 19: Run View Enhancements (2/2 plans) — completed 2026-02-23
- [x] Phase 20: Spawn Timeout Error Preservation (1/1 plan) — completed 2026-02-23
- [x] Phase 21: Launch-from-Objective UI (2/2 plans) — completed 2026-02-23
- [x] Phase 22: v3.0 Tech Debt Cleanup (1/1 plan) — completed 2026-02-23
- [x] Phase 23: Akasa UI Rebrand — Design System Rollout (7/7 plans) — completed 2026-02-23

See `.planning/milestones/v3.0-ROADMAP.md` for full phase details.

</details>

---

### v4.0 The Ring Leader (In Progress)

**Milestone Goal:** Promote the Ring Leader from a concept to a first-class autonomous entity that owns soul selection, population assembly, agent spawning, real-time swarm coordination, and run synthesis — demoting the Orchestrator to a thin pre-flight layer.

#### Phase 24: Ring Leader Schema and Shared Types

**Goal:** All database columns, shared TypeScript types, and Zod schemas required by the Ring Leader are in place and importable before any Ring Leader logic is written.
**Depends on:** Phase 23
**Requirements:** (schema enabler — no direct requirement IDs; enables all 38 v4.0 requirements)
**Success Criteria** (what must be TRUE):
  1. New DB columns (ring_leader_soul, mission_brief, population_manifest, ring_leader_fitness) are migrated and queryable.
  2. Shared types package exports RingLeaderMissionBrief, PopulationManifest, SoulSelectionEntry, RingLeaderSynthesis, and RingLeaderFitnessScore with full TypeScript inference.
  3. Zod schemas for all Ring Leader event payloads compile without error in both execution-service and UI.
  4. Existing execution, bot, and soul records are unaffected by the migration (zero data loss).
**Plans:** 3 plans

Plans:
- [x] 24-01-PLAN.md — DB migration: ring_leader_runs and ring_leader_fitness tables, ring_leader_run_id on executions
- [x] 24-02-PLAN.md — Shared types and Zod event schemas for Ring Leader lifecycle

#### Phase 25: Orchestrator Demotion and Ring Leader Core

**Goal:** The Orchestrator becomes a thin pre-flight layer that validates the task graph and budget envelope, then hands off to a Ring Leader instance — it no longer drives soul selection, spawning, or coordination.
**Depends on:** Phase 24
**Requirements:** ORCH-01, ORCH-02, ORCH-03, ORCH-04
**Success Criteria** (what must be TRUE):
  1. User submits an execution and the system produces a validated task graph with per-task complexity, required tools, and DAG dependencies before any agent spawns.
  2. Orchestrator rejects a submission whose tool grants or budget cap cannot satisfy the task graph requirements, surfacing a specific constraint message.
  3. Orchestrator emits a single structured mission brief (objective, task_graph, tool_grants, budget_cap, runtime_limit, campaign_type, run_id) and transfers control to the Ring Leader.
  4. After Ring Leader spawn, the Orchestrator takes no further action — all soul selection, spawning, and execution decisions originate from the Ring Leader.
**Plans:** 3 plans

Plans:
- [x] 25-01-PLAN.md — Task graph parser: LLM-based DAG decomposition with complexity, tools, populations
- [x] 25-02-PLAN.md — Pre-flight validation: tool grants and budget check against task graph
- [x] 25-03-PLAN.md — Ring Leader spawn: mission brief construction and Orchestrator handoff

#### Phase 26: Soul Library Search and Population Assembly

**Goal:** The Ring Leader can search the Akashic Library to assemble a differentiated population of souls per task, handle novel tasks with archetypal generation, and produce a structured population manifest ready for spawning.
**Depends on:** Phase 25
**Requirements:** SOUL-01, SOUL-02, SOUL-03, SOUL-04, SOUL-05, SOUL-06, SOUL-07, SOUL-08
**Success Criteria** (what must be TRUE):
  1. For a known task category, the Ring Leader retrieves a selection pool of 2x required population filtered by embedding similarity (threshold 0.78), required tools, task complexity, and campaign type weighting — with negative-signal souls excluded.
  2. Ring Leader selects from the pool with class priority (Artisan first) and enforces cosine similarity < 0.85 between any two assigned souls on the same task.
  3. Ring Leader can apply a single targeted mutation (substitution or amplification) to a selected soul and log the operation and rationale.
  4. For a novel task with insufficient library results, Ring Leader generates 5 archetypal souls across the behavioral spread and flags the task as Pioneer.
  5. Ring Leader produces a population manifest per task with all required fields: soul_id, agent_class, source, parent_soul_id, mutation_applied, selection_rationale, differentiation_score.
**Plans:** 3 plans

Plans:
- [x] 26-01-PLAN.md — Library search: embedding similarity, tool filter, complexity filter, campaign weighting, negative signal exclusion
- [x] 26-02-PLAN.md — Population selection: class priority, differentiation enforcement, pre-deployment mutation
- [x] 26-03-PLAN.md — Pioneer generation, population manifest assembly, and ring-leader-spawner integration
#### Phase 27: Budget Validation and Population Sizing

**Goal:** Ring Leader validates that the assembled population fits the budget cap before any agent spawns, applies tiered reduction when needed, and surfaces a clear constraint message to the user when the minimum viable population cannot be funded.
**Depends on:** Phase 26
**Requirements:** BUDG-01, BUDG-02, BUDG-03, BUDG-04
**Success Criteria** (what must be TRUE):
  1. Ring Leader estimates total run cost from the population manifest and compares against the budget cap before any VM spawns.
  2. When estimated cost exceeds the budget cap, Ring Leader applies tiered reduction in order: replace Artisans with Understudies, then reduce to minimum populations — surfacing a warning to the user at each tier.
  3. Ring Leader never reduces a task below 3 worker agents regardless of cost pressure.
  4. When the budget cannot fund minimum populations (3 agents per task), user sees a specific constraint message with the exact shortfall and options to scope down or increase budget.
**Plans:** 3 plans

Plans:
- [x] 27-01-PLAN.md — TDD: budget-validator module with cost estimation, tiered reduction, and minimum population guard
- [x] 27-02-PLAN.md — Wire budget validation into population assembly pipeline and surface constraint failures

#### Phase 28: Ring Leader Agent Spawning

**Goal:** Ring Leader spawns agents using the validated population manifest — injecting session JWTs, full SOUL.md documents, task briefs, and upstream intelligence signals into each OpenClaw session, respecting DAG ordering, and registering every active session.
**Depends on:** Phase 27
**Requirements:** SPAWN-01, SPAWN-02, SPAWN-03, SPAWN-04, SPAWN-05, SPAWN-06, SPAWN-07
**Success Criteria** (what must be TRUE):
  1. Each spawned agent receives a session JWT encoding soul_id, task_id, tool_allowlist, third_party_grants, budget_allocation, and runtime_limit.
  2. Each agent's OpenClaw session starts with the full SOUL.md document injected, with inviolable constitution lines verified present and unmodified before execution begins.
  3. Task brief and any available upstream intelligence signals are injected alongside SOUL.md in each session.
  4. Tasks with no DAG dependencies spawn immediately in parallel; tasks with upstream dependencies are held until upstream outputs are available.
  5. Every spawned agent's session ID is registered in the active session registry, and the pre-flight dashboard shows the full population manifest before the first agent begins executing.
**Plans:** 4 plans

Plans:
- [x] 28-01-PLAN.md — Session JWT generation, SOUL.md injection, task brief assembly, and constitution verification
- [x] 28-02-PLAN.md — DAG-respecting spawn sequencing, active session registry, and pipeline wiring
- [x] 28-03-PLAN.md — Pre-flight dashboard data endpoint: population manifest per task
- [x] 28-04-PLAN.md — Gap closure: upstream intelligence pipeline (ring_leader_task_id column + collectUpstreamOutputs)

#### Phase 29: Real-Time Execution Coordination

**Goal:** Ring Leader monitors active sessions, routes intelligence between agents, reallocates on failure or early completion, detects and corrects objective drift, and applies tiered budget degradation — with all coordination events logged.
**Depends on:** Phase 28
**Requirements:** COORD-01, COORD-02, COORD-03, COORD-04, COORD-05, COORD-06, COORD-07, COORD-08
**Success Criteria** (what must be TRUE):
  1. Ring Leader polls active sessions at a configurable interval (default 30s) and maintains a live run state object with elapsed time, budget consumed, task states, drift score, and anomalies.
  2. When one agent discovers intelligence relevant to another task, Ring Leader routes it to the target agent with routing rationale logged.
  3. When an agent fails, Ring Leader redistributes its tasks to surviving agents or spawns a replacement from the selection pool if budget allows; when an agent finishes early, Ring Leader evaluates whether the freed capacity benefits active tasks.
  4. Ring Leader maintains a live similarity score between collective outputs and the original objective embedding and broadcasts a reanchoring signal (objective restatement, drift summary, reorientation directive) when drift exceeds 0.35.
  5. Ring Leader projects budget consumption to run end at every polling interval and applies tiered degradation: deprioritize, consolidate, wrap up, hard stop at 95% cap.
**Plans:** 5 plans

Plans:
- [x] 29-01-PLAN.md — Coordination polling loop, live run state object, and coordination event logging infrastructure
- [x] 29-02-PLAN.md — Intelligence routing between agents with relevance detection and rationale logging
- [x] 29-03-PLAN.md — Failure reallocation, early-completion capacity evaluation, and guardrail classification
- [x] 29-04-PLAN.md — Objective drift detection via embedding similarity and reanchoring signal broadcast
- [x] 29-05-PLAN.md — Budget projection, tiered degradation, and full coordination loop wiring into spawner pipeline

#### Phase 30: Run Synthesis

**Goal:** Ring Leader produces a structured synthesis document after all tasks complete (or runtime limit is reached) — covering objective achievement, per-task summaries, soul selection retrospective, recommended library writes, and its own coordination self-assessment — and delivers it to the Council as the primary input for Performance Judge evaluation.
**Depends on:** Phase 29
**Requirements:** SYNTH-01, SYNTH-02, SYNTH-03, SYNTH-04, SYNTH-05
**Success Criteria** (what must be TRUE):
  1. After all tasks complete or runtime limit is reached, Ring Leader produces a synthesis document containing: objective_achieved flag, achievement_rationale, per-task summary, event counts, and budget variance.
  2. Synthesis includes soul_selection_retrospective — Ring Leader's own assessment of which persona selections worked and which did not.
  3. Synthesis includes recommended_library_writes (souls to promote/retain) and pioneer_events lists.
  4. Synthesis includes ring_leader_self_assessment of its coordination performance.
  5. Performance Judge receives the Ring Leader synthesis as its primary input before reviewing individual agent outputs.
**Plans:** 3 plans

Plans:
- [x] 30-01-PLAN.md — Run synthesis module: LLM-driven document generation with all SYNTH-01 through SYNTH-04 fields
- [x] 30-02-PLAN.md — Wire synthesis into coordination loop termination and Performance Judge council handoff (SYNTH-05)
- [x] 30-03-PLAN.md — Gap closure: add runtime-limit termination check to coordination loop

#### Phase 31: Ring Leader Fitness Scoring

**Goal:** Ring Leader is evaluated on both coordination quality and soul selection quality; its composite fitness score is stored in the Akashic Library entry with full dimension breakdown, and promotion thresholds govern its own class progression.
**Depends on:** Phase 30
**Requirements:** FIT-01, FIT-02, FIT-03, FIT-04, FIT-05
**Success Criteria** (what must be TRUE):
  1. After a run, the Ring Leader receives a coordination quality score across four dimensions: Collective Outcome (40%), Drift Prevention (25%), Reallocation Effectiveness (20%), Budget Management (15%).
  2. Soul Analyst evaluates the Ring Leader on soul selection quality across five dimensions: Library Search Quality, Differentiation Effectiveness, Mutation Decision Quality, Pioneer Handling, and Selection Retrospective Quality.
  3. Composite Ring Leader fitness score weights coordination at 60% and soul selection at 40%.
  4. Ring Leader Akashic Library entry contains: soul_selection_log, library_search_queries, soul_selection_score, selection_retrospective, pioneer_tasks_handled, mutation_operations_applied, mutation_success_rate.
  5. Ring Leader class progression enforces thresholds: Novice to Understudy requires 4 runs + 0.68 confidence; Understudy to Artisan requires 9 runs + 0.85 confidence + soul selection score above 0.75 in at least 6 qualifying runs.
**Plans:** 4 plans

Plans:
- [x] 31-01-PLAN.md — Coordination quality scoring: four dimensions with LLM-based evaluation and deterministic fallback
- [x] 31-02-PLAN.md — Soul selection quality scoring: five dimensions with LLM-based evaluation
- [x] 31-03-PLAN.md — Composite fitness computation, Akashic Library persistence, and coordination loop wiring
- [x] 31-04-PLAN.md — Ring Leader class progression thresholds and promotion evaluation

#### Phase 32: Dashboard and Reporting

**Goal:** Pre-flight, live execution, and post-run surfaces all expose Ring Leader decisions — population manifest before spawn, live run state and coordination events during execution, and synthesis with fitness scores after completion.
**Depends on:** Phase 31 (post-run views), Phase 28 (pre-flight view), Phase 29 (live coordination view)
**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Pre-flight view shows the full population manifest per task: soul assignments, agent classes, soul sources, and Ring Leader selection rationale for each assignment.
  2. Live execution view shows Ring Leader run state: budget consumed, task states per task, objective drift score, and active anomalies.
  3. Activity feed surfaces Ring Leader coordination events in real time: intelligence routing, reallocation decisions, reanchoring signals, and budget degradation warnings.
  4. Post-run report includes Ring Leader synthesis: soul selection retrospective and coordination self-assessment sections.
  5. Post-run report shows Ring Leader fitness scores with coordination and soul selection dimension breakdowns visible.
**Plans:** 4 plans

Plans:
- [ ] 32-01: Pre-flight population manifest UI — soul assignments, classes, sources, selection rationale
- [ ] 32-02: Live execution Ring Leader state panel — budget, task states, drift score, anomalies
- [ ] 32-03: Activity feed Ring Leader coordination events — routing, reallocation, reanchoring, budget warnings
- [ ] 32-04: Post-run Ring Leader synthesis and fitness score panels

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 4/4 | Complete | 2026-02-18 |
| 2. Core Execution Pipeline | v1.0 | 4/4 | Complete | 2026-02-18 |
| 3. Bot Runtime and Tool Gateway | v1.0 | 4/4 | Complete | 2026-02-19 |
| 4. Control Plane Services | v1.0 | 3/3 | Complete | 2026-02-19 |
| 5. Performance Intelligence and DNA Capture | v1.0 | 3/3 | Complete | 2026-02-19 |
| 6. UI Command Center | v1.0 | 5/5 | Complete | 2026-02-19 |
| 7. Google Auth Gate | v1.1 | 6/6 | Complete | 2026-02-19 |
| 8. Database Schema and Shared Types | v2.0 | 2/2 | Complete | 2026-02-21 |
| 9. Soul Generation and Dispatch Integration | v2.0 | 3/3 | Complete | 2026-02-21 |
| 10. Decision Trace Collection | v2.0 | 2/2 | Complete | 2026-02-22 |
| 11. The Council | v2.0 | 2/2 | Complete | 2026-02-22 |
| 12. Human Confirmation Gate | v2.0 | 2/2 | Complete | 2026-02-22 |
| 13. God Layer and Agent Class System | v2.0 | 4/4 | Complete | 2026-02-22 |
| 14. UI Extensions | v2.0 | 4/4 | Complete | 2026-02-22 |
| 15. Bot Reliability | v3.0 | 3/4 | Complete | 2026-02-23 |
| 16. Named Objectives Data Model | v3.0 | 3/3 | Complete | 2026-02-22 |
| 17. Objective Hub UI | v3.0 | 3/3 | Complete | 2026-02-22 |
| 18. Soul Inspector | v3.0 | 2/2 | Complete | 2026-02-22 |
| 19. Run View Enhancements | v3.0 | 2/2 | Complete | 2026-02-23 |
| 20. Spawn Timeout Error Preservation | v3.0 | 1/1 | Complete | 2026-02-23 |
| 21. Launch-from-Objective UI | v3.0 | 2/2 | Complete | 2026-02-23 |
| 22. v3.0 Tech Debt Cleanup | v3.0 | 1/1 | Complete | 2026-02-23 |
| 23. Akasa UI Rebrand — Design System Rollout | v3.0 | 7/7 | Complete | 2026-02-23 |
| 24. Ring Leader Schema and Shared Types | v4.0 | 2/2 | Complete | 2026-03-02 |
| 25. Orchestrator Demotion and Ring Leader Core | v4.0 | 3/3 | Complete | 2026-03-02 |
| 26. Soul Library Search and Population Assembly | v4.0 | 3/3 | Complete | 2026-03-02 |
| 27. Budget Validation and Population Sizing | v4.0 | 2/2 | Complete | 2026-03-02 |
| 28. Ring Leader Agent Spawning | v4.0 | 4/4 | Complete | 2026-03-02 |
| 29. Real-Time Execution Coordination | v4.0 | 5/5 | Complete | 2026-03-02 |
| 30. Run Synthesis | v4.0 | 3/3 | Complete | 2026-03-02 |
| 31. Ring Leader Fitness Scoring | v4.0 | 4/4 | Complete | 2026-03-02 |
| 32. Dashboard and Reporting | v4.0 | 0/TBD | Not started | - |
