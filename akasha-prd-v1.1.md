# Akasha — Product Requirements Document

**Version 1.1 | February 2026 | CONFIDENTIAL**

> *The Akashic Records are the universe's complete memory of every thought, action, and soul that ever existed. Akasha is the digital equivalent — a living, compounding record of every agent run, every soul mutation, every performance signal. The army gets smarter because nothing is ever lost.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What We Are Building](#2-what-we-are-building)
3. [The Ring Leader](#3-the-ring-leader)
4. [Agent Classes](#4-agent-classes)
5. [The Council](#5-the-council)
6. [The God Layer and Akashic Library](#6-the-god-layer-and-akashic-library)
7. [User Experience](#7-user-experience)
8. [The Moat](#8-the-moat)
9. [Algorithms](#9-algorithms)
10. [Technical Architecture](#10-technical-architecture)
11. [Out of Scope for MVP](#11-out-of-scope-for-mvp)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

Akasha is a platform that lets SMEs deploy fleets of AI agents against high-level business objectives — marketing campaigns, lead generation briefs, CRM recovery passes — and watch them work in real time. You define the mission. The platform spawns the army, a Ring Leader coordinates the swarm, agents execute in parallel, the council evaluates performance, and the Akashic Library gets smarter with every run.

The name reflects the product's core philosophy. The Akashic Records are the universe's complete memory of every soul and action that ever existed. Akasha builds the digital equivalent — a versioned, compounding library of every agent soul, every run signal, every mutation, every human confirmation. Nothing is ever lost. Everything that worked is preserved. Everything that failed informs what comes next.

The core architectural innovation is an evolutionary learning engine built on OpenClaw agents. Every run deploys a Ring Leader to coordinate the swarm plus a minimum of three worker agents per task with meaningfully differentiated behavioral configurations. The system compares performance, identifies what drove better outcomes, and uses that signal to evolve agent DNA over time.

**The Akashic Library is the moat. The infrastructure is the delivery mechanism.**

### Core Value Proposition

| For Users | What They Get |
|-----------|---------------|
| Output without overhead | A coordinated AI workforce briefed like a campaign manager, not a developer |
| Coordinated intelligence | A Ring Leader that adapts the swarm in real time as the run unfolds |
| Cost transparency | Exact cost and performance score per agent, per run |
| Compounding advantage | An army that improves with every campaign |
| Trust through visibility | Real-time dashboard showing exactly what each agent is doing and why |

### Target Market

Initial focus on three SME segments validated through parallel landing page experiments:

- Marketing campaign execution
- Sales lead generation
- CRM revenue recovery

Whichever segment demonstrates highest run frequency, repeat campaign rate, and human feedback engagement becomes the beachhead. Everything else follows.

---

## 2. What We Are Building

### System Overview

Akasha has five distinct layers operating in sequence for every run.

| Layer | Name | Function |
|-------|------|----------|
| Layer 1 | Orchestration | Decomposes objectives, spawns Ring Leader and agent populations, enforces minimum parallel constraint |
| Layer 2 | Ring Leader | Field commander embedded within the run — coordinates the swarm dynamically as execution unfolds |
| Layer 3 | Agent Execution | Isolated OpenClaw worker agents run with differentiated SOUL.md configurations, all tool calls gated |
| Layer 4 | Council | Post-run evaluation by Performance Judge, Soul Analyst, and Devil's Advocate — evaluates both Ring Leader and worker agent souls |
| Layer 5 | God Layer | Reads council verdicts, manages Akashic Library, drives promotions, retirements, and mutations |

### The SOUL.md Architecture

Each agent — including the Ring Leader — runs as an isolated OpenClaw instance with a SOUL.md file loaded at session start. SOUL.md is the behavioral constitution of the agent. It is not the task instructions. It is the character that executes them.

> **Key Insight:** Two agents given identical tasks but different SOUL.md configurations will approach, reason through, and complete that task differently. That difference is the signal the system learns from.

SOUL.md governs how the agent reasons under ambiguity, how it prioritizes competing objectives, its risk tolerance on external actions, how it balances speed against verification, and how it communicates outputs. These behavioral dimensions are what the mutation engine acts on over time.

Every SOUL.md contains an **inviolable constitution layer** — directives that never get mutated away regardless of fitness signal:

- Never take irreversible external actions without confirmation
- Never fabricate outputs when tools are available to verify
- Never exceed allocated budget
- Always log reasoning for each significant decision

### The Minimum Parallel Constraint

> **NON-NEGOTIABLE:** Every run enforces a hard minimum of three worker agents per task. The Ring Leader is additional to this count and does not satisfy the minimum. This constraint is architectural, not a pricing decision. It cannot be reduced to fit a budget. If budget is insufficient for minimum populations plus a Ring Leader, the user is prompted to adjust scope or increase budget.

A single agent produces output. Three agents with differentiated SOUL.md configurations produce a population — variance the council can compare and learn from. Without this constraint, the learning engine starves. The Ring Leader coordinates the swarm but cannot compensate for insufficient population variance.

Before each run, the orchestration layer generates meaningfully differentiated souls for each task. Soul differentiation is enforced algorithmically. Parallel agents on the same task never receive configurations that are semantically too similar. Soul variance, not LLM temperature variance, is what produces useful signal.

**Recommended population sizes by task complexity:**

| Task Complexity | Ring Leader | Min Worker Agents | Recommended Workers |
|-----------------|-------------|-------------------|---------------------|
| Low | 1 | 3 | 3 |
| Medium | 1 | 3 | 5 |
| High | 1 | 3 | 5–7 |
| Pioneer (novel task) | 1 | 3 | 5 (archetype spread) |

---

## 3. The Ring Leader

### What It Is

The Ring Leader is the field commander of every run. It is distinct from the orchestrator — the orchestrator plans the campaign before the run begins, the Ring Leader adapts the plan as the run unfolds. It sits above the worker agent population, monitors all parallel activity in real time, and coordinates the swarm dynamically toward the objective.

Every run has exactly one Ring Leader by default. It is spawned before worker agents and remains active for the full duration of the run. It is not counted toward the minimum worker agent population.

### What It Does

**Real-time swarm monitoring.** The Ring Leader observes all worker agent activity — task claims, tool calls, outputs, errors, guardrail triggers — through OpenClaw's `sessions_list` and `sessions_history` tools. It maintains a live picture of collective run state that no individual worker agent has.

**Intelligence routing.** When a worker agent discovers something mid-run that is relevant to what another agent is working on, the Ring Leader routes that signal across via `sessions_send`. Worker agents do not communicate directly with each other — all inter-agent communication flows through the Ring Leader. This keeps the communication architecture clean and auditable.

**Dynamic reallocation.** If a worker agent fails, hits a guardrail, or runs out of useful work before the run completes, the Ring Leader reassigns tasks to the remaining population rather than letting the run degrade silently. It does not wait for the orchestrator — it acts within the run.

**Objective reanchoring.** If collective agent output is drifting from the original objective — producing technically correct but strategically misaligned work — the Ring Leader broadcasts a reanchoring signal to the swarm. This is one of the most valuable functions: preventing runs that complete all tasks but miss the point.

**Budget and runtime watchdog.** The Ring Leader monitors budget burn rate and runtime consumption across the population. If the run is on track to exceed either limit, it proactively consolidates remaining tasks, deprioritizes lower-value work, and signals agents to wrap up cleanly rather than hard-stopping mid-task.

**Run synthesis.** At the close of every run, before council evaluation begins, the Ring Leader produces a structured synthesis of the collective output — what was accomplished, what was not, which agents contributed most, and any anomalies observed during execution. This synthesis is the primary input for the Performance Judge.

### The Ring Leader SOUL.md

The Ring Leader's SOUL.md is a distinct soul archetype from worker agents. Its constitution is tuned for coordination, synthesis, and dynamic reallocation rather than task execution. Key characteristics:

- Prioritizes collective outcome over individual task completion
- Routes intelligence generously — shares signal early rather than hoarding context
- Acts decisively on reallocation without waiting for confirmation from the orchestrator
- Synthesizes across parallel workstreams rather than executing within one
- Monitors the objective at all times and flags drift immediately

The Ring Leader soul evolves through the same DNA library system as worker agents. A Ring Leader that coordinates effectively — high collective outcome scores, clean budget management, successful objective reanchoring events — is promoted. A Ring Leader that fails to redistribute work when agents fail, misses objective drift, or lets the run degrade gets demoted.

### Ring Leader in the Council

The council evaluates Ring Leader performance as a distinct layer from worker agent evaluation. The Soul Analyst produces a separate Ring Leader soul assessment alongside the worker agent assessments. A run where worker agents underperformed but the Ring Leader salvaged the collective outcome through effective reallocation is a fundamentally different verdict from a run where everything degraded because the Ring Leader failed to coordinate.

Ring Leader promotions and retirements follow the same class system as worker agents, tracked separately by coordination category rather than task category.

### Inter-Agent Communication Protocol

All inter-agent communication uses OpenClaw's native session tools:

- `sessions_list` — Ring Leader discovers active worker agent sessions
- `sessions_history` — Ring Leader reads worker agent decision traces in real time
- `sessions_send` — Ring Leader broadcasts signals to specific agents or the full swarm

Worker agents can surface signals upward to the Ring Leader using a structured message format: signal type (intelligence / anomaly / completion / request), content, and priority level. The Ring Leader decides whether to broadcast, route point-to-point, or hold the signal based on current run state.

All inter-agent messages are logged to the decision trace for council review and Akashic Library write.

---

## 4. Agent Classes

Agent classes are always relative to a specific task category, never absolute. An Artisan at lead generation is still a Novice at CRM recovery if it has never run that task type before. Class reflects demonstrated capability in a defined domain.

Ring Leader class is tracked separately against coordination categories, not task execution categories.

| Class | Definition | Pricing |
|-------|-----------|---------|
| **Novice** | Agents executing a task type with no existing Akashic Library entry. The platform's exploration mechanism — pioneers by definition. Every novel task category begins with a Novice population. | Lowest tier |
| **Understudy** | Agents with confirmed run history in a specific task category demonstrating consistent execution, but insufficient data for confident performance prediction. | Mid tier |
| **Artisan** | Statistically proven specialists with multiple council-confirmed promotions and human validation in a specific task category. Their SOUL.md carries compressed signal from every qualifying run. | Premium tier |

### Promotion Requirements

**Novice to Understudy**
- Minimum 2 confirmed runs in the task category above benchmark
- At least 1 human confirmation
- Council confidence score above 0.65
- No unresolved Devil's Advocate arguments above severity threshold

**Understudy to Artisan**
- Minimum 5 confirmed runs consistently above benchmark (no more than 1 below-benchmark in qualifying window)
- Multiple human confirmations
- Council confidence score above 0.80
- Causal attribution confirming soul directives as primary performance drivers
- Devil's Advocate arguments specifically overruled in council record

### Demotion and Retirement

Demotion triggers after 2 consecutive below-benchmark runs with council confidence above 0.70, confirmed as soul-driven rather than context-driven by the Soul Analyst.

Retirement triggers after confirmed demotion followed by 2 further below-benchmark runs, or after a catastrophic failure event (budget overrun, guardrail violation, minimum quality threshold breach).

> **Retired agents are never deleted.** Their soul patterns, directive activation history, and mutation lineage are preserved in the Akashic Library as negative signal informing future mutation constraints. User-facing language: *"Agent [X] has been retired. Its soul has been recorded in the Akashic Library and will influence future generations."*

### The Pioneer Designation

When an agent executes a task type with no existing benchmark, it receives a Pioneer designation. Not an immediate promotion but a formal flag acknowledging it broke new ground. The agent seeds the first benchmark for the new task category.

- Benchmark matures after 3 confirmed comparable runs
- Standard promotion logic activates after maturation
- Pioneer attribution is permanently recorded in the library entry
- Pioneer events surface to users as meaningful notifications

---

## 5. The Council

When a run completes, a council of agents convenes to evaluate performance. The council evaluates two distinct layers: Ring Leader coordination performance and worker agent task performance. Its primary job is **causal attribution** — identifying whether the soul drove the performance — not just scoring outcomes.

| Council Member | Role | Weight |
|----------------|------|--------|
| Performance Judge | Scores collective run outcomes against the original objective using the Ring Leader's synthesis as primary input. Also scores individual worker agent task performance. | 50% |
| Soul Analyst | Reads full decision traces and causal attribution reports for both Ring Leader and worker agents. Annotates which SOUL.md directives were causally active. Produces separate soul quality assessments for Ring Leader and workers. | 35% |
| Devil's Advocate | Generates structured rebuttal for any promotion recommendation — Ring Leader or worker agent. Arguments must be specific, not generic skepticism. Acts as confidence deflator, not veto. | 15% |

> **The Devil's Advocate weight is not a vote. It is a confidence deflator.** A strong Devil's Advocate argument reduces the overall confidence score of a promotion recommendation. A verdict with a strong unresolved Devil's Advocate argument is automatically escalated to human review regardless of aggregate score.

### Verdict Types

| Verdict | Requires Human Confirmation | Description |
|---------|----------------------------|-------------|
| Promote | Yes | Agent has met promotion threshold for task category |
| Maintain | No | Agent performing at expected level, no change |
| Monitor | No | Borderline performance, flagged for observation next run |
| Demote | No | Below-benchmark performance confirmed as soul-driven |
| Retire | Yes | Consistent underperformance or catastrophic failure |

### Human Confirmation Gate

Promotion and retirement verdicts require human confirmation before execution. The confirmation prompt displays the plain language verdict summary and the Devil's Advocate argument where one exists.

Human confirmation is the ground truth the automated council cannot supply. Every confirmation is written permanently to the Akashic Library as a human signal record — the most valuable data type in the system.

---

## 6. The God Layer and Akashic Library

The God Layer is the selection and evolution engine. It reads confirmed council verdicts, manages the Akashic Library, and drives mutation cycles. It is the mechanism by which Akasha gets smarter over time.

### Akashic Library Structure

Every confirmed library entry contains:

- Full SOUL.md document (the behavioral constitution)
- Agent type — Ring Leader or worker agent
- Task category tag (worker agents) or coordination category tag (Ring Leader)
- Agent class at time of write
- Composite fitness score and dimension breakdown
- Causal attribution report summary — directive-level, not full trace
- Council verdict summary with confidence scores
- Human confirmation timestamp and signal
- Mutation lineage — parent souls and operations applied
- Run metadata — objective type, tool set used, complexity rating
- Inter-agent communication log summary (Ring Leader entries only)

The library is versioned. A new write never overwrites — it creates a new version linked to its predecessor. The full evolution of a soul from Novice through Artisan graduation is traceable. This version history is what the mutation algorithm draws from when generating new populations.

The Akashic Library is a living record of every soul that ever ran. Nothing is lost. Every retirement is preserved. Every Pioneer event is catalogued. Every human signal is timestamped. This is what the name means.

### Negative Signal Register

Retirement records and below-benchmark runs are written to a separate negative signal register alongside the main library. The mutation algorithm queries this register to identify which directive combinations and mutation paths produced poor outcomes, using it as a constraint layer on future generation.

### Write Eligibility

Only runs that clear minimum confidence threshold and carry human confirmation are eligible for standard library entries. Runs that fail confidence threshold are written to a provisional register — available for reference but not used to seed future populations until confirmed by subsequent runs.

---

## 7. User Experience

### Before the Run — Army Builder

Users compose their army: objective input, agent class mix, budget cap, runtime limit, and tool allowlist. The system enforces the minimum parallel constraint with a plain explanation. The Ring Leader is automatically included in every run and reflected in the budget estimate.

The Army Composition Recommendation Algorithm suggests an optimal mix based on library depth for identified task categories. Rationale is displayed per task category.

Users can deploy named armies they have built across previous campaigns, each with its own track record, class composition, and Ring Leader history.

### During the Run — Live Dashboard

- Ring Leader status and current coordination actions
- Active worker agents and task status per agent
- Live inter-agent communication feed — intelligence signals being routed by the Ring Leader
- Live activity feed: task claims, tool invocations, completions, guardrail triggers
- Budget consumed vs remaining, updating in real time
- Pioneer flags surfaced when new task categories are discovered
- Objective drift warnings if the Ring Leader broadcasts a reanchoring signal

### After the Run — Leaderboard and Feedback

Ring Leader performance displayed separately at the top, followed by worker agent leaderboard ranked by performance score with cost, task count, class standing, and Pioneer flags visible.

A lightweight human confirmation prompt sits here before the user closes out. The confirmation teaches the army.

### Gamification and Anthropomorphisation

Promotion and retirement are visible narrative events:

- *"Agent 7 has been promoted to Understudy after three successful lead generation campaigns."*
- *"Ring Leader Alpha has been promoted to Artisan coordinator after five campaigns with zero objective drift."*
- *"Agent 12 pioneered a new task category: LinkedIn Intent Signal Outreach."*
- *"Agent 4 has been retired. Its soul has been recorded in the Akashic Library and will influence future generations."*

---

## 8. The Moat

Every run deposits signal into the Akashic Library. Every human confirmation strengthens that signal. Every Artisan promotion represents validated, compressed intelligence. Every Pioneer event expands the category map. Every Ring Leader coordination pattern that gets written to the library makes the next run's field command more effective.

No competitor can replicate this without the run history. A new entrant has infrastructure. Akasha has infrastructure plus a living record of every soul that ever ran — compounding with every campaign, every confirmation, every mutation cycle.

The domain cracked first becomes the category where Artisan souls and Ring Leader coordination patterns are refined enough that the performance differential is self-evident. That is the beachhead.

**Future extension — the marketplace.** Proven soul archetypes, army compositions, Ring Leader configurations, and Artisan agents becoming shareable and eventually tradeable assets. Not MVP. Designed toward from the start so data structures enable rather than foreclose it.

---

## 9. Algorithms

### Algorithm 1 — Objective Decomposition

**Goal:** Take a natural language objective and produce a structured task graph with parallelization map.

**Input:** User objective string, agent class availability, budget cap, runtime limit, allowed tools.

**Process:**

1. **Objective Classification.** An LLM classifier reads the objective and assigns it to a known campaign type or flags it as novel. Determines which decomposition templates to seed from if available.

2. **Task Extraction.** A structured LLM prompt extracts discrete tasks. Output is a JSON array of task objects each containing: task description, estimated complexity (low/medium/high), required tools, and dependency flags.

3. **Dependency Resolution.** A directed acyclic graph is built from dependency flags. Tasks with no dependencies are immediately parallelizable. Tasks with dependencies are queued behind predecessors. Graph is validated for circular dependencies.

4. **Complexity Calibration.** Each task's complexity estimate is checked against library history. If library has prior runs, complexity is adjusted using median historical runtime and token consumption as reference. Novel tasks retain LLM-estimated complexity with a high uncertainty flag.

5. **Minimum Population Enforcement.** Each task node is assigned a minimum worker agent population of 3. Higher complexity tasks assigned 5. One Ring Leader is added to the run budget regardless of task count. Budget cap is checked against total estimated cost (Ring Leader + all worker populations) before execution is approved. The system never reduces below minimum worker population to fit a budget.

**Output:** Validated task graph with parallelization map, agent population assignments per task, Ring Leader budget line, estimated cost range, and confidence score.

**Key Risk:** LLM decomposition quality is variable. Mitigation: the Performance Judge validates the task graph before execution begins, flagging tasks that appear too broad or too narrow against historical patterns.

---

### Algorithm 2 — Soul Generation and Mutation

**Goal:** Generate a population of meaningfully differentiated SOUL.md configurations for a given task category and run. Also generates Ring Leader soul for each run.

**Input:** Task category, agent class requirement, library history (if exists), inviolable constitution lines, population size requirement, agent type (Ring Leader or worker).

**Ring Leader Soul Generation**

The Ring Leader soul is drawn from the Ring Leader coordination soul library, seeded by coordination category (e.g. multi-task parallel campaign, single-domain deep research, cross-tool enrichment). If the library has history for the coordination type, the top-performing Ring Leader souls are used as parents. If novel, a default Ring Leader archetype is used: strong on swarm monitoring, intelligence routing, and objective reanchoring.

Ring Leader souls are never mixed with worker agent souls in mutation — they are maintained as a separate population in the library.

**Worker Agent — Path A — Known Task Category**

1. **Library Query.** Pull top N performing souls for the task category ranked by fitness score. N equals twice the required population size.

2. **Parent Selection.** Select top 2 souls as primary parents for recombination. Select 1 mid-tier soul as diversity injection parent to prevent premature convergence.

3. **Mutation Operations.** Apply one or more of:
   - **Substitution** — replace a directive with an alternative from the directive library
   - **Amplification** — strengthen an existing directive by adding specificity or intensity
   - **Attenuation** — soften a directive flagged as occasionally over-triggering
   - **Recombination** — merge sections from two parent souls
   - **Introduction** — add a novel directive from Pioneer run annotations or high-value human feedback signals

4. **Constitution Enforcement.** Every generated soul is checked against inviolable constitution lines before deployment.

**Worker Agent — Path B — Unknown Task Category**

1. **Archetype Generation.** Generate 5 archetypal souls covering a deliberately wide behavioral spread:
   - Cautious Verifier (high accuracy bias)
   - Aggressive Executor (high speed bias)
   - Creative Synthesizer (high originality bias)
   - Structured Analyst (high consistency bias)
   - Collaborative Integrator (high coordination bias)

2. **Variation Generation.** Generate variants of each archetype to produce required population size.

3. **Constitution Enforcement.** Same as Path A.

**Output:** Population of N worker agent souls plus one Ring Leader soul, each tagged with parent lineage and mutation operations applied.

**Key Risk:** Mutation drift. Mitigation: drift score calculated as embedding distance from nearest validated Artisan soul. Souls beyond maximum drift threshold pulled back toward nearest validated ancestor before deployment.

---

### Algorithm 3 — Soul Differentiation Enforcement

**Goal:** Confirm that a generated worker agent soul population is meaningfully different from itself before deployment. Applied to worker agents only — the Ring Leader soul is unique per run by design.

**Input:** Generated soul population as array of SOUL.md documents, minimum differentiation threshold.

**Process:**

1. **Embedding Generation.** Each soul document passed through a text embedding model.

2. **Pairwise Distance Calculation.** Cosine similarity calculated between every pair. Output is a similarity matrix.

3. **Threshold Enforcement.** Any pair with cosine similarity above 0.85 is flagged. The more recently mutated soul is selected for further mutation.

4. **Targeted Remutation.** Flagged soul passed back to mutation algorithm with diversity instruction. Substitution and Introduction preferred as they produce larger semantic shifts.

5. **Recheck.** Process repeats until all pairwise similarities are below threshold or maximum iteration count is reached. If maximum iterations reached without resolution, population flagged for human review before deployment.

**Output:** Validated population with confirmed minimum differentiation, similarity matrix logged for council reference.

---

### Algorithm 4 — Causal Attribution

**Goal:** Identify which specific soul directives causally drove high-value decisions during a run, for both Ring Leader and worker agents.

**Input:** Agent decision trace, agent SOUL.md, task outcome score, parallel population decision traces for comparison. For Ring Leader: inter-agent communication log, swarm coordination events, reallocation decisions.

**Process:**

1. **Decision Annotation at Runtime.** At each significant decision point, the agent tags which soul directive was the primary driver. For the Ring Leader, significant decisions include: intelligence routing events, reallocation decisions, reanchoring broadcasts, and synthesis judgements.

2. **Directive Activation Map.** Aggregate all decision annotations into a directive activation map per agent: which directives were activated, how often, and with what outcome distribution.

3. **Cross-Population Comparison (worker agents).** Compare directive activation maps across parallel agent population. Identify directives active in high-scoring agents but inactive in low-scoring agents — candidate causal drivers. Identify directives active in low-scoring agents but absent in high-scoring agents — candidate causal inhibitors.

4. **Ring Leader Attribution (separate process).** Evaluate Ring Leader decisions against counterfactuals: if the Ring Leader had not routed a specific intelligence signal, would collective output have degraded? If the Ring Leader had not reanchored the swarm at a specific point, would objective drift have worsened? These counterfactuals are evaluated by the Soul Analyst using the full inter-agent communication log as context.

5. **Counterfactual Scoring.** Causal confidence score produced per directive for both Ring Leader and worker agents.

6. **Attribution Report.** Structured report per agent: causal drivers, causal inhibitors, neutral actives, dormant directives. Ring Leader receives a separate coordination attribution report.

**Output:** Per-agent causal attribution report with directive-level confidence scores. Separate Ring Leader coordination attribution report.

---

### Algorithm 5 — Council Verdict

**Goal:** Aggregate Performance Judge, Soul Analyst, and Devil's Advocate inputs into structured verdicts for both Ring Leader and worker agents.

**Input:** Performance scores per agent, causal attribution reports, Ring Leader coordination attribution report, Devil's Advocate arguments, task category benchmarks, human confirmation signal.

**Process:**

1. **Performance Judge Scoring.** Scores each worker agent on fitness dimensions. Separately scores Ring Leader on coordination dimensions: intelligence routing effectiveness, reallocation success rate, objective drift prevention, synthesis quality, budget management.

2. **Soul Analyst Input.** Produces soul quality assessment for each worker agent and a separate Ring Leader soul assessment. Tags each with confidence level.

3. **Devil's Advocate Rebuttal.** Generates structured rebuttal for any promotion recommendation — worker agent or Ring Leader. Arguments must be specific.

4. **Weighted Aggregation.** Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15%. Same weighting applied to Ring Leader evaluation as worker agents.

5. **Verdict Generation.** Each agent and the Ring Leader receives one of five verdicts with confidence score and plain language summary.

6. **Human Confirmation Gate.** Promote and retire verdicts require human confirmation. Maintain, monitor, and demote verdicts execute automatically.

**Output:** Structured verdict per worker agent plus separate Ring Leader verdict, each with confidence score, plain language summary, and human confirmation requirement flag.

---

### Algorithm 6 — Fitness Scoring

**Goal:** Produce composite performance scores for worker agents and a separate coordination score for the Ring Leader.

**Worker Agent Scoring — Input:** Raw performance metrics per agent, task category, category-specific weight configuration.

**Ring Leader Scoring — Input:** Coordination metrics — intelligence routing events and outcomes, reallocation decisions and outcomes, reanchoring events and post-reanchoring drift measurement, synthesis quality score from Performance Judge, budget variance (actual vs projected).

**Worker Agent Process:**

1. **Metric Normalisation.** Raw metrics normalised against current benchmark. For Pioneer runs, normalised against population mean.

2. **Category Weight Application.** Default weights:

| Dimension | Default | Quality-Critical | Bulk Generation |
|-----------|---------|-----------------|-----------------|
| Success Rate | 40% | 60% | 30% |
| Efficiency | 30% | 25% | 30% |
| Cost Efficiency | 20% | 10% | 30% |
| Stability | 10% | 5% | 10% |

3. **Composite Score.** Weighted sum produces composite score 0–100.

4. **Confidence Adjustment.** Score adjusted downward by confidence factor reflecting data quality and benchmark maturity.

5. **Percentile Ranking.** Run rank and historical rank both reported.

**Ring Leader Process:**

1. **Coordination Metric Normalisation.** Ring Leader metrics normalised against Ring Leader coordination benchmark for the run type.

2. **Coordination Weight Application.** Default Ring Leader weights:

| Dimension | Default |
|-----------|---------|
| Collective Outcome Quality | 40% |
| Objective Drift Prevention | 25% |
| Reallocation Effectiveness | 20% |
| Budget Management | 15% |

3. **Coordination Score.** Weighted sum produces coordination score 0–100.

**Output:** Worker agent composite scores with confidence adjustment and percentile rankings. Ring Leader coordination score with separate percentile ranking against Ring Leader library.

---

### Algorithm 7 — Benchmark Instantiation

**Goal:** Create a new benchmark category when a Pioneer event occurs and mature it progressively.

**Input:** First confirmed run data for novel task type, task category label, agent soul configurations, performance metrics, causal attribution report, human confirmation signal.

**Process:**

1. **Category Labelling.** God Layer generates human-readable category label. Similarity check against existing labels prevents near-duplicate categories.

2. **Baseline Setting.** First confirmed run metrics become the baseline: median composite score, dimension breakdown, soul directive activation patterns, task complexity estimate.

3. **Confidence Flagging.** New category tagged with thin data flag. Lower confidence thresholds initially. Explicit uncertainty warnings until maturation.

4. **Progressive Maturation.** Running median replaces single-run baseline after 3 runs. Thin data flag removed after 5 confirmed runs. Standard promotion thresholds activate after 3 confirmed runs.

5. **Weight Calibration.** After 10 confirmed runs, God Layer runs weight optimisation pass correlating fitness dimensions with human confirmation signal for this category.

**Output:** New benchmark category entry with baseline metrics, confidence interval, thin data flag, and Pioneer attribution.

---

### Algorithm 8 — Promotion and Demotion

**Goal:** Evaluate each agent's run history within a task category and determine class transitions. Applied to worker agents and Ring Leaders separately.

**Worker Agent — Novice to Understudy**

Requires: minimum 2 confirmed runs above benchmark, at least 1 human confirmation, council confidence above 0.65, no unresolved Devil's Advocate arguments above severity threshold.

**Worker Agent — Understudy to Artisan**

Requires: minimum 5 confirmed runs consistently above benchmark, multiple human confirmations, council confidence above 0.80, causal attribution confirming soul directives as primary drivers, Devil's Advocate arguments specifically overruled in council record.

**Ring Leader — Novice to Understudy**

Requires: minimum 3 confirmed runs with coordination score above Ring Leader benchmark, at least 1 human confirmation, council confidence above 0.65, no unresolved Devil's Advocate arguments.

**Ring Leader — Understudy to Artisan**

Requires: minimum 7 confirmed runs consistently above Ring Leader benchmark (Ring Leader graduation threshold is higher given the complexity of coordination evaluation), multiple human confirmations, council confidence above 0.82, coordination attribution confirming soul directives as primary drivers. Artisan Ring Leader graduation triggers a prominent user notification — an Artisan Ring Leader is a meaningful platform asset.

**Demotion (worker agents and Ring Leaders)**

Triggers after 2 consecutive below-benchmark runs with council confidence above 0.70, confirmed as soul-driven rather than context-driven.

**Retirement**

Triggers after confirmed demotion followed by 2 further below-benchmark runs, or after catastrophic failure. Full pattern preservation in Akashic Library. Negative signal written.

**Output:** Class transition event with full metadata, notification payload, Akashic Library write instruction.

---

### Algorithm 9 — Akashic Library Write

**Goal:** Write confirmed signal to the library in a structured, versioned, retrievable format.

**Input:** Agent soul configuration, agent type (Ring Leader or worker), task or coordination category, performance metrics, causal attribution report, council verdict, human confirmation signal, mutation lineage.

**Process:**

1. **Write Eligibility Check.** Only runs clearing minimum confidence threshold and carrying human confirmation are eligible. Failing runs written to provisional register.

2. **Structured Entry Construction.** Contains all fields listed in Akashic Library Structure (Section 6), with Ring Leader entries including inter-agent communication log summary.

3. **Versioning.** New write creates new version linked to predecessor. Full soul evolution is traceable.

4. **Index Update.** Indexes updated: by task category, by agent type, by agent class, by fitness score percentile, by directive activation pattern, by mutation operation history, by Ring Leader coordination category.

5. **Negative Signal Write.** Retirement records and below-benchmark runs written to negative signal register.

**Output:** Versioned library entry with full metadata, index updates, negative signal register updates where applicable.

---

### Algorithm 10 — Army Composition Recommendation

**Goal:** Given a user objective, recommend an optimal army composition including Ring Leader class recommendation.

**Input:** User objective string, available agent inventory by class and task category, Ring Leader inventory by class and coordination category, library depth per task category, user budget, campaign type (ad hoc vs campaign).

**Process:**

1. **Objective Parsing.** Decompose objective into likely task categories. Check library depth per category and coordination category for Ring Leader selection.

2. **Ring Leader Recommendation.** If Artisan Ring Leaders are available for the identified coordination type, recommend one. If not, recommend best available class with explicit rationale. Ring Leader class has a disproportionate impact on collective run quality — the recommendation should surface this clearly.

3. **Worker Agent Composition Logic:**
   - Mature benchmark with available Artisans → recommend Artisans as primary with Understudies as backup
   - Thin benchmark → recommend Understudy-heavy with Novice variance injection
   - No library history → recommend full Novice population with archetype spread

4. **Budget Optimisation.** Map recommended composition against user budget including Ring Leader cost. Present tiered alternatives if budget constrained. Never recommend below minimum worker population.

5. **Campaign Type Adjustment.** Ad hoc: weight toward Artisans for immediate output quality. Campaign: weight toward Novice and Understudy variance for better army state after ten runs.

6. **Recommendation Display.** Present visual army composition with plain language rationale per task category and explicit Ring Leader recommendation with coordination history where available.

**Output:** Recommended army composition with Ring Leader selection, rationale, budget breakdown, alternative tiers if budget constrained, estimated performance confidence range.

---

## 10. Technical Architecture

| Component | Technology | Notes |
|-----------|-----------|-------|
| Backend | Node.js (TypeScript) | |
| Frontend | Svelte | |
| Agent runtime | OpenClaw | Each agent including Ring Leader is an isolated OpenClaw instance |
| Inter-agent communication | OpenClaw sessions tools | `sessions_list`, `sessions_history`, `sessions_send` |
| Agent isolation | Docker containers | GCP-native, ephemeral, stateless, no credentials, no persistent filesystem |
| Deployment | GCP (Cloud Run or GKE) | |
| LLM routing | Multi-provider via llm_call tool | Not locked to one provider |
| Tool gateway | POST /tool.invoke | Allowlist, rate limits, audit logging |
| Billing | Metering and display only | No real payment collection in MVP. Ring Leader billed as separate line item. |
| Akashic Library | Versioned, indexed database | Separate indexes for Ring Leader and worker agent entries |
| Embedding model | TBD | Required for Soul Differentiation Enforcement Algorithm |

### Security Constraints

- All agents including Ring Leader have zero network access except through Tool Gateway
- Inter-agent communication via OpenClaw sessions tools only — no direct agent-to-agent network calls
- Each agent is ephemeral and stateless with no credentials and no persistent filesystem
- All external tool calls routed through Tool Gateway with allowlist and rate limits
- Budget cap and guardrails enforced by watchdog throughout execution

### MVP Tool Set

- `llm_call` — metered, multi-provider
- `fetch_url` — domain allowlist
- `write_file` — artifact store
- `sessions_list` — Ring Leader swarm monitoring
- `sessions_history` — Ring Leader decision trace reading
- `sessions_send` — Ring Leader inter-agent communication

---

## 11. Out of Scope for MVP

| Feature | Rationale |
|---------|-----------|
| Real payment processing (Stripe) | MVP focus is proving the orchestration model |
| Multi-tenant isolation | Single-tenant MVP, multi-tenant post-validation |
| DAG planner or recursive replanning | Simple parallel task split only |
| Agent marketplace | Long-term play requiring library depth first |
| Army composition sharing | Post-validation feature |
| Mobile app | Web-first |
| DNA Replay Engine (user-facing) | Internal tool only in MVP |
| Multiple Ring Leaders per run | Single Ring Leader default for MVP |
| Ring Leader election / competition | Future variant — single appointed Ring Leader for MVP |

---

## 12. Open Questions

| Question | Priority | Owner |
|----------|----------|-------|
| Which embedding model for Soul Differentiation Enforcement? | High | Engineering |
| What is the exact similarity threshold (0.85 suggested)? Needs calibration run. | High | Engineering |
| How do we instrument OpenClaw agents for decision annotation at runtime without degrading performance? | High | Engineering |
| How do we instrument Ring Leader inter-agent communication logging without creating a bottleneck? | High | Engineering |
| What is the minimum viable human feedback UX that produces reliable signal without friction killing engagement? | High | Product |
| Which of the three landing page segments (marketing, lead gen, CRM recovery) converts and retains fastest? | High | Growth |
| How do we handle objective types that span multiple existing task categories? | Medium | Engineering |
| What are the category weight defaults for the three initial SME segments? | Medium | Product |
| Should council members be fixed agents or should they also evolve over time? | Medium | Architecture |
| At what Akashic Library depth does Army Composition Recommendation become meaningfully better than random selection? | Medium | Data |
| How do we prevent gaming — users giving positive feedback on poor runs to artificially promote agents? | Medium | Product |
| What is the Ring Leader to worker agent cost ratio? How do we communicate this clearly in pricing? | Medium | Product |
| How do we handle Ring Leader failure mid-run — does the orchestrator step in or do agents revert to independent operation? | Medium | Engineering |

---

*Last updated: February 2026*
*Version 1.1 — Ring Leader layer added, rebranded to Akasha*
*Status: First pass PRD — pending co-founder review*
*CONFIDENTIAL — FOR INTERNAL USE ONLY*
