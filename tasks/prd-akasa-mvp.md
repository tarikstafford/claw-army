# PRD: Akasa MVP

**Companion documents:**
- `tasks/akasa-design-guide.md` — Complete visual language reference (two worlds, typography, colour, components, do/don'ts)
- `tasks/akasa-onboarding.md` — Onboarding flow PRD (Start Mode, Connect Mode, team proposal, Indra brief)
- `tasks/akasa-vision.html` — Interactive visual for team presentations
- `design-context.md` — Original claw-army design system reference (Director's Cut foundation)

## Introduction

Akasa is a D2C product that wraps the Paperclip AI orchestration platform into a consumer-facing experience where anyone can acquire, deploy, and evolve AI agents to create compounding value. The core thesis is that value creation is a **war of attrition** — the number of agents you operate (**bit rate**) and how good they are at their task (**effective bit rate**) determines your output. Agents aren't static tools; they evolve. Each agent carries a **soul** — a behavioral profile that mutates through a genetic algorithm inspired by Karpathy's autoresearch loop: try, evaluate against immutable metrics, keep or discard, repeat. High-performing behavioral DNA is captured and made available through the **Akashic Library**, a marketplace where users can acquire pre-evolved agent souls proven in production.

Agents don't operate in a vacuum — they interface with the real world through the **Tool Nexus**, an extensible gateway where users connect external services (HubSpot, Telegram, Stripe, etc.) and agents consume them as capabilities. The Tool Nexus is also a **cloud-hosted runtime** where agents can eventually build and deploy their own tooling — launching webhook receivers, microservices, and integrations autonomously. This closes the loop: agents don't just execute tasks, they extend their own reach.

Beyond tools, agents carry **skills** — discrete, composable units of procedural knowledge that define *how* an agent approaches a class of work. Skills are inspired by Claude Code's skill system (SKILL.md files with progressive disclosure) but adapted for autonomous learning: agents can acquire skills from the **Skill Bazaar** marketplace, learn new skills through successful execution patterns, and unlearn skills that degrade performance. Skills sit between the soul (who the agent *is*) and tools (what the agent *can access*) — they represent what the agent *knows how to do*.

Running an empire of agents means you need to talk to them. The **Command Channel** is Akasa's communication layer — a chat-first interface for directing your CEO, delegating to specialists, and monitoring fleet conversations. Built on Paperclip's issue-backed communication system (issue comments as the durable record, WebSocket live streaming, agent sessions with task-key continuity), the Command Channel surfaces this as a consumer-grade chat experience. Talk to your CEO in natural language, watch agents collaborate on tasks in real-time, and bridge external channels (Telegram, Slack) into the same conversation fabric.

**Base layer:** Akasa is built in the `claw-army` repository — which already has auth, GCP infrastructure, Cloud SQL (PostgreSQL + pgvector), the evolution engine (soul system, council, god layer), and a Svelte 5 + Fastify stack. Paperclip (`claw-paper-clip`) runs as a **separate service dependency** providing agent orchestration, adapters, and the plugin SDK. Akasa calls Paperclip's API for agent dispatch, session management, and adapter coordination — but all product logic (evolution, skills, tools, billing, UI) lives in claw-army.

**Onboarding model:** CEO-first, identical to Paperclip's existing flow. Your first agent is the CEO — the orchestrator that delegates to the fleet you build beneath it.

## Goals

- Ship a consumer-grade UX on top of Paperclip's existing orchestration engine
- Implement the soul system (7 behavioral dimensions, mutation, constitution) adapted from claw-army
- Build the Karpathy-loop feedback engine: autonomous try→evaluate→keep/discard cycle per agent per task category
- Implement the Council (3-judge evaluation) and God Layer (class transitions, DNA capture, negative signals)
- Launch the Akashic Library — a marketplace for acquiring pre-evolved agent souls
- Provide full transparency into agent evolution: verdicts, mutation diffs, dimension breakdowns, lineage trees
- Measure agent fitness via a composite score (task completion rate, speed, cost efficiency) plus per-task completion metric
- Enable users to scale from 1 agent (CEO) to N agents, each independently evolving
- Build the Tool Nexus — an extensible gateway where users connect external services and agents consume them as capabilities
- Lay groundwork for agent-authored tooling: a cloud-hosted runtime where agents can deploy their own webhook receivers, services, and integrations
- Implement the Skill System — composable procedural knowledge units that agents can learn, unlearn, and share
- Launch the Skill Bazaar — a marketplace for proven skill packages that agents can acquire
- Build the Command Channel — a chat-first interface for communicating with your CEO and fleet, with multi-channel bridging (Telegram, Slack)

## User Stories

### US-001: Onboarding — First Visit to First Agent Action
**Description:** As a new user, I want a guided onboarding experience that captures my business context, proposes a team of agents with appropriate souls and model tiers, and gets my first agent taking a real action — all within 5 minutes.

> **Full specification:** `tasks/akasa-onboarding.md` — complete onboarding PRD covering Start Mode (0→1) and Connect Mode (1→N) flows, question sequences, team proposal logic, Indra's opening brief, model tier assignment, and edge cases.

**Acceptance Criteria:**
- [ ] Entry point fork: Start Mode (new idea, no tools) vs Connect Mode (live business, existing tools) — Connect Mode visually dominant
- [ ] Start Mode: 3-question sequence (business type → first goal → monthly budget) → Indra proposes 3 agents with names, roles, model tiers, soul archetypes
- [ ] Connect Mode: business type → tool selection + connection → improvement goal → data-informed team proposal with quick wins
- [ ] Budget determines model tier: <$50 all Haiku, $50-200 core Sonnet, $200+ all Sonnet, Opus only via progression. Indra (CEO) always Opus
- [ ] "SUMMON THE CREW" confirmation unlocks Office, Chat, and Sanctum tabs
- [ ] Indra sends a contextual opening brief (references real data in Connect Mode, proposes concrete first task, names agents and roles)
- [ ] All questions support chip-based responses + free text input
- [ ] Progress persists across sessions (mid-flow abandonment → resume)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Soul Profile Card
**Description:** As a user, I want to see each agent's behavioral personality summarized in plain language so I understand how it operates without reading raw markdown.

**Acceptance Criteria:**
- [ ] Each agent displays a Soul Card showing the 7 behavioral dimensions as human-readable summaries
- [ ] Dimensions rendered as labeled traits (e.g., "Risk Tolerance: Conservative — verifies before acting")
- [ ] Soul Card shows: generation number, parent lineage (1-click to view parent soul), archetype origin
- [ ] Constitution directives shown as "Hard Rules" section (inviolable behaviors)
- [ ] Content hash and version displayed for traceability
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Define Objectives with Success Metrics
**Description:** As a user, I want to create objectives with explicit success metrics so agents have immutable evaluation criteria to optimize against.

**Acceptance Criteria:**
- [ ] Objective creation form includes: title, description, task category, success metric definition
- [ ] Success metric definition supports: composite score weights (completion rate, speed, cost efficiency) + custom completion criteria
- [ ] Metrics are immutable after first agent run begins (Karpathy principle: agent cannot modify its own evaluation)
- [ ] Objective auto-classifies into a task category (used for DNA matching and pioneer tracking)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Agent Acquisition from Akashic Library
**Description:** As a user, I want to browse and acquire pre-evolved agent souls from the Akashic Library so I can start with proven behavioral patterns instead of baseline archetypes.

**Acceptance Criteria:**
- [ ] Library page shows available souls filterable by: task category, agent class (Novice/Understudy/Artisan), composite score, generation count
- [ ] Each listing shows: soul summary card, fitness score, mutation lineage depth, category specialization, number of successful runs
- [ ] "Acquire" action clones the soul as a new agent in the user's fleet (new bot, copied soul, generation incremented)
- [ ] 6 canonical archetypes always available as free baseline options (Cautious Verifier, Aggressive Executor, Creative Synthesizer, Structured Analyst, Collaborative Integrator, Balanced Pragmatist)
- [ ] DNA provenance shown: full lineage tree from archetype → current form
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: The Karpathy Loop — Autonomous Feedback Engine
**Description:** As a user, I want my agents to autonomously improve their performance through a try→evaluate→keep/discard cycle so they compound value without manual tuning.

**Acceptance Criteria:**
- [ ] After each task execution, agent performance is scored against the objective's immutable composite metric
- [ ] Composite score computed from: task completion rate (weight configurable), execution speed (time to completion), cost efficiency (tokens/$ per unit of output)
- [ ] Per-task completion metric recorded (binary: completed/failed + quality signal if available)
- [ ] Score compared against category benchmark (pioneer baseline or running best)
- [ ] If score improved: soul changes are kept, DNA captured, agent advances
- [ ] If score regressed or held: soul changes are discarded (reverted to pre-mutation state for next cycle)
- [ ] Loop runs continuously across executions — no manual trigger needed after initial objective
- [ ] Results logged to a per-agent experiment ledger (analogous to autoresearch's results.tsv)
- [ ] Typecheck passes

### US-006: Council Evaluation — Three-Judge System
**Description:** As a user, I want each agent evaluated by an independent council so verdicts are rigorous and not based on a single perspective.

**Acceptance Criteria:**
- [ ] After execution, three independent judges evaluate the agent:
  - Performance Judge (50% weight): quantitative task metrics, success rate, composite score
  - Soul Analyst (35% weight): counterfactual verification — did soul directives actually cause the behavior, or would the agent have acted the same anyway?
  - Devil's Advocate (15% weight): adversarial challenge of apparent success — were tasks trivial? Did agent get lucky?
- [ ] Each judge produces: verdict type (Promote/Maintain/Monitor/Demote/Retire), confidence score (0-1), reasoning
- [ ] Judges never see each other's outputs (independence guarantee)
- [ ] Weighted aggregation produces final verdict with combined confidence
- [ ] If Devil's Advocate raises a "strong" unresolved challenge → verdict requires human confirmation before God Layer executes
- [ ] Full council output visible to user in agent's Evolution History
- [ ] Typecheck passes

### US-007: God Layer — Class Transitions & DNA Capture
**Description:** As a user, I want the system to automatically promote, demote, or retire agents based on council verdicts so the fleet self-optimizes.

**Acceptance Criteria:**
- [ ] Agent class progression: Novice → Understudy → Artisan (or → Retired)
- [ ] Promotion rules enforced deterministically:
  - Novice → Understudy: 2+ above-benchmark runs, 1+ human confirmation, confidence > 0.65, benchmark mature (3+ category runs)
  - Understudy → Artisan: 5+ above-benchmark, ≤1 below-benchmark, 2+ human confirmations, confidence > 0.80
- [ ] Demotion: 2+ consecutive below-benchmark runs (soul-driven agents only), confidence > 0.70
- [ ] Retirement: verdict type = Retire AND soul-driven
- [ ] On every verdict: DNA snapshot captured to `dna_store` (insert-only, versioned, never updated)
- [ ] On retirement/demotion: negative signal written to `negative_signal_register` with failed directives and mutation blacklist
- [ ] Pioneer detection: first successful agent in a task category establishes frozen baseline benchmark
- [ ] Class transitions emit events visible in agent timeline
- [ ] Typecheck passes

### US-008: Soul Mutation Engine
**Description:** As a user, I want agent souls to mutate between runs so they explore behavioral variations that might improve performance.

**Acceptance Criteria:**
- [ ] Before each execution cycle, agent's soul is mutated from its current state
- [ ] Mutation operations: substitution, amplification, attenuation, recombination (with second parent), introduction
- [ ] Novel task categories (no history): conservative mutations (substitution + attenuation only, low temperature)
- [ ] Known task categories (history exists): full mutation palette, guided by top-5 DNA entries + negative signal register
- [ ] Constitution directives (ethical hard stops) validated after every mutation — must appear verbatim; retry up to 5x if missing
- [ ] Embedding similarity check: mutated soul must differ from all siblings by cosine similarity < 0.85 (prevents convergence)
- [ ] If mutation fails validation after retries: flag for human review, do not deploy
- [ ] Mutation diff viewable by user: before/after comparison of each dimension
- [ ] Typecheck passes

### US-009: Evolution Dashboard
**Description:** As a user, I want a dashboard showing my fleet's evolution over time so I can see the compounding value of my agents.

**Acceptance Criteria:**
- [ ] Fleet overview: agent count by class (Novice/Understudy/Artisan/Retired), total composite score trend
- [ ] Per-agent evolution timeline: every council verdict, class transition, mutation event, DNA capture
- [ ] Lineage tree visualization: which archetype/acquired soul → mutations → current form
- [ ] Experiment ledger per agent: run-by-run log showing score, keep/discard, mutation applied
- [ ] Category benchmarks view: pioneer baselines, benchmark maturity, thin-data flags
- [ ] Fleet "bit rate" metric: total agent count × average composite score = effective output capacity
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Agent Scaling & Fleet Management
**Description:** As a user, I want to add agents to my fleet and assign them to objectives so I can increase my bit rate.

**Acceptance Criteria:**
- [ ] "Add Agent" action: choose from Akashic Library (pre-evolved) or 6 free archetypes
- [ ] Assign agent to one or more objectives
- [ ] Agent capacity view: how many agents are running, idle, or queued
- [ ] Cost tracking per agent: tokens consumed, estimated $/agent/day
- [ ] Bulk operations: pause/resume/retire multiple agents
- [ ] Fleet budget cap: user sets max $/day spend, system pauses agents when approaching limit
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Human-in-the-Loop Confirmation Gates
**Description:** As a user, I want to be notified when the system needs my confirmation before executing high-stakes transitions so I maintain control.

**Acceptance Criteria:**
- [ ] Notification when Devil's Advocate raises strong unresolved challenge
- [ ] Notification when mutation fails constitution validation and is flagged for review
- [ ] Confirmation UI shows: full council verdict, judge reasoning, mutation diff, recommendation
- [ ] User can: approve (execute transition), reject (revert to pre-verdict state), or override verdict type
- [ ] Pending confirmations shown in dashboard notification badge
- [ ] Telegram bot integration: confirmations can be approved/rejected via Telegram (leveraging existing telegram-bot service)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Akashic Library — Publishing Souls
**Description:** As a user, I want to publish my high-performing agent souls to the Akashic Library so others can benefit from my agents' evolution.

**Acceptance Criteria:**
- [ ] Only Artisan-class agents can be published (proven through full promotion pipeline)
- [ ] Publishing creates an anonymized DNA snapshot: soul content, fitness scores, category, lineage depth (no user data)
- [ ] Publisher sets: listing title, description, suggested use cases
- [ ] Published souls show: composite score, run count, category specialization, generation depth
- [ ] Published souls are cloneable — acquiring user gets a copy, not a reference (independent evolution from that point)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-013: Tool Nexus — Connect External Services
**Description:** As a user, I want to connect external services (HubSpot, Telegram, Slack, Stripe, Google Sheets, etc.) to my fleet so agents can interact with the real world.

**Acceptance Criteria:**
- [ ] Tool Nexus page shows a catalog of available integrations organized by category (CRM, Communication, Payments, Data, etc.)
- [ ] Each integration has a connection flow: OAuth where supported, API key input otherwise
- [ ] Connected tools appear in the user's "Tool Belt" — the set of capabilities available to their agents
- [ ] Each tool exposes a set of **actions** (e.g., HubSpot: create contact, update deal, list companies) and **triggers** (e.g., new deal created, contact updated)
- [ ] Tools are represented as typed contracts: input schema, output schema, auth method, rate limits
- [ ] Agents can discover and invoke any tool in the user's Tool Belt during task execution
- [ ] Connection status visible: connected, expired, rate-limited, errored
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-014: Tool Nexus — Tool Invocation Gateway
**Description:** As an agent, I need a unified gateway to invoke any connected tool so I don't need to know the specifics of each external API.

**Acceptance Criteria:**
- [ ] Single gateway endpoint that agents call with: `toolId`, `action`, `params`
- [ ] Gateway handles auth injection (OAuth tokens, API keys) — agents never see raw credentials
- [ ] Gateway validates request params against the tool's input schema before forwarding
- [ ] Gateway normalizes responses into a consistent envelope: `{ success, data, error }`
- [ ] Rate limiting enforced per-tool per-user (respects external API limits)
- [ ] All invocations logged: tool, action, agent, execution, timestamp, latency, success/failure
- [ ] Tool usage tracked in cost accounting (some tools may have per-call costs)
- [ ] Retry logic with exponential backoff for transient failures (429, 503)
- [ ] Typecheck passes

### US-015: Tool Nexus — Webhook Receiver
**Description:** As a user, I want to receive webhooks from external services so agents can react to real-world events (new customer signed up, payment received, form submitted).

**Acceptance Criteria:**
- [ ] Each connected tool can register webhook endpoints: unique URL per user per tool
- [ ] Incoming webhooks are validated (signature verification where supported), parsed, and routed to the appropriate agent/objective
- [ ] Webhook events can trigger new task creation: event payload becomes task context
- [ ] Webhook routing rules configurable: "when HubSpot deal > $10k → assign to Sales Agent"
- [ ] Event log shows all received webhooks with payload, routing decision, and resulting action
- [ ] Dead letter queue for webhooks that fail routing or agent assignment
- [ ] Typecheck passes

### US-016: Tool Nexus — Custom Tool Registration
**Description:** As a power user, I want to register my own custom tools (any HTTP API) so agents can use services not in the built-in catalog.

**Acceptance Criteria:**
- [ ] "Add Custom Tool" form accepts: name, base URL, auth config (Bearer token, API key header, OAuth2), description
- [ ] User defines actions as: HTTP method, path template, request body JSON schema, response schema
- [ ] Custom tools appear in the Tool Belt alongside built-in integrations
- [ ] Custom tools go through the same gateway (auth injection, schema validation, logging)
- [ ] OpenAPI/Swagger import: paste a spec URL or upload a file to auto-generate actions from an existing API
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-017: Tool Nexus — Agent-Authored Tools (Foundation)
**Description:** As an Artisan-class agent, I want to be able to propose and deploy simple tools (webhook receivers, scheduled scripts, data transformers) so I can extend my own capabilities.

**Acceptance Criteria:**
- [ ] Artisan agents (only) can request tool creation via a structured proposal: tool name, purpose, implementation sketch, required endpoints
- [ ] Proposals require human approval before deployment (confirmation gate, same as US-011)
- [ ] Approved tools are deployed to a sandboxed cloud runtime (isolated container per user)
- [ ] Each agent-authored tool gets: a unique URL, health check, auto-restart on crash, stdout/stderr log capture
- [ ] Agent-authored tools are registered in the Tool Belt and usable by the entire fleet
- [ ] Resource limits enforced per user: max containers, max memory, max CPU, max egress
- [ ] Agent-authored tools can be paused/stopped/deleted by the user from the Tool Nexus UI
- [ ] Deployment logs and runtime logs visible in the Tool Nexus dashboard
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-018: Tool Nexus — Tool Performance in Evolution
**Description:** As a user, I want tool usage patterns to factor into agent evolution so agents that use tools effectively are rewarded and poor tool usage is penalized.

**Acceptance Criteria:**
- [ ] Tool invocation metrics (success rate, latency, cost) are included in the composite fitness score
- [ ] Council's Performance Judge considers tool usage patterns: efficient batching, appropriate tool selection, retry handling
- [ ] Soul Analyst checks if tool usage was soul-driven (directive: "always verify via CRM before acting") or incidental
- [ ] DNA captures include tool usage patterns: which tools, in what sequence, with what outcomes
- [ ] Negative signal register captures tool misuse: excessive retries, wrong tool for task, credential errors caused by agent behavior
- [ ] Typecheck passes

### US-019: Skill Definition & Structure
**Description:** As a skill author, I want a clear format for defining skills so they can be loaded into agents as composable knowledge units.

**Acceptance Criteria:**
- [ ] Each skill is a directory containing a `SKILL.md` file with YAML frontmatter + markdown body
- [ ] Required frontmatter: `name`, `description`, `version`, `category` (e.g., "outreach", "research", "code-review", "data-analysis")
- [ ] Optional frontmatter: `requires_tools` (Tool Nexus dependencies), `requires_skills` (skill dependencies), `min_agent_class` (Novice/Understudy/Artisan)
- [ ] Skill body contains procedural knowledge: step-by-step workflows, decision trees, best practices, error handling strategies
- [ ] Three-level progressive disclosure (mirroring Claude Code's skill system):
  - Level 1 — Metadata (name + description): always loaded into agent context for skill discovery (~100 words)
  - Level 2 — SKILL.md body: loaded when skill is activated for a task (~2,000 words max)
  - Level 3 — Bundled resources (`references/`, `examples/`, `templates/`): loaded on-demand during execution
- [ ] Skills can declare `triggers` — task category patterns that auto-activate the skill (e.g., "when task category matches 'sales-outreach'")
- [ ] Typecheck passes

### US-020: Skill Loadout — Equipping Agents
**Description:** As a user, I want to equip my agents with specific skills so they have the procedural knowledge needed for their objectives.

**Acceptance Criteria:**
- [ ] Each agent has a "Skill Loadout" — the set of skills currently equipped
- [ ] Users can add/remove skills from an agent's loadout via the agent detail page
- [ ] Skill loadout has a capacity limit based on agent class: Novice (3 skills), Understudy (5 skills), Artisan (8 skills)
- [ ] Skills in loadout are injected into the agent's context at execution time (Level 1 metadata always, Level 2 body on trigger match)
- [ ] Loadout changes take effect on the next execution cycle (not mid-task)
- [ ] Agent detail page shows equipped skills with activation frequency stats (how often each skill triggers)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-021: Skill Learning — Acquiring Skills Through Performance
**Description:** As a user, I want agents to learn new skills autonomously when they discover effective patterns, so the fleet's capabilities grow organically.

**Acceptance Criteria:**
- [ ] After each execution, the Council evaluates whether the agent exhibited a repeatable procedural pattern not covered by its current skill loadout
- [ ] If a novel effective pattern is detected (composite score improvement + Soul Analyst confirms directive-driven behavior):
  - System generates a candidate skill definition (SKILL.md) from the agent's decision traces and task context
  - Candidate skill is flagged for review: auto-approved if confidence > 0.80, human approval required otherwise
- [ ] Learned skills are tagged with their origin: `source: "learned"`, `learnedBy: agentId`, `learnedDuring: executionId`
- [ ] Learned skills enter the agent's loadout automatically (if capacity allows) and are available for the fleet
- [ ] Learning event visible in the Evolution Dashboard timeline
- [ ] Typecheck passes

### US-022: Skill Unlearning — Dropping Underperforming Skills
**Description:** As a user, I want agents to automatically unlearn skills that degrade their performance so skill loadouts stay lean and effective.

**Acceptance Criteria:**
- [ ] Skill effectiveness tracked per-agent: activation count, contribution to composite score (positive/negative/neutral)
- [ ] If a skill activates 5+ times with negative or neutral contribution to composite score, it is flagged as "underperforming"
- [ ] Underperforming skills are auto-removed from the agent's loadout after 2 consecutive negative evaluation cycles
- [ ] Unlearning event recorded in Evolution Dashboard with reasoning (which metrics degraded, how often skill activated)
- [ ] Unlearned skills are not deleted — they remain available for re-equipping or for other agents
- [ ] Negative signal register captures unlearned skill metadata for cross-agent pattern detection
- [ ] Typecheck passes

### US-023: Skill Bazaar — Marketplace for Skills
**Description:** As a user, I want to browse and acquire proven skills from a marketplace so I can quickly equip my agents with specialized knowledge.

**Acceptance Criteria:**
- [ ] Skill Bazaar page shows available skills filterable by: category, required tools, min agent class, popularity, effectiveness rating
- [ ] Each listing shows: skill summary, category, required tools, average effectiveness score across all agents using it, total equip count
- [ ] "Acquire" action adds the skill to the user's skill library (available for equipping on any agent)
- [ ] Starter skills ship built-in (free): basic research workflow, task decomposition, error recovery, progress reporting
- [ ] Skills acquired from the Bazaar show provenance: original author (anonymized), source (learned vs. authored), effectiveness history
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-024: Skill Bazaar — Publishing Skills
**Description:** As a user, I want to publish skills that my agents have learned or that I've authored so others can benefit.

**Acceptance Criteria:**
- [ ] Publishable skills must have: 10+ successful activations across the user's fleet, average positive effectiveness score
- [ ] User-authored skills (manually created SKILL.md) can be published without activation history requirement
- [ ] Publishing creates an anonymized snapshot: skill content, effectiveness stats, category, required tools (no user/agent data)
- [ ] Publisher sets: listing title, description, suggested use cases
- [ ] Published skills show: effectiveness rating, equip count, category, compatible tool requirements
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-025: Skill-Aware Evolution
**Description:** As a user, I want the evolution system to consider skill effectiveness when evaluating agents so the Karpathy loop optimizes skill loadouts alongside soul mutations.

**Acceptance Criteria:**
- [ ] Council's Performance Judge includes skill activation metrics in evaluation: which skills fired, how they affected outcomes
- [ ] Soul Analyst verifies skill-soul alignment: do the agent's soul directives complement or conflict with its equipped skills?
- [ ] DNA captures include skill loadout at time of capture: which skills were equipped, activation frequency, effectiveness per skill
- [ ] Mutation engine can suggest skill loadout changes as part of the evolution cycle (add/remove skills alongside soul dimension mutations)
- [ ] Skill effectiveness scores factor into composite fitness: an agent with effective skills scores higher than one relying purely on soul-driven behavior
- [ ] Artisan agents that consistently produce high-performing skill combinations have their loadout captured as a "Skill Blueprint" in DNA
- [ ] Typecheck passes

### US-026: Skill Management UI
**Description:** As a user, I want a dedicated interface for managing my skill library and seeing how skills perform across my fleet.

**Acceptance Criteria:**
- [ ] Skill Library page shows all skills the user has access to: built-in, acquired from Bazaar, learned by agents, user-authored
- [ ] Per-skill detail view: description, full SKILL.md content, equipped agents, activation stats, effectiveness trend
- [ ] Skill authoring interface: create/edit SKILL.md with live preview, set metadata, add reference files
- [ ] Fleet-wide skill heatmap: which skills are most/least effective across all agents
- [ ] Skill conflict detection: warn when equipping skills with contradictory procedures (e.g., "always act fast" vs. "always verify twice")
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-027: Command Channel — Chat with Your CEO
**Description:** As a user, I want to chat with my CEO agent in natural language so I can direct strategy, ask questions, and give instructions without navigating task management UI.

**Acceptance Criteria:**
- [ ] Primary dashboard features a persistent chat interface for talking to the CEO agent
- [ ] Messages sent in chat create issue comments under a "Command Channel" conversation issue (leveraging Paperclip's issue-backed communication system)
- [ ] CEO responses stream in real-time via WebSocket (using Paperclip's live events infrastructure)
- [ ] Chat preserves session continuity: CEO remembers prior conversation context across messages (via `agent_task_sessions` task-key strategy)
- [ ] User can switch between "chat mode" (conversational) and "task mode" (structured issue view) on the same conversation
- [ ] Chat supports markdown rendering, code blocks, and inline file/image references
- [ ] Typing indicator while CEO is generating a response
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-028: Command Channel — Fleet Communication Hub
**Description:** As a user, I want to see and participate in conversations across my entire fleet so I understand what agents are doing and can intervene when needed.

**Acceptance Criteria:**
- [ ] Fleet Comms view shows all active agent conversations in a unified feed (sorted by recent activity)
- [ ] Each conversation shows: agent name, class badge, last message preview, issue title, status
- [ ] Click into any conversation to see full thread with agent responses, user comments, and linked run output
- [ ] @-mention an agent in any conversation to wake it up and reassign (leveraging Paperclip's existing wakeup mechanism)
- [ ] Filter conversations by: agent, status (active/waiting/completed), objective, priority
- [ ] Live streaming output visible inline when an agent is actively working on a task
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-029: Command Channel — Agent-to-Agent Delegation
**Description:** As a user, I want to see when agents delegate work to each other and follow the conversation chain so I understand how my fleet collaborates.

**Acceptance Criteria:**
- [ ] When CEO creates a sub-task and assigns it to another agent, this appears as a delegation event in the conversation thread
- [ ] Delegation chain visible: CEO → specialist agent → sub-task results → CEO synthesizes
- [ ] User can inject comments at any point in the chain (comments trigger wakeup for the assigned agent)
- [ ] Agent-to-agent handoff events show: what was delegated, why, which agent, expected outcome
- [ ] Conversation threads are linked: parent issue conversation references child task conversations
- [ ] Typecheck passes

### US-030: Command Channel — Multi-Channel Bridging
**Description:** As a user, I want to talk to my CEO from Telegram, Slack, or other external channels so I'm not locked into the web UI.

**Acceptance Criteria:**
- [ ] Telegram bridge: messages in Telegram → issue comments → CEO responds → forwarded back to Telegram (leveraging existing telegram-bot service)
- [ ] Slack bridge: similar flow via Slack integration through Tool Nexus
- [ ] All bridged messages appear in the web UI Command Channel alongside native messages (single source of truth)
- [ ] External channel messages tagged with source: `[via Telegram]`, `[via Slack]`
- [ ] CEO's responses are channel-aware: can format differently for Telegram (shorter, markdown-safe) vs. web (full rich content)
- [ ] User can set preferred notification channel: "notify me on Telegram when agents need confirmation"
- [ ] Typecheck passes

### US-031: Command Channel — Quick Commands
**Description:** As a user, I want shortcut commands in the chat interface for common fleet operations so I can manage agents without leaving the conversation.

**Acceptance Criteria:**
- [ ] `/status` — fleet overview: agents by class, active tasks, pending confirmations
- [ ] `/agents` — list all agents with status and current task
- [ ] `/assign @AgentName <task description>` — create a new task and assign it
- [ ] `/pause @AgentName` / `/resume @AgentName` — control agent execution
- [ ] `/evolve @AgentName` — trigger an evolution cycle (mutate → execute → evaluate)
- [ ] `/cost` — fleet cost summary for current period
- [ ] `/new <objective description>` — create a new objective with CEO as initial assignee
- [ ] Commands auto-complete with suggestions as user types
- [ ] Command results render inline in the chat (not as separate pages)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-032: Command Channel — Notification Digest
**Description:** As a user, I want important fleet events surfaced in my Command Channel so I don't miss critical moments.

**Acceptance Criteria:**
- [ ] System messages appear in the Command Channel for: agent promotions, demotions, retirements, skills learned/unlearned, tools deployed, pending human confirmations
- [ ] Messages are actionable: "Agent X needs confirmation for promotion" includes approve/reject buttons inline
- [ ] Daily digest option: summarize fleet activity from the past 24h as a single message from the CEO
- [ ] Notification priority levels: critical (blocks work), important (needs attention), info (FYI)
- [ ] User can configure which events generate notifications vs. appear only in the feed
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Akasa lives in the `claw-army` repository. Paperclip (`claw-paper-clip`) is deployed as a separate service on GCP and consumed via HTTP API for agent orchestration, adapter dispatch, and session management. All product logic (evolution, skills, tools, billing, UI, marketplace) lives in claw-army
- FR-2: The soul system (7 behavioral dimensions, constitution, embeddings, content hashing) already exists in claw-army and is extended with Akasa-specific features (Akashic Library publishing, skill-soul integration)
- FR-3: Each agent has exactly one active soul at any time; soul history is versioned and immutable (insert-only)
- FR-4: Objectives must define immutable success metrics before any agent runs against them; metrics cannot be modified after first execution
- FR-5: The composite fitness score is computed as: `w1 * completionRate + w2 * speedScore + w3 * costEfficiency + w4 * taskCompletionMetric` where weights are set per-objective and frozen at creation
- FR-6: The Karpathy loop runs automatically: mutate soul → execute tasks → evaluate via Council → keep/discard → capture DNA → repeat
- FR-7: Council judges run on independent LLM calls with no shared context between judges
- FR-8: The God Layer executes class transitions as atomic database transactions with Redis category locks to prevent concurrent soul library corruption
- FR-9: DNA store is insert-only with `(category, soulId, version)` unique constraint; provisional flag set when confidence < 0.50
- FR-10: Negative signal register captures failed directives (counterfactual < 0.3), failed mutation operations, and parent lineage for mutation blacklisting
- FR-11: Pioneer detection freezes the first successful agent's composite score as permanent category baseline
- FR-12: Category benchmarks mature after 3+ confirmed runs; class promotions blocked until benchmark is mature
- FR-13: Akashic Library is a read/write store of published DNA snapshots; acquiring a soul clones it (new soulId, incremented generation, new parentSoulId)
- FR-14: User-facing soul summaries are generated via LLM from raw SOUL.md content — plain-language personality descriptions, not raw markdown
- FR-15: Evolution transparency: every council verdict, mutation event, class transition, and DNA capture is stored with full audit trail and visible in the UI
- FR-16: Agent execution is delegated to Paperclip's adapter system via API — agents can run on Claude, Codex, Gemini, OpenClaw, Cursor, OpenCode, or any future adapter without Akasa needing to implement adapter logic
- FR-17: Fleet metrics are computed in real-time: total bit rate (agent count), effective bit rate (agent count × average composite score), cost per effective bit
- FR-18: Tool Nexus provides a unified gateway for all external tool invocations; agents call the gateway, never external APIs directly
- FR-19: Tool credentials (OAuth tokens, API keys) are stored encrypted and injected by the gateway at invocation time — agents never see raw secrets
- FR-20: Each tool is defined by a typed contract: actions (name, input schema, output schema, HTTP mapping), triggers (webhook event types, payload schema), auth method, rate limits
- FR-21: Built-in integrations ship with pre-defined contracts; custom tools use user-defined contracts validated against the same schema
- FR-22: Webhook receiver generates unique per-user-per-tool URLs; incoming payloads are signature-verified, parsed, and routed to agents via configurable rules
- FR-23: Tool invocations are metered and included in cost tracking — per-call latency, token cost of marshaling, and any external API costs
- FR-24: Agent-authored tools run in sandboxed containers with resource limits (CPU, memory, egress, max containers per user); deployed only after human approval
- FR-25: Agent-authored tools are registered in the Tool Belt identically to built-in/custom tools — same gateway, same schema validation, same logging
- FR-26: Tool usage metrics (success rate, tool selection accuracy, invocation cost) factor into the composite fitness score used by the Karpathy loop
- FR-27: OpenAPI/Swagger import parses a spec into tool contracts automatically — actions extracted from paths, schemas from components
- FR-28: Skills are defined as SKILL.md files with YAML frontmatter (name, description, version, category, triggers, requires_tools, requires_skills, min_agent_class) and a markdown body containing procedural knowledge
- FR-29: Skill loading uses three-level progressive disclosure: Level 1 (metadata, ~100 words, always in context), Level 2 (body, ~2k words, loaded on trigger match), Level 3 (references/examples, loaded on demand)
- FR-30: Each agent has a skill loadout with class-based capacity limits: Novice (3), Understudy (5), Artisan (8)
- FR-31: Skill activation is trigger-based: skills declare task category patterns; when a task matches, the skill body is injected into the agent's execution context
- FR-32: Skill effectiveness is tracked per-agent per-skill: activation count, composite score delta when active vs. inactive, positive/negative/neutral classification
- FR-33: Skill learning generates candidate SKILL.md from decision traces when an agent exhibits a novel effective pattern not covered by current loadout; candidates require human approval if confidence < 0.80
- FR-34: Skill unlearning auto-removes skills from loadout after 5+ activations with negative contribution and 2 consecutive negative evaluation cycles
- FR-35: Skill Bazaar listings are anonymized snapshots of skills with effectiveness stats; acquiring clones the skill into the user's library
- FR-36: Skills integrate with the evolution system: Council evaluates skill effectiveness, DNA captures include skill loadout, mutation engine can suggest loadout changes
- FR-37: Skill-soul conflict detection: warn (not block) when equipping skills whose procedures contradict the agent's soul directives
- FR-38: The Command Channel is built on Paperclip's issue-backed communication system — chat messages are issue comments, session continuity via `agent_task_sessions` with task-key strategy, real-time streaming via WebSocket live events
- FR-39: Every chat message creates a durable issue comment record — there is no separate chat table; the issue is the source of truth for conversation, audit trail, and cost attribution
- FR-40: Agent responses stream in real-time via Paperclip's WebSocket infrastructure (`/api/companies/{companyId}/events/ws`); UI renders chunks as they arrive
- FR-41: @-mentioning an agent in any conversation triggers a wakeup via `heartbeat.wakeup()` — the mentioned agent resumes its session with the conversation context
- FR-42: Multi-channel bridges (Telegram, Slack) create issue comments through Paperclip's API; agent responses are polled/pushed back to the external channel; all messages appear in the web UI Command Channel
- FR-43: Quick commands (`/status`, `/assign`, `/pause`, etc.) are parsed client-side and translated to Paperclip API calls; results rendered inline as system messages in the chat
- FR-44: Fleet notification events (promotions, confirmations, skill learning) are injected as system messages in the Command Channel with actionable inline controls

## Non-Goals

- **Not a model training platform** — Akasa evolves agent behavior (prompts/souls), not model weights
- **No custom adapter development** — MVP uses Paperclip's existing adapters only
- **No multi-tenant Akashic Library moderation** — MVP trusts published souls; abuse/quality moderation is post-MVP
- **No agent-to-agent communication protocol** — agents coordinate through Paperclip's existing task system, not peer-to-peer
- **No mobile app** — web-only for MVP
- **No real-time collaboration** — single-user fleet management; team/org features are post-MVP
- **No soul editing by users** — souls are mutated by the system only; users influence evolution by defining objectives and metrics, not by editing SOUL.md directly
- **No paid Akashic Library or Skill Bazaar** — both marketplaces are free at MVP; paid listings or revenue share for publishers is post-MVP
- **No self-hosted deployment** — Akasa MVP is a hosted SaaS product on GCP (Paperclip runs as a service dependency within the same VPC)
- **No fully autonomous agent-authored tools at MVP** — agents can propose tools, but human approval is required before deployment. Fully autonomous tool creation (agent deploys without asking) is post-MVP
- **No tool marketplace** — MVP Tool Nexus is per-user only; sharing custom tool contracts across users is post-MVP
- **No complex orchestration of agent-authored tools** — MVP supports single-container stateless services only; multi-container compositions, databases, and persistent storage for agent tools are post-MVP
- **No skill versioning or branching** — MVP skills are mutable documents; version history and branching (A/B testing two versions of a skill) are post-MVP
- **No skill composition/chaining** — MVP skills are independent units; declarative skill pipelines ("run skill A, then skill B") are post-MVP
- **No automated skill generation from documentation** — MVP requires manual authoring or agent learning; importing skills from external docs/wikis is post-MVP
- **No skill-level pricing** — Skill Bazaar is free at MVP; paid skills or revenue share are post-MVP
- **No voice/video communication** — Command Channel is text-only at MVP; voice commands and screen sharing are post-MVP
- **No message editing or deletion** — issue comments are append-only at MVP; edit/delete is post-MVP
- **No read receipts or typing indicators between agents** — only user↔agent typing indicators at MVP
- **No end-to-end encryption** — communication is encrypted in transit (TLS) and at rest, but not E2E; post-MVP for enterprise
- **No group chat rooms** — MVP has per-agent conversations and the fleet-wide feed; custom group channels are post-MVP

## Design Considerations

> **Full specification:** `tasks/akasa-design-guide.md` — complete visual language reference covering both product worlds, colour systems, typography, spacing, components, motion, do/don't rules, and CSS variables.

### The Two Worlds

Akasa has two rendering contexts that share the same token set:

- **Screenplay (Light / Warm)** — user-facing: onboarding, chat interface, the Office scene. Warm creams (`#F5F2EC`), deep plum (`#3D3560`), burnished gold (`#B8965A`). Fonts: Cormorant Garamond (display), DM Sans (body), Press Start 2P (labels/tags at 6-8px only)
- **Director's Cut (Dark / Deep)** — technical: system architecture, evolution mechanics, integrations. Near-black (`#06050E`), violet (`#7C3AED`), amber for karma/IP moat. Same font stack, different colour application

Toggled via `body.system` class. Both worlds are one product in two registers.

### Key Design Rules

- **Execution over decoration.** Every visual decision earns its place by making the product faster to understand or easier to trust
- **Press Start 2P is never used above 8px.** It handles labels, tags, and UI chrome only — never body text
- **Cormorant Garamond for display only.** Headlines, titles, pull quotes — never UI labels or form inputs. 16px minimum
- **DM Sans is the default.** When in doubt, DM Sans
- **Opacity scale for text hierarchy** — `rgba(236, 232, 255, 0.52/0.42/0.24)` in dark mode, never arbitrary grey hex values
- **Amber is reserved for karma, IP moat, and compounding.** Never for generic emphasis
- **Near-black, never pure black** — `#06050E` has a violet undertone, `#000000` is banned
- **Progressive disclosure:** Full council verdicts, mutation diffs, dimension breakdowns available on demand. Default view shows summarized personality + trend line
- **Dashboard-first:** User lands on Evolution Dashboard showing fleet health, recent verdicts, and bit rate metrics

### Tech Stack

- **Framework:** SvelteKit v2 + Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- **Styling:** Vanilla CSS with CSS custom properties — no Tailwind, no CSS modules
- **Components:** Fully bespoke — no component library. Paperclip's React UI is not used
- **Fonts:** Google Fonts (Cormorant Garamond, DM Sans, Press Start 2P)

## Technical Considerations

### Two-Repo Architecture

Akasa is built across two repositories with a clear boundary:

**`claw-army` — The Akasa product repo (your IP)**
- All product logic: evolution engine, skill system, tool nexus, command channel, billing, marketplaces
- Frontend: SvelteKit v2 + Svelte 5 runes, dark violet design system
- Backend: Fastify v5 (execution-service, tool-gateway)
- Database: Cloud SQL (PostgreSQL + pgvector) — already running at 10.101.0.3
- Auth: @auth/sveltekit with Google OAuth — already set up
- Infrastructure: GCP (GCE VMs, Pub/Sub, IAP, VPC)
- Queue: BullMQ + Redis — already set up

**`claw-paper-clip` — Paperclip (service dependency)**
- Deployed on GCP as a separate service (not Railway — moved to match claw-army's infra)
- Consumed via HTTP API by claw-army for: agent dispatch, adapter management, session handling
- Provides: 7 agent adapters, plugin SDK, orchestration engine, issue-backed communication
- Stays in sync with upstream open-source; claw-army never forks it

**Integration pattern:** claw-army's Fastify backend calls Paperclip's Express API for agent operations. Paperclip manages agent lifecycle, adapter selection, and task dispatch. claw-army manages everything else: evolution, skills, tools, billing, UI.

### Repository Structure (claw-army)

```
claw-army/
├── packages/
│   ├── db/                          # [EXISTING] Drizzle ORM + Cloud SQL
│   │   └── src/schema/
│   │       ├── ... existing tables ...
│   │       ├── bot-souls.ts         # [EXISTING] soul system
│   │       ├── council-verdicts.ts  # [EXISTING] council outputs
│   │       ├── agent-classes.ts     # [EXISTING] class progression
│   │       ├── dna-store.ts         # [EXISTING] DNA + Akashic Library
│   │       ├── category-benchmarks.ts # [EXISTING] pioneer baselines
│   │       ├── negative-signals.ts  # [EXISTING] failure patterns
│   │       ├── decision-traces.ts   # [EXISTING] attribution records
│   │       ├── agent-skills.ts      # [NEW] skill definitions
│   │       ├── skill-loadouts.ts    # [NEW] agent ↔ skill junction
│   │       ├── skill-activations.ts # [NEW] effectiveness tracking
│   │       ├── tool-definitions.ts  # [NEW] typed tool contracts
│   │       ├── tool-connections.ts  # [NEW] encrypted credentials
│   │       ├── tool-invocations.ts  # [NEW] audit log
│   │       └── billing.ts          # [NEW] Stripe subscription refs
│   ├── shared-types/                # [EXISTING] pure TS types
│   └── event-schemas/               # [EXISTING] Zod v4 event schemas
│
├── services/
│   ├── execution-service/           # [EXISTING] Fastify backend
│   │   └── src/
│   │       ├── orchestrator/        # [EXISTING] bot orchestration
│   │       ├── council/             # [EXISTING] 3-judge system
│   │       ├── god-layer/           # [EXISTING] class transitions, DNA
│   │       ├── services/
│   │       │   ├── soul-generator.ts # [EXISTING] mutation engine
│   │       │   ├── skill-manager.ts  # [NEW] learn/unlearn/loadout
│   │       │   ├── paperclip-client.ts # [NEW] HTTP client for Paperclip API
│   │       │   ├── stripe-billing.ts # [NEW] usage records, subscriptions
│   │       │   └── webhook-router.ts # [NEW] incoming webhook → task routing
│   │       ├── routes/
│   │       │   ├── ... existing ...
│   │       │   ├── evolution.ts     # [NEW] evolution dashboard API
│   │       │   ├── souls.ts         # [NEW] Akashic Library endpoints
│   │       │   ├── skills.ts        # [NEW] Skill Bazaar endpoints
│   │       │   ├── tool-nexus.ts    # [NEW] tool connections, invocations
│   │       │   └── billing.ts       # [NEW] budget management, usage
│   │       └── queue/
│   │           ├── ... existing ...
│   │           ├── evolution-worker.ts # [NEW] Karpathy loop orchestrator
│   │           ├── council-worker.ts   # [EXISTING] 3-judge eval
│   │           └── god-layer-worker.ts # [EXISTING] class transitions
│   │
│   ├── tool-gateway/                # [EXISTING] HTTP proxy + tool invocation
│   │   └── src/                     # [EXTEND] generalize for Tool Nexus
│   │       ├── proxy.ts             # [EXISTING] forward proxy
│   │       ├── tool-invoker.ts      # [NEW] schema validation, auth injection
│   │       └── openapi-importer.ts  # [NEW] Swagger → tool contract parser
│   │
│   ├── telegram-bot/                # [MOVE BACK] from claw-paper-clip
│   │   └── src/
│   │
│   └── ui/                          # [EXISTING] SvelteKit + Svelte 5
│       └── src/
│           ├── app.css              # [EXISTING] design tokens
│           ├── routes/
│           │   ├── ... existing ...
│           │   ├── dashboard/       # [EXTEND] evolution dashboard
│           │   ├── command/         # [NEW] Command Channel chat UI
│           │   ├── akashic/         # [NEW] Akashic Library marketplace
│           │   ├── bazaar/          # [NEW] Skill Bazaar marketplace
│           │   ├── tools/           # [NEW] Tool Nexus management
│           │   └── billing/         # [NEW] budget & cost analytics
│           └── lib/
│               ├── components/
│               │   ├── evolution/   # [NEW] SoulCard, Timeline, LineageTree, etc.
│               │   ├── skills/      # [NEW] SkillLoadout, SkillCard, SkillEditor
│               │   ├── tools/       # [NEW] ToolCatalog, ToolBelt, WebhookManager
│               │   └── command/     # [NEW] ChatInterface, FleetFeed, QuickCommands
│               ├── paperclip.ts     # [NEW] Paperclip API client (agent ops)
│               └── stripe.ts        # [NEW] Stripe billing client
│
├── infra/                           # [EXISTING] Terraform, Docker configs
├── scripts/                         # [EXISTING] utility scripts
└── CLAUDE.md                        # [EXISTING] project instructions
```

### Existing Infrastructure (claw-army — already running)

- **Database:** Cloud SQL PostgreSQL + pgvector at 10.101.0.3
- **Compute:** GCE VMs (`claw-app-dev` at 10.0.0.3), bot VMs on 10.0.0.0/24 subnet
- **Auth:** @auth/sveltekit with Google OAuth
- **Queue:** BullMQ + Redis
- **Events:** GCP Pub/Sub for inter-service events, SSE for real-time UI
- **Networking:** VPC with IAP for SSH, `allow-iap-ssh-bots` firewall rule
- **Soul system:** bot_souls, council, god layer, archetypes, mutation engine — all built

### Hosting Strategy: Hybrid GCP + Railway

**GCP** for what's already there and needs low-latency internal networking:
- Cloud SQL (database — stays, already running)
- Bot VMs (GCE instances running OpenClaw)
- Pub/Sub (inter-service events)
- VPC networking

**Railway** for application services (low friction, deploy from git push, auto-HTTPS):
- Akasa backend (execution-service)
- Paperclip service (claw-paper-clip — already on Railway)
- Telegram bot
- Tool gateway
- Agent-authored tool containers

Railway connects to Cloud SQL via public IP + SSL (or Cloud SQL Auth Proxy). Best of both: GCP's managed database and networking where it matters, Railway's deploy simplicity for application code. Revisit when scale justifies committed-use GCP pricing. The real cost driver is LLM tokens, not infra — the 20% markup covers hosting with room to spare.

### New Infrastructure Needed

- **Stripe:** Metered billing subscriptions, Usage Records API. 20% markup pricing, daily budget cap enforcement
- **Paperclip service:** Already on Railway; Akasa backend calls its API over HTTPS
- **Tool Nexus:** Extend existing tool-gateway service with generalized tool invocation, schema validation, and OpenAPI import; deploy on Railway
- **Agent-authored tool runtime:** Railway containers for sandboxed user tool deployments; each user gets isolated services with resource limits
- **Webhook ingress:** Railway provides public HTTPS URLs per service automatically — no load balancer configuration needed

### Key Technical Details

- **Embedding storage:** pgvector already installed on Cloud SQL (1536-dim vectors from text-embedding-3-small for soul similarity)
- **Council LLM calls:** 3 independent API calls per verdict; heterogeneous providers (Claude for Performance + Soul Analyst, Gemini for Devil's Advocate)
- **Karpathy loop orchestration:** BullMQ job queue for mutation → execution → council → god-layer pipeline; each stage is a separate job type with retry and dead-letter handling
- **Redis:** Category locks (God Layer), rate limiting (Council: 5 jobs/min), benchmark maturity caching
- **Akashic Library:** Database-backed; published DNA entries in `dna_store` with `isPublished: true` flag and anonymized metadata (no companyId back-reference)
- **Skill storage:** `agent_skills` table with SKILL.md content (markdown), parsed metadata (JSONB), category, trigger patterns, effectiveness metrics. Loadout in `skill_loadouts` junction table
- **Skill learning pipeline:** Decision traces → pattern extraction (LLM) → candidate SKILL.md → validation → approval gate → persist with `source: 'learned'`
- **Skill context injection:** At execution time, Level 1 metadata always in context; Level 2 bodies loaded lazily on task category match
- **Command Channel:** Issue-backed communication via Paperclip API (comments + sessions + WebSocket streaming). claw-army's Svelte frontend renders the chat UI; Paperclip handles the durability and real-time transport
- **Multi-channel bridging:** Telegram bot already built (services/telegram-bot/); Slack bridge follows same pattern. All bridges create issue comments via Paperclip API, forwarding responses back to external channels
- **Data isolation:** All tables scoped by user/company ID. Publishing to Akashic Library or Skill Bazaar creates anonymized, detached copies with no back-reference to the original owner

## Success Metrics

- User can go from sign-up to first agent executing an objective in under 5 minutes (CEO-first onboarding)
- Agents show measurable composite score improvement within 10 execution cycles (Karpathy loop working)
- At least 1 agent per user reaches Understudy class within first week of active use
- Akashic Library has 50+ published Artisan souls within first month of launch
- Average fleet effective bit rate (agent count × composite score) increases week-over-week for active users
- Council verdicts complete within 60 seconds of execution finishing
- User engagement: 70%+ of users check Evolution Dashboard at least once per day
- 80%+ of active users have at least 2 external tools connected within first week
- Tool invocation success rate > 95% (gateway reliability)
- At least 1 agent-authored tool deployed per 10 active Artisan agents within first month
- Agents learn at least 1 new skill per 20 execution cycles on average
- Skill Bazaar has 30+ published skills within first month
- Skill unlearning fires correctly: underperforming skills removed within 2 cycles of detection
- CEO response latency < 3 seconds for first streaming token in Command Channel
- 90%+ of user interactions happen through the Command Channel (chat-first engagement)
- Multi-channel bridge messages appear in web UI within 2 seconds of being sent externally

## Monetization

### Model: Token Arbitrage

Akasa's business model is simple: **pure token markup**. Users pay for the tokens their agents consume, marked up 20% from provider cost. No subscriptions, no seat licenses, no feature gates.

**How it works:**

1. **User sets a daily budget** — e.g., "$50/day". This is the maximum they will spend. Period.
2. **Agents consume tokens** — every LLM call (task execution, soul mutation, Council evaluation, skill learning, Command Channel responses) is metered at the token level
3. **Akasa charges provider cost + 20%** — if Claude charges $0.01 per 1k tokens, Akasa charges $0.012
4. **When daily budget is approaching the limit**, fleet is paused gracefully (in-progress tasks complete, no new tasks dispatched)
5. **No hidden costs** — tool invocations, webhook processing, and platform infrastructure are included. Users only pay for LLM tokens

**Why this works:**

- **Zero friction onboarding** — no pricing tiers to compare, no "contact sales" gates. Set a budget and go
- **Aligned incentives** — Akasa makes more money when agents consume more tokens, but the evolution engine optimizes for cost efficiency (lower tokens per unit of output). Better agents = lower cost per result = users set higher budgets because ROI is clear
- **The compound effect is the upsell** — as agents evolve and prove ROI, users naturally increase their daily budget and add more agents. The platform doesn't need to gate features; value compounds organically
- **Transparent** — users see exact token consumption per agent, per task, per LLM call. No surprises

### Functional Requirements (Monetization)

- FR-45: All LLM API calls are metered at the token level (input + output tokens) and attributed to the specific agent, task, and execution
- FR-46: Token costs are computed using provider base rates + 20% markup; consumption reported to Stripe via Usage Records API; Stripe handles invoicing and payment collection
- FR-47: Users set a daily budget cap (minimum: $1/day, no maximum). Budget is enforced in real-time — fleet pauses when 90% consumed, hard stop at 100%
- FR-48: Budget dashboard shows: today's spend, remaining budget, burn rate (tokens/hour), projected daily total, cost breakdown by agent and by LLM operation type (task execution, evolution, council, communication)
- FR-49: Cost efficiency is a component of the composite fitness score — agents that achieve the same output with fewer tokens score higher and are more likely to be promoted
- FR-50: Evolution overhead (soul mutation, Council evaluation, DNA capture) is included in the daily budget — users see the cost of improvement alongside the cost of execution
- FR-51: Historical cost analytics: daily/weekly/monthly spend trends, cost per effective bit over time, ROI tracking (value created vs. tokens consumed)
- FR-52: Budget alerts configurable: email/Telegram/Slack notification at 50%, 75%, 90% of daily budget

## Open Questions

1. ~~**Pricing model:**~~ **RESOLVED** — Pure token arbitrage with 20% markup. Users set a daily budget, that's all they spend. See Monetization section.
2. **Akashic Library economics:** Do publishers earn anything when their soul is acquired? Revenue share? Reputation points? Or purely community/open?
3. **Cross-user DNA:** Should the Karpathy loop be allowed to pull mutation parents from other users' published DNA, or only from the user's own fleet + Akashic Library acquisitions?
4. **Objective metric validation:** How do we verify that user-defined success metrics are actually measurable by the system? What if the metric requires external data the agent can't access?
5. **Soul ownership:** When a user acquires a soul from the Akashic Library and it evolves further through their fleet, can they re-publish the evolved version? Does original publisher get attribution?
6. **Adapter constraints:** Some Paperclip adapters (Cursor, Codex) have different capability profiles. Should soul mutations be adapter-aware, or is that abstracted away?
7. **Rate limiting evolution:** Should there be a cooldown between mutation cycles to prevent thrashing, or does the Karpathy loop principle of "never stop" apply?
8. **Tool Nexus launch catalog:** Which integrations ship built-in at MVP? Suggested starter set: HubSpot, Slack, Telegram, Google Sheets, Stripe, GitHub, Linear — but need to confirm based on target user demand
9. **Agent-authored tool boundaries:** What can an agent-authored tool do? MVP proposes stateless HTTP services only — but should agents be able to create scheduled jobs (cron), persistent queues, or database-backed services?
10. **Tool security model:** When an agent invokes a tool that modifies external state (creates a HubSpot contact, sends a Slack message), should there be a per-action approval gate, or is connecting the tool sufficient consent?
11. **Tool evolution feedback:** Should the Tool Nexus itself evolve? e.g., if an agent discovers a better way to batch HubSpot API calls, should that optimization be captured in the tool contract and shared?
12. **Skill vs. soul boundary:** When an agent learns a pattern, should it become a soul dimension mutation or a discrete skill? The line between "who the agent is" (soul) and "what the agent knows how to do" (skill) needs a clear heuristic — e.g., behavioral/personality patterns → soul; procedural/workflow patterns → skill
13. **Skill capacity scaling:** Should skill loadout capacity scale with agent class (proposed: 3/5/8), or should it scale with composite score, or be user-configurable?
14. **Cross-agent skill transfer:** When one agent learns a skill, should it auto-propagate to other agents in the same fleet with matching task categories, or require manual equipping?
15. **Skill quality decay:** Should skill effectiveness decay over time if not activated? An unused skill might become stale as the task landscape changes
16. **Skill-tool coupling:** Some skills only make sense with specific tools (e.g., "HubSpot deal nurturing" requires HubSpot connected). Should the system auto-disable skills when their required tools are disconnected?
17. **Command Channel as default landing:** Should the Command Channel (chat with CEO) be the first thing users see on login, or should they land on the Evolution Dashboard? Chat-first vs. dashboard-first is a core UX decision
18. **Agent-to-agent private channels:** Should agents be able to have private conversations that the user doesn't see by default? This could improve coordination efficiency but reduces transparency
19. **Conversation context window:** How much conversation history should agents receive when waking up? Full thread vs. last N messages vs. summarized context? Impacts cost and quality
20. **External channel parity:** Should Telegram/Slack bridges support quick commands (`/status`, `/assign`) or only free-text messages? Full parity increases complexity significantly
21. **Daily digest authorship:** Should the daily digest be generated by the CEO agent (using its soul/personality) or by a system-level summarizer? CEO-authored feels more personal but costs tokens
