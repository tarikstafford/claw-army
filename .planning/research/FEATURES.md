# Feature Landscape

**Domain:** AI Bot Orchestration Platform (multi-agent workforce, parallel task execution)
**Researched:** 2026-02-21 (v1 features) + 2026-02-21 (v2.0 SOUL System features)
**Confidence:** HIGH (v1 features); MEDIUM-HIGH (SOUL System — novel domain, cross-referenced against evolutionary AI, LLM-as-judge, and gamification research)

---

## Summary

This file covers two milestone layers:

- **v1 Features (already shipped):** Execution intake, bot orchestration, tool gateway, performance scoring, DNA capture, UI dashboards. See "v1 Feature Landscape" section below — do not re-research or re-implement.
- **v2.0 SOUL System (this milestone):** Behavioral constitutions, soul mutation operations, Council evaluation, God Layer + DNA Library, agent class progression, human confirmation gates, Army Builder UI, gamified lifecycle events.

The SOUL System is not incremental polish — it is a paradigm shift from "bots execute tasks" to "bots evolve behavioral strategies across runs." The table stakes for v2.0 are defined by what makes the evolutionary loop coherent, not by competitor parity (no competitor does this at all).

---

## v2.0 SOUL System — Table Stakes

Features that must exist for the SOUL System to be coherent. Missing these makes the v2.0 premise hollow.

### SOUL.md Behavioral Constitutions

| Feature | Why Required | Complexity | Dependency on v1 |
|---------|--------------|------------|-----------------|
| SOUL.md schema with defined behavioral dimensions | Without explicit dimensions, mutation has no axes to operate on — you're mutating noise | MEDIUM | None (new artifact type) |
| Per-agent soul loading at session start | Agents need distinct constitutions to generate differentiated behavior signal | LOW | Bot lifecycle (v1) |
| Soul differentiation enforcement (embedding similarity pre-deployment) | If agents share near-identical constitutions, evaluation signal is worthless | MEDIUM | DNA store (v1), needs embedding infrastructure |
| Minimum 3 differentiated agents per task category | Single-agent runs produce no causal comparison baseline | LOW | Bot orchestrator (v1) |
| Soul version tracking (hash + generation number) | You cannot attribute mutation lineage without knowing what soul version ran | LOW | DNA store (v1) |

**What a SOUL.md governs (research-confirmed dimensions):**
Research on Anthropic's constitutional approach, CrewClaw SOUL.md patterns, and agent behavioral science confirms 7 core dimensions:

1. **Identity and role** — What the agent conceives its purpose to be (e.g., "aggressive optimizer" vs. "cautious verifier")
2. **Decision-making priorities** — What to optimize when trade-offs arise (speed vs. thoroughness, breadth vs. depth)
3. **Tool usage doctrine** — Which tools to reach for first, when to chain calls, when to stop
4. **Risk tolerance and caution level** — How to handle ambiguous instructions, edge cases, potential errors
5. **Communication and reporting style** — How structured outputs are formatted, verbosity, what to surface
6. **Recovery and resilience behavior** — How to handle failures, retries, partial results, timeout conditions
7. **Ethical boundaries and hard stops** — What the agent refuses to do regardless of instruction

**How a soul differs from a system prompt:** A system prompt says "do X." A soul says "when trade-offs arise, prefer Y because of Z." Souls govern decision-making under uncertainty — the conditions that standard prompts don't cover.

### Soul Mutation Operations

| Operation | Description | Why Required | Complexity |
|-----------|-------------|--------------|------------|
| **Substitution** | Replace a directive with a higher-performing variant from DNA library | Without this, good patterns cannot propagate forward | MEDIUM |
| **Amplification** | Strengthen a directive that causally correlated with success (increase emphasis, add more specificity) | Without this, partially-good behaviors stay weak | MEDIUM |
| **Attenuation** | Weaken or remove a directive that causally correlated with failure | Without this, bad behaviors persist | MEDIUM |
| **Recombination** | Blend directive fragments from two high-performing souls | Without this, evolution has no crossover — it is only point mutation | HIGH |
| **Introduction** | Insert a novel directive not present in either parent (seeded from archetype library) | Without this, the system converges on local optima without exploration | HIGH |

**Research basis:** EvoAgent (arxiv:2406.14228), GAAPO, and EvoPrompt all confirm these as the standard mutation taxonomy for LLM-based evolutionary systems. Recombination and Introduction are the high-complexity operations — they require semantic coherence checking to prevent contradictory directives after crossover.

**Mutation scope warning:** Mutations must target individual directives, not entire souls. Full-soul replacement breaks lineage continuity and makes attribution impossible. The soul is a collection of directives; mutations operate on directive-level granularity.

### Council Evaluation (3-Judge Post-Run Panel)

| Feature | Why Required | Complexity | Dependency on v1 |
|---------|--------------|------------|-----------------|
| Three distinct judge roles (Performance Judge, Soul Analyst, Devil's Advocate) | Single-judge evaluation has ~31% disagreement rate vs human consensus; three-role design forces different causal lenses | HIGH | Performance scoring (v1), trace capture (v1) |
| Causal attribution: soul directive → outcome linkage | The God Layer cannot mutate intelligently without knowing which directive caused which result | HIGH | Runtime annotation (new in v2) |
| Structured verdict schema (JSON, machine-readable) | Council output feeds God Layer — must be parseable, not prose | LOW | None |
| Position-randomized evaluation to prevent verbosity bias | Research confirms positional bias causes 10%+ accuracy shifts in judge panels | MEDIUM | None |
| Disagreement resolution protocol | Without a tie-breaking mechanism, 2-1 splits produce no actionable signal | MEDIUM | None |

**Council roles (research-derived):**
- **Performance Judge:** Evaluates outcome metrics (task success, efficiency, cost per task, stability). Grounds evaluation in v1 composite score data. Looks for: did this soul produce better task outcomes than its peers this run?
- **Soul Analyst:** Evaluates behavioral coherence. Did the soul's stated priorities manifest in actual tool call sequences? Identifies which specific directives were causally active. Provides directive-level attribution.
- **Devil's Advocate:** Challenges success attributions. Asks: was this success due to the soul, or luck (easy task, favorable timing, other bot clearing blockers)? Downgrades soul credit for confounded successes.

**Variance reduction (research-confirmed):**
- Use distinct model families for different judge roles (e.g., not all Claude — mix in GPT-4 or Gemini for Devil's Advocate)
- Schema-constrained JSON output mandatory — prose verdicts introduce parsing failure and hallucinated scores
- Minority-veto rule for retirement verdicts: one judge recommending "Retire" blocks promotion even if two approve it
- Multiple evaluation temperatures for each judge role to reduce stochastic variance

### Runtime Soul Directive Annotation

| Feature | Why Required | Complexity | Dependency on v1 |
|---------|--------------|------------|-----------------|
| Agents annotate which soul directive they are acting under per tool call | Without this, council attribution is retrospective guessing not causal signal | HIGH | Tool gateway (v1), trace capture (v1) |
| Annotation stored in existing trace capture | Extends v1 trace schema — avoids new infrastructure | LOW | Structured trace capture (v1) |

**This is the hardest v2.0 feature to implement correctly.** Agents must actively self-report directive activation, not just emit tool calls. The annotation can be lightweight (directive ID tag per tool call) but must be built into the bot runtime. Without this, the Council is doing correlation not causation.

---

## v2.0 SOUL System — Differentiators

Features that are not strictly required for coherence but create competitive distance and user engagement.

### God Layer (Meta-Orchestrator)

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Automated mutation decision-making from council verdicts | Closes the evolutionary loop without requiring human involvement for every cycle | HIGH | Council evaluation, DNA library |
| Exploration vs. exploitation balance | Prevents full convergence on known-good souls — maintains population diversity | MEDIUM | God Layer core |
| Mutation lineage graph (parent → child soul tracking) | Users can see evolution of agent "lineages" — creates narrative and trust in the system | MEDIUM | DNA library |
| Promotion/demotion/retirement decision generation | God Layer produces recommendations; humans confirm (see confirmation gate below) | MEDIUM | Agent class system |

**Research basis:** Evolutionary algorithm literature confirms that meta-controllers managing population-level selection pressure are essential for preventing premature convergence. The God Layer is the population-level selection mechanism — it is not just "pick the best soul." It must also inject diversity (Introduction mutations) when population variance drops below a threshold.

### DNA Library (Versioned Soul Store)

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Versioned soul entries with mutation lineage | Enables time-travel debugging: "why did this soul emerge?" | MEDIUM | v1 DNA store (extends) |
| Causal attribution reports per soul version | Each soul knows which specific directive changes drove its performance delta | HIGH | Council evaluation |
| Objective-category indexing | Seeds appropriate archetypes for novel categories without cold-start | MEDIUM | v1 category tagging |
| Archetype library (6-8 canonical personality templates) | Novel categories without history need a warm start — archetypes provide spread without history | MEDIUM | God Layer |
| Performance delta tracking per soul version | Soul v3 beat soul v2 by 12% on efficiency — visible improvement narrative | LOW | v1 performance scoring |

**Archetype library matters:** For new task categories, the system has no prior souls to mutate from. Without archetypes, you get random initialization which produces incoherent souls. Archetypes should cover the major behavioral axes: aggressive optimizer, cautious verifier, breadth-first explorer, depth-first specialist, creative recombiner, conservative executor.

### Agent Class Progression (Novice / Understudy / Artisan)

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Per-task-category class tracking | Specialization is domain-specific — a Artisan email-processor is still Novice at code review | MEDIUM | DNA library, task category tagging |
| Promotion thresholds (performance-based, run-count-based) | Research confirms that progression gates need both quality and quantity signals — lucky runs don't promote | LOW | Performance scoring (v1) |
| Demotion logic (performance regression tracking) | Without demotion, the class system becomes a one-way ratchet with no signal value | MEDIUM | Performance scoring (v1) |
| Retirement trigger conditions | When a soul consistently underperforms across multiple runs, retirement creates space for new exploration | MEDIUM | God Layer |
| Class-aware army composition recommendations | In Army Builder, prefer known Artisans for mission-critical slots, Novices for exploration | MEDIUM | Army Builder UI |

**Research basis:** RPG progression system design literature (IntechOpen, UniversityXP) confirms three principles for engagement: (1) progression must be visible, (2) promotion must require sustained performance not one lucky run, (3) specialization paths must diverge (an Artisan Optimizer and Artisan Verifier should feel meaningfully different). The Novice/Understudy/Artisan structure maps to these — three tiers is the engagement sweet spot; five or more creates choice paralysis.

**Critical detail:** Class tracks per task category, not per agent identity. An agent-soul is a behavioral constitution, not a persistent identity. The "class" belongs to the soul-version-plus-category combination, not a named agent. Users should understand they are promoting a behavioral pattern, not a character.

### Human Confirmation Gate (Promote / Retire Verdicts)

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Confirmation required before DNA library write for Promote/Retire | Prevents automated system from degrading the DNA library with miscalibrated verdicts | LOW | Council evaluation, God Layer |
| Context summary shown at confirmation (not raw verdict) | Research confirms that cognitive overload at confirmation kills engagement — show the key finding, not the full judge transcript | MEDIUM | Council evaluation |
| Async confirmation (non-blocking) | Blocking execution on human response kills the "deploy and watch" UX | LOW | None |
| Decline-with-reason capture | If user rejects a verdict, that signal improves council calibration over time | MEDIUM | God Layer |
| Auto-confirm after timeout (configurable) | Prevents abandoned verdicts from blocking library growth | LOW | None |

**UX research finding (HIGH confidence):** The optimal friction level for confirmation gates is: show one sentence of evidence, require one binary decision (Confirm/Override), default to async so the user is never blocked. Research from permit.io and HITL literature confirms that contextual, lightweight summaries maintain signal quality while preventing reviewer fatigue. Full transcript review destroys engagement — users stop reading after the first 3 confirmations if they see a wall of text.

**What NOT to do:** Don't require users to adjudicate between the three judge opinions. The God Layer's verdict synthesis is the system's job. The human confirms or overrides the synthesized recommendation — they do not re-run the evaluation.

### Army Builder UI

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Soul composition view before deployment | Users see what behavioral mix they're deploying — not just "3 bots" but "2 Artisan Optimizers + 1 Novice Explorer" | MEDIUM | Agent class system, DNA library |
| Library-depth-aware recommendations | "This category has 12 runs of data — recommending 2 Artisans + 1 Novice for coverage" | MEDIUM | DNA library depth query |
| Cold-start archetype selection UI | For novel categories: let user pick starting archetypes (or accept system default spread) | MEDIUM | Archetype library |
| Budget-aware composition | Class costs (Artisans have more complex souls, potentially higher token usage) visible per slot | LOW | v1 budget enforcement |
| Differentiation enforcement feedback | Visual confirmation that souls passed embedding similarity check before deployment | LOW | Soul differentiation enforcement |

**Research basis:** Fleet management UX literature (Hicron) and multi-agent UI design research (ACM DIS 2025) both confirm that heterogeneous fleet management requires role-legibility — users need to understand what each "slot" in the fleet does, not just how many slots exist. The Army Builder is the pre-flight checklist: it answers "what am I deploying and why."

### Gamified Lifecycle Events

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Promotion ceremony (narrative event on class advancement) | Research confirms milestone visibility drives re-engagement — users return to see what happened | LOW | Agent class system, confirmation gate |
| Retirement announcement (memorial-style narrative on soul retirement) | Retiring a soul after 20 runs creates a story — users feel the lifecycle not just see a table update | LOW | Agent class system |
| Pioneer badge (first Artisan in a new category) | Marks exploration milestones — the "first ever" narrative is well-documented as high-engagement | LOW | Agent class system |
| Mutation lineage visualization ("this soul descended from...") | Shows users the evolutionary story — makes the system feel alive, not algorithmic | MEDIUM | DNA library lineage graph |
| Run-level evolution feed ("Council promoted Soul-7 to Understudy after 3 consecutive top-tier runs") | Makes the God Layer's decisions visible and legible to users who don't read technical verdicts | LOW | Council evaluation, God Layer |

**Research basis:** Gamification literature (Centrical, Open Loyalty, Optimove) consistently identifies lifecycle events (promotion, graduation, retirement) as among the highest-engagement triggers. The key is they must feel earned and be legible — users need to understand what the agent did to deserve promotion. Vague celebration defeats the purpose.

**Note:** These are notification/display features, not mechanical features. Complexity is LOW because they are display representations of decisions already made by the system. Do not over-engineer the gamification layer — the mechanical substance must exist first.

---

## v2.0 SOUL System — Anti-Features

Features that seem right for SOUL System but create problems. Deliberately excluded.

| Anti-Feature | Why It Seems Right | Why It Is a Trap | What to Do Instead |
|--------------|-------------------|------------------|-------------------|
| **Full-soul replacement as mutation** | Simpler to implement — just swap the whole soul | Destroys lineage continuity; attribution becomes impossible; evolution loses its gradient | Mutate at directive level (substitution, amplification, attenuation on specific dimensions) |
| **User-editable souls (manual prompt engineering)** | Power users want to write their own constitutions | Introduces human-written text into what should be an algorithmically-generated evolutionary space; pollutes lineage graph; creates accountability confusion | Expose archetype selection and weight sliders, not raw text editing. Soul text is an output, not an input |
| **Fine-tuning model weights from soul data** | DNA Library sounds like training data | Requires RLHF infrastructure, months of evaluation, and model serving changes. Out of scope for v2.0 | Prompt-level mutation only — the soul is a behavioral specification applied at inference time, not a weight update |
| **Real-time council evaluation during execution** | Seems more responsive | Council evaluation requires full trace data — you cannot attribute "which directive caused this outcome" mid-run. Premature council = garbage attribution | Council runs post-run only, with complete trace + performance data available |
| **5+ class tiers (e.g., Apprentice/Journeyman/Expert/Master/Grandmaster)** | More granularity sounds richer | Three tiers is the RPG engagement optimum. More tiers create choice paralysis and slow the progression feedback loop; users disengage when promotion feels distant | Novice/Understudy/Artisan — three is enough. Add prestige sub-tiers only if users explicitly ask |
| **Continuous automated promotion without human gate** | Faster, less friction | The DNA Library is a long-term asset. Miscalibrated council verdicts can degrade it silently. Human gate provides a circuit breaker for early-iteration council errors | Require confirmation for Promote and Retire. Confirmation for Demotion can be automated (lower stakes) |
| **Multi-model council using the same model family** | Seems consistent | Self-preference bias — GPT-4 as all three judges will favor GPT-4-style outputs. Research confirms diversity of model families is required for bias mitigation | Use different model families for at least one judge role. Performance Judge can be same-family; Devil's Advocate should not be |
| **Unlimited soul mutation history (unbounded lineage growth)** | More history = more data | Lineage graphs become unnavigable. Users cannot understand their army if every soul has a 40-generation ancestry tree | Prune lineage display to depth-3. Maintain full history in DB but surface 3 generations in UI |
| **Per-run soul mutation (mutate after every execution)** | Faster evolution sounds better | With insufficient run count per soul, causal attribution is noise not signal. Single-run council verdicts promote overfitting | Require minimum N runs (e.g., 3-5) before a soul is eligible for council evaluation and mutation |

---

## Feature Dependencies (SOUL System)

```
[SOUL.md Behavioral Constitutions]
    └──requires──> [v1 Bot Orchestrator] (loads soul at bot spawn)
    └──requires──> [v1 DNA Store] (soul versioning extends existing store)
    └──requires──> [Embedding Similarity Check] (new — enforces differentiation)

[Runtime Soul Directive Annotation]
    └──requires──> [v1 Tool Gateway Trace Capture] (extends trace schema)
    └──requires──> [SOUL.md] (directive IDs must exist to annotate against)

[Council Evaluation]
    └──requires──> [Runtime Soul Directive Annotation] (causal attribution needs annotations)
    └──requires──> [v1 Performance Scoring] (Performance Judge reads composite scores)
    └──requires──> [v1 Structured Trace Capture] (Soul Analyst reads tool call sequences)
    └──requires──> [Structured Verdict Schema] (JSON output, not prose)

[God Layer]
    └──requires──> [Council Evaluation] (reads verdicts)
    └──requires──> [DNA Library] (reads + writes souls)
    └──requires──> [Agent Class System] (issues promotion/demotion/retirement)
    └──requires──> [Human Confirmation Gate] (gates library writes)

[DNA Library]
    └──requires──> [v1 DNA Store] (extends, does not replace)
    └──requires──> [Soul Version Tracking] (hash + generation number)
    └──requires──> [Causal Attribution Reports] (from Council)
    └──requires──> [Archetype Library] (warm-start for cold categories)

[Agent Class System (Novice/Understudy/Artisan)]
    └──requires──> [DNA Library] (souls have classes)
    └──requires──> [v1 Performance Scoring] (promotion thresholds)
    └──requires──> [v1 Task Category Tagging] (class is per-category)
    └──requires──> [God Layer] (issues class transitions)

[Human Confirmation Gate]
    └──requires──> [God Layer] (produces recommendations to confirm)
    └──requires──> [Council verdict summary] (evidence shown to user)

[Army Builder UI]
    └──requires──> [DNA Library] (shows available souls by class + category)
    └──requires──> [Agent Class System] (shows class per slot)
    └──requires──> [Soul Differentiation Enforcement] (validates composition before deploy)
    └──requires──> [v1 Budget Enforcement] (class-aware cost estimation)

[Gamified Lifecycle Events]
    └──requires──> [Agent Class System] (reads transitions)
    └──requires──> [Human Confirmation Gate] (promotion confirmed = event fires)
    └──requires──> [Mutation Lineage Graph] (ancestry display)

[Soul Mutation Operations]
    └──requires──> [God Layer] (decides which mutation to apply)
    └──requires──> [DNA Library] (source material for Recombination + Substitution)
    └──requires──> [Archetype Library] (source material for Introduction)
    └──requires──> [Semantic Coherence Check] (post-mutation validation — new)
```

**Critical path for v2.0:** SOUL.md schema → Runtime Annotation → Council Evaluation → God Layer → DNA Library → Agent Class System → Human Confirmation Gate. Army Builder UI and Gamification are display layers that can ship after the mechanical loop is closed.

---

## Feature Complexity Ratings (SOUL System Only)

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| SOUL.md schema design + loading | LOW | Markdown file + DB column; no new infrastructure |
| Soul version tracking | LOW | Hash + generation counter; extends existing DNA store |
| Embedding similarity enforcement | MEDIUM | Needs embedding model call at deploy time; adds ~200ms pre-flight |
| Runtime soul directive annotation | HIGH | Requires bot runtime changes; agents must actively tag actions |
| Council evaluation (3 judges) | HIGH | Multi-LLM orchestration, bias mitigation, structured verdicts, attribution |
| Structured verdict schema + parsing | LOW | JSON schema definition; low impl risk |
| God Layer mutation decisions | HIGH | Exploration/exploitation balance; requires semantic coherence checking post-mutation |
| Soul mutation operations (all 5) | HIGH | Recombination + Introduction require semantic coherence validation |
| DNA Library (versioned + lineage) | MEDIUM | Extends v1 DNA store schema; lineage graph is new but contained |
| Archetype library (6-8 templates) | MEDIUM | Content creation + embedding indexing; no new infrastructure |
| Agent class system (3 tiers) | MEDIUM | DB columns + promotion logic; depends on God Layer |
| Human confirmation gate | LOW | Simple confirm/decline UI + async webhook; no complex logic |
| Army Builder UI | MEDIUM | New UI screen; depends on DNA Library + class system being stable |
| Gamified lifecycle events | LOW | Display layer only; depends on class transitions existing |
| Causal attribution reports | HIGH | Requires runtime annotations + council analysis to be coherent |

---

## MVP Recommendation for v2.0

### Build First (Mechanical Loop — nothing works without these)

1. SOUL.md schema — 7 behavioral dimensions, directive-level structure, versioning
2. Soul loading at bot spawn — inject soul into bot runtime context
3. Runtime directive annotation — tag each tool call with active directive ID
4. Soul differentiation enforcement — embedding similarity pre-deployment check
5. Council evaluation — 3-judge panel, structured JSON verdicts, post-run only
6. Causal attribution — directive-to-outcome linkage from annotations + council analysis
7. God Layer core — reads verdicts, generates mutation candidates and class recommendations
8. Soul mutation operations — Substitution, Amplification, Attenuation first; Recombination + Introduction after
9. DNA Library — versioned souls, lineage tracking, extends v1 dna_store table
10. Human confirmation gate — async, context-summary-only, confirm/override

### Build Second (User-Facing — depends on loop being closed)

11. Agent class system — Novice/Understudy/Artisan per category, promotion/demotion/retirement
12. Archetype library — 6-8 canonical personality templates for cold-start
13. Army Builder UI — composition view, class-aware slot filling, differentiation feedback

### Build Third (Engagement Layer — depends on class system existing)

14. Gamified lifecycle events — promotion ceremony, retirement announcement, pioneer badge, lineage visualization
15. Run-level evolution feed — legible God Layer decision surface

### Defer to v2.1+

- Soul weight sliders (user influence on mutation pressure without raw text editing)
- Multi-category army optimization (optimize across categories simultaneously)
- DNA export / portability (regulated enterprise requirement)
- Soul A/B testing UI (compare two soul versions head-to-head)

---

## v1 Feature Landscape (Already Shipped — Do Not Re-Research)

### Table Stakes (v1 — Shipped)

| Feature | Status |
|---------|--------|
| Objective intake + task decomposition | SHIPPED v1.0 |
| Parallel agent execution | SHIPPED v1.0 |
| Task claiming / work queue (BullMQ) | SHIPPED v1.0 |
| Agent lifecycle management | SHIPPED v1.0 |
| Hard budget caps (atomic Redis Lua) | SHIPPED v1.0 |
| Per-execution status tracking | SHIPPED v1.0 |
| Tool allowlisting | SHIPPED v1.0 |
| Rate limiting per agent | SHIPPED v1.0 |
| Audit / event log | SHIPPED v1.0 |
| Execution cost reporting | SHIPPED v1.0 |
| Bot-level performance metrics | SHIPPED v1.0 |
| Sandbox isolation (Docker, GCE VMs with OpenClaw) | SHIPPED v1.1 |
| Loop/thrash detection | SHIPPED v1.0 |
| Structured trace capture | SHIPPED v1.0 |
| Execution history | SHIPPED v1.0 |

### Differentiators (v1 — Shipped)

| Feature | Status |
|---------|--------|
| Bot performance scoring (composite 40/30/20/10) | SHIPPED v1.0 |
| Bot leaderboard with tier indicators | SHIPPED v1.0 |
| DNA capture for elite bots (system prompt + tool sequences + decision patterns) | SHIPPED v1.0 |
| Real-time live activity feed | SHIPPED v1.0 |
| Per-bot-hour billing transparency | SHIPPED v1.0 |
| Guardrail event feed in UI | SHIPPED v1.0 |
| Bot detail drill-down | SHIPPED v1.0 |
| Objective-category tagging for DNA | SHIPPED v1.0 |
| Auth (Google OAuth, Auth.js v5) | SHIPPED v1.1 |

---

## Sources

**SOUL.md / Behavioral Constitutions:**
- [What is AI Agent Soul File (SOUL.md)? — Chipp AI Glossary](https://chipp.ai/ai/glossary/ai-agent-soul-file)
- [SOUL.md Guide: Create an AI Agent with One File — CrewClaw](https://www.crewclaw.com/blog/soul-md-create-ai-agent)
- [Claude 4.5 Opus Soul Document — Simon Willison](https://simonwillison.net/2025/Dec/2/claude-soul-document/)
- [Anthropic Publishes Claude's Constitution — Anthropic](https://www.anthropic.com/news/claudes-constitution)

**Evolutionary AI / Mutation Operations:**
- [EvoAgent: Towards Automatic Multi-Agent Generation via Evolutionary Algorithms — arXiv 2406.14228](https://arxiv.org/abs/2406.14228)
- [GAAPO: Genetic Algorithmic Applied to Prompt Optimization — Frontiers](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1613007/full)
- [Evolving Excellence: Automated Optimization of LLM-based Agents — arXiv 2512.09108](https://www.arxiv.org/pdf/2512.09108)
- [Comparing Top 5 AI Agent Architectures 2025 — MarkTechPost](https://www.marktechpost.com/2025/11/15/comparing-the-top-5-ai-agent-architectures-in-2025-hierarchical-swarm-meta-learning-modular-evolutionary/)

**LLM-as-Judge / Council Evaluation:**
- [LLM-as-a-judge: A Complete Guide — EvidentlyAI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [When AIs Judge AIs: The Rise of Agent-as-a-Judge — arXiv 2508.02994](https://arxiv.org/html/2508.02994v1)
- [LLMs-as-Judges: A Comprehensive Survey — arXiv 2412.05579](https://arxiv.org/html/2412.05579v2)
- [LLM-as-a-Judge Primer and Autoraters — Aman's AI Journal](https://aman.ai/primers/ai/LLM-as-a-judge/)
- [Beyond Consensus: Mitigating Agreeableness Bias in LLM Judge Evaluations — NUS / AICET](https://aicet.comp.nus.edu.sg/wp-content/uploads/2025/10/Beyond-Consensus-Mitigating-the-agreeableness-bias-in-LLM-judge-evaluations.pdf)

**Human-in-the-Loop / Confirmation UX:**
- [Human-in-the-Loop for AI Agents: Best Practices — permit.io](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo)
- [Designing for Autonomy: UX Principles for Agentic AI — UXmatters](https://www.uxmatters.com/mt/archives/2025/12/designing-for-autonomy-ux-principles-for-agentic-ai.php)
- [HITL Patterns in LangGraph: Approve, Reject, and Edit — Medium](https://medium.com/the-advanced-school-of-ai/human-in-the-loop-in-langgraph-approve-or-reject-pattern-fcf6ba0c5990)

**Agent Class Progression / Gamification:**
- [Pathways to Mastery: A Taxonomy of Player Progression Systems — IntechOpen](https://www.intechopen.com/online-first/1221745)
- [What are Progression Systems in Games? — University XP](https://www.universityxp.com/blog/2024/1/16/what-are-progression-systems-in-games)
- [AI-Orchestrated Gamification: The Future — Optimove](https://www.optimove.com/blog/ai-gamification-next-level-player-engagement)
- [The 2025 Inflection Point and The Agent Maturity Model — Agent Factory](https://agentfactory.panaversity.org/docs/General-Agents-Foundations/agent-factory-paradigm/the-2025-inflection-point)

**Army Builder / Multi-Agent UX:**
- [Designing with Multi-Agent Generative AI: Insights from Industry Early Adopters — ACM DIS 2025](https://dl.acm.org/doi/10.1145/3715336.3735823)
- [Fleet Management Dashboard UI Design Guide — Hicron Software](https://hicronsoftware.com/blog/fleet-management-dashboard-ui-design/)

---

*v2.0 SOUL System feature research: 2026-02-21*
*v1 feature research: 2026-02-18*
