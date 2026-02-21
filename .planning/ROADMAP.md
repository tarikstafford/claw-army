# Roadmap: Claw Bot Army

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-02-19)
- ✅ **v1.1 Google Auth Gate** — Phase 7 (shipped 2026-02-19)
- 📋 **v2.0 The SOUL System** — Phases 8-14 (planned)

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

### 📋 v2.0 The SOUL System (Planned)

**Milestone Goal:** Transform the platform into an evolutionary learning engine — every run generates signal that mutates and improves agent behavioral constitutions over time, compounding a DNA Library no competitor can replicate without the run history.

---

#### Phase 8: Database Schema and Shared Types

**Goal:** All persistent structures for the SOUL System exist in the database and type system, enabling every subsequent phase to write real data rather than stubs.
**Depends on:** Phase 7
**Requirements:** SOUL-01, SOUL-03, SOUL-04, DTRC-03

**Success Criteria:**
1. Drizzle migration runs cleanly against the existing Cloud SQL instance, adding 4 new tables (`bot_souls`, `decision_traces`, `council_verdicts`, `negative_signal_register`) and all additive columns to `dna_store`, `bots`, and `executions` without touching existing rows
2. All existing run history queries continue to return correct data after migration — no regressions from nullable new columns
3. Shared TypeScript types for `SoulDocument` (7 behavioral dimensions, inviolable constitution directives, content hash, generation counter) and `VerdictType` are exported from `packages/shared-types` and compile cleanly across all service packages
4. The 6+ canonical archetype soul templates (Cautious Verifier, Aggressive Executor, Creative Synthesizer, Structured Analyst, Collaborative Integrator, and variants) are seeded into the database as static library records
5. `decision_traces` table has a documented 90-day TTL archival policy and the row-count threshold is noted in the schema comment

**Plans:** 2 plans

Plans:
- [ ] 08-01-PLAN.md -- Schema files (4 new tables, 3 additive columns, shared types)
- [ ] 08-02-PLAN.md -- Migration generation (pgvector), archetype seed script (6 archetypes)

---

#### Phase 9: Soul Generation and Dispatch Integration

**Goal:** Every execution deploys bots with meaningfully differentiated SOUL.md behavioral constitutions — souls are generated before VM spawn, enforced for differentiation, and delivered to agents at dispatch time.
**Depends on:** Phase 8
**Requirements:** SOUL-02, SGEN-01, SGEN-02, SGEN-03, SGEN-04, SGEN-05

**Success Criteria:**
1. Submitting an execution with a known task category produces a population of at least 3 souls — each seeded from top-performing historical souls with one mid-tier diversity parent — before any VM is spawned
2. Submitting an execution with a novel task category produces a population of at least 3 souls generated as an archetype spread from the canonical library
3. Any soul pair with cosine similarity above 0.85 is detected, the offending soul is remutated with a diversity instruction, and the check repeats — deployment is blocked until all pairs pass or a human-review flag is set after maximum iterations
4. Every generated soul is validated against inviolable constitution directives before dispatch — a soul that violates constitution lines is rejected and regenerated without any manual intervention
5. Submitting an execution where the budget cannot support a minimum 3-agent population is blocked at the API with a plain explanation — the minimum is never silently reduced

**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md -- Soul generation service (classify, mutate, validate, embed, differentiate, persist)
- [ ] 09-02-PLAN.md -- Dispatch integration (startup script soul delivery, orchestrator wiring, budget enforcement)

---

#### Phase 10: Decision Trace Collection

**Goal:** Agents produce a per-decision attribution record at runtime that the Council can use for causal attribution — both the real-time annotation path and the post-hoc fallback are built and operational.
**Depends on:** Phase 9
**Requirements:** DTRC-01, DTRC-02

**Success Criteria:**
1. After an execution completes, the `decision_traces` table contains rows for each significant agent decision (tool call, reasoning branch, output step) — each row carries a decision ID, decision type, directive referenced, attribution confidence score, and outcome
2. When the OpenClaw runtime supports `decision_annotation` messages, those messages are the source of truth for trace rows — when unavailable, the post-hoc attribution compiler runs automatically against the `tool_invocations` sequence and produces equivalent rows, with no manual switch required

**Plans:** TBD

---

#### Phase 11: The Council

**Goal:** After every execution, three independent LLM judges evaluate each agent's performance and produce a weighted verdict with causal attribution — processed asynchronously on a dedicated queue so execution results surface immediately.
**Depends on:** Phase 10
**Requirements:** CNCL-01, CNCL-02, CNCL-03, CNCL-04, CNCL-05, CNCL-06

**Success Criteria:**
1. After an execution completes, council evaluation jobs are enqueued on a separate `council-queue` BullMQ worker (concurrency=5, rate limiter configured) — the execution result is available to users immediately, without waiting for Council evaluation
2. Each of the three judges (Performance Judge, Soul Analyst, Devil's Advocate) produces its verdict independently — no judge output is visible to any other judge before all three outputs are collected; the Devil's Advocate uses a different LLM provider family than the Performance Judge
3. The Soul Analyst performs counterfactual verification for each claimed directive attribution — a counterfactual score overrides self-reported score when they disagree, and the disagreement rate is logged as a system health metric
4. Each agent receives a verdict row in `council_verdicts` with one of 5 verdict types (Promote, Maintain, Monitor, Demote, Retire), a weighted confidence score (Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15%), a plain-language summary, and a human-confirmation-required flag
5. A strong unresolved Devil's Advocate argument automatically escalates the verdict to human review regardless of the aggregate score

**Plans:** TBD

---

#### Phase 12: Human Confirmation Gate

**Goal:** Promote and Retire verdicts are gated behind an operator confirmation step before the God Layer acts — the gate is built to resist rubber-stamping from launch, not as a future hardening pass.
**Depends on:** Phase 11
**Requirements:** CONF-01, CONF-02, CONF-03, CONF-04

**Success Criteria:**
1. A Promote or Retire verdict cannot trigger any DNA library write or class transition until the operator calls `POST /verdicts/:verdictId/confirm` — Maintain, Monitor, and Demote verdicts execute automatically without requiring confirmation
2. The confirmation UI surfaces at least one concrete evidence item (a specific tool call sequence, or the Devil's Advocate argument where one exists) before the confirm and reject controls are rendered
3. The reject path is visually equivalent in weight to the confirm path and carries a label framing rejection as a positive contribution to the army's learning
4. Per-user confirmation rate above 95% across 10 or more confirmations triggers a calibration warning visible to the operator

**Plans:** TBD

---

#### Phase 13: God Layer and Agent Class System

**Goal:** Confirmed verdicts drive the DNA Library forward — class transitions execute, mutation cycles are prepared, negative signal is preserved, and the evolutionary loop closes end to end.
**Depends on:** Phase 12
**Requirements:** GODL-01, GODL-02, GODL-03, GODL-04, GODL-05, GODL-06, GODL-07, CLAS-01, CLAS-02, CLAS-03, CLAS-04, CLAS-05, CLAS-06

**Success Criteria:**
1. The God Layer BullMQ worker starts alongside the existing openclaw dispatcher — on receiving a confirmed verdict, it executes class transition, DNA library write, and negative register update atomically, with idempotency guaranteed by `council_verdicts.status` atomic state transition
2. Each DNA Library entry written by God Layer contains: full SOUL.md content, task category, agent class at write time, composite fitness score with dimension breakdown, causal attribution report summary, council verdict summary with confidence scores, human confirmation timestamp, and full mutation lineage (parent soul IDs and operations applied)
3. Every DNA Library write creates a new versioned record linked to its predecessor — no write overwrites an existing entry — and the full evolutionary lineage from first Novice run to Artisan graduation is traceable through linked version records
4. An agent's class (Novice, Understudy, Artisan) is tracked per task category independently — the same bot can be Artisan in one category and Novice in another, and class transitions (promotion, demotion, retirement) follow the specified thresholds including human confirmation counts and council confidence floors
5. Pioneer events (first confirmed run in a novel task category) instantiate a benchmark, receive a permanent Pioneer designation in the library, and gate promotion eligibility until 3 confirmed comparable runs mature the benchmark
6. God Layer holds a Redis lock on the category soul library during active campaigns and evaluates only the `bot_souls` snapshot recorded at execution start — mid-run library mutations never affect agents in flight

**Plans:** TBD

---

#### Phase 14: UI Extensions

**Goal:** The evolutionary system is visible and actionable in the UI — the leaderboard shows class and verdict context, operators can confirm verdicts with evidence, lifecycle events are narrated in real time, and the Army Builder lets users understand the composition they are about to deploy.
**Depends on:** Phase 13
**Requirements:** UIEX-01, UIEX-02, UIEX-03, UIEX-04, UIEX-05

**Success Criteria:**
1. The post-run leaderboard displays each bot's agent class tier badge (Novice / Understudy / Artisan), council verdict summary, and pioneer flag alongside existing performance metrics and cost — no existing leaderboard data is removed or rearranged
2. Pending Promote and Retire verdicts appear as notifications in the UI with a confirmation panel that surfaces at least one concrete evidence item before confirm and reject controls are available
3. SSE pushes narrative lifecycle event notifications to connected users for promotion, demotion, retirement, and pioneer events — each notification carries a human-readable description (for example: "Agent 7 has been promoted to Understudy after three successful lead generation campaigns")
4. The Army Builder UI identifies task categories in the submitted objective, displays the available class mix per category with library-depth rationale, and presents a budget breakdown across three composition tiers (full, 75%, minimum viable at 3 Novices per task)
5. Army Builder blocks submission when minimum viable composition (3 agents per task category) exceeds the budget — the block is accompanied by a plain explanation and never silently reduces the agent count

**Plans:** TBD

---

## Coverage Validation

- v2.0 requirements: 37 total
- Mapped: 37
- Unmapped: 0
- All requirements mapped: ✓

| Requirement | Phase |
|-------------|-------|
| SOUL-01 | Phase 8 |
| SOUL-02 | Phase 9 |
| SOUL-03 | Phase 8 |
| SOUL-04 | Phase 8 |
| SGEN-01 | Phase 9 |
| SGEN-02 | Phase 9 |
| SGEN-03 | Phase 9 |
| SGEN-04 | Phase 9 |
| SGEN-05 | Phase 9 |
| DTRC-01 | Phase 10 |
| DTRC-02 | Phase 10 |
| DTRC-03 | Phase 8 |
| CNCL-01 | Phase 11 |
| CNCL-02 | Phase 11 |
| CNCL-03 | Phase 11 |
| CNCL-04 | Phase 11 |
| CNCL-05 | Phase 11 |
| CNCL-06 | Phase 11 |
| CONF-01 | Phase 12 |
| CONF-02 | Phase 12 |
| CONF-03 | Phase 12 |
| CONF-04 | Phase 12 |
| GODL-01 | Phase 13 |
| GODL-02 | Phase 13 |
| GODL-03 | Phase 13 |
| GODL-04 | Phase 13 |
| GODL-05 | Phase 13 |
| GODL-06 | Phase 13 |
| GODL-07 | Phase 13 |
| CLAS-01 | Phase 13 |
| CLAS-02 | Phase 13 |
| CLAS-03 | Phase 13 |
| CLAS-04 | Phase 13 |
| CLAS-05 | Phase 13 |
| CLAS-06 | Phase 13 |
| UIEX-01 | Phase 14 |
| UIEX-02 | Phase 14 |
| UIEX-03 | Phase 14 |
| UIEX-04 | Phase 14 |
| UIEX-05 | Phase 14 |

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
| 8. Database Schema and Shared Types | v2.0 | 0/TBD | Not started | - |
| 9. Soul Generation and Dispatch Integration | v2.0 | 0/2 | Not started | - |
| 10. Decision Trace Collection | v2.0 | 0/TBD | Not started | - |
| 11. The Council | v2.0 | 0/TBD | Not started | - |
| 12. Human Confirmation Gate | v2.0 | 0/TBD | Not started | - |
| 13. God Layer and Agent Class System | v2.0 | 0/TBD | Not started | - |
| 14. UI Extensions | v2.0 | 0/TBD | Not started | - |
