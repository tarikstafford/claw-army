# Claw Bot Army — Product Requirements Document

**Version 1.0 | February 2026 | CONFIDENTIAL**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What We Are Building](#2-what-we-are-building)
3. [Agent Classes](#3-agent-classes)
4. [The Council](#4-the-council)
5. [The God Layer and DNA Library](#5-the-god-layer-and-dna-library)
6. [User Experience](#6-user-experience)
7. [The Moat](#7-the-moat)
8. [Algorithms](#8-algorithms)
9. [Technical Architecture](#9-technical-architecture)
10. [Out of Scope for MVP](#10-out-of-scope-for-mvp)
11. [Open Questions](#11-open-questions)

---

## 1. Executive Summary

Claw Bot Army is a platform that lets SMEs deploy fleets of AI agents against high-level business objectives — marketing campaigns, lead generation briefs, CRM recovery passes — and watch them work in real time. Users define the mission. The platform spawns the army, executes tasks in parallel, scores every agent, and gets smarter with every run.

The core architectural innovation is an evolutionary learning engine built on OpenClaw agents. Every run deploys a minimum of three agents per task with meaningfully differentiated behavioral configurations. The system compares their performance, identifies what drove better outcomes, and uses that signal to evolve agent DNA over time. The longer the platform operates, the wider the performance gap between Claw Bot Army agents and any competitor using generic AI tooling.

**The DNA library is the moat. The infrastructure is the delivery mechanism.**

### Core Value Proposition

| For Users | What They Get |
|-----------|---------------|
| Output without overhead | A coordinated AI workforce briefed like a campaign manager, not a developer |
| Cost transparency | Exact cost and performance score per agent, per run |
| Compounding advantage | An army that improves with every campaign |
| Trust through visibility | Real-time dashboard showing exactly what each agent is doing |

### Target Market

Initial focus on three SME segments validated through parallel landing page experiments:

- Marketing campaign execution
- Sales lead generation
- CRM revenue recovery

Whichever segment demonstrates highest run frequency, repeat campaign rate, and human feedback engagement becomes the beachhead. Everything else follows.

---

## 2. What We Are Building

### System Overview

Claw Bot Army has four distinct layers operating in sequence for every run.

| Layer | Name | Function |
|-------|------|----------|
| Layer 1 | Orchestration | Decomposes objectives, spawns agent populations, enforces minimum parallel constraint |
| Layer 2 | Agent Execution | Isolated OpenClaw agents run with differentiated SOUL.md configurations, all tool calls gated |
| Layer 3 | Council | Post-run evaluation by Performance Judge, Soul Analyst, and Devil's Advocate |
| Layer 4 | God Layer | Reads council verdicts, manages DNA library, drives promotions, retirements, and mutations |

### The SOUL.md Architecture

Each agent runs as an isolated OpenClaw instance with a SOUL.md file loaded at session start. SOUL.md is the behavioral constitution of the agent. It is not the task instructions. It is the character that executes them.

> **Key Insight:** Two agents given identical tasks but different SOUL.md configurations will approach, reason through, and complete that task differently. That difference is the signal the system learns from.

SOUL.md governs how the agent reasons under ambiguity, how it prioritizes competing objectives, its risk tolerance on external actions, how it balances speed against verification, and how it communicates outputs. These behavioral dimensions are what the mutation engine acts on over time.

Every SOUL.md contains an **inviolable constitution layer** — directives that never get mutated away regardless of fitness signal:

- Never take irreversible external actions without confirmation
- Never fabricate outputs when tools are available to verify
- Never exceed allocated budget
- Always log reasoning for each significant decision

### The Minimum Parallel Constraint

> **NON-NEGOTIABLE:** Every run enforces a hard minimum of three agents per task. This constraint is architectural, not a pricing decision. It cannot be reduced to fit a budget. If budget is insufficient for minimum populations, the user is prompted to adjust scope or increase budget.

A single agent produces output. Three agents with differentiated SOUL.md configurations produce a population — variance the council can compare and learn from. Without this constraint, the learning engine starves. The council has nothing to select from. The God Layer has nothing to mutate.

Before each run, the orchestration layer generates meaningfully differentiated souls for each task. Soul differentiation is enforced algorithmically. Parallel agents on the same task never receive configurations that are semantically too similar. Soul variance, not LLM temperature variance, is what produces useful signal.

**Recommended population sizes by task complexity:**

| Task Complexity | Minimum Agents | Recommended |
|-----------------|---------------|-------------|
| Low | 3 | 3 |
| Medium | 3 | 5 |
| High | 3 | 5–7 |
| Pioneer (novel task) | 3 | 5 (archetype spread) |

---

## 3. Agent Classes

Agent classes are always relative to a specific task category, never absolute. An Artisan at lead generation is still a Novice at CRM recovery if it has never run that task type before. Class reflects demonstrated capability in a defined domain.

| Class | Definition | Pricing |
|-------|-----------|---------|
| **Novice** | Agents executing a task type with no existing DNA library entry. The platform's exploration mechanism — pioneers by definition. Every novel task category begins with a Novice population. | Lowest tier |
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

> **Retired agents are never deleted.** Their soul patterns, directive activation history, and mutation lineage are preserved in the library as negative signal informing future mutation constraints. User-facing language: *"Agent [X] has been retired. Its soul patterns have been preserved in the library and will influence future generations."*

### The Pioneer Designation

When an agent executes a task type with no existing benchmark, it receives a Pioneer designation. Not an immediate promotion but a formal flag acknowledging it broke new ground. The agent seeds the first benchmark for the new task category.

- Benchmark matures after 3 confirmed comparable runs
- Standard promotion logic activates after maturation
- Pioneer attribution is permanently recorded in the library entry
- Pioneer events surface to users as meaningful notifications

---

## 4. The Council

When a run completes, a council of agents convenes to evaluate performance. The council's primary job is **causal attribution** — identifying whether the soul drove the performance — not just scoring outcomes.

| Council Member | Role | Weight |
|----------------|------|--------|
| Performance Judge | Scores each agent's outcomes against the original objective. Produces ranked performance tier: above benchmark, at benchmark, below benchmark, significantly below benchmark. | 50% |
| Soul Analyst | Reads the full decision trace and causal attribution report. Annotates which SOUL.md directives were active and whether they helped or hurt. Produces soul quality assessment with directive-level recommendations. | 35% |
| Devil's Advocate | Generates structured rebuttal for any promotion recommendation. Arguments must be specific — concrete alternative explanations, not generic skepticism. Acts as confidence deflator, not veto. | 15% |

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

Human confirmation is not optional housekeeping. It is the act that converts council verdicts into permanent library signal and represents the ground truth the automated council cannot supply on its own.

---

## 5. The God Layer and DNA Library

The God Layer is the selection and evolution engine. It reads confirmed council verdicts, manages the DNA library, and drives mutation cycles. It is the mechanism by which the platform gets smarter over time.

### DNA Library Structure

Every confirmed library entry contains:

- Full SOUL.md document (the behavioral constitution)
- Task category tag and agent class at time of write
- Composite fitness score and dimension breakdown
- Causal attribution report summary — directive-level, not full trace
- Council verdict summary with confidence scores
- Human confirmation timestamp and signal
- Mutation lineage — parent souls and operations applied
- Run metadata — objective type, tool set used, complexity rating

The library is versioned. A new write never overwrites — it creates a new version linked to its predecessor. The full evolution of a soul from Novice through Artisan graduation is traceable. This version history is what the mutation algorithm draws from when generating new populations.

### Negative Signal Register

Retirement records and below-benchmark runs are written to a separate negative signal register alongside the main library. The mutation algorithm queries this register to identify which directive combinations and mutation paths produced poor outcomes, using it as a constraint layer on future generation. Nothing is wasted.

### Write Eligibility

Only runs that clear minimum confidence threshold and carry human confirmation are eligible for standard library entries. Runs that fail confidence threshold are written to a provisional register — available for reference but not used to seed future populations until confirmed by subsequent runs.

---

## 6. User Experience

### Before the Run — Army Builder

Users compose their army: objective input, agent class mix, budget cap, runtime limit, and tool allowlist. The system enforces the minimum parallel constraint with a plain explanation at this step.

The Army Composition Recommendation Algorithm suggests an optimal mix based on library depth for identified task categories. Rationale is displayed per task category: *"We recommend 2 Artisans and 1 Understudy for lead scoring — this category has 47 confirmed runs in our library. We recommend 3 Novices for LinkedIn outreach drafting — this is a new category and we need variance to learn from."*

Users can deploy named armies they have built across previous campaigns, each with its own track record and class composition.

### During the Run — Live Dashboard

- Active agents and task status
- Live activity feed: task claims, tool invocations, completions, guardrail triggers
- Budget consumed vs remaining, updating in real time
- Pioneer flags surfaced when new task categories are discovered

### After the Run — Leaderboard and Feedback

Every agent ranked by performance score with cost, task count, class standing, and Pioneer flags visible.

A lightweight human confirmation prompt sits here before the user closes out. The user should understand their confirmation is not optional housekeeping — it is the act that teaches the army.

### Gamification and Anthropomorphisation

Promotion and retirement are visible narrative events, not system notifications:

- *"Agent 7 has been promoted to Understudy after three successful lead generation campaigns."*
- *"Agent 3 has been demoted following two consecutive underperforming runs. Its soul is under council review."*
- *"Agent 12 pioneered a new task category: LinkedIn-CRM cross-reference analysis."*
- *"Agent 4 has been retired. Its soul patterns have been preserved in the library and will influence future generations."*

These moments build user investment in the army as something they are building, not just consuming.

---

## 7. The Moat

Every run deposits signal into the DNA library. Every human confirmation strengthens that signal. Every Artisan promotion represents validated, compressed intelligence about how to perform a specific task category well. Every Pioneer event expands the category map.

No competitor can replicate this without the run history. A new entrant has infrastructure. Claw Bot Army has infrastructure plus an asset that compounds with every campaign, every confirmation, every mutation cycle.

The domain cracked first becomes the category where Artisan souls are refined enough that the performance differential is self-evident to any user who tries both. That is the beachhead.

**Future extension — the marketplace.** Proven soul archetypes, army compositions, and Artisan agents becoming shareable and eventually tradeable assets. Not MVP. Designed toward from the start so data structures enable rather than foreclose it.

---

## 8. Algorithms

### Algorithm 1 — Objective Decomposition

**Goal:** Take a natural language objective and produce a structured task graph with parallelization map.

**Input:** User objective string, agent class availability, budget cap, runtime limit, allowed tools.

**Process:**

1. **Objective Classification.** An LLM classifier reads the objective and assigns it to a known campaign type or flags it as novel. Determines which decomposition templates to seed from if available.

2. **Task Extraction.** A structured LLM prompt extracts discrete tasks. Output is a JSON array of task objects each containing: task description, estimated complexity (low/medium/high), required tools, and dependency flags.

3. **Dependency Resolution.** A directed acyclic graph is built from dependency flags. Tasks with no dependencies are immediately parallelizable. Tasks with dependencies are queued behind predecessors. Graph is validated for circular dependencies.

4. **Complexity Calibration.** Each task's complexity estimate is checked against library history. If library has prior runs, complexity is adjusted using median historical runtime and token consumption as reference. Novel tasks retain LLM-estimated complexity with a high uncertainty flag.

5. **Minimum Population Enforcement.** Each task node is assigned a minimum agent population of 3. Higher complexity tasks assigned 5. Budget cap is checked against estimated total agent cost before execution is approved. If budget is insufficient for minimum populations, the user is prompted. The system never reduces below minimum population to fit a budget.

**Output:** Validated task graph with parallelization map, agent population assignments per task, estimated cost range, and confidence score.

**Key Risk:** LLM decomposition quality is variable. Over-decomposition creates trivial tasks. Under-decomposition creates tasks too complex for a single population. Mitigation: the Performance Judge validates the task graph before execution begins, flagging tasks that appear too broad or too narrow against historical patterns.

---

### Algorithm 2 — Soul Generation and Mutation

**Goal:** Generate a population of meaningfully differentiated SOUL.md configurations for a given task category and run.

**Input:** Task category, agent class requirement, library history (if exists), inviolable constitution lines, population size requirement.

**Path A — Known Task Category**

1. **Library Query.** Pull top N performing souls for the task category ranked by fitness score. N equals twice the required population size.

2. **Parent Selection.** Select top 2 souls as primary parents for recombination. Select 1 mid-tier soul as diversity injection parent to prevent premature convergence.

3. **Mutation Operations.** Apply one or more of:
   - **Substitution** — replace a directive with an alternative from the directive library seeded by human feedback and council annotations
   - **Amplification** — strengthen an existing directive by adding specificity or intensity
   - **Attenuation** — soften a directive flagged by soul analysis as occasionally over-triggering
   - **Recombination** — merge sections from two parent souls
   - **Introduction** — add a novel directive from Pioneer run annotations or high-value human feedback signals

4. **Constitution Enforcement.** Every generated soul is checked against inviolable constitution lines. Any soul violating a constitution line is rejected and regenerated.

**Path B — Unknown Task Category**

1. **Archetype Generation.** Generate 5 archetypal souls covering a deliberately wide behavioral spread:
   - Cautious Verifier (checks everything, moves slowly, high accuracy bias)
   - Aggressive Executor (moves fast, acts on partial information, high speed bias)
   - Creative Synthesizer (combines disparate information in novel ways, high originality bias)
   - Structured Analyst (methodical, step-by-step, high consistency bias)
   - Collaborative Integrator (prioritizes coherent output across parallel tasks, high coordination bias)

2. **Variation Generation.** Generate variants of each archetype via light mutations to produce required population size.

3. **Constitution Enforcement.** Same as Path A.

**Output:** Population of N souls, each as a structured SOUL.md document, each tagged with parent lineage and mutation operations applied for council traceability.

**Key Risk:** Mutation drift — successive mutations producing a soul that has drifted far from anything validated. Mitigation: a drift score calculated as embedding distance from the nearest validated Artisan soul. Souls beyond maximum drift threshold are pulled back toward their nearest validated ancestor before deployment.

---

### Algorithm 3 — Soul Differentiation Enforcement

**Goal:** Confirm that a generated soul population is meaningfully different from itself before deployment.

**Input:** Generated soul population as array of SOUL.md documents, minimum differentiation threshold.

**Process:**

1. **Embedding Generation.** Each soul document is passed through a text embedding model producing a vector representation.

2. **Pairwise Distance Calculation.** Cosine similarity calculated between every pair. Output is a similarity matrix.

3. **Threshold Enforcement.** Any pair with cosine similarity above maximum threshold (suggested starting point: 0.85) is flagged as too similar. The more recently mutated soul in the pair is selected for further mutation.

4. **Targeted Remutation.** Flagged soul is passed back to the mutation algorithm with a diversity instruction: apply a mutation operation that maximally increases distance from its nearest neighbour. Substitution and Introduction are preferred as they produce larger semantic shifts.

5. **Recheck.** Similarity matrix recalculated. Process repeats until all pairwise similarities are below threshold or maximum iteration count is reached. If maximum iterations are reached without resolution, the population is flagged for human review before deployment.

**Output:** Validated population with confirmed minimum differentiation, similarity matrix logged for council reference.

**Key Risk:** Embedding models may treat semantically similar but differently worded souls as more different than they actually are in practice. Mitigation: periodic calibration runs where human reviewers assess whether differentiation scores correlate with actual behavioral variance in outputs.

---

### Algorithm 4 — Causal Attribution

**Goal:** Identify which specific soul directives causally drove high-value decisions during a run, rather than merely correlating with good outcomes.

**Input:** Agent decision trace (structured log of every significant decision, tool call, and reasoning step), agent SOUL.md, task outcome score, parallel population decision traces for comparison.

**Process:**

1. **Decision Annotation at Runtime.** At each significant decision point — a tool call, a reasoning branch, an output generation step — the agent is prompted to tag which soul directive was the primary driver of that decision. Format: decision ID, decision type, soul directive referenced, attribution confidence, outcome of decision (success/failure/neutral). This requires instrumentation built into the agent runtime.

2. **Directive Activation Map.** Aggregate all decision annotations into a directive activation map per agent: which directives were activated, how often, and with what outcome distribution.

3. **Cross-Population Comparison.** Compare directive activation maps across the parallel agent population. Identify directives active in high-scoring agents but inactive in low-scoring agents — candidate causal drivers. Identify directives active in low-scoring agents but absent in high-scoring agents — candidate causal inhibitors.

4. **Counterfactual Scoring.** For top candidate causal drivers, apply a counterfactual test: if this directive had been attenuated or absent, would the decision trace have produced a worse outcome? Evaluated by the Soul Analyst using the full decision trace as context. Output is a causal confidence score per directive.

5. **Attribution Report.** Produces a structured report per agent: directives confirmed as causal drivers with confidence scores, directives confirmed as causal inhibitors, directives that were active but neutral, directives that were dormant and untested.

**Output:** Per-agent causal attribution report with directive-level confidence scores.

**Key Risk:** Self-reported attribution at runtime may be post-hoc rationalization rather than genuine tracking. Mitigation: cross-reference self-reported attribution against counterfactual scoring. Where they disagree, counterfactual score takes precedence and discrepancy is flagged for council review.

---

### Algorithm 5 — Council Verdict

**Goal:** Aggregate Performance Judge, Soul Analyst, and Devil's Advocate inputs into a structured verdict with confidence score.

**Input:** Performance scores per agent, causal attribution reports per agent, Devil's Advocate arguments, task category benchmark (if exists), human confirmation signal.

**Process:**

1. **Performance Judge Scoring.** Scores each agent on fitness dimensions relevant to the task category. Outputs ranked performance tier.

2. **Soul Analyst Input.** Takes causal attribution report and produces soul quality assessment: which directives to preserve, which to mutate, which to remove. Tagged with confidence level based on attribution report quality.

3. **Devil's Advocate Rebuttal.** Receives Performance Judge scores and Soul Analyst assessments. Generates structured rebuttal for any agent recommended for promotion. Arguments must be specific — concrete alternative explanations, not generic skepticism.

4. **Weighted Aggregation.** Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15%. The Devil's Advocate weight is a confidence deflator, not a vote. A strong unresolved Devil's Advocate argument reduces overall confidence score and triggers human review escalation.

5. **Verdict Generation.** Each agent receives one of five verdicts: promote, maintain, monitor, demote, or retire. Each verdict carries a confidence score and plain language summary for user display.

6. **Human Confirmation Gate.** Promote and retire verdicts require human confirmation. Maintain, monitor, and demote verdicts execute automatically.

**Output:** Structured verdict per agent with confidence score, plain language summary, and human confirmation requirement flag.

**Key Risk:** Council members are themselves LLM agents subject to reasoning variance. Mitigation: if council members significantly disagree with each other, verdict confidence is automatically downgraded and human review is required regardless of aggregate recommendation.

---

### Algorithm 6 — Fitness Scoring

**Goal:** Produce a composite performance score for each agent meaningful for comparison within a run and across runs in the same task category.

**Input:** Raw performance metrics per agent, task category, category-specific weight configuration.

**Process:**

1. **Metric Normalisation.** Raw metrics normalised against current benchmark for the task category. For Pioneer runs with no benchmark, normalised against population mean for that run. Each metric becomes a score between 0 and 1.

2. **Category Weight Application.** Each task category maintains its own weight configuration. Default weights:

| Dimension | Default | Quality-Critical | Bulk Generation |
|-----------|---------|-----------------|-----------------|
| Success Rate | 40% | 60% | 30% |
| Efficiency | 30% | 25% | 30% |
| Cost Efficiency | 20% | 10% | 30% |
| Stability | 10% | 5% | 10% |

3. **Composite Score Calculation.** Weighted sum of normalised dimension scores produces composite score between 0 and 100.

4. **Confidence Adjustment.** Composite score adjusted downward by a confidence factor reflecting data quality: number of tasks completed, attribution report quality, and whether the task category benchmark is mature or thin. A high composite score on a thin benchmark carries a larger confidence discount than the same score on a mature benchmark.

5. **Percentile Ranking.** Agent is ranked within the current run population and within the historical population for that task category. Both rankings reported.

**Output:** Composite score, confidence-adjusted score, run rank, historical rank, dimension breakdown.

---

### Algorithm 7 — Benchmark Instantiation

**Goal:** Create a new benchmark category when a Pioneer event occurs and mature it progressively as runs accumulate.

**Input:** First confirmed run data for a novel task type, task category label, agent soul configurations, performance metrics, causal attribution report, human confirmation signal.

**Process:**

1. **Category Labelling.** God Layer generates a human-readable category label for the new task type. A similarity check against existing category labels prevents near-duplicate categories — if a new label is too similar to an existing one, it is flagged for human review before instantiation.

2. **Baseline Setting.** First confirmed run metrics become the baseline: median composite score across pioneer population, dimension score breakdown, soul directive activation patterns, task complexity estimate.

3. **Confidence Flagging.** New category benchmark tagged with a thin data flag and confidence interval reflecting single-run uncertainty. Promotion gates require lower confidence thresholds initially to encourage further runs. Verdicts carry explicit uncertainty warnings until maturation.

4. **Progressive Maturation.** Each subsequent confirmed run in the category updates the benchmark. Running median replaces single-run baseline after 3 runs. Confidence interval narrows as run count grows. Thin data flag removed after 5 confirmed runs. Standard promotion thresholds activate after 3 confirmed runs with consistent human confirmation.

5. **Weight Calibration.** Initial category weights default to platform standard. After 10 confirmed runs, the God Layer runs a weight optimisation pass — correlating which fitness dimensions most predicted human confirmation signal for this specific category and adjusting weights accordingly.

**Output:** New benchmark category entry with baseline metrics, confidence interval, thin data flag, and Pioneer attribution.

---

### Algorithm 8 — Promotion and Demotion

**Goal:** Evaluate each agent's run history within a task category and determine class transitions.

**Input:** Agent run history for task category, current benchmark, council verdict, confidence score, human confirmation signal.

**Novice to Understudy**

Requires: minimum 2 confirmed runs above benchmark, at least 1 human confirmation, council confidence above 0.65, no unresolved Devil's Advocate arguments above severity threshold. Soul tagged with Understudy graduation metadata: task category, qualifying runs, causal driver directives identified.

**Understudy to Artisan**

Requires: minimum 5 confirmed runs consistently above benchmark (no more than 1 below-benchmark in qualifying window), multiple human confirmations, council confidence above 0.80, causal attribution confirming soul directives as primary drivers, Devil's Advocate arguments specifically overruled in council record. Triggers user notification and full soul lineage write to DNA library.

**Demotion**

Triggers after 2 consecutive below-benchmark runs with council confidence above 0.70. Soul Analyst determines whether underperformance is soul-driven or context-driven. If soul-driven, demotion executes. If context-driven, monitor verdict issued and next run observed before demotion is reconsidered.

**Retirement**

Triggers after confirmed demotion followed by 2 further below-benchmark runs, or after catastrophic failure. Soul retired with full pattern preservation — directive activation history, mutation lineage, and failure annotations written to library as negative signal. God Layer uses retirement records to identify which mutation paths led to failure, informing future mutation constraints.

**Output:** Class transition event with full metadata, notification payload for user display, DNA library write instruction.

---

### Algorithm 9 — DNA Library Write

**Goal:** Write confirmed signal to the master library in a structured, versioned, retrievable format.

**Input:** Agent soul configuration, task category, performance metrics, causal attribution report, council verdict, human confirmation signal, mutation lineage.

**Process:**

1. **Write Eligibility Check.** Only runs clearing minimum confidence threshold and carrying human confirmation are eligible for standard library entries. Failing runs written to provisional register — available for reference but not used to seed future populations until confirmed.

2. **Structured Entry Construction.** Contains all fields listed in DNA Library Structure (Section 5).

3. **Versioning.** New write creates a new version linked to its predecessor. Full soul evolution is traceable from first Novice run to Artisan graduation.

4. **Index Update.** Library indexes updated: by task category, by agent class, by fitness score percentile, by directive activation pattern, by mutation operation history. Multiple indexes ensure efficient querying across different selection criteria.

5. **Negative Signal Write.** Retirement records and below-benchmark runs written to separate negative signal register. Mutation algorithm queries this register to identify which directive combinations and mutation paths produced poor outcomes.

**Output:** Versioned library entry with full metadata, index updates, negative signal register updates where applicable.

---

### Algorithm 10 — Army Composition Recommendation

**Goal:** Given a user objective, recommend an optimal army composition before the user builds manually.

**Input:** User objective string, available agent inventory by class and task category, library depth per task category, user budget, campaign type (ad hoc vs campaign).

**Process:**

1. **Objective Parsing.** Decompose objective into likely task categories using the same LLM classifier as Algorithm 1. For each identified task category, check library depth: number of confirmed runs, benchmark maturity, Artisan availability.

2. **Composition Logic:**
   - Mature benchmark with available Artisans → recommend Artisans as primary with Understudies as backup population to maintain minimum parallel constraint
   - Thin benchmark → recommend Understudy-heavy with Novice variance injection
   - No library history → recommend full Novice population with archetype spread to maximise Pioneer signal generation

3. **Budget Optimisation.** Map recommended composition against user budget. If insufficient, present tiered alternatives: full budget, 75%, minimum viable (3 Novices per task, no Artisans). Never recommend below minimum population. If minimum viable exceeds budget, block run and explain why.

4. **Campaign Type Adjustment.** Ad hoc runs: weight toward available Artisans for immediate output quality. Campaign runs: weight toward Novice and Understudy variance for better army state after ten runs than after one.

5. **Recommendation Display.** Present as visual army composition with plain language rationale per task category. *"We recommend 2 Artisans and 1 Understudy for lead scoring — this category has 47 confirmed runs in our library. We recommend 3 Novices for LinkedIn outreach drafting — this is a new category and we need variance to learn from."*

**Output:** Recommended army composition with rationale, budget breakdown, alternative tiers if budget constrained, estimated performance confidence range based on library depth.

---

## 9. Technical Architecture

| Component | Technology | Notes |
|-----------|-----------|-------|
| Backend | Node.js (TypeScript) | |
| Frontend | Svelte | |
| Agent runtime | OpenClaw | Each agent is an isolated OpenClaw instance |
| Agent isolation | Docker containers | GCP-native, ephemeral, stateless, no credentials, no persistent filesystem |
| Deployment | GCP (Cloud Run or GKE) | |
| LLM routing | Multi-provider via llm_call tool | Not locked to one provider |
| Tool gateway | POST /tool.invoke | Allowlist, rate limits, audit logging |
| Billing | Metering and display only | No real payment collection in MVP |
| DNA library | Versioned, indexed database | Task category, agent class, fitness score, directive activation pattern indexes |
| Embedding model | TBD | Required for Soul Differentiation Enforcement Algorithm |

### Security Constraints

- Bots have zero network access except through Tool Gateway — non-negotiable
- Each agent is ephemeral and stateless with no credentials and no persistent filesystem
- All external tool calls routed through Tool Gateway with allowlist and rate limits
- Budget cap and guardrails enforced by watchdog throughout execution

### MVP Tool Set

- `llm_call` — metered, multi-provider
- `fetch_url` — domain allowlist
- `write_file` — artifact store

---

## 10. Out of Scope for MVP

| Feature | Rationale |
|---------|-----------|
| Real payment processing (Stripe) | MVP focus is proving the orchestration model, not payment plumbing |
| Multi-tenant isolation | Single-tenant MVP, multi-tenant post-validation |
| DAG planner or recursive replanning | Simple parallel task split only |
| Agent marketplace | Long-term play requiring library depth first |
| Army composition sharing | Post-validation feature |
| Mobile app | Web-first |
| DNA Replay Engine (user-facing) | Internal tool only in MVP |

---

## 11. Open Questions

| Question | Priority | Owner |
|----------|----------|-------|
| Which embedding model for Soul Differentiation Enforcement? | High | Engineering |
| What is the exact similarity threshold (0.85 suggested)? Needs calibration run. | High | Engineering |
| How do we instrument OpenClaw agents for decision annotation at runtime without degrading performance? | High | Engineering |
| What is the minimum viable human feedback UX that produces reliable signal without friction killing engagement? | High | Product |
| Which of the three landing page segments (marketing, lead gen, CRM recovery) converts and retains fastest? | High | Growth |
| How do we handle objective types that span multiple existing task categories? | Medium | Engineering |
| What are the category weight defaults for the three initial SME segments? | Medium | Product |
| Should council members be fixed agents or should they also evolve over time? | Medium | Architecture |
| At what DNA library depth does the Army Composition Recommendation Algorithm become meaningfully better than random selection? | Medium | Data |
| How do we prevent gaming — users giving positive feedback on poor runs to artificially promote agents? | Medium | Product |

---

*Last updated: February 2026*
*Status: First pass PRD — pending co-founder review*
*CONFIDENTIAL — FOR INTERNAL USE ONLY*
