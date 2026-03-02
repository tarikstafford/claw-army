# Requirements: Akasa

**Defined:** 2026-03-02
**Core Value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.

## v4.0 Requirements

Requirements for The Ring Leader milestone. Each maps to roadmap phases.

### Orchestration

- [ ] **ORCH-01**: Orchestrator parses user objective into a validated task graph with DAG, per-task complexity (low/medium/high), required tools, dependencies, and min/recommended population sizes
- [ ] **ORCH-02**: Orchestrator validates tool grants and budget cap against task graph requirements before spawning Ring Leader
- [ ] **ORCH-03**: Orchestrator spawns a Ring Leader instance with a structured mission brief (objective, task_graph, tool_grants, budget_cap, runtime_limit, campaign_type, run_id)
- [ ] **ORCH-04**: Orchestrator steps back after Ring Leader spawn — no further involvement in soul selection, agent spawning, or execution coordination

### Soul Selection

- [ ] **SOUL-01**: Ring Leader searches the Akashic Library per task using task description embedding similarity (threshold 0.78), required tools filter, task complexity filter, and campaign type weighting
- [ ] **SOUL-02**: Ring Leader excludes souls in the negative signal register for the relevant task category from all search results
- [ ] **SOUL-03**: Ring Leader retrieves 2x the required population per task to create a selection pool
- [ ] **SOUL-04**: Ring Leader selects from pool with class priority (Artisan > Understudy > Novice) and differentiation enforcement (cosine similarity < 0.85 between any two souls on the same task)
- [ ] **SOUL-05**: Ring Leader can apply targeted pre-deployment mutations (single directive substitution or amplification) and logs the mutation operation and rationale
- [ ] **SOUL-06**: Ring Leader handles novel tasks (insufficient library results) by generating 5 archetypal souls across the behavioral spread and flagging the task as Pioneer
- [ ] **SOUL-07**: Ring Leader can assign the same task to multiple differentiated souls when variance is expected to produce better outcomes, with explicit rationale logged
- [ ] **SOUL-08**: Ring Leader produces a structured population manifest per task (soul_id, agent_class, source, parent_soul_id, mutation_applied, selection_rationale, differentiation_score)

### Budget Validation

- [ ] **BUDG-01**: Ring Leader estimates total run cost from population manifest and validates against budget cap before spawning
- [ ] **BUDG-02**: When estimated cost exceeds budget, Ring Leader applies tiered reduction: replace Artisans with Understudies, reduce to minimum populations, then surface warning to user
- [ ] **BUDG-03**: Ring Leader never reduces below minimum parallel constraint of 3 worker agents per task
- [ ] **BUDG-04**: When budget cannot support minimum populations, user is prompted to scope down or increase budget with specific constraint details

### Agent Spawning

- [ ] **SPAWN-01**: Ring Leader generates a session JWT per agent encoding soul_id, task_id, tool_allowlist, third_party_grants, budget_allocation, and runtime_limit
- [ ] **SPAWN-02**: Ring Leader injects full SOUL.md document into each agent's OpenClaw session at start
- [ ] **SPAWN-03**: Ring Leader injects task brief and any available upstream intelligence signals alongside SOUL.md
- [ ] **SPAWN-04**: Ring Leader confirms inviolable constitution lines are present and unmodified in every SOUL.md before execution begins
- [ ] **SPAWN-05**: Ring Leader registers each spawned agent's session ID in an active session registry
- [ ] **SPAWN-06**: Ring Leader respects the task graph DAG — tasks with no dependencies spawn immediately in parallel; dependent tasks are held until upstream outputs are available
- [ ] **SPAWN-07**: Pre-flight dashboard displays the full population manifest (souls, classes, sources, rationale) before the first agent begins execution

### Real-Time Coordination

- [ ] **COORD-01**: Ring Leader polls active sessions at configurable interval (default 30s) and maintains a live run state object (elapsed time, budget consumed, task states, drift score, anomalies)
- [ ] **COORD-02**: Ring Leader routes mid-run intelligence discoveries from one agent to another via inter-agent communication, with routing rationale logged
- [ ] **COORD-03**: Ring Leader reallocates on agent failure — redistributes tasks to surviving agents or spawns replacement from selection pool if budget allows
- [ ] **COORD-04**: Ring Leader reallocates on early completion — evaluates whether freed capacity can benefit active tasks and spawns additional agents if beneficial
- [ ] **COORD-05**: Ring Leader logs guardrail triggers, evaluates whether soul-driven or context-driven, and decides whether to reallocate or pause for review
- [ ] **COORD-06**: Ring Leader maintains live similarity score between collective outputs and original objective embedding; broadcasts reanchoring signal to all agents when drift exceeds 0.35
- [ ] **COORD-07**: Reanchoring signal contains objective restatement, drift summary, and reorientation directive
- [ ] **COORD-08**: Ring Leader projects budget consumption to run end at every monitoring interval and applies tiered degradation (deprioritize, consolidate, wrap up, hard stop at 95% cap)

### Run Synthesis

- [ ] **SYNTH-01**: Ring Leader produces a structured synthesis after all tasks complete (or runtime limit reached) containing objective_achieved, achievement_rationale, per-task summary, event counts, budget variance
- [ ] **SYNTH-02**: Synthesis includes soul_selection_retrospective — Ring Leader's own assessment of which persona selections worked and which didn't
- [ ] **SYNTH-03**: Synthesis includes recommended_library_writes and pioneer_events lists
- [ ] **SYNTH-04**: Synthesis includes ring_leader_self_assessment of its coordination performance
- [ ] **SYNTH-05**: Performance Judge receives Ring Leader synthesis as primary input before reviewing individual agent outputs

### Ring Leader Fitness

- [ ] **FIT-01**: Ring Leader is evaluated on coordination quality (Collective Outcome 40%, Drift Prevention 25%, Reallocation Effectiveness 20%, Budget Management 15%)
- [ ] **FIT-02**: Ring Leader is evaluated on soul selection quality by the Soul Analyst (Library Search Quality, Differentiation Effectiveness, Mutation Decision Quality, Pioneer Handling, Selection Retrospective Quality)
- [ ] **FIT-03**: Composite Ring Leader fitness score weights coordination 60% and soul selection 40%
- [ ] **FIT-04**: Ring Leader Akashic Library entry includes soul_selection_log, library_search_queries, soul_selection_score, selection_retrospective, pioneer_tasks_handled, mutation_operations_applied, mutation_success_rate
- [ ] **FIT-05**: Ring Leader promotion thresholds: Novice→Understudy requires 4 runs + 0.68 confidence; Understudy→Artisan requires 9 runs + 0.85 confidence + soul selection score above 0.75 in at least 6 qualifying runs

### Dashboard & Reporting

- [ ] **DASH-01**: Pre-flight view shows population manifest per task with soul assignments, classes, sources, and Ring Leader selection rationale
- [ ] **DASH-02**: Live execution view shows Ring Leader run state: budget consumed, task states, objective drift score, active anomalies
- [ ] **DASH-03**: Activity feed surfaces Ring Leader coordination events: intelligence routing, reallocation, reanchoring, budget warnings
- [ ] **DASH-04**: Post-run report includes Ring Leader synthesis with soul selection retrospective and coordination self-assessment
- [ ] **DASH-05**: Post-run report shows Ring Leader fitness scores (coordination + soul selection dimensions)

## Future Requirements

### Ring Leader Advanced

- **RL-ADV-01**: Ring Leader leaderboard showing selection accuracy over time (product surface decision pending)
- **RL-ADV-02**: Mutation lineage visualization for Ring Leader mutation decisions
- **RL-ADV-03**: Ring Leader self-improvement — meta-learning from selection retrospectives across runs
- **RL-ADV-04**: Partial soul selection log recovery when Ring Leader fails mid-run

### Platform

- **PLAT-01**: Real payment processing (Stripe integration)
- **PLAT-02**: Multi-tenant isolation
- **PLAT-03**: Agent marketplace / soul trading
- **PLAT-04**: DAG replanning (recursive task graph modification)

## Out of Scope

| Feature | Reason |
|---------|--------|
| User-editable Ring Leader SOUL.md | Corrupts evolutionary lineage attribution — same constraint as worker souls |
| Real-time council evaluation during Ring Leader execution | Requires complete decision trace; council runs post-synthesis |
| Ring Leader marketplace | Requires DNA Library depth and multi-tenant infrastructure first |
| Narrow library search detection / auto-correction | Medium-priority open question from PRD; defer to post-v4.0 calibration |
| Soul selection quality visible to users as separate metric | Open question from PRD; v4.0 includes it in post-run report but defers standalone leaderboard |
| Fine-tuning from Ring Leader data | Requires RLHF infrastructure |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCH-01 | Phase 25 | Pending |
| ORCH-02 | Phase 25 | Pending |
| ORCH-03 | Phase 25 | Pending |
| ORCH-04 | Phase 25 | Pending |
| SOUL-01 | Phase 26 | Pending |
| SOUL-02 | Phase 26 | Pending |
| SOUL-03 | Phase 26 | Pending |
| SOUL-04 | Phase 26 | Pending |
| SOUL-05 | Phase 26 | Pending |
| SOUL-06 | Phase 26 | Pending |
| SOUL-07 | Phase 26 | Pending |
| SOUL-08 | Phase 26 | Pending |
| BUDG-01 | Phase 27 | Pending |
| BUDG-02 | Phase 27 | Pending |
| BUDG-03 | Phase 27 | Pending |
| BUDG-04 | Phase 27 | Pending |
| SPAWN-01 | Phase 28 | Pending |
| SPAWN-02 | Phase 28 | Pending |
| SPAWN-03 | Phase 28 | Pending |
| SPAWN-04 | Phase 28 | Pending |
| SPAWN-05 | Phase 28 | Pending |
| SPAWN-06 | Phase 28 | Pending |
| SPAWN-07 | Phase 28 | Pending |
| COORD-01 | Phase 29 | Pending |
| COORD-02 | Phase 29 | Pending |
| COORD-03 | Phase 29 | Pending |
| COORD-04 | Phase 29 | Pending |
| COORD-05 | Phase 29 | Pending |
| COORD-06 | Phase 29 | Pending |
| COORD-07 | Phase 29 | Pending |
| COORD-08 | Phase 29 | Pending |
| SYNTH-01 | Phase 30 | Pending |
| SYNTH-02 | Phase 30 | Pending |
| SYNTH-03 | Phase 30 | Pending |
| SYNTH-04 | Phase 30 | Pending |
| SYNTH-05 | Phase 30 | Pending |
| FIT-01 | Phase 31 | Pending |
| FIT-02 | Phase 31 | Pending |
| FIT-03 | Phase 31 | Pending |
| FIT-04 | Phase 31 | Pending |
| FIT-05 | Phase 31 | Pending |
| DASH-01 | Phase 32 | Pending |
| DASH-02 | Phase 32 | Pending |
| DASH-03 | Phase 32 | Pending |
| DASH-04 | Phase 32 | Pending |
| DASH-05 | Phase 32 | Pending |

**Coverage:**
- v4.0 requirements: 38 total (ORCH: 4, SOUL: 8, BUDG: 4, SPAWN: 7, COORD: 8, SYNTH: 5, FIT: 5, DASH: 5)
- Mapped to phases: 38
- Unmapped: 0

**Phase 24 note:** No direct requirement IDs — it is a pure enabler phase that creates the schema and types infrastructure required by all 38 v4.0 requirements.

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 — traceability populated after roadmap creation*
