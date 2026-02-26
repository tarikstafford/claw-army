# Akasa — Ring Leader PRD
**Version 1.0 | February 2026 | CONFIDENTIAL**

> *The Ring Leader does not receive an army. It builds one. Then it leads it.*

---

## 1. Purpose of This Document

This PRD specifies the Ring Leader as a first-class product component under Option A architecture. Under this model, the Orchestrator is a thin pre-flight layer responsible for objective decomposition and budget validation only. Everything that happens after task graph approval — soul library search, persona selection, task assignment, execution management, synthesis — is owned by the Ring Leader.

This is a meaningful departure from the v1.1 PRD framing, where soul generation was an Orchestrator-triggered algorithm and the Ring Leader received a pre-assembled army. Under Option A, the Ring Leader is the real intelligence of every run. The Orchestrator hands it a mission brief. The Ring Leader decides how to execute it.

---

## 2. Revised Responsibility Boundary

### What the Orchestrator now does (pre-flight only)

1. Parses the user's natural language objective
2. Decomposes it into a validated task graph with dependency map
3. Checks tool grants and budget against task graph requirements
4. Spawns the Ring Leader with the approved mission brief
5. Steps back — execution is now the Ring Leader's domain

The Orchestrator does not select souls. It does not generate SOUL.md configurations. It does not assign agents to tasks. It produces a task graph and a budget envelope, then hands both to the Ring Leader.

### What the Ring Leader now owns

Everything between mission brief receipt and council handoff:

- Soul library search and persona selection
- Task-to-soul assignment
- Agent spawning
- Real-time swarm monitoring and coordination
- Dynamic reallocation
- Objective reanchoring
- Budget and runtime watchdog
- Run synthesis for the Performance Judge

The Ring Leader soul itself evolves through the Akashic Library on both dimensions — its coordination performance AND its soul selection quality. A Ring Leader that consistently picks the right personas for the right tasks is a better Ring Leader. That signal compounds.

---

## 3. The Ring Leader's Mission Brief

When the Orchestrator hands off to the Ring Leader, it passes a structured mission brief containing:

```json
{
  "objective": "string — original user input",
  "task_graph": {
    "tasks": [
      {
        "task_id": "string",
        "description": "string",
        "complexity": "low | medium | high",
        "required_tools": ["string"],
        "dependencies": ["task_id"],
        "parallelizable": true,
        "min_population": 3,
        "recommended_population": 5
      }
    ],
    "dag": "adjacency map"
  },
  "tool_grants": ["string"],
  "budget_cap": "number — total run budget in USD",
  "runtime_limit": "number — seconds",
  "campaign_type": "ad_hoc | campaign",
  "run_id": "string"
}
```

The Ring Leader owns everything from this point forward. It cannot modify the task graph structure (that is the Orchestrator's output and is locked). It can — and must — determine how to staff and execute it.

---

## 4. Phase 1 — Soul Library Search

Before spawning a single agent, the Ring Leader searches the Akashic Library. This is the most consequential thing it does.

### 4.1 Search Inputs

For each task node in the task graph, the Ring Leader constructs a search query using:

- **Task description** — embedded and compared against library entries by task category tag
- **Required tools** — filters for souls with confirmed performance using the granted tool set
- **Task complexity** — filters for souls with fitness scores above benchmark at the relevant complexity tier
- **Campaign type** — ad hoc runs weight toward proven Artisan souls for immediate output quality; campaign runs weight toward Understudy variance to build army state over time
- **Negative signal exclusion** — souls in the negative signal register for this task category are excluded from consideration regardless of class

### 4.2 Search Query per Task

```
QUERY: souls WHERE
  task_category MATCHES embed(task.description) WITH similarity > 0.78
  AND tool_grants_used CONTAINS ALL task.required_tools
  AND agent_class IN (Artisan, Understudy, Novice)  -- ranked in that order
  AND soul_id NOT IN negative_signal_register[task_category]
  AND latest_fitness_score > category_benchmark
ORDER BY fitness_score DESC, human_confirmation_count DESC
LIMIT population_size * 2  -- retrieve double, select from the pool
```

The Ring Leader retrieves twice the required population for each task. This gives it a selection pool to apply differentiation logic against before final assignment.

### 4.3 Novel Task Handling

If similarity search returns fewer than the minimum population for a task node, that task is flagged as a **Pioneer candidate**. The Ring Leader does not abort. It switches to archetype generation for that task:

1. Generates five archetypal souls across the behavioural spread (Cautious Verifier, Aggressive Executor, Creative Synthesizer, Structured Analyst, Collaborative Integrator)
2. Generates variants to meet minimum population requirement
3. Flags the task with Pioneer status in the mission log
4. Notifies the user via dashboard that new territory is being explored

### 4.4 Assigning the Same Task to Different Souls

This is a deliberate and important capability. The Ring Leader can and should assign the same task to slightly different souls when the task has high variance potential — creative work, strategic synthesis, or any objective where approach diversity is likely to produce meaningfully different outputs.

Rules governing same-task multi-soul assignment:

- **Minimum differentiation enforced.** The Soul Differentiation Enforcement Algorithm (Algorithm 3) runs across all souls assigned to the same task. No two souls on the same task may have cosine similarity above 0.85. The Ring Leader is responsible for ensuring this before spawning.
- **Explicit rationale logged.** When the Ring Leader assigns the same task to multiple souls, it logs the rationale: what variance it expects, what signal it is trying to generate.
- **Council receives the variance signal.** The Performance Judge scores cross-soul variance on the same task as a data quality signal, not a problem to resolve. High-variance outputs from the same task brief are valuable — they surface which soul approach produced better outcomes.

This is not a fallback for when the library is thin. It is a first-class research instrument. For any task where the Ring Leader's own soul history suggests approach diversity correlates with better collective outcomes, it should use it deliberately.

---

## 5. Phase 2 — Population Assembly

After search, the Ring Leader assembles the final population for each task node.

### 5.1 Selection from Pool

For each task, the Ring Leader selects from its retrieved pool using:

1. **Class priority.** Artisans preferred, then Understudies, then Novices. Unless campaign type weights differently (see 4.1).
2. **Differentiation check.** Run Soul Differentiation Enforcement across the candidate selection before finalising. Replace any soul above similarity threshold with next-best from pool.
3. **Mutation decision.** If a soul from the library is close to ideal but not quite right for this specific task instance, the Ring Leader may apply a targeted mutation — a single directive substitution or amplification — before deployment. It logs the mutation operation and its rationale. The mutation is written to the library as a new version linked to the parent.
4. **Novel generation.** If pool depth is insufficient after differentiation filtering, generate new souls via Algorithm 2 Path A or Path B as appropriate.

### 5.2 Population Table per Task

Before spawning, the Ring Leader produces a structured population manifest:

```json
{
  "task_id": "string",
  "task_description": "string",
  "assigned_souls": [
    {
      "soul_id": "string",
      "agent_class": "Artisan | Understudy | Novice",
      "source": "library | generated | mutated",
      "parent_soul_id": "string | null",
      "mutation_applied": "string | null",
      "selection_rationale": "string",
      "differentiation_score": "number — distance from nearest soul in population"
    }
  ],
  "pioneer_flag": "boolean",
  "variance_intent": "string | null — rationale if same task assigned to diverse souls"
}
```

This manifest is logged to the run record and surfaced in the live dashboard before execution begins.

### 5.3 Budget Validation

After assembling the full population manifest, the Ring Leader performs a budget check:

```
total_estimated_cost =
  SUM(population_size[task] * estimated_cost_per_agent[complexity]) for all tasks
  + ring_leader_cost
```

If estimated cost exceeds the budget cap, the Ring Leader does not abort. It applies a tiered reduction strategy:

1. First: replace Artisan souls with Understudy equivalents where task category has strong Understudy bench
2. Second: reduce recommended populations to minimums where task complexity is low
3. Third: surface a pre-flight warning to the user with the revised composition and cost estimate

The Ring Leader never reduces below the minimum parallel constraint of 3 worker agents per task. If the budget cannot support minimum populations across all tasks, the user is prompted to scope down or increase budget. The Ring Leader presents the specific tasks causing the constraint.

---

## 6. Phase 3 — Agent Spawning

With the population manifest validated and budget confirmed, the Ring Leader spawns agents.

### 6.1 Spawn Sequence

1. **JWT issuance.** For each agent, the Ring Leader generates a session JWT encoding: soul_id, task_id, tool_allowlist, third_party_grants, budget_allocation (per-agent slice of total budget), runtime_limit.
2. **SOUL.md injection.** The full SOUL.md document for the assigned soul is loaded into the agent's OpenClaw session at start.
3. **Task brief injection.** The specific task description, required outputs, and any intelligence signals already available (from previously completed upstream tasks) are injected alongside SOUL.md.
4. **Inviolable constitution check.** Before any agent begins execution, the Ring Leader confirms the inviolable constitution lines are present and unmodified in the SOUL.md.
5. **Session registration.** Each spawned agent's session ID is registered in the Ring Leader's active session registry.

### 6.2 Dependency-aware spawning

The Ring Leader respects the DAG from the task graph. Tasks with no dependencies are spawned immediately in parallel. Tasks with upstream dependencies are held in a spawn queue and released when their dependencies complete and outputs are available.

The Ring Leader does not wait for full DAG completion before acting. As soon as a task's dependencies clear, it spawns that task population. The run is always moving forward.

### 6.3 Pre-flight dashboard state

Before the first agent begins execution, the live dashboard shows the full population manifest — which souls are assigned to which tasks, their class, their source (library/generated/mutated), and the Ring Leader's selection rationale. Users see what army they are deploying before it moves.

---

## 7. Phase 4 — Execution and Coordination

The Ring Leader remains active for the full duration of the run. All coordination functions from the v1.1 PRD are retained and specified in greater detail here.

### 7.1 Continuous Monitoring

The Ring Leader polls `sessions_list` and `sessions_history` across all active sessions at a configurable interval (default: every 30 seconds, configurable per run complexity). It maintains a live run state object:

```json
{
  "run_id": "string",
  "elapsed_time": "number",
  "budget_consumed": "number",
  "task_states": {
    "task_id": {
      "status": "queued | active | completing | complete | failed",
      "active_agents": ["session_id"],
      "completed_agents": ["session_id"],
      "failed_agents": ["session_id"],
      "output_quality_signal": "number | null — early scoring if available"
    }
  },
  "objective_drift_score": "number — 0 to 1, 0 = fully aligned",
  "anomalies": []
}
```

### 7.2 Intelligence Routing

When a worker agent produces a discovery mid-run that is relevant to another active task — a competitor pricing insight that changes the brief for the content drafting task, a contact that belongs to a lead list another agent is building — the Ring Leader routes it via `sessions_send`.

The routing decision is logged: what signal was routed, from which agent to which agent, and the Ring Leader's rationale for the routing decision. This log is written to the Akashic Library entry and is one of the key inputs to the Ring Leader's coordination attribution score.

### 7.3 Dynamic Reallocation

If an agent fails, hits a guardrail, or completes its task significantly early while other tasks are still running, the Ring Leader reallocates:

- **Agent failure:** Remaining tasks on the failed agent are redistributed to surviving agents on the same task, or a new agent is spawned from the next-best soul in the original selection pool if budget allows.
- **Early completion:** Ring Leader evaluates whether the freed agent capacity can be redirected to any active task that would benefit from additional population. If yes, it spawns a new agent from the pool for that task and routes accumulated context to it.
- **Guardrail trigger:** Ring Leader logs the trigger, evaluates whether it was soul-driven or context-driven, and decides whether to reallocate or pause that task for review.

All reallocation decisions are logged with the Ring Leader's explicit rationale.

### 7.4 Objective Reanchoring

The Ring Leader maintains a live similarity score between collective agent outputs and the original objective embedding. If drift score exceeds 0.35, it broadcasts a reanchoring signal to all active agents containing:

- A restatement of the core objective
- A summary of how current outputs are drifting
- A directive to reorient remaining work

The reanchoring event is timestamped and logged. Post-reanchoring drift measurement (does the swarm recover?) is one of the Ring Leader's key fitness dimensions.

### 7.5 Budget and Runtime Watchdog

At every monitoring interval, the Ring Leader projects budget consumption to run end based on current burn rate. If projection exceeds budget cap:

1. First action: deprioritise lowest-value remaining tasks (Ring Leader judgement call, logged)
2. Second action: consolidate overlapping work across agents where duplication is detected
3. Third action: signal all agents to wrap up cleanly rather than continuing to expand scope
4. Hard stop: if budget is within 5% of cap with tasks still running, Ring Leader initiates graceful shutdown sequence across all active sessions

---

## 8. Phase 5 — Run Synthesis

When all tasks complete (or the run reaches its runtime limit), the Ring Leader produces a structured synthesis before council evaluation begins.

### 8.1 Synthesis Contents

```json
{
  "run_id": "string",
  "objective": "string",
  "objective_achieved": "boolean — Ring Leader judgement",
  "achievement_rationale": "string",
  "task_summary": [
    {
      "task_id": "string",
      "completed": "boolean",
      "top_performing_soul": "soul_id",
      "output_quality_signal": "number",
      "anomalies": ["string"]
    }
  ],
  "intelligence_routing_events": "number",
  "reallocation_events": "number",
  "reanchoring_events": "number",
  "soul_selection_retrospective": "string — Ring Leader's own assessment of its selection decisions",
  "budget_variance": "number — actual vs projected",
  "recommended_library_writes": ["soul_id"],
  "pioneer_events": ["task_id"],
  "ring_leader_self_assessment": "string"
}
```

The `soul_selection_retrospective` field is important. The Ring Leader explicitly reflects on whether its persona selections were right — which souls performed above expectation, which below, and what that implies for future selection decisions on similar tasks. This retrospective is written to the Ring Leader's own Akashic Library entry and feeds directly into its soul-selection fitness dimension.

### 8.2 Synthesis as Primary Council Input

The Performance Judge receives the Ring Leader synthesis as its primary input before reviewing individual agent outputs. This is intentional — the Ring Leader is the one entity that observed the entire run. Its synthesis frames the council's evaluation.

---

## 9. Ring Leader Fitness Dimensions

The Ring Leader is evaluated on two categories of performance: coordination quality (inherited from v1.1) and soul selection quality (new under Option A).

### 9.1 Coordination Dimensions (inherited, weights unchanged)

| Dimension | Weight |
|---|---|
| Collective Outcome Quality | 40% |
| Objective Drift Prevention | 25% |
| Reallocation Effectiveness | 20% |
| Budget Management | 15% |

### 9.2 Soul Selection Dimensions (new)

These dimensions are scored by the Soul Analyst using the soul selection retrospective, the population manifest, and the cross-agent performance variance data.

| Dimension | Description |
|---|---|
| Library Search Quality | Did the Ring Leader find the best available souls for each task? Were better options present in the library that weren't selected? |
| Differentiation Effectiveness | Did the souls assigned to each task produce meaningfully different approaches? Or did apparent differentiation collapse during execution? |
| Mutation Decision Quality | Where the Ring Leader applied targeted mutations before deployment, did those mutations improve performance relative to the base soul? |
| Pioneer Handling | When novel tasks arose, did the Ring Leader's archetype selection produce useful variance? Did the Pioneer souls generate signal the library can learn from? |
| Selection Retrospective Quality | Does the Ring Leader's own retrospective accurately identify what worked and what didn't? A Ring Leader that consistently misattributes its selection outcomes is a worse Ring Leader regardless of collective outcomes. |

Soul selection quality is scored separately and reported alongside coordination quality. A Ring Leader with strong coordination and poor soul selection is a different problem from one with poor coordination and strong selection. The council verdict reflects the distinction.

### 9.3 Composite Ring Leader Fitness Score

The two categories are weighted:

| Category | Weight |
|---|---|
| Coordination Quality | 60% |
| Soul Selection Quality | 40% |

This weighting reflects that coordination is the harder, more complex skill. But soul selection is not a secondary concern — a Ring Leader that consistently deploys the wrong souls will degrade collective outcomes even with perfect in-run coordination.

---

## 10. Ring Leader Promotion Thresholds (revised under Option A)

Promotion thresholds are higher than in v1.1 because the Ring Leader's responsibilities are now broader.

| Threshold | v1.1 | Option A |
|---|---|---|
| Novice → Understudy min runs | 3 | 4 |
| Novice → Understudy council confidence | 0.65 | 0.68 |
| Understudy → Artisan min runs | 7 | 9 |
| Understudy → Artisan council confidence | 0.82 | 0.85 |
| Understudy → Artisan additional requirement | — | Soul selection quality score above 0.75 in at least 6 of qualifying runs |

An Artisan Ring Leader under Option A is a genuinely rare asset. It has demonstrated not just coordination excellence but the ability to consistently read the soul library correctly and assemble populations that produce better collective outcomes than the alternatives. That compounding judgement is what the platform is ultimately selling.

---

## 11. Akashic Library — Ring Leader Entry Schema (updated)

Ring Leader library entries carry all fields from the v1.1 schema plus the following new fields:

| Field | Type | Description |
|---|---|---|
| `soul_selection_log` | JSONB | Full population manifest for the run — which souls were selected, from library or generated, mutation operations applied |
| `library_search_queries` | JSONB | The search queries issued per task, results returned, and final selections made |
| `soul_selection_score` | FLOAT | Composite soul selection quality score from council |
| `selection_retrospective` | TEXT | Ring Leader's own post-run assessment of its selection decisions |
| `pioneer_tasks_handled` | INT | Number of tasks where library depth was insufficient and archetypes were generated |
| `mutation_operations_applied` | INT | Number of pre-deployment mutations made by Ring Leader in this run |
| `mutation_success_rate` | FLOAT | Of mutations applied, what fraction produced above-benchmark performance |

New composite index: `(soul_id, coordination_category, soul_selection_score)` — the core query for identifying Ring Leaders that are both strong coordinators and strong soul selectors.

---

## 12. Revised Algorithm 2 — Soul Generation and Mutation (Ring Leader triggers, not Orchestrator)

This algorithm is now triggered by the Ring Leader, not the Orchestrator. The Ring Leader calls it when:

- Library search returns insufficient results for a task (Path B — archetype generation)
- A retrieved soul requires a targeted mutation before deployment
- Population differentiation enforcement requires remutation of a flagged soul

The algorithm inputs and process are unchanged from v1.1. The trigger point and ownership are the changes.

**Important implication:** Because the Ring Leader triggers mutation and tracks the outcomes, the Ring Leader's own library entry accumulates a mutation decision history over time. A Ring Leader that consistently makes good mutation calls — selecting the right operation, applying it to the right directive, producing above-benchmark performance — builds a demonstrable mutation competency that the God Layer can identify and promote on.

---

## 13. Updated System Layer Diagram

| Layer | Name | Function under Option A |
|---|---|---|
| Layer 1 | Orchestration | Parses objective, produces task graph, validates budget and tool grants, spawns Ring Leader with mission brief. Steps back. |
| Layer 2 | Ring Leader | Searches soul library, assembles population, spawns agents, coordinates execution, synthesises run for council. The run's intelligence. |
| Layer 3 | Agent Execution | Isolated OpenClaw worker agents execute tasks with assigned SOUL.md configurations |
| Layer 4 | Council | Evaluates Ring Leader on both coordination and soul selection dimensions, plus worker agent task performance |
| Layer 5 | God Layer | Reads verdicts, manages library, drives mutations, promotions, retirements |

---

## 14. What Does Not Change from v1.1

- Inter-agent communication protocol (sessions_list, sessions_history, sessions_send)
- Worker agent minimum parallel constraint (3 minimum, Ring Leader additional)
- Council structure, weighting, and verdict types
- Human confirmation gate for Promote and Retire verdicts
- Inviolable constitution layer — present in Ring Leader SOUL.md and all worker agent SOUL.md
- Negative signal register and write-eligibility rules
- Pioneer designation mechanics for novel tasks
- Security constraints — all agents including Ring Leader have zero direct network access
- Army Builder UX steps 1, 2, 3 (objective, composition, tool grants)
- Post-run leaderboard structure

---

## 15. Open Questions (new, specific to Option A)

| Question | Priority |
|---|---|
| What is the right similarity threshold for soul library search (0.78 suggested)? Needs calibration against library depth at different task categories. | High |
| How does the Ring Leader handle a task graph where one task's optimal soul population is in direct conflict with the budget envelope — does it surface this before spawning or attempt internal resolution first? | High |
| Should the Ring Leader's soul selection decisions be shown to users in the pre-flight dashboard, or is this too much cognitive load before a run? What level of detail is right? | High |
| When the Ring Leader applies a targeted pre-deployment mutation, who owns the resulting soul for library purposes — the Ring Leader that mutated it, or the original parent? | Medium |
| If a Ring Leader repeatedly selects the same soul for the same task category across multiple runs, is that a sign of strong selection judgement or a sign of library search being too narrow? How do we detect and correct the latter? | Medium |
| Should soul selection quality be visible to users post-run, or is it internal signal only? A Ring Leader leaderboard showing selection accuracy over time could be a powerful product surface. | Medium |
| What happens to the soul selection log if the Ring Leader fails mid-run before synthesis — is partial selection data recoverable and useful for the library? | Low |

---

*Akasa Ring Leader PRD v1.0*
*February 2026 | CONFIDENTIAL*
*Supersedes Ring Leader section of Akasha PRD v1.1 under Option A architecture*
