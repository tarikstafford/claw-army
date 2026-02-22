# PRD Changelog — Claw Bot Army v1.0 → Akasha v1.3

**Date:** February 2026
**Prepared for:** Internal review

---

## Summary

This document consolidates all changes from the original v1.0 PRD through to the current v1.3. Three major release cycles are covered.

**v1.1** introduced a complete rebrand from Claw Bot Army to Akasha and added the Ring Leader coordination layer — the most significant architectural addition in the document's history. The Ring Leader touches every section.

**v1.2** introduced two new architectural sections: a per-run tool grant model defining how agents get access to external tools and third-party integrations, and an initial LLM backend strategy formalising why multi-model experimentation is out of MVP scope while reserving the schema infrastructure to add it cleanly post-launch.

**v1.3** replaced the LLM backend routing approach entirely. The v1.2 framing implied a commodity complexity-based router as the post-MVP implementation path. v1.3 rejects that and replaces it with a soul-model affinity router — a routing layer that uses the Akashic Library itself as its data source, routing agents to model tiers based on demonstrated soul-model fitness affinity rather than prompt complexity. Complexity-based routing survives as a cold start fallback only. This is a differentiated approach no general-purpose router can replicate.

---

## 1. Rebrand (v1.1)

| Was | Now |
|-----|-----|
| Claw Bot Army | Akasha |
| DNA Library | Akashic Library |
| Version 1.0 | Version 1.2 |

Every reference to "Claw Bot Army", "DNA library", and "bots" has been updated throughout. The name change is accompanied by a new opening epigraph:

> *"The Akashic Records are the universe's complete memory of every thought, action, and soul that ever existed. Akasha builds the digital equivalent — a versioned, compounding library of every agent soul, every run signal, every mutation, every human confirmation. Nothing is ever lost."*

The Akashic Library section now carries an explicit statement of what the name means and why the library is the moat, which was implicit in v1.0 but not stated directly.

---

## 2. New Section — The Ring Leader (Section 3, added v1.1)

The largest single addition across both releases. An entirely new section covering the Ring Leader layer did not exist in v1.0.

**What the Ring Leader is.** Field commander distinct from the orchestrator. The orchestrator plans before the run. The Ring Leader adapts during it. One per run, always. Spawned before worker agents. Not counted toward the minimum worker agent population.

**What it does.** Six defined functions:

- Real-time swarm monitoring via `sessions_list` and `sessions_history`
- Intelligence routing between agents via `sessions_send`
- Dynamic reallocation when agents fail or finish early
- Objective reanchoring when collective output drifts
- Budget and runtime watchdog across the full population
- Run synthesis delivered to the Performance Judge before council convenes

**Ring Leader SOUL.md.** Distinct soul archetype from worker agents. Constitution tuned for coordination, synthesis, and dynamic reallocation rather than task execution. Evolves through the same library system as worker agents but tracked separately by coordination category, not task category.

**Ring Leader in the Council.** Council now evaluates two distinct layers. A run where workers underperformed but the Ring Leader salvaged the collective outcome through effective reallocation is a fundamentally different verdict from a run where everything degraded because the Ring Leader failed to coordinate.

**Inter-Agent Communication Protocol.** All inter-agent communication is mediated by the Ring Leader. Worker agents never communicate directly with each other. All messages log to the decision trace for council review and library write.

---

## 3. New Section — Per-Run Tool Grants (Section 7, added v1.2)

Did not exist in v1.0 or v1.1.

**The problem it solves.** The v1.1 MVP tool set was a flat list with no model for how different objectives get different tool access. A lead generation run needs LinkedIn. A CRM recovery run needs HubSpot. A content drafting run needs neither. Giving every agent access to every tool is both a security failure and a product failure.

**Decision: per-run grants, not per-task-category defaults.** The user confirms tool grants explicitly in Army Builder before each run. The system suggests grants based on detected objective type, but nothing is active without user confirmation. This is an MVP learning constraint — the platform needs empirical data on what combinations users actually authorise before encoding category-level defaults. Task-category defaults are a post-MVP feature, to be defined once that data exists.

**Base tool set.** Five tools always granted, no user action required: `llm_call`, `write_file`, and the three Ring Leader session tools (`sessions_list`, `sessions_history`, `sessions_send`). Worker agents never receive session tools regardless of run configuration.

**Extended tool grants.** Six named grant types defined:

| Tool Grant | Tools Unlocked | Credential Required |
|------------|---------------|---------------------|
| Web Research | `fetch_url` (broad domain allowlist) | None |
| LinkedIn Access | `fetch_url` scoped to linkedin.com | LinkedIn OAuth |
| Apollo / Hunter | `fetch_url` scoped to apollo.io, hunter.io | API keys |
| HubSpot CRM | hubspot read/write tools | HubSpot OAuth |
| Salesforce CRM | salesforce query/update tools | Salesforce OAuth |
| Email Drafting | `write_file` with .eml extension | None |

**Non-negotiable constraint.** No tool grant in MVP includes write access to any communication channel. Agents draft. Humans send. Removing this constraint requires an explicit product decision and a separate PRD revision.

**JWT structure.** The orchestrator encodes tool grants into the session JWT at spawn time via two new claims: `tool_allowlist` and `third_party_grants`. The credential proxy and tool gateway enforce these claims — an agent cannot call a tool or reach an endpoint not in its JWT regardless of what instructions it receives.

**Third-party credential model.** User OAuth tokens stored per-user per-integration in GCP Secret Manager under the naming convention `user-oauth-{user_id}-{service}`. The credential proxy injects the real token only when the agent JWT includes the matching service in `third_party_grants`. The raw credential never enters the agent context.

**Akashic Library.** Per-run tool grants written to every library entry in the `run_metadata` field. Enables future analysis of tool-soul affinity — which combinations correlate with higher fitness scores for specific objective types.

**Pre-flight validation.** Algorithm 1 now includes a tool grant validation step before launch. If a decomposed task requires a tool the user did not grant, the orchestrator surfaces a pre-flight warning. Runs never launch with tasks that silently cannot access their required tools.

---

## 4. New Section — LLM Backend Strategy (Section 8, added v1.2, rewritten v1.3)

Did not exist in v1.0 or v1.1. Added in v1.2 with a commodity routing approach implied as the post-MVP implementation path. Substantially rewritten in v1.3 to reject that approach and replace it with a soul-model affinity router.

**MVP position (unchanged across v1.2 and v1.3).** Single configured LLM backend. All inference routed to one provider and model. Model variance introduced before the soul evolution engine has a controlled baseline contaminates causal attribution.

**Why complexity-based routing was rejected (v1.3).** The v1.2 framing implied a complexity-based router — classify requests by prompt characteristics, route to cheapest capable model. v1.3 explicitly rejects this. Complexity-based routing is a solved problem every LLM gateway has or will have. It routes on what the prompt looks like without any knowledge of what produced good outcomes. It knows nothing about the soul.

**Soul-model affinity routing (v1.3).** The Akashic Library is the routing layer. After sufficient depth, the platform knows not just that a task is complex, but that a specific soul with its specific directive configuration performs well or poorly on a specific model tier. Three affinity patterns emerge from library data: model-agnostic souls (always route to Economy once confirmed), model-coupled souls (route to tier where peak fitness was recorded), and model-unvalidated souls (flagged explicitly before any tier change).

**The routing decision tree (v1.3).** Full orchestrator decision logic specified. Cross-tier library data present: use affinity routing. No cross-tier data: fall back to 14-dimension complexity scorer. After three cross-tier confirmed runs: graduate to affinity routing. The complexity fallback generates the data the affinity router needs.

**The 14-dimension complexity scorer (v1.3, cold start only).** Adapted from ClawRouter's open-source scoring approach, implemented natively in the `llm_call` tool handler. No external dependency. Under 1ms, local. Explicitly scoped as cold start — retired per soul once affinity data accumulates.

**Deliberate cross-tier experiments (v1.3).** The God Layer can schedule cross-tier experiments: the same soul on different tiers across successive runs of the same campaign. Routing used as a research instrument. Before Artisan promotion, the platform can require confidence in fitness across at least two tiers. Exposed as an opt-in in Army Builder.

**Cost-adjusted fitness and the moat implication (v1.3).** A cost_efficiency_rating field introduced — quality per dollar delivered by a soul. Souls proving model-agnostic accumulate a cost-efficiency advantage in library rankings. The mutation engine can act on this: directives precise enough that cheaper models execute them faithfully produce a fitness advantage over souls requiring frontier capability. The library rewards quality per dollar. This selection pressure compounds. No complexity-based router can replicate it.

**SOUL.md vs system prompt boundary (unchanged from v1.2).** SOUL.md carries all behavioural content. The system prompt is a thin fixed wrapper only.

**Schema (expanded in v1.3).** v1.2 reserved llm_backend with two partial indexes. v1.3 adds model_tier, routing_method, and cost_efficiency_rating fields, plus a composite index on (soul_id, model_tier, task_category) — the core affinity router query that must be in place before multi-LLM data accumulates.

---

## 5. Changes to Existing Sections

### Executive Summary

Added "Coordinated intelligence" to the value proposition table: *"A Ring Leader that adapts the swarm in real time as the run unfolds."*

Updated the product description to include the Ring Leader as a named step in the run sequence: *"You define the mission. The platform spawns the army, a Ring Leader coordinates the swarm, agents execute in parallel, the council evaluates performance, and the Akashic Library gets smarter with every run."*

Removed a marketing claim about performance gap versus competitors — does not belong in a PRD.

### System Overview (Section 2)

Layer count increased from four to five. The Ring Leader is Layer 2, sitting between Orchestration and Agent Execution. All subsequent layers renumbered.

| Layer | v1.0 | v1.3 |
|-------|------|------|
| Orchestration | Spawns agent populations | Spawns Ring Leader and agent populations |
| Ring Leader | Did not exist | Field commander — coordinates swarm dynamically during execution |
| Council | Evaluates worker agents | Evaluates both Ring Leader and worker agent souls |
| God Layer | Manages DNA library | Manages Akashic Library |

The Ring Leader scope note added to SOUL.md architecture: *"Each agent — including the Ring Leader — runs as an isolated OpenClaw instance."*

### Minimum Parallel Constraint

Updated to make explicit that the Ring Leader does not count toward the minimum:

> *"The Ring Leader is additional to this count and does not satisfy the minimum. If budget is insufficient for minimum populations plus a Ring Leader, the user is prompted to adjust scope or increase budget."*

Population table updated with a Ring Leader column showing one Ring Leader per run at all complexity levels.

### Agent Classes (Section 4)

Added: *"Ring Leader class is tracked separately against coordination categories, not task execution categories."*

Retirement language updated: *"soul has been recorded in the Akashic Library and will influence future generations."*

### The Council (Section 5)

Opening updated to name the two evaluation layers explicitly: *"The council evaluates two distinct layers: Ring Leader coordination performance and worker agent task performance."*

Council member roles updated:

- **Performance Judge** now uses the Ring Leader's run synthesis as its primary input.
- **Soul Analyst** now produces separate assessments for Ring Leader and worker agents.
- **Devil's Advocate** now explicitly targets Ring Leader promotion recommendations as well as worker agents.

Human confirmation language tightened: human confirmation described as the ground truth the automated council cannot supply.

### The God Layer and Akashic Library (Section 6)

Section renamed from "DNA Library" to "Akashic Library" throughout.

Library entry schema updated with new fields across both releases:

| Field | Added in | Notes |
|-------|----------|-------|
| Agent type | v1.1 | Ring Leader or worker |
| Coordination category tag | v1.1 | Ring Leader entries only |
| Inter-agent communication log summary | v1.1 | Ring Leader entries only |
| `tool_grants` JSONB | v1.2 | Per-run grants active at time of write |
| `llm_backend` VARCHAR | v1.2 | Reserved, null in MVP. Partial index in place. |

Added: *"The Akashic Library is a living record of every soul that ever ran. Nothing is lost. Every retirement is preserved. Every Pioneer event is catalogued. Every human signal is timestamped. This is what the name means."*

### User Experience — Army Builder (Section 9)

Army Builder rewritten as a formal four-step flow. In v1.0 it was an unstructured paragraph. In v1.2 it is four named steps:

**Step 1 — Objective.** User inputs business objective in plain language. System parses it and surfaces Army Composition Recommendation.

**Step 2 — Army Composition.** Class mix, budget cap, runtime limit. Ring Leader automatically included and reflected in budget estimate. Minimum parallel constraint enforced with plain explanation.

**Step 3 — Tool Grants (new in v1.2).** User reviews and confirms tool grants for this run. System pre-selects suggestions. User must explicitly confirm each grant. Third-party integrations prompt OAuth connection if not already authorised. No write-to-channel grants available in MVP.

**Step 4 — Launch.** Full run configuration review before confirmation.

Saved army configurations now carry tool grants — users do not re-confirm grants on every run if the saved configuration is unchanged.

Live Dashboard: three new items added in v1.1:

- Ring Leader status and current coordination actions
- Live inter-agent communication feed showing intelligence signals being routed
- Objective drift warnings when the Ring Leader broadcasts a reanchoring signal

Post-run leaderboard: Ring Leader performance displayed separately at the top before worker agent rankings.

### Algorithm 1 — Objective Decomposition

v1.1: Minimum Population Enforcement step updated — Ring Leader added to run budget as a separate line item before budget cap is checked.

v1.2: Tool Grant Validation step added — before the run begins, the orchestrator validates that confirmed per-run tool grants are sufficient to execute the decomposed task graph. If any task requires a tool not in the confirmed grants, a pre-flight warning surfaces. Runs never launch with tasks that cannot access their required tools.

### Algorithm 2 — Soul Generation and Mutation

Input parameter updated to include agent type (Ring Leader or worker).

New Ring Leader soul generation path added before worker agent paths. Ring Leader souls drawn from a separate coordination soul library, seeded by coordination category. Ring Leader souls are never mixed with worker agent souls in mutation.

Output updated: *"Population of N worker agent souls plus one Ring Leader soul."*

### Algorithm 3 — Soul Differentiation Enforcement

Scope clarification added: applied to worker agents only. *"The Ring Leader soul is unique per run by design."*

### Algorithm 4 — Causal Attribution

Input updated to include Ring Leader-specific inputs: inter-agent communication log, swarm coordination events, reallocation decisions.

New step added: Ring Leader attribution as a separate process. Counterfactual evaluation specific to coordination decisions — would collective output have degraded without that intelligence routing? Would drift have worsened without that reanchoring broadcast?

Output updated to include separate Ring Leader coordination attribution report.

### Algorithm 5 — Council Verdict

Goal updated: produces verdicts for both Ring Leader and worker agents.

Performance Judge scoring now explicitly includes Ring Leader coordination dimensions: intelligence routing effectiveness, reallocation success rate, objective drift prevention, synthesis quality, budget management.

Output updated: *"Structured verdict per worker agent plus separate Ring Leader verdict."*

### Algorithm 6 — Fitness Scoring

Section restructured into two distinct processes: Worker Agent Scoring and Ring Leader Scoring, each with their own inputs and process steps.

New Ring Leader coordination weight table added:

| Dimension | Default |
|-----------|---------|
| Collective Outcome Quality | 40% |
| Objective Drift Prevention | 25% |
| Reallocation Effectiveness | 20% |
| Budget Management | 15% |

### Algorithm 8 — Promotion and Demotion

Four separate promotion thresholds now defined — Novice to Understudy and Understudy to Artisan for both worker agents and Ring Leaders.

Ring Leader thresholds are higher than worker agent thresholds:

| Threshold | Worker Agent | Ring Leader |
|-----------|-------------|-------------|
| Novice → Understudy min runs | 2 | 3 |
| Understudy → Artisan min runs | 5 | 7 |
| Understudy → Artisan council confidence | 0.80 | 0.82 |

Artisan Ring Leader graduation flagged as a prominent user notification: *"an Artisan Ring Leader is a meaningful platform asset."*

### Algorithm 9 — Akashic Library Write

v1.1: Input updated to include agent type. Ring Leader entries include inter-agent communication log summary. Index update step includes Ring Leader coordination category.

v1.2: Input updated to include `per-run tool grants used` and `llm_backend (null in MVP)`. Entry construction explicitly notes `tool_grants` JSONB and `llm_backend` fields. Index update step includes `by tool grants` and `by llm_backend where not null (partial index)`.

### Algorithm 10 — Army Composition Recommendation

Input updated to include Ring Leader inventory by class and coordination category.

New step added: Ring Leader Recommendation. Surfaces Ring Leader class and its disproportionate impact on collective run quality. Artisan Ring Leader recommended when available for the identified coordination type.

Budget optimisation step updated to include Ring Leader cost in the budget calculation.

### Technical Architecture (Section 12)

Changes across both releases:

| Component | v1.0 | v1.2 |
|-----------|------|------|
| Agent isolation | Docker containers | Docker containers with gVisor runtime |
| LLM routing | Multi-provider, not locked to one provider | Single provider in MVP. Post-MVP: multi-provider. `llm_backend` reserved in schema. |
| Inter-agent communication | Not listed | OpenClaw sessions tools: `sessions_list`, `sessions_history`, `sessions_send` |
| Credential proxy | Not listed | Internal Cloud Run service. Injects third-party credentials from Secret Manager. Raw credentials never in agent context. |
| Per-run tool grants | Not listed | JWT claims issued by orchestrator at spawn. Enforced by credential proxy and tool gateway. |
| Billing | MVP metering only | MVP metering only. Tool grant usage (third-party API calls) metered separately. Ring Leader billed as separate line item. |
| Akashic Library | Separate indexes for Ring Leader and worker agent entries | As v1.1 plus `llm_backend` reserved field, partial index, and `tool_grants` JSONB field. |

Security constraints updated: inter-agent communication via OpenClaw sessions tools only — no direct agent-to-agent network calls.

MVP tool set updated with three Ring Leader tools: `sessions_list`, `sessions_history`, `sessions_send`.

### Out of Scope for MVP (Section 13)

Five items added across both releases:

| Item | Added in | Rationale |
|------|----------|-----------|
| Multiple Ring Leaders per run | v1.1 | Single Ring Leader default for MVP |
| Ring Leader election / competition | v1.1 | Future variant — single appointed Ring Leader for MVP |
| Multi-LLM backend selection | v1.2 | Schema reserved. Model variance contaminates soul attribution before baseline is established. |
| Task-category-level tool grant defaults | v1.2 | Per-run grants generate empirical data first. Category defaults defined once that data exists. |
| Write access to communication channels | v1.2 | Out of scope indefinitely until human-in-the-loop send workflow is separately specified and reviewed. |

### Open Questions (Section 14)

Eight questions added across both releases:

| Question | Added in | Priority |
|----------|----------|----------|
| How do we instrument Ring Leader inter-agent communication logging without creating a bottleneck? | v1.1 | High |
| What is the Ring Leader to worker agent cost ratio? How do we communicate it clearly in pricing? | v1.1 | Medium |
| How do we handle Ring Leader failure mid-run — does the orchestrator step in or do agents revert to independent operation? | v1.1 | Medium |
| What does the tool grant confirmation UX look like for non-technical users? How do we explain OAuth to an SME owner? | v1.2 | High |
| Which OAuth integration do we build first — HubSpot, LinkedIn, or Salesforce? Depends on which segment converts fastest. | v1.2 | High |
| What happens to a run mid-execution if a third-party OAuth token expires? Graceful degradation or hard stop? | v1.2 | High |
| What is the right system prompt boundary — which instructions belong in SOUL.md vs the fixed system prompt wrapper? Needs a documented policy before the first agent sprint. | v1.2 | Medium |
| When multi-LLM is introduced post-MVP, do souls promoted on a single backend need re-validation on new backends? | v1.2 | Low |

One existing question updated: "DNA library depth" changed to "Akashic Library depth."

---

## 6. What Did Not Change

- Core SOUL.md architecture and inviolable constitution layer
- Agent class definitions (Novice, Understudy, Artisan) and promotion logic for worker agents
- Pioneer designation mechanics
- Council structure, weighting (50/35/15), and all five verdict types
- Human confirmation gate mechanics
- Benchmark Instantiation algorithm (Algorithm 7)
- Target market and beachhead strategy (three SME segments)
- Minimum parallel constraint (3 worker agents minimum, Ring Leader additional)
- Causal attribution weighting and counterfactual scoring methodology
- Post-run leaderboard structure (Ring Leader addition noted above, underlying mechanics unchanged)
- Viral marketing strategy — covered in separate document
- All prior Out of Scope exclusions retained (new ones added, none removed)

---

*Claw Bot Army PRD v1.0 → Akasha PRD v1.3*
*February 2026 | CONFIDENTIAL*
