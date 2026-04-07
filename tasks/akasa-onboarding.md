Here’s your document cleanly converted into Markdown:

---

# AKASA

## Onboarding Flow

**Product Requirements Document v1.0**

**Status**
Draft — for co-founder review

**Author**
Dhruv / Jungle Punk Ventures

**Date**
March 2026

**Scope**
End-to-end onboarding: first visit through first agent action

**Related**
Akasa Product Blueprint v2, Akasa Vision Doc, Demo v4 

---

## 1. Purpose

This PRD defines the onboarding flow for Akasa — the experience a user goes through from landing on the product for the first time to their first agent taking a real action on their behalf.

Onboarding is not a formality. It is the product's first act of intelligence. Done right, it sets up the entire compounding loop: the right agents, with the right souls, running on the right model tier, against a business context that Indra actually understands.

Done wrong, it creates a team of misaligned agents that underperform from run one, poisoning the system before value is demonstrated.

---

## 2. Scope and Out of Scope

### In Scope

* Entry point selection: Start Mode (0 to 1) vs Connect Mode (1 to N)
* Business context capture: type, vertical, primary challenge, budget
* Tool connection flow (Connect Mode only)
* Team proposal: agent roles, names, model tier assignment, soul archetype selection
* User confirmation and crew summoning
* First task prompt: Indra's opening brief after team is assembled
* Navigation unlock: Office, Chat, Sanctum tabs

### Out of Scope

* Authentication and account creation
* Payment and billing setup
* Deep tool OAuth flows
* Soul mutation and karma accumulation
* Contractor spawning

---

## 3. The Two Entry Points

| Start Mode (0 → 1)           | Connect Mode (1 → N)              |
| ---------------------------- | --------------------------------- |
| User has an idea             | User has a live business          |
| No tools yet                 | Existing tools (CRM, ads, etc.)   |
| Agents from archetypes       | Agents from real data             |
| First action: setup workflow | First action: analyze + quick win |
| Smaller market               | Larger market                     |

**Key Insight:**
Connect Mode is the larger opportunity and faster path to value. It should be visually dominant.

---

## 4. Start Mode Flow (0 → 1)

### 4.1 Question Sequence

* Q1: Business type
* Q2: First goal
* Q3: Monthly budget

All questions support:

* Chip-based responses
* Free text input

---

### 4.2 Team Proposal

Indra generates 3 agents:

* Name (identity)
* Role (Marketing, Sales, Ops, Finance)
* Model tier (Haiku / Sonnet / Opus)
* One-line responsibility

Budget directly determines model tier.

---

### 4.3 Confirm and Summon

CTA: **SUMMON THE CREW**

After confirmation:

* Tabs unlock (Office, Chat, Sanctum)
* Office initializes
* Indra sends opening brief
* Sanctum shows baseline metrics

---

### 4.4 Indra Opening Brief (Start Mode)

Must:

* Acknowledge business + goal
* Name agents and roles
* Propose a concrete first task
* Ask for confirmation

---

## 5. Connect Mode Flow (1 → N)

### 5.1 Question Sequence

* Q1: Business type
* Q2: Tool selection
* Q3: Main improvement goal

---

### 5.2 Connection Panel

States:

* Connected
* Analysing
* Needs setup

Indra message:

> Connecting now. Give me a moment to read your business.

---

### 5.3 Team Proposal (Data-Informed)

Differences from Start Mode:

* Roles based on tools
* Quick wins surfaced immediately
* Model tier based on data volume

---

### 5.4 Confirm and Summon

After confirmation:

* Tabs unlock
* Agents already in motion
* Indra sends data-based brief
* Sanctum shows real metrics

---

### 5.5 Indra Opening Brief (Connect Mode)

Must:

* Reference real data
* Be specific
* Avoid generic messaging

---

## 6. Agent Roles and Model Tier

### 6.1 Default Roles

| Role           | Name  | Tier   |
| -------------- | ----- | ------ |
| Marketing      | Mira  | Sonnet |
| Sales          | Kael  | Sonnet |
| Ops            | Asha  | Sonnet |
| Finance        | Roan  | Haiku  |
| Chief of Staff | Indra | Opus   |

---

### 6.2 Tier Logic

* < $50 → all Haiku
* $50–200 → core Sonnet, finance Haiku
* $200+ → all Sonnet
* Opus only via progression
* Indra always Opus

---

### 6.3 Soul Archetypes

| Archetype                | Description        | Best Fit  |
| ------------------------ | ------------------ | --------- |
| Cautious Verifier        | Risk-aware         | Finance   |
| Aggressive Executor      | Fast, output-heavy | Sales     |
| Creative Synthesizer     | Novel thinking     | Marketing |
| Structured Analyst       | Data-first         | Ops       |
| Collaborative Integrator | Coordination       | Ops       |
| Balanced Pragmatist      | Generalist         | Any       |

---

## 7. Edge Cases

* No tools in Connect Mode → fallback to Start
* Mid-flow abandonment → resume progress
* Ambiguous input → confirm interpretation
* Tool ingestion failure → fallback proposal
* Budget constraints → surfaced explicitly
* Agent edits → trigger re-proposal

---

## 8. Functional Requirements

### MUST

* Fork is first interaction
* No team before tool connection
* Budget drives model tier
* Indra brief must be specific
* Tabs locked until confirmation
* Free text always allowed
* Progress persists

### SHOULD

* Archetypes auto-selected
* Data referenced in Connect Mode
* Quick wins pre-confirmation
* Budget warnings inline

### COULD

* Rename agents
* Show cost estimates
* Skip budget (default Sonnet)

---

## 9. Non-Functional Requirements

* 70% onboarding completion
* < 5 min to first action
* 15 sec connection timeout
* Mobile compatible
* Accessible UI
* Human-readable errors

---

## 10. Demo vs Target State

| Area            | Demo        | Target            |
| --------------- | ----------- | ----------------- |
| Entry fork      | Basic chips | Dominant selector |
| Budget          | Missing     | Required          |
| Tool connection | Simulated   | Real              |
| Team            | Static      | Dynamic           |
| Opening brief   | Generic     | Contextual        |
| Quick wins      | None        | Pre-confirmation  |
| Persistence     | None        | Full              |
| Mobile          | Untested    | Required          |

---

## 11. Open Questions

* Budget input: range vs numeric
* Number of agents: 3 vs 4
* Replace agents logic
* Indra persona flexibility
* Enterprise tool access delays
* Re-onboarding capability

---

## 12. Success Metrics

| Metric          | Target      |
| --------------- | ----------- |
| Mode selection  | 60% Connect |
| Completion rate | 70%         |
| Time to action  | < 5 min     |
| Tool connection | 80%         |
| Day-7 retention | 50%         |
| First-run karma | > 60        |

---

## Appendix — Flow Diagram

### Start Mode

1. Q1
2. Q2
3. Q3
4. Proposal
5. Confirm
6. Indra brief

### Connect Mode

1. Q1
2. Tool selection
3. Connection
4. Q3
5. Proposal
6. Confirm
7. Indra brief

### Shared State

* Office active
* Chat active
* Sanctum active

---

If you want, I can tighten this into a **1-page co-founder version** or convert it into a **pitch / Notion-ready doc**.
