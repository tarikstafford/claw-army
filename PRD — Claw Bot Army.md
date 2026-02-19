✅ PRD — Claw Bot Army
Master MVP v1.0 (Final)
1. Product Vision

Claw Bot Army enables SMEs and individuals to deploy multiple AI bot workers (“Claw Bots”) against a high-level objective, with:

Safe orchestration

Pay-per-bot-hour pricing

Guardrails against runaway spend

Retroactive performance reporting

Continuous improvement via DNA capture

The system acts like:

“An AI workforce you can deploy, monitor, and improve over time.”

2. Target Users
Primary

SMEs who want AI labor without complexity

Secondary

Individuals running intensive workflows (research, ops, automation)

3. Core Value Proposition

“Deploy a crew of bots. Pay hourly. Watch them work. See performance. Improve every run.”

4. MVP Pillars

Master MVP delivers 6 foundational pillars:

Objective → Execution orchestration

Secure bot runtime isolation

Tool Gateway with strict control

Per-hour-per-bot billing + metering

Performance intelligence + scoring

UI Command Center for execution + reporting

5. System Architecture (High Level)
Control Plane

Execution Service

Planner (simple splitter)

Task Queue

Bot Orchestrator

Guardrail Watchdog

Performance Engine

Billing Engine

DNA Capture Engine

Data Plane

Bot Workers (isolated containers/microVMs)

Tool Gateway (only external interface)

Artifact Store

Telemetry + Trace Store

DNA Store

6. Functional Requirements
6.1 Execution Creation (Objective Input)
Endpoint

POST /executions

Input

objective_text

max_bots

allowed_tools

max_budget_usd

max_runtime_minutes

Output

execution_id

status = queued

Execution lifecycle states:

queued

running

paused

stopped (budget/policy)

completed

failed

6.2 Planner (MVP Simplicity)

MVP planner performs:

Objective → N independent tasks

Parallelizable workload only

No recursive replanning

No DAG visual builder

Example:

Objective: “Process 100 customer emails”
→ 100 tasks, each email = one task

6.3 Bot Orchestration
Requirements

Spawn up to max_bots

Bots claim tasks via leasing

Bots shut down after idle timeout

Task reassignment on failure

Each bot is:

Ephemeral

Isolated

Stateless

No credentials

No direct internet

6.4 Bot Runtime Sandbox

Each bot runs inside:

Container or microVM

CPU/memory/runtime capped

No persistent filesystem

Network restricted to Tool Gateway only

6.5 Tool Gateway (Mandatory Security Layer)

Bots may ONLY access tools through:

POST /tool.invoke

Gateway enforces:

Tool allowlists

Argument schema validation

Rate limits

Budget enforcement

Full audit logging

MVP Tool Set
Tool	Notes
llm_call	Metered inference
fetch_url	Domain allowlist only
write_file	Artifact storage only

No arbitrary shell execution in MVP.

6.6 Guardrails & Abuse Prevention

Hard controls include:

Budget Caps

Execution stops when max_budget reached.

Token Burn Limits

Max tokens/min per bot.

Tool Call Rate Limits

Max tool calls/min per bot.

Loop Detection

Watchdog kills bots showing repetitive thrashing.

Idle Shutdown

Bots terminate after 5 min idle.

If violated:

Bot revoked

Execution paused/stopped

Event logged

6.7 Billing & Metering (Per Bot-Hour)
Pricing Unit

1 bot-hour = wall-clock runtime of one bot instance

Metering Events

bot_started

bot_stopped

tool_invoked

execution_completed

budget_exceeded

Billing Formula

Total cost:

Σ(bot_runtime_hours) × hourly_rate

UI must show:

bot-hours consumed

estimated cost

remaining budget

7. Performance Intelligence Layer
7.1 Structured Trace Capture (Bot Telemetry)

For every bot capture:

bot_id

tasks handled

runtime

token usage

tool calls

retries

errors

For every step capture:

timestamp

prompt input

response output

tool invoked

tool arguments

tool output summary

duration

tokens used

Stored as structured trace data (not raw logs).

7.2 Retroactive Bot Performance Metrics

Computed post-run:

Efficiency

tasks/min

tokens/task

tool calls/task

idle ratio

Reliability

success rate

retry rate

error frequency

Cost Efficiency

cost per successful task

7.3 Composite Bot Performance Score

Each bot receives a normalized score:

Score =
  Success Rate (40%)
+ Efficiency (30%)
+ Cost Efficiency (20%)
+ Stability (10%)

Score stored historically for improvement tracking.

8. Buyer-Facing Performance Reporting

Execution report must include:

total bots used

total bot-hours

total cost

average bot score

top-performing bot

error distribution

cost per task

Bot leaderboard:

Bot	Tasks	Runtime	Score	Tier

Tiers:

High (green)

Medium (yellow)

Low (red)

9. Bot DNA Capture & Improvement Moat
9.1 Elite Bot Identification

After execution:

If bot_score exceeds threshold AND:

above execution average by X%

low error rate

high efficiency

→ Mark bot as Elite Candidate

9.2 DNA Capture Requirements

Capture replayable “DNA”:

system prompt

planning approach

tool call sequence

argument patterns

retry strategy

decision branches

timing + token distribution

Stored as versioned execution template.

9.3 DNA Store + Governance

DNA must be:

tenant-safe

PII redacted

structural (patterns) not raw customer data

tagged by objective category

9.4 Replay Engine (Internal Only)

Internal tool enables:

replay top-performing DNA

benchmark against baseline bots

validate repeatability

prevent overfitting

Not user-facing in MVP.

10. UI Requirements (MVP Command Center)

UI is required for SME usability.

10.1 Screen: New Execution

User inputs:

Objective text

Max bots (slider)

Budget cap ($)

Allowed tools (multi-select)

CTA:

Deploy Crew

10.2 Screen: Live Execution View

Displays:

Status (Running/Paused/Completed)

Active bots count

Bot-hours consumed

Budget remaining

Estimated cost

Live Activity Feed:

bot claimed task

tool invoked

task completed

guardrail triggered

10.3 Screen: Post-Execution Dashboard

Execution summary:

Total cost

Total bot-hours

Tasks completed

Avg score

Top bot

Bot leaderboard table with tier indicators.

10.4 Screen: Bot Detail View

Per bot:

tasks completed

runtime

token usage

tool calls

error count

performance score

Optional developer expandable:

step trace

tool breakdown

10.5 Screen: Usage & Billing

Shows:

bot-hours this month

spend estimate

historical executions

cost per execution

11. MVP Launch Criteria (Definition of Done)

Master MVP is complete when:

Users can launch executions via UI

10+ bots run concurrently

Tool Gateway blocks unauthorized calls

Budget + rate guardrails stop runaway behavior

Bot-hours billing is accurate

Performance scoring works per bot

Buyers see execution + bot leaderboard

Elite bot DNA can be captured + replayed internally