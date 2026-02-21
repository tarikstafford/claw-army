# PRD Changelog — Claw Bot Army v1.0 → Akasha v1.1

**Date:** February 2026
**Prepared for:** Internal review

---

## Summary

Two categories of change in this version: a complete rebrand from Claw Bot Army to Akasha, and a substantive architectural addition — the Ring Leader coordination layer. The Ring Leader is not cosmetic. It touches every section of the document.

---

## 1. Rebrand

| Was | Now |
|-----|-----|
| Claw Bot Army | Akasha |
| DNA Library | Akashic Library |
| Version 1.0 | Version 1.1 |

Every reference to "Claw Bot Army", "DNA library", and "bots" has been updated throughout. The product name change is accompanied by a new opening epigraph explaining the philosophical grounding of the Akasha name:

> *"The Akashic Records are the universe's complete memory of every thought, action, and soul that ever existed. Akasha builds the digital equivalent — a versioned, compounding library of every agent soul, every run signal, every mutation, every human confirmation. Nothing is ever lost."*

The Akashic Library section now carries an explicit statement of what the name means and why the library is the moat, which was implicit in v1.0 but not stated directly.

---

## 2. New Section — The Ring Leader (Section 3)

The largest addition. An entirely new section covering the Ring Leader layer did not exist in v1.0. Full content added:

**What the Ring Leader is.** Field commander distinct from the orchestrator. The orchestrator plans before the run. The Ring Leader adapts during it. One per run, always. Spawned before worker agents. Not counted toward the minimum worker agent population.

**What it does.** Six defined functions:
- Real-time swarm monitoring via `sessions_list` and `sessions_history`
- Intelligence routing between agents via `sessions_send`
- Dynamic reallocation when agents fail or finish early
- Objective reanchoring when collective output drifts
- Budget and runtime watchdog
- Run synthesis delivered to the Performance Judge before council convenes

**Ring Leader SOUL.md.** Distinct soul archetype from worker agents. Constitution tuned for coordination, synthesis, and dynamic reallocation rather than task execution. Evolves through the same library system as worker agents but tracked separately by coordination category, not task category.

**Ring Leader in the Council.** Council now evaluates two distinct layers. A run where workers underperformed but the Ring Leader salvaged the collective outcome is a fundamentally different verdict from a run where everything degraded because the Ring Leader failed to coordinate.

**Inter-Agent Communication Protocol.** All inter-agent communication is mediated by the Ring Leader. Worker agents never communicate directly with each other. All messages log to the decision trace for council review and library write.

---

## 3. Changes to Existing Sections

### Executive Summary

Added "Coordinated intelligence" to the value proposition table: *"A Ring Leader that adapts the swarm in real time as the run unfolds."*

Updated the product description to include the Ring Leader as a named step in the run sequence: *"You define the mission. The platform spawns the army, a Ring Leader coordinates the swarm, agents execute in parallel, the council evaluates performance, and the Akashic Library gets smarter with every run."*

Removed the sentence about performance gap versus competitors using generic AI tooling — this was a marketing claim that does not belong in a PRD.

### System Overview (Section 2)

Layer count increased from four to five. The Ring Leader is Layer 2, sitting between Orchestration and Agent Execution. All subsequent layers renumbered.

Layer descriptions updated:

| Layer | v1.0 | v1.1 |
|-------|------|------|
| Orchestration | Spawns agent populations | Spawns Ring Leader and agent populations |
| Council | Evaluates worker agents | Evaluates both Ring Leader and worker agent souls |
| God Layer | Manages DNA library | Manages Akashic Library |

The Ring Leader scope note added to SOUL.md architecture: *"Each agent — including the Ring Leader — runs as an isolated OpenClaw instance."*

### Minimum Parallel Constraint

Updated to make explicit that the Ring Leader does not count toward the minimum:

> *"The Ring Leader is additional to this count and does not satisfy the minimum. If budget is insufficient for minimum populations plus a Ring Leader, the user is prompted to adjust scope or increase budget."*

Population table updated with a Ring Leader column showing one Ring Leader per run at all complexity levels.

Old rationale: *"Without this constraint, the learning engine starves. The council has nothing to select from. The God Layer has nothing to mutate."*

New rationale: *"Without this constraint, the learning engine starves. The Ring Leader coordinates the swarm but cannot compensate for insufficient population variance."*

### Agent Classes (Section 4, was Section 3)

Added: *"Ring Leader class is tracked separately against coordination categories, not task execution categories."*

Retirement language updated from *"soul patterns have been preserved in the library"* to *"soul has been recorded in the Akashic Library and will influence future generations"* — tighter, more resonant copy aligned with the Akasha brand.

### The Council (Section 5, was Section 4)

Opening updated to name the two evaluation layers explicitly: *"The council evaluates two distinct layers: Ring Leader coordination performance and worker agent task performance."*

Council member roles updated:

- **Performance Judge** now uses the Ring Leader's run synthesis as its primary input, rather than raw agent outputs directly.
- **Soul Analyst** now produces separate assessments for Ring Leader and worker agents.
- **Devil's Advocate** now explicitly targets Ring Leader promotion recommendations as well as worker agents.

Human confirmation language tightened: the v1.0 phrasing about confirmation not being "optional housekeeping" was replaced with a cleaner statement about human confirmation being the ground truth the automated council cannot supply.

### The God Layer and Akashic Library (Section 6, was Section 5)

Section renamed from "DNA Library" to "Akashic Library" throughout.

Library entry schema updated with two new fields:
- Agent type — Ring Leader or worker agent
- Coordination category tag (Ring Leader entries) alongside task category tag (worker agents)
- Inter-agent communication log summary (Ring Leader entries only)

Added explicit statement: *"The Akashic Library is a living record of every soul that ever ran. Nothing is lost. Every retirement is preserved. Every Pioneer event is catalogued. Every human signal is timestamped. This is what the name means."*

Removed the closing line *"Nothing is wasted"* from the Negative Signal Register description — the point is already made more effectively in the library description above.

### User Experience (Section 7, was Section 6)

Army Builder: Ring Leader now automatically included in every run and reflected in the budget estimate.

Live Dashboard: three new items added:
- Ring Leader status and current coordination actions
- Live inter-agent communication feed showing intelligence signals being routed
- Objective drift warnings when the Ring Leader broadcasts a reanchoring signal

Post-run leaderboard: Ring Leader performance now displayed separately at the top, before the worker agent rankings.

Army narrative events: added Ring Leader promotion notification. *"Ring Leader Alpha has been promoted to Artisan coordinator after five campaigns with zero objective drift."*

Removed the closing sentence *"These moments build user investment in the army as something they are building, not just consuming"* — editorial commentary, not specification language.

### The Moat (Section 8, was Section 7)

Added Ring Leader coordination patterns to the compounding moat argument: *"Every Ring Leader coordination pattern that gets written to the library makes the next run's field command more effective."*

Updated the competitor comparison: *"A new entrant has infrastructure. Akasha has infrastructure plus a living record of every soul that ever ran."*

Updated the beachhead statement to include Ring Leader patterns alongside Artisan souls.

Marketplace future extension updated to include *"Ring Leader configurations"* as a shareable/tradeable asset class.

### Algorithm 1 — Objective Decomposition

Minimum Population Enforcement step updated: Ring Leader is now added to the run budget as a separate line item before budget cap is checked. Output now includes Ring Leader budget line.

Removed the over/under-decomposition risk note — condensed for clarity.

### Algorithm 2 — Soul Generation and Mutation

Input parameter updated to include agent type (Ring Leader or worker).

New Ring Leader soul generation path added before worker agent paths. Ring Leader souls drawn from a separate coordination soul library, seeded by coordination category. Ring Leader souls are never mixed with worker agent souls in mutation.

Worker agent path labels updated from "Path A / Path B" to "Worker Agent — Path A / Worker Agent — Path B" for clarity.

Archetype descriptions in Path B condensed — parenthetical elaborations removed as they were redundant with the archetype names.

Output updated: *"Population of N worker agent souls plus one Ring Leader soul."*

### Algorithm 3 — Soul Differentiation Enforcement

Scope clarification added: applied to worker agents only. *"The Ring Leader soul is unique per run by design."*

Removed the calibration risk note about embedding models and behavioral variance — moved to open questions implicitly.

### Algorithm 4 — Causal Attribution

Input updated to include Ring Leader-specific inputs: inter-agent communication log, swarm coordination events, reallocation decisions.

Step 1 updated: Ring Leader significant decision types named explicitly — intelligence routing events, reallocation decisions, reanchoring broadcasts, synthesis judgements.

Step 3 renamed "Cross-Population Comparison (worker agents)" for disambiguation.

New Step 4 added: Ring Leader attribution as a separate process. Counterfactual evaluation specific to coordination decisions — would collective output have degraded without that intelligence routing? Would drift have worsened without that reanchoring broadcast?

Steps renumbered accordingly. Output updated to include separate Ring Leader coordination attribution report.

Removed the self-reported attribution risk note — condensed the document overall.

### Algorithm 5 — Council Verdict

Goal updated: produces verdicts for both Ring Leader and worker agents, not just workers.

Performance Judge scoring now explicitly includes Ring Leader coordination dimensions: intelligence routing effectiveness, reallocation success rate, objective drift prevention, synthesis quality, budget management.

Output updated: *"Structured verdict per worker agent plus separate Ring Leader verdict."*

Removed council variance risk note.

### Algorithm 6 — Fitness Scoring

Section restructured into two distinct processes: Worker Agent Scoring and Ring Leader Scoring, each with their own inputs and process steps.

New Ring Leader coordination weight table added:

| Dimension | Default |
|-----------|---------|
| Collective Outcome Quality | 40% |
| Objective Drift Prevention | 25% |
| Reallocation Effectiveness | 20% |
| Budget Management | 15% |

Output updated to include Ring Leader coordination score with separate percentile ranking against Ring Leader library.

### Algorithm 8 — Promotion and Demotion

Four separate promotion thresholds now defined — Novice to Understudy and Understudy to Artisan for both worker agents and Ring Leaders.

Ring Leader thresholds are higher than worker agent thresholds given the complexity of coordination evaluation:
- Ring Leader Novice to Understudy: 3 confirmed runs (vs 2 for workers)
- Ring Leader Understudy to Artisan: 7 confirmed runs with council confidence above 0.82 (vs 5 runs and 0.80 for workers)

Artisan Ring Leader graduation explicitly flagged as a prominent user notification: *"an Artisan Ring Leader is a meaningful platform asset."*

Demotion and retirement descriptions now cover Ring Leaders explicitly alongside worker agents.

### Algorithm 9 — Akashic Library Write (was DNA Library Write)

Input updated to include agent type parameter.

Structured entry construction references Akashic Library Structure in Section 6. Ring Leader entries include inter-agent communication log summary.

Index update step now includes Ring Leader coordination category as a separate index.

### Algorithm 10 — Army Composition Recommendation

Input updated to include Ring Leader inventory by class and coordination category.

New Step 2 added: Ring Leader Recommendation. Surfaces Ring Leader class and its disproportionate impact on collective run quality explicitly. If an Artisan Ring Leader is available for the identified coordination type, it is recommended with rationale.

Worker agent composition logic renumbered to Step 3.

Budget optimisation step updated to include Ring Leader cost in the budget calculation.

Output updated to include Ring Leader selection.

### Technical Architecture (Section 10, was Section 9)

New rows added:

| Component | Technology | Notes |
|-----------|-----------|-------|
| Inter-agent communication | OpenClaw sessions tools | `sessions_list`, `sessions_history`, `sessions_send` |

Ring Leader noted as isolated OpenClaw instance in the agent runtime row.

Billing note updated: Ring Leader billed as separate line item.

Akashic Library notes separate indexes for Ring Leader and worker agent entries.

Security constraints updated: inter-agent communication via OpenClaw sessions tools only — no direct agent-to-agent network calls.

MVP tool set updated with three Ring Leader tools: `sessions_list`, `sessions_history`, `sessions_send`.

### Out of Scope for MVP (Section 11, was Section 10)

Two items added:
- Multiple Ring Leaders per run
- Ring Leader election and competition model

### Open Questions (Section 12, was Section 11)

Three questions added:
- How do we instrument Ring Leader inter-agent communication logging without creating a bottleneck?
- What is the Ring Leader to worker agent cost ratio and how do we communicate it clearly in pricing?
- How do we handle Ring Leader failure mid-run — does the orchestrator step in or do agents revert to independent operation?

One question updated: "DNA library depth" changed to "Akashic Library depth."

---

## What Did Not Change

- Core SOUL.md architecture and inviolable constitution layer
- Agent class definitions (Novice, Understudy, Artisan) and their promotion logic for worker agents
- Pioneer designation mechanics
- Council weighting (50/35/15) — same weights now applied to Ring Leader evaluation
- Human confirmation gate mechanics
- Benchmark Instantiation algorithm
- Target market and beachhead strategy
- Security model (zero network access, Tool Gateway, Docker isolation)
- MVP scope exclusions (all prior exclusions retained)
- Viral marketing strategy — covered in separate document

---

*Claw Bot Army PRD v1.0 → Akasha PRD v1.1*
*February 2026 | CONFIDENTIAL*
