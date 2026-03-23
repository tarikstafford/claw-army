# Feature Research

**Domain:** AI Agent Platform — Tool Integration Gateway, Evolution Dashboard, Paperclip API Integration
**Researched:** 2026-03-23
**Milestone:** v6.0 Paperclip Foundation (subsequent milestone — features dimension only)
**Confidence:** HIGH (PRD authoritative; supplemented by ecosystem research on integration platforms and dashboard patterns)

---

## Context and Scope

This is a **subsequent milestone** research document. Features below cover only the three new capability domains in v6.0. The following are already shipped and are explicitly out of scope for this document:

- Soul system, mutation operations, constitution validation
- Council (3-judge evaluation), God Layer (class transitions, DNA capture, negative signals)
- Ring Leader orchestration with DAG decomposition, pre-flight manifest
- Objective CRUD, DNA evolution timeline, soul library browser, decision traces, negative signal register
- Live execution monitoring, category benchmarks, Army Builder UI
- Landing page, Google OAuth, billing metering

**v6.0 new capability domains:**
1. Paperclip API Integration — Akasa becomes the product layer; Paperclip becomes the runtime engine
2. Tool Nexus — Generalized tool gateway with OAuth, typed contracts, catalog, webhooks, OpenAPI import
3. Evolution Dashboard — Rebuilt with two-world design system (Screenplay + Director's Cut)

---

## Domain 1: Paperclip API Integration

Akasa currently manages GCE VMs directly via OpenClaw. v6.0 shifts to calling Paperclip's HTTP API for agent dispatch and session management. All product logic (evolution, skills, tools, billing) stays in claw-army; Paperclip handles runtime adapters.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Paperclip API client (agent dispatch) | Platform cannot function without delegating execution to Paperclip — this is the architectural foundation of v6.0 | MEDIUM | Wraps Paperclip HTTP calls: create session, dispatch task, poll/stream status. Replaces direct GCE/OpenClaw VM management |
| Adapter selection per agent | 7 runtimes available (Claude, Codex, Gemini, OpenClaw, Cursor, OpenCode, PI) — users expect the platform to choose the right one per agent class | MEDIUM | Model tier → adapter mapping. Indra always Opus. Novice → Haiku-class adapter; Artisan → Opus-class. Selection stored on agent, not hardcoded |
| Session management with task-key continuity | Agents must maintain conversation context across tasks in the same category — stateless sessions break multi-turn agent work | MEDIUM | `agent_task_sessions` keyed by (agentId, taskCategory). Paperclip session re-used on matching key; new session on novel category |
| Error handling and retry on Paperclip API failures | Integration APIs fail. Platform must degrade gracefully rather than propagating failures to users | LOW | Exponential backoff with jitter. Circuit breaker on repeated failures. Queue task for retry if Paperclip unavailable |
| Paperclip credential management | API keys/tokens stored in env vars, rotation-safe — not hardcoded | LOW | Environment injection; never committed to source. Single credential per Paperclip environment (dev/prod) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Soul injection into Paperclip sessions | Akasa's entire competitive moat is evolved souls — injecting SOUL.md as system-prompt prefix into Paperclip sessions means evolutionary advantage travels with the agent | HIGH | SOUL.md injected at session creation via Paperclip's system prompt field. Constitution validation before dispatch (existing logic, wired to new API call) |
| Session JWT per agent with scoped tool allowlist | Per-agent security boundary: agent X can only invoke tools in its allowlist. Prevents fleet-wide credential exposure if one agent is compromised | MEDIUM | Existing JWT pattern (soulId, taskId, toolAllowlist, budgetAllocation, runtimeLimit) extended to Paperclip session context field |
| Ring Leader as Paperclip orchestrator | Ring Leader's DAG execution delegates to Paperclip's multi-agent coordination. Akasa's evolution logic runs on top of Paperclip's reliable task dispatch | HIGH | Significant refactor of Ring Leader coordination loop: replace direct botOrchestrator calls with Paperclip API calls. Existing DAG logic intact |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fork Paperclip to add Akasa-specific features | Faster short-term, full control | Diverges from upstream permanently, kills future Paperclip updates, violates the two-repo architecture decision | PR to Paperclip for needed features; Akasa-specific logic stays in the product layer above the API |
| Expose Paperclip API directly to UI | Simpler proxying | Leaks Paperclip internals to the browser, breaks Akasa's abstraction layer, couples UI to upstream schema changes | Maintain `/api/[...path]` reverse proxy with Akasa-owned response contracts |
| Re-implement adapter logic inside claw-army | Independence from Paperclip | Duplicates all 7 adapters, doubles maintenance burden for every model update | Adapter logic belongs in Paperclip; Akasa selects adapter at session creation, Paperclip executes |
| Parallel operation of old GCE/OpenClaw path and new Paperclip path long-term | Safer migration | Two execution paths = two sets of bugs, two code paths to maintain. Migration window is acceptable; permanent parallel is not | Time-box the migration window. Build Paperclip client → test → cut over → remove GCE orchestration code |

---

## Domain 2: Tool Nexus

Generalized tool gateway replacing the MVP's hard-coded tool-gateway service. Agents invoke any external service through one endpoint; Tool Nexus handles auth, schema validation, routing, logging, and metering.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tool catalog UI with category browsing | Every integration platform (Zapier, n8n, Make, Composio) shows a searchable catalog — missing this makes the platform feel unfinished. Category grouping (CRM, Communication, Payments, Data, Productivity) is the minimum expected structure | LOW | Static catalog for MVP. 5-8 built-in integrations, not 50. HubSpot, Slack, Stripe, Google Sheets, Telegram, GitHub, Notion as initial set |
| OAuth connection flow | Industry standard for connecting SaaS tools. API key as fallback only — OAuth is the expected path for every major SaaS | MEDIUM | Redirect to provider → callback → encrypted token storage. Must handle token refresh (Zapier pattern: auto-refresh OAuth v2 on expiry). Re-auth button on expired connections |
| API key connection flow | Many enterprise APIs and self-hosted services don't support OAuth. Power users expect API key auth as a fallback | LOW | Masked input field. Test-connection button before save. Clear error on bad credential |
| Tool Belt view (user's connected tools) | Users need a single view of what their agents can access — absence creates a trust gap ("what can my agents actually do?") | LOW | List: tool name, connection status badge (connected / expired / rate_limited / errored), last used timestamp, action count |
| Connection status visibility | Expired or rate-limited tools silently failing is the #1 integration UX failure mode. Users blame the platform, not the expired token | LOW | Status badge per tool. Re-auth button inline on expired. Rate limit remaining counter on rate_limited |
| Single gateway invocation endpoint | Agents should call one endpoint with `toolId + action + params` and never know API specifics. Consistent interface regardless of underlying API | MEDIUM | Existing tool-gateway extended. Auth injection, schema validation, response normalization into `{ success, data, error }` envelope |
| Credential encryption at rest | Storing OAuth tokens or API keys in plain text is a security failure users correctly assume doesn't exist in any production product | MEDIUM | Encrypted column (pgcrypto AES-256 or application-layer encryption before insert). Agents never receive raw secrets — only the gateway decrypts and injects |
| Invocation logging | Debugging agent tool failures requires a full audit trail. Without it, users cannot diagnose why an agent did something unexpected | LOW | Per-invocation log: toolId, action, agentId, executionId, timestamp, latency (ms), success/failure, error message. Queryable by execution |
| Rate limiting per-tool per-user | External APIs enforce rate limits. Without gateway-level protection, one aggressive agent can exhaust the user's API quota for the entire fleet | MEDIUM | Redis sliding window per (userId, toolId). Return 429 to agent with retry-after header. Configurable per-tool limits |
| Retry logic with exponential backoff | Transient API failures (429, 503) are common. Without automatic retry, agents fail tasks that would have succeeded with one retry | LOW | Exponential backoff with jitter on 429/503. Configurable max retries per tool. Fail after max retries, return structured error to agent |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Typed tool contracts (Zod/JSON Schema) | Agents receive validated input/output schemas, not raw HTTP calls. This eliminates an entire class of agent errors where the LLM hallucinates API parameters | MEDIUM | `tool-contracts` package (already exists) extended with built-in integration schemas. Input schema validated before gateway forwards request. Output schema validated before returning to agent |
| OpenAPI/Swagger import | Power users can connect any API in minutes by pasting a spec URL or uploading a file. No manual action definition. No competitor in the AI agent space does this today | HIGH | Parse OAS paths → actions, components → schemas. Extract: path, method, parameters, requestBody, response schema. Store as tool contract. URL import with auto-sync option |
| Custom tool registration | Connects any HTTP API not in the catalog. Unlocks the power user segment completely — they can bring any internal API or niche SaaS | MEDIUM | Form: name, base URL, auth config (Bearer, API key header, OAuth2), then define actions as HTTP method + path template + request/response schemas. Custom tools flow through same gateway (same auth, logging, rate limiting) |
| Webhook receiver with routing rules | Transforms Tool Nexus from query-only to event-driven. Agents can react to real-world events (new CRM record, payment received, form submitted) rather than only polling | HIGH | Unique URL per user per tool. Signature verification where supported (HubSpot HMAC, Stripe webhook secret). Configurable routing rules: "when HubSpot deal > $10k → assign to Sales Agent." Webhook event log |
| Dead letter queue for failed webhooks | Production-grade reliability — webhooks that fail routing or agent assignment should not silently disappear. Users need to see and replay unrouted events | MEDIUM | BullMQ dead-letter queue for failed webhook routing. Event log: payload, routing decision, resulting action, failure reason |
| Tool invocation metering in cost accounting | Tool calls have real costs (API usage fees, per-call costs from some providers). Metering closes the billing loop and gives users accurate cost visibility | LOW | Extend existing metering schema. Per-invocation: latency, any external API cost (configurable per tool), token cost of request marshaling |
| Tool performance in agent evolution | Tool usage patterns factor into composite fitness score. Agents that use tools effectively (good batching, correct tool selection, low retry rate) are rewarded; poor tool usage is penalized. No integration platform does this | HIGH | Extend Council's Performance Judge prompts with tool invocation metrics. Extend DNA captures to include tool usage sequences. Extend composite score formula with tool efficiency component. Requires invocation logging to be stable first |
| Agent-authored tools (Artisan only) | Artisan agents can propose and deploy their own tools (webhook receivers, scheduled scripts, data transformers). Closes the autonomy loop — agents extend their own capabilities. No competitor supports this at all | VERY HIGH | Proposal → human approval gate (same as US-011 confirmation gate) → deploy to sandboxed container runtime → register in Tool Belt. Resource limits enforced per user. Deployment and runtime logs visible. Treat as separate phase or defer to v6.1 if timeline constrained — this requires new GCP Cloud Run (or equivalent) infrastructure |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Agents calling external APIs directly | Simpler for agents, no gateway overhead | Bypasses auth management, logging, rate limiting, and security isolation. The bot-cannot-have-raw-credentials constraint is non-negotiable per architecture | All egress through Tool Nexus gateway without exception. This is a security requirement, not an option |
| 50+ integrations at launch | More integrations = more value | Each integration requires a maintained OAuth app registration, contract schema, and test coverage. 50 broken integrations are worse than 8 working ones | Curated catalog (5-8). Custom tool registration + OpenAPI import cover everything else |
| User-editable tool schemas | Power user control | Schema mutations on built-in tools corrupt signed contracts. Agents operating on mutated schemas produce unpredictable behavior | OpenAPI import for fully custom schemas. Built-in tool schemas are Akasa-maintained and versioned |
| Shared OAuth app credentials across users | Simpler management | Single OAuth app revocation kills all users. App store policies prohibit shared credentials for production apps in most SaaS provider programs | Per-user OAuth tokens. Akasa is the registered OAuth client; each user independently authorizes their own account |
| Real-time tool analytics dashboards | Seems analytically valuable | Tool analytics is high-volume noisy telemetry. Complex dashboards distract from the primary value of the platform (agent evolution). Tool usage data is already captured in invocation logs | Summary stats in Tool Belt view: success rate, last invocation, total calls. Detailed query available on demand. Tool performance visible in Evolution Dashboard via fitness score impact |

---

## Domain 3: Evolution Dashboard Rebuild

The existing evolution UI was built on the old "Akasa dark violet" design system. v6.0 rebuilds with the two-world design system (Screenplay light + Director's Cut dark) and adds new visualization capabilities requested in US-009.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CSS token system for both worlds | Foundation requirement — without the `--h-*` and `--d-*` token sets, no v6.0 component can be built consistently. This is the design system prerequisite for all other UI work | MEDIUM | Screenplay tokens (`--h-bg`, `--h-card`, `--plum`, `--gold`, etc.) + Director's Cut tokens (`--d-bg`, `--d-card`, `--d-vio`, `--d-amb`, `--d-teal`, `--d-rose`). `body.system` class toggle persisted in user preferences |
| Three-typeface loading (Cormorant Garamond + DM Sans + Press Start 2P) | Typography is the brand identity — wrong fonts break recognition immediately. Press Start 2P at wrong sizes breaks legibility | LOW | Google Fonts or self-hosted. Non-negotiable rules: Press Start 2P max 8px; Cormorant Garamond display-only (never body); DM Sans default for everything else |
| Fleet overview with class distribution | Primary health metric for power users: "how is my fleet doing overall?" Without this, the dashboard has no orienting view | LOW | Agent count by class (Novice/Understudy/Artisan/Retired) as a visual distribution. Trend indicator vs. previous period |
| Bit rate and effective bit rate metrics | The core Akasa value proposition made visible — two numbers users care about most. Already computed in existing data | LOW | Bit rate: total active agent count. Effective bit rate: agent count × average composite score. Always prominent. Use `--d-amb` / `--gold` for these metrics (karma color per design guide) |
| Per-agent evolution timeline | Users expect to see chronological history of what happened to each agent — every council verdict, class transition, mutation event, DNA capture. Data already stored; this is a UI rebuild | MEDIUM | Chronological event feed per agent. Icons/color coding per event type. Expandable detail for each event |
| Category benchmarks view | Without benchmarks, users cannot tell if evolution is working. Pioneer baselines and maturity flags are already computed; they need a browsable surface | LOW | One row per task category: pioneer baseline score, benchmark maturity (3+ confirmed runs = mature), thin-data flag, current best composite score |
| Composite score trends | Users need to see improvement over time. "My agent scored 0.72 this run" is meaningless without historical context | LOW | Chart: composite score per agent over executions. Existing data. Simple line chart — no need for complex visualization |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lineage tree visualization (depth-1) | Shows compounding value visually — from archetype root through mutations to current form. No competitor shows this because no competitor has soul lineage. Makes the "compounding" thesis tangible | HIGH | Tree/graph render: nodes are soul versions, edges are mutations. Root = archetype. Depth-1 = parent → current. Click to expand. D3 force graph or SVG. Ship depth-1 now; depth-3 is v6.1 |
| Experiment ledger per agent | Mirrors Karpathy's autoresearch `results.tsv` — run-by-run log showing score, delta, keep/discard decision, mutation applied, verdict. Makes the Karpathy loop visible as a data table | MEDIUM | Table per agent: executionId, composite score, score delta vs. previous, mutation type applied, verdict, outcome (kept/discarded). Paginated, filterable by date range |
| Two-world rendering (Screenplay + Director's Cut) | Context-sensitive design for two user modes: founder demo mode (Screenplay: warm, editorial, premium) vs. technical deep-dive mode (Director's Cut: dark, serious, infrastructure feel). Evolution Dashboard lives in Director's Cut; onboarding and chat live in Screenplay | MEDIUM | `body.system` class toggle. Persist preference in localStorage or user DB record. Evolution Dashboard defaults to Director's Cut. Toggle in navigation |
| Pending confirmation notifications in Evolution Dashboard | Human-in-the-loop gates (Promote/Retire verdicts) need to surface at the right moment — in the dashboard the user already has open, with evidence before the decision | MEDIUM | Notification badge in dashboard nav. Inline confirmation panel per pending verdict with concrete evidence (tool call sequence or DA argument). Approve/reject buttons gated until evidence renders (existing CONF-02 requirement) |
| Pioneer designation visual treatment | Pioneer is a permanent honor — first agent in a category to establish a benchmark. Currently under-surfaced. The "first ever" narrative is well-documented as a high-engagement event | LOW | Amber treatment (`--d-amb` / `--gold`). Permanent Pioneer badge on DNA entry. Text: "First in [category]" with date. No other agent can ever take this designation away |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time Council evaluation during execution | Faster feedback loop | Council runs post-synthesis by design — judges need full trace data to evaluate directive causation. Mid-execution evaluation violates the independence guarantee and produces garbage attribution | Show "evaluation pending" state during execution. Council fires after Ring Leader synthesis. This is a design constraint, not a limitation |
| User-editable soul dimensions via sliders | Direct user control over agent behavior | Corrupts evolutionary lineage attribution. If the user manually tuned a dimension, you cannot credit mutations for subsequent performance. Explicitly deferred to v2.1 per PROJECT.md | Mutation engine controls soul parameters. User influences evolution via objective definition, tool configuration, and verdict confirmation — not direct soul editing |
| Depth-3 lineage tree graphical view at launch | Richer lineage context | Graph rendering complexity for depth-3 with interactive navigation is significant work. Depth-1 already differentiates from every competitor. Explicitly deferred per PROJECT.md | Ship depth-1 lineage tree. Add depth-3 in v6.1 when users are navigating the depth-1 tree and requesting more |
| Full redesign of execution monitoring UI in v6.0 | Consistent design system across all surfaces | Execution monitoring is a separate surface area (live run view, bot cards, activity feed). Combining it with Evolution Dashboard rebuild in one milestone risks scope explosion | Rebuild Evolution Dashboard with new design system. Execution monitoring redesign as a separate phase when design system is stable and component patterns are established |
| Army composition history and named armies | Fleet history tracking | Requires new data model, complex UI, and named identity for agent groups that doesn't exist yet. Explicitly deferred to v2.1 per PROJECT.md | Run history per objective provides sufficient context at current scale |
| Mutation weight sliders in v6.0 | User influence on evolution pressure | Adds significant UI complexity. Explicitly deferred to v2.1 per PROJECT.md. Premature before users have seen what default evolution produces | Defer to v6.1 minimum. First build trust that the default evolution loop works |

---

## Feature Dependencies

```
[CSS Token System]
    └──required by──> [All Evolution Dashboard components]
    └──required by──> [Two-World Rendering toggle]
    └──required by──> [Typography Loading]
    └──required by──> [Tool Nexus UI components]

[Typography Loading (Cormorant + DM Sans + Press Start 2P)]
    └──required by──> [All UI components with correct brand feel]

[Paperclip API Client]
    └──required by──> [Agent dispatch via Paperclip]
    └──required by──> [Session management with task-key continuity]
    └──required by──> [Ring Leader → Paperclip coordination]
    └──required by──> [Command Channel (future v7.0)]

[Tool Contracts (Zod schemas in tool-contracts package)]
    └──required by──> [Gateway invocation endpoint (validates requests)]
    └──required by──> [OpenAPI import (generates contracts)]
    └──required by──> [Custom tool registration (stores contracts)]
    └──required by──> [Tool performance in evolution (structured invocation metrics)]

[OAuth Connection Flow]
    └──required by──> [Tool Belt view (status of connected tools)]
    └──required by──> [Gateway invocation for OAuth-protected APIs]
    └──required by──> [Token refresh logic]

[API Key Connection Flow]
    └──required by──> [Tool Belt view (non-OAuth tools)]
    └──required by──> [Gateway invocation for API-key APIs]

[Tool Belt (connected tools list)]
    └──required by──> [Webhook receiver (tool must be connected to receive webhooks)]
    └──required by──> [Agent tool discovery at execution time]
    └──required by──> [Agent-authored tools (registered identically to built-ins)]

[Gateway Invocation Endpoint]
    └──required by──> [Rate limiting per-tool (middleware on gateway)]
    └──required by──> [Invocation logging (fires after each call)]
    └──required by──> [Cost metering per invocation (fires after each call)]
    └──required by──> [Retry logic (wraps gateway forward)]
    └──required by──> [Tool performance in evolution (needs invocation data)]

[Invocation Logging]
    └──required by──> [Tool performance in evolution (Council reads invocation metrics)]
    └──required by──> [Cost metering (per-invocation cost attribution)]

[Tool Performance in Evolution]
    └──requires──> [Council Performance Judge extension (prompt + scoring)]
    └──requires──> [DNA capture schema extension (tool usage sequences)]
    └──requires──> [Invocation Logging (stable, structured data)]
    NOTE: Build invocation logging first; wire into evolution in v6.1 when enough data exists

[Fleet Overview + Bit Rate Metrics]
    └──required by──> [Per-agent Evolution Timeline (needs fleet context)]

[Per-Agent Evolution Timeline]
    └──required by──> [Lineage Tree (depth-1) (needs soul version history)]
    └──required by──> [Experiment Ledger (needs run-by-run score history)]

[Webhook Receiver]
    └──requires──> [Tool Belt (tool must be connected)]
    └──requires──> [Routing rules storage (DB schema)]
    └──requires──> [Dead letter queue (BullMQ)]

[Agent-Authored Tools]
    └──requires──> [Tool Belt (registration path)]
    └──requires──> [Gateway Invocation Endpoint (same gateway, same path)]
    └──requires──> [Human Confirmation Gate (approval before deployment)]
    └──requires──> [Sandboxed container runtime (new GCP Cloud Run infra)]
    NOTE: Highest-risk feature. Treat as separate phase or defer to v6.1
```

### Critical Dependency Notes

- **CSS Token System is the unblocking prerequisite for all UI work.** Build tokens and typography first. No component can be built correctly without it.
- **Tool Contracts block the Gateway.** Typed contracts must be defined before the gateway can validate requests. `tool-contracts` package must be extended in the first phase of Tool Nexus work.
- **OAuth flow blocks most of Tool Belt.** Tools connected with API key auth can ship before OAuth, but HubSpot, Slack, and Google Sheets require OAuth. Schedule OAuth implementation before catalog launch.
- **Tool Performance in Evolution requires invocation logging to be stable first.** Do not extend the Council and fitness score until 10+ executions' worth of clean invocation data exists from the new gateway. This is a v6.1 feature, not v6.0.
- **Agent-Authored Tools requires new GCP infrastructure** (Cloud Run sandboxed containers per user). This is a separate infrastructure concern from all other features. Scope it as a standalone phase and gate on business validation.
- **Paperclip API client and existing GCE/OpenClaw path are temporarily parallel during migration.** Both paths must function during the transition window. Time-box the migration: build Paperclip client → test → cut over atomically → remove GCE orchestration code.

---

## v6.0 MVP Definition

### Launch With (v6.0 core — P1)

Features without which v6.0 cannot ship:

- [ ] CSS token system — Screenplay (`--h-*`) and Director's Cut (`--d-*`) tokens, `body.system` toggle, all three fonts loaded — required as the unblocking prerequisite for all v6.0 UI
- [ ] Paperclip API client — agent dispatch, session management, adapter selection — required to make Akasa a product layer
- [ ] Tool Nexus: Tool catalog UI — 5-8 built-in integrations, organized by category
- [ ] Tool Nexus: OAuth + API key connection flows — token storage, status display, re-auth on expiry
- [ ] Tool Nexus: Tool Belt view — connected tools, connection status badges, last used
- [ ] Tool Nexus: Typed tool contracts — `tool-contracts` package extended with built-in integration schemas
- [ ] Tool Nexus: Gateway invocation endpoint — auth injection, schema validation, normalized `{ success, data, error }` response
- [ ] Tool Nexus: Rate limiting per-tool (Redis sliding window) — 429 with retry-after
- [ ] Tool Nexus: Invocation logging — structured per-invocation log queryable by execution
- [ ] Tool Nexus: Retry logic — exponential backoff with jitter on 429/503
- [ ] Tool Nexus: Custom tool registration — name, base URL, auth config, actions as schemas
- [ ] Tool Nexus: OpenAPI/Swagger import — paste URL or upload file, auto-generate actions from spec
- [ ] Evolution Dashboard: Fleet overview — class distribution, bit rate, effective bit rate (prominent with amber/gold treatment)
- [ ] Evolution Dashboard: Per-agent evolution timeline — council verdicts, class transitions, mutations, DNA captures in chronological order
- [ ] Evolution Dashboard: Composite score trend chart — per-agent score over executions
- [ ] Evolution Dashboard: Lineage tree (depth-1) — archetype → current soul, clickable nodes
- [ ] Evolution Dashboard: Experiment ledger — run-by-run log per agent (score, delta, mutation, verdict, outcome)
- [ ] Evolution Dashboard: Category benchmarks — pioneer baselines, maturity status, thin-data flags
- [ ] Evolution Dashboard: Two-world toggle — Director's Cut default for evolution views; Screenplay for onboarding/chat

### Add After Validation (v6.1)

- [ ] Webhook receiver with routing rules — add when tool catalog is in active use and users request event-driven triggers
- [ ] Dead letter queue for failed webhooks — add with webhook receiver
- [ ] Tool performance in evolution (Council extension + fitness score update) — add after 10+ executions through new gateway; needs clean invocation data first
- [ ] Cost metering per invocation (per-call cost attribution) — add with tool performance
- [ ] Lineage tree depth-3 graphical view — add when users navigate depth-1 tree and request more history
- [ ] Agent-authored tools (sandboxed container runtime) — add after tool catalog is stable and business validates demand; requires new GCP infrastructure

### Future Consideration (v7.0+)

- [ ] Skill System (SKILL.md, skill loadout, Skill Bazaar) — full dedicated milestone per PRD US-019 through US-026
- [ ] Command Channel (Paperclip issue-backed comms, WebSocket streaming, multi-channel bridging) — full dedicated milestone per PRD US-027 through US-032
- [ ] Akashic Library (soul marketplace, publishing) — requires DNA Library depth before publishable souls exist at scale
- [ ] Multi-tenant isolation — out of scope until post-validation
- [ ] Mutation weight sliders (user influence on evolution pressure) — explicitly deferred to v2.1 in PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSS Token System + Typography | HIGH | LOW | P1 |
| Paperclip API Client | HIGH | MEDIUM | P1 |
| Tool Catalog UI | HIGH | LOW | P1 |
| OAuth Connection Flow | HIGH | MEDIUM | P1 |
| API Key Connection Flow | HIGH | LOW | P1 |
| Tool Belt View | HIGH | LOW | P1 |
| Typed Tool Contracts | HIGH | MEDIUM | P1 |
| Gateway Invocation Endpoint | HIGH | MEDIUM | P1 |
| Rate Limiting per-tool | HIGH | MEDIUM | P1 |
| Invocation Logging | HIGH | LOW | P1 |
| Retry Logic | MEDIUM | LOW | P1 |
| Fleet Overview + Bit Rate | HIGH | LOW | P1 |
| Per-Agent Evolution Timeline | HIGH | MEDIUM | P1 |
| Composite Score Trend Chart | HIGH | LOW | P1 |
| Lineage Tree (depth-1) | HIGH | HIGH | P1 |
| Category Benchmarks View | MEDIUM | LOW | P1 |
| Experiment Ledger | MEDIUM | MEDIUM | P1 |
| Two-World Toggle | MEDIUM | MEDIUM | P1 |
| Custom Tool Registration | HIGH | MEDIUM | P2 |
| OpenAPI/Swagger Import | HIGH | HIGH | P2 |
| Cost Metering per Invocation | MEDIUM | LOW | P2 |
| Webhook Receiver | MEDIUM | HIGH | P2 |
| Dead Letter Queue | MEDIUM | MEDIUM | P2 |
| Tool Performance in Evolution | MEDIUM | HIGH | P2 |
| Lineage Tree (depth-3) | MEDIUM | HIGH | P3 |
| Agent-Authored Tools | HIGH | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for v6.0 launch
- P2: Add in v6.1 after v6.0 validated
- P3: Future consideration, defer until product-market fit confirmed

---

## Competitor Feature Analysis

| Feature | Zapier / n8n | Composio / LangChain Tools | Akasa Approach |
|---------|--------------|----------------------------|----------------|
| Tool catalog | 1000+ integrations (Zapier), 400+ (n8n) | 100+ tools optimized for LLM consumption | Curated (5-8) with custom registration + OpenAPI import. Quality and correctness over quantity |
| OAuth management | Polished popup flow (Zapier), complex setup (n8n) | Token injection for LLM context | Zapier-style UX: one click to authorize, auto-refresh, re-auth button on expiry |
| Typed contracts | Loose node schemas (n8n), not agent-facing | Structured for LLM function calling | Zod schemas in `tool-contracts` package — agents get validated I/O, not raw HTTP. Stronger than Composio's function call schemas |
| OpenAPI import | Zapier: no. n8n: partial (HTTP node) | No | Full OpenAPI/Swagger import generating action definitions. Differentiating capability |
| Per-agent tool scoping | No concept of agent identity in tool calls | Partial (per-agent context) | Session JWT with tool allowlist per agent — security boundary that Zapier/n8n don't have |
| Webhook routing rules | Zapier: trigger-based. n8n: filter nodes | Not supported | Configurable routing rules with event log and dead letter queue |
| Agent-authored tools | Not supported | Not supported | Artisan-only proposal → approval → sandboxed deploy → Tool Belt registration. Unique capability |
| Tool performance in agent evolution | Not applicable (tools are passive utilities) | Not applicable | Tool usage patterns factor into fitness score — tools become evolutionary levers |
| Evolution dashboard | Not applicable | Not applicable | Unique to Akasa — lineage trees, experiment ledger, bit rate metrics, pioneer designations |

---

## Sources

- `tasks/prd-akasa-mvp.md` — US-009, US-013 through US-018, FR-16 through FR-27 (HIGH confidence — authoritative PRD)
- `.planning/PROJECT.md` — v6.0 milestone requirements (HIGH confidence — authoritative project doc)
- `tasks/akasa-design-guide.md` — two-world design system, CSS token spec, typography rules (HIGH confidence — authoritative design doc)
- [APIs for AI Agents: The 5 Integration Patterns — Composio](https://composio.dev/content/apis-ai-agents-integration-patterns) — AI agent API integration patterns (MEDIUM confidence)
- [MCP Gateways: A Developer's Guide — Composio](https://composio.dev/content/mcp-gateways-guide) — current gateway architecture for AI agents (MEDIUM confidence)
- [Outgrowing Zapier/Make/n8n for AI Agents — Composio](https://composio.dev/content/outgrowing-make-zapier-n8n-ai-agents) — per-user OAuth, tenant isolation patterns at scale (MEDIUM confidence)
- [Zapier Auth Documentation](https://docs.zapier.com/platform/build/auth) — OAuth v2 auto-refresh pattern (HIGH confidence — official docs)
- [Getting Found by Agents: Tool Discovery Guide — icme.io](https://blog.icme.io/getting-found-by-agents-a-builders-guide-to-tool-discovery-in-2026/) — OpenAPI spec quality for agent tool discovery (LOW confidence — single source)
- [API Gateway Patterns for AI SaaS — dasroot.net](https://dasroot.net/posts/2026/02/api-gateway-patterns-ai-saas/) — gateway design patterns for AI platforms (MEDIUM confidence)

---

*Feature research for: Akasa v6.0 — Paperclip Foundation (Tool Nexus, Evolution Dashboard, Paperclip Integration)*
*Researched: 2026-03-23*
*Supersedes: Previous FEATURES.md content (v2.0 SOUL System research — features now shipped)*
