# Architecture — Akasa (claw-army)

> **Last updated**: 2026-04-07  
> **Status**: Baseline documentation (v1.0)

## Overview

Akasa is a D2C platform for acquiring, deploying, and evolving AI agent fleets. It wraps [Paperclip](https://github.com/paperclipai/paperclip) (separate repo) with a consumer-facing product layer on top.

### Core Thesis

Value creation is a war of attrition — **bit rate** (number of agents) × **effective bit rate** (average fitness) = output capacity.

### Two-Repo Architecture

| Repo | Role | Hosting |
|------|------|---------|
| `claw-army` (this repo) | Akasa product — evolution engine, skill system, Tool Nexus, marketplaces, billing, UI | Railway + GCP |
| `claw-paper-clip` | Agent orchestration, 7 adapters (Claude, Codex, Gemini, OpenClaw, Cursor, OpenCode, PI), plugin SDK | Railway |

Akasa's Fastify backend calls Paperclip's API for agent dispatch. All product logic lives in claw-army.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                    SvelteKit UI (Port 5173 dev / Vercel prod)               │
│                                                                              │
│  /office (Fleet Management)  /chat (Command Channel)  /evolution (DNA)      │
│  /indra (CEO Briefing)      /tools (Tool Nexus)       /sanctum (Settings)  │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTP (SvelteKit proxy /api/... → execution-service)
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AKASA BACKEND (Railway)                               │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │    execution-service (Fastify)   │  │        akasa-server (Fastify)    │  │
│  │  • Bot lifecycle & orchestration │  │  • OAuth flows (Tool Nexus)       │  │
│  │  • BullMQ task dispatch          │  │  • Webhook routing & verification │  │
│  │  • Ring Leader coordination      │  │  • Soul injection & generation    │  │
│  │  • Council (3-judge evaluation)  │  │  • Credential encryption (AES-256) │  │
│  │  • God Layer (class transitions) │  │  • Evolution trigger polling      │  │
│  │  • Budget enforcement            │  │                                   │  │
│  └──────────────┬──────────────────┘  └───────────────┬───────────────────┘  │
│                 │                                          │                │
│                 │ SSE / HTTP                               │                │
│                 ▼                                          ▼                │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │         tool-gateway (Fastify)   │  │       GCP Pub/Sub                 │  │
│  │  • Per-execution domain          │  │  • billing.events                  │  │
│  │    allowlisting                  │  │  • lifecycle.events                │  │
│  │  • Tool invocation audit logging │  │  • execution.events                │  │
│  │  • Per-bot rate limiting         │  │  • council.events                  │  │
│  │  • HTTP CONNECT tunneling        │  │                                   │  │
│  └──────────────┬──────────────────┘  └───────────────────────────────────┘  │
│                 │                                                             │
└─────────────────┼─────────────────────────────────────────────────────────────┘
                  │ HTTPS / WebSocket
                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     PAPERCLIP (claw-paper-clip on Railway)                   │
│                                                                              │
│  • Agent sessions & orchestration    • 7 runtime adapters                      │
│  • Plugin SDK                       • Issue-backed communication             │
│  • WebSocket events                 • Company/agent management                │
└──────────────────────────────────────────────────────────────────────────────┘
                  │
                  │ GCE VMs (no public IP, 10.0.0.0/24 subnet)
                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           BOT AGENTS (GCE)                                   │
│                                                                              │
│  • OpenClaw runtime (pinned v2026.2.22-2)    • SOUL.md constitution          │
│  • Session JWT for auth                       • Ephemeral, stateless          │
│  • Zero direct network access                 • All egress via tool-gateway   │
└──────────────────────────────────────────────────────────────────────────────┘
                  │
                  │ Internal IP only
                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         GCP CLOUD SQL + REDIS                                │
│                                                                              │
│  PostgreSQL + pgvector (10.101.0.3)    Redis (BullMQ queue)                   │
│  • All Akasa data                     • Task queue (concurrency=20)          │
│  • Soul embeddings (vector(1536))     • Rate limit counters                  │
│                                        • Budget state                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Package Structure

```
packages/
├── db/                        # Drizzle ORM schema + migrations + seeds
│   └── src/
│       └── schema/            # 19 schema files (one per table)
│           ├── auth.ts
│           ├── executions.ts
│           ├── bots.ts
│           ├── tasks.ts
│           ├── objectives.ts
│           ├── bot-souls.ts          # SoulDocument, embedding vector(1536)
│           ├── council-verdicts.ts    # VerdictType (Promote/Maintain/etc)
│           ├── decision-traces.ts     # Per-decision soul attribution
│           ├── dna-store.ts           # Behavioral DNA per task category
│           ├── agent-classes.ts       # Novice → Understudy → Artisan
│           ├── category-benchmarks.ts # Pioneer benchmarks
│           ├── negative-signal-register.ts
│           ├── ring-leader-runs.ts
│           ├── billing-events.ts
│           ├── tool-invocations.ts
│           ├── tool-connections.ts    # OAuth credentials (encrypted)
│           ├── tool-invocation-logs.ts
│           ├── webhook-routing-rules.ts
│           └── telemetry.ts
│
├── shared-types/              # Pure TypeScript types (no runtime deps)
├── event-schemas/             # Zod v4 schemas for all SSE/Pub/Sub events
└── tool-contracts/            # Zod v4 schemas for tool gateway contracts
```

---

## Service Architecture

### execution-service (`services/execution-service/`)

**Purpose**: Core backend — bot lifecycle, orchestration, Council, God Layer, evolution engine.

**Port**: 3000 (dev)

**Framework**: Fastify v5 + TypeBox + `@fastify/type-provider-typebox`

**Routes**:

| Prefix | File | Purpose |
|--------|------|---------|
| `/executions` | `routes/executions.ts` | CRUD + SSE streams (events, logs, lifecycle) |
| `/bots` | `routes/bots.ts` | Bot registry and status |
| `/billing` | `routes/billing.ts` | Budget enforcement + billing events |
| `/admin` | `routes/admin.ts` | Health checks, waitlist |
| `/verdicts` | `routes/verdicts.ts` | Human confirmation gate for Promote/Retire |
| `/army-builder` | `routes/army-builder.ts` | Population analysis |
| `/objectives` | `routes/objectives.ts` | Objective CRUD |
| `/ring-leader` | `routes/ring-leader.ts` | Pre-flight manifest, run lookup |
| `/souls` | `routes/souls.ts` | Soul Library browser |
| `/category-benchmarks` | `routes/category-benchmarks.ts` | Pioneer benchmarks |
| `/decision-traces` | `routes/decision-traces.ts` | Decision trace viewer |
| `/negative-signals` | `routes/negative-signals.ts` | Negative signal register |
| `/onboarding` | `routes/onboarding.ts` | Company + agent creation |
| `/paperclip-proxy` | `routes/paperclip-proxy.ts` | Forward to Paperclip API |
| `/auth` | `routes/auth.ts` | BetterAuth Google OAuth |
| `/events` | `routes/sse.ts` | Lifecycle SSE (promotion/demotion/retirement) |

**Core Services**:

| Module | File | Responsibility |
|--------|------|----------------|
| **Bot Orchestrator** | `orchestrator/bot-orchestrator.ts` | Bot lifecycle state machine |
| **GCE Launcher** | `orchestrator/gce-bot-launcher.ts` | Spawn bots on GCE VMs |
| **OpenClaw Client** | `orchestrator/openclaw-client.ts` | OpenClaw gateway communication |
| **Bot Registry** | `orchestrator/bot-registry.ts` | Active bot session tracking |
| **Task Queue** | `queue/task-queue.ts` | BullMQ producer/consumer |
| **Council Worker** | `queue/council-worker.ts` | Async 3-judge evaluation |
| **God Layer Worker** | `queue/god-layer-worker.ts` | Verdict execution (promotions, DNA writes) |
| **Ring Leader Spawner** | `services/ring-leader-spawner.ts` | CEO agent instantiation |
| **Soul Library Search** | `services/soul-library-search.ts` | pgvector similarity search |
| **Population Assembler** | `services/population-assembler.ts` | Bot soul assignment per task |
| **Coordination Loop** | `services/coordination-loop.ts` | Real-time inter-bot intelligence routing |
| **Drift Detector** | `services/drift-detector.ts` | Objective drift detection |
| **Budget Validator** | `services/budget-validator.ts` | Pre-spawn budget validation |
| **Budget Degradation** | `services/budget-degradation.ts` | Tiered runtime budget enforcement |
| **Run Synthesis** | `services/run-synthesis.ts` | LLM-driven post-run synthesis |
| **Performance Judge** | `council/performance-judge.ts` | LLM evaluation (Anthropic Claude) |
| **Soul Analyst** | `council/soul-analyst.ts` | Soul behavior analysis (Anthropic Claude) |
| **Devil's Advocate** | `council/devils-advocate.ts` | Challenge evaluation (Google Gemini) |
| **Class Machine** | `god-layer/class-machine.ts` | State transitions (Novice→Understudy→Artisan) |
| **DNA Writer** | `god-layer/dna-writer.ts` | Capture elite behavioral patterns |
| **Negative Register** | `god-layer/negative-register.ts` | Penalty signals for degraded behavior |
| **Pioneer Tracker** | `god-layer/pioneer-tracker.ts` | Track category benchmark setters |

**Event Publishers**:

| Event Family | Topic |
|--------------|-------|
| `billing.events` | Budget consumption, threshold alerts |
| `lifecycle.events` | Bot start/stop, promotion/demotion |
| `execution.events` | Execution state transitions |
| `council.events` | Verdict outputs |

**Environment Variables**:

```
DATABASE_URL           # PostgreSQL connection string
REDIS_URL              # Redis connection string
PAPERCLIP_API_URL      # Paperclip API base URL
PAPERCLIP_API_TOKEN    # Paperclip API auth token
AUTH_SECRET            # JWT signing secret
GOOGLE_CLIENT_ID       # OAuth client ID
GOOGLE_CLIENT_SECRET   # OAuth client secret
CORS_ORIGIN            # Allowed CORS origin
LOG_LEVEL              # Pino log level
```

---

### akasa-server (`services/akasa-server/`)

**Purpose**: Paperclip wrapper server + Tool Nexus OAuth + webhooks.

**Port**: 3001 (dev)

**Framework**: Paperclip app (Express-based) extended with Fastify routes

**Paperclip Integration**: Spawns Paperclip server as embedded dependency, installs Akasa Tool Nexus plugin.

**Routes**:

| Prefix | File | Purpose |
|--------|------|---------|
| `/akasa/health` | `routes/internal.ts` | Health check |
| `/akasa/tool-connections` | `routes/tool-connections.ts` | OAuth credential management |
| `/akasa/oauth-flow` | `routes/oauth-flow.ts` | OAuth authorization code flow |
| `/akasa/webhooks` | `routes/webhooks.ts` | Inbound webhook receiver |
| `/akasa/webhook-routing-rules` | `routes/webhook-routing-rules.ts` | Routing rule CRUD |
| `/akasa/webhook-logs` | `routes/webhook-logs.ts` | Webhook delivery logs |
| `/akasa/god-layer` | `routes/god-layer.ts` | God Layer trigger |
| `/akasa/council` | `routes/council.ts` | Council invocation |
| `/akasa/souls` | `routes/souls.ts` | Soul CRUD |
| `/akasa/evolution-trigger` | `routes/evolution-trigger.ts` | Heartbeat polling for completed runs |
| `/akasa/evolution-dashboard` | `routes/evolution-dashboard.ts` | Evolution metrics |

**Core Services**:

| Module | File | Responsibility |
|--------|------|----------------|
| **Credential Encryption** | `services/credential-encryption.ts` | AES-256-GCM encryption for OAuth tokens |
| **Token Manager** | `services/token-manager.ts` | OAuth access/refresh token lifecycle |
| **OAuth Providers** | `services/oauth-providers.ts` | HubSpot, Slack, Stripe provider configs |
| **Webhook Verifier** | `services/webhook-verifier.ts` | HMAC-SHA256 signature verification |
| **Soul Injector** | `services/soul-injector.ts` | Inject SOUL.md into agent sessions |
| **Soul Generator** | `services/soul-generator.ts` | Generate new souls via mutation |
| **Council Runner** | `council/council-runner.ts` | Async 3-judge evaluation |
| **God Layer Handler** | `god-layer/god-layer-handler.ts` | Verdict-driven state transitions |
| **Tool Rate Limiter** | `middleware/tool-rate-limiter.ts` | Per-user rate limiting |

---

### tool-gateway (`services/tool-gateway/`)

**Purpose**: Security boundary — all bot internet egress routes through here.

**Port**: 3002 (dev)

**Framework**: Fastify v5

**Security Model**:
- Bots have **zero direct internet access**
- All egress via HTTP CONNECT tunneling or HTTP forward proxy
- Per-execution domain allowlist enforced
- Per-bot rate limiting (tools/min, tokens/min)
- Full audit logging

**Routes**:

| Path | File | Purpose |
|------|------|---------|
| `/tool-invoke` | `routes/tool-invoke.ts` | Tool execution with allowlist + rate limiting |
| `CONNECT *` | `routes/proxy.ts` | TCP tunnel for bot egress |
| `HTTP *` | `routes/proxy.ts` | HTTP forward proxy |

**Middleware**:

| Module | File | Responsibility |
|--------|------|----------------|
| **Auth** | `middleware/auth.ts` | JWT validation (BOT_JWT_SECRET) |
| **Rate Limit** | `middleware/rate-limit.ts` | Per-bot rate limiting counters |

**Tools Built-in**:

| Tool | File | Purpose |
|------|------|---------|
| `fetch-url` | `tools/fetch-url.ts` | HTTP GET with allowlist |
| `write-file` | `tools/write-file.ts` | Write to bot's working directory |
| `llm-call` | `tools/llm-call.ts` | Direct LLM invocation (for Tool Nexus LLMs) |

**Environment Variables**:

```
BOT_JWT_SECRET         # JWT validation secret for bot auth
TOOL_ENCRYPTION_KEY    # AES-256-GCM key for credential encryption
CACHE_TTL_SECONDS      # Domain allowlist cache TTL (default 60)
```

---

### ui (`services/ui/`)

**Purpose**: SvelteKit consumer frontend.

**Port**: 5173 (dev)

**Framework**: SvelteKit v2 + Svelte 5 (runes syntax)

**Route Groups**:

| Group | Path | Purpose |
|-------|------|---------|
| `(marketing)` | `/` | Landing page, waitlist |
| `(onboarding)` | `/onboarding` | First-time user flow with Indra |
| `(app)` | `/office/*` | Fleet management |
| `(app)` | `/chat` | Command Channel |
| `(app)` | `/evolution/*` | Soul library, DNA, lineage |
| `(app)` | `/indra` | CEO briefing page |
| `(app)` | `/tools/*` | Tool Nexus UI |
| `(app)` | `/sanctum` | Settings |
| `(app)` | `/guide` | Getting started guide |
| `auth` | `/login` | Google OAuth login |

**Key Pages**:

| Page | File | Purpose |
|------|------|---------|
| Office | `(app)/office/+page.svelte` | Fleet dashboard |
| Bot Detail | `(app)/office/bots/[id]/+page.svelte` | Individual bot + decision traces |
| Execution Detail | `(app)/office/executions/[id]/+page.svelte` | Live execution monitoring |
| Objectives | `(app)/office/goals/+page.svelte` | Objective CRUD |
| Evolution | `(app)/evolution/+page.svelte` | Fleet overview, verdicts |
| Soul Library | `(app)/evolution/agents/+page.svelte` | Browse souls |
| Category Benchmarks | `(app)/evolution/benchmarks/+page.svelte` | Pioneer tracking |
| Tool Catalog | `(app)/tools/catalog/+page.svelte` | Available tools |
| Tool Belt | `(app)/tools/belt/+page.svelte` | User's connected tools |
| Webhooks | `(app)/tools/webhooks/+page.svelte` | Webhook routing rules |
| Indra | `(app)/indra/+page.svelte` | Chief of Staff briefing |
| Chat | `(app)/chat/+page.svelte` | Command Channel |

**Components** (selected):

| Component | Path | Purpose |
|-----------|------|---------|
| `NavBar` | `lib/components/NavBar.svelte` | Primary navigation |
| `Modal` | `lib/components/Modal.svelte` | Modal dialog |
| `Accordion` | `lib/components/Accordion.svelte` | Collapsible sections |
| `SlidePanel` | `lib/components/SlidePanel.svelte` | Slide-in panel |
| `MetricTile` | `lib/components/MetricTile.svelte` | KPI display |
| `LineageTree` | `lib/components/evolution/LineageTree.svelte` | Soul lineage visualization |
| `VerdictConfirm` | `lib/components/evolution/VerdictConfirm.svelte` | Human confirmation gate |
| `BotTimeline` | `lib/components/evolution/BotTimeline.svelte` | DNA evolution timeline |
| `ToolCard` | `lib/components/tools/ToolCard.svelte` | Tool display |
| `AgentCard` | `lib/components/onboarding/AgentCard.svelte` | Onboarding agent proposal |
| `ChipSelect` | `lib/components/onboarding/ChipSelect.svelte` | Chip-based input |

**Two UI Worlds**:

| World | Trigger | Palette |
|-------|---------|---------|
| **Screenplay** (light) | Default | Cream `#F5F2EC` / plum / gold |
| **Director's Cut** (dark) | `body.system` class | Near-black `#06050E` / violet / amber |

**Fonts**:
- Cormorant Garamond — display/headlines
- DM Sans — body/UI
- Press Start 2P — labels/tags only (6-8px)

**Real-time**: WebSocket via `$lib/ws.ts` (3 streams: execution events, bot logs, lifecycle)

---

## Database Schema

### Core Entities

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   executions    │────▶│      bots       │────▶│    tasks        │
│                 │     │                 │     │                 │
│ status          │     │ status          │     │ status          │
│ objective       │     │ executionId FK  │     │ botId FK        │
│ budgetCapCents  │     │ soulId (logical)│     │ executionId FK   │
│ maxBots         │     │ compositeScore  │     │                  │
│ allowedTools[]  │     │ tier            │     └─────────────────┘
│ taskCategory    │     │ paperclipAgentId│
│ campaignType    │     └────────┬────────┘
│ ringLeaderRunId │              │
└─────────────────┘              │ soulId (logical)
                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  agent_classes  │◀─── │   bot_souls     │────▶│ decision_traces │
│                 │     │                 │     │                 │
│ botId FK        │     │ embedding(1536) │     │ soulId FK       │
│ class (Novice/  │     │ dimensions JSON │     │ directive       │
│  Understudy/    │     │ archetype       │     │ decision JSON   │
│  Artisan)       │     │ generation      │     └─────────────────┘
│ taskCategory    │     │ lineage[]       │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ council_verdicts│
                        │                 │
                        │ botId FK        │
                        │ verdict         │
                        │ (Promote/       │
                        │  Maintain/      │
                        │  Monitor/        │
                        │  Demote/Retire)  │
                        │ confidence      │
                        │ judgeType       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   dna_store     │
                        │                 │
                        │ taskCategory    │
                        │ patterns JSON   │
                        │ version         │
                        │ generation      │
                        └─────────────────┘
```

### Full Schema Tables

| Table | File | Key Columns |
|-------|------|-------------|
| `executions` | `schema/executions.ts` | status, objective, budgetCapCents, maxBots, allowedTools[], taskCategory, campaignType |
| `bots` | `schema/bots.ts` | status, executionId FK, soulId (logical), compositeScore, tier, paperclipAgentId |
| `tasks` | `schema/tasks.ts` | status, botId FK, executionId FK, taskKey |
| `objectives` | `schema/objectives.ts` | title, description, taskCategory, successMetrics, userId FK |
| `bot_souls` | `schema/bot-souls.ts` | embedding vector(1536), dimensions JSON, archetype, generation, parentLineage[] |
| `council_verdicts` | `schema/council-verdicts.ts` | verdict (enum), confidence, judgeType, evidence JSON |
| `decision_traces` | `schema/decision-traces.ts` | soulId FK, directive, decision JSON, timestamp |
| `dna_store` | `schema/dna-store.ts` | taskCategory, patterns JSON, version |
| `agent_classes` | `schema/agent-classes.ts` | botId FK, class, taskCategory, promotedAt |
| `category_benchmarks` | `schema/category-benchmarks.ts` | taskCategory, pioneerBotId FK, benchmarkScore |
| `negative_signal_register` | `schema/negative-signal-register.ts` | botId FK, signalType, evidence JSON |
| `ring_leader_runs` | `schema/ring-leader-runs.ts` | executionId FK, fitnessScore, synthesisDoc |
| `billing_events` | `schema/billing-events.ts` | executionId FK, eventType, cents, timestamp |
| `tool_invocations` | `schema/tool-invocations.ts` | botId FK, toolName, success, tokensUsed, latencyMs |
| `tool_connections` | `schema/tool-connections.ts` | userId FK, provider, encryptedCredentials |
| `tool_invocation_logs` | `schema/tool-invocation-logs.ts` | toolConnectionId FK, request/response (encrypted) |
| `webhook_routing_rules` | `schema/webhook-routing-rules.ts` | toolConnectionId FK, eventType, routingExpression |
| `telemetry` | `schema/telemetry.ts` | botId FK, metricName, value, timestamp |
| `auth` | `schema/auth.ts` | (Paperclip schema — users, sessions, accounts) |

---

## Queue Architecture (BullMQ + Redis)

```
┌─────────────────────────────────────────────────────────────┐
│                        REDIS                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ task-queue   │  │ council-queue│  │ god-layer-queue  │  │
│  │              │  │              │  │                  │  │
│  │ concurrency= │  │ concurrency= │  │ concurrency=1   │  │
│  │     20       │  │     5        │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼────────────────────┼───────────┘
          │                 │                    │
          ▼                 ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   stub-bot /    │ │  Council Worker │ │   God Layer Worker  │
│   OpenClaw VM   │ │  (3 judges)     │ │  (Class transitions,│
│                 │ │                 │ │   DNA writes)       │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

## Security Architecture

### Bot Isolation

1. **Network**: GCE VMs on private subnet (10.0.0.0/24), no public IP, IAP SSH only
2. **Egress**: All outbound traffic routed through tool-gateway via `HTTP_PROXY` env var
3. **Auth**: Per-bot session JWTs, no persistent credentials
4. **Filesystem**: Ephemeral, stateless — no persistent storage on VM

### Tool Gateway Security

```
Bot Request
    │
    ▼
JWT Validation (BOT_JWT_SECRET)
    │
    ▼
Domain Allowlist Check (Redis-cached, 60s TTL)
    │
    ▼
Rate Limiting (Redis counters: tools/min, tokens/min per bot)
    │
    ▼
Tool Schema Validation (Zod)
    │
    ▼
Tool Execution + Audit Logging
    │
    ▼
Response
```

### Credential Encryption

OAuth credentials stored with AES-256-GCM encryption:
- Key: `TOOL_ENCRYPTION_KEY` env var (32 bytes, base64)
- Per-nonce IV, authentication tag prevents tampering
- Only encrypted blobs hit the database

---

## Infrastructure

### GCP

| Resource | Details |
|----------|---------|
| Cloud SQL | PostgreSQL + pgvector at 10.101.0.3 |
| Bot VMs | `e2-standard-2`, Ubuntu 22.04, no external IP |
| Subnet | 10.0.0.0/24 |
| Firewall | `claw-bot-vm` tag, IAP SSH only |
| Pub/Sub | Inter-service events |

### Railway

| Service | Details |
|---------|---------|
| `claw-akasa` | akasa-server (Paperclip + Tool Nexus) |
| `claw-execution` | execution-service |
| `claw-tool-gateway` | tool-gateway |
| `claw-paperclip` | Paperclip service |
| `claw-telegram` | Telegram bot |

---

## Evolution Engine

### Karpathy Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXECUTION CYCLE                             │
│                                                                 │
│  1. Ring Leader decomposes objective into DAG                   │
│  2. Soul Library search (pgvector similarity)                   │
│  3. Population assembly + budget validation                     │
│  4. Bot spawning with SOUL.md constitutions                     │
│  5. Coordination loop (intelligence routing, failure handling) │
│  6. Run synthesis (LLM retrospective)                            │
│  7. Council evaluation (3-judge async)                         │
│  8. Human confirmation gate (Promote/Retire only)               │
│  9. God Layer executes verdict                                  │
│     • Class transition (Novice→Understudy→Artisan)             │
│     • DNA capture (elite patterns)                              │
│     • Pioneer tracking (benchmark setters)                      │
│  10. Next generation souls mutate based on DNA                  │
└─────────────────────────────────────────────────────────────────┘
```

### Soul Dimensions (7 behavioral axes)

1. `identityRole` — How the bot identifies itself
2. `decisionPriorities` — What takes precedence
3. `toolUsageDoctrine` — When and how to use tools
4. `riskTolerance` — Risk posture
5. `communicationStyle` — How it reports
6. `recoveryBehavior` — How it recovers from failures
7. `ethicalHardStops` — Inviolable rules

### Verdict Types

| Verdict | Meaning | Action |
|---------|---------|-------|
| `Promote` | Exceptional performance | Increment class, capture DNA |
| `Maintain` | Normal performance | Continue operating |
| `Monitor` | Below average | Increased observability |
| `Demote` | Poor performance | Reduce class or flag |
| `Retire` | Failed/unsafe | Remove from fleet |

### Agent Classes

```
Novice ──(10+ successful runs, benchmark beat)──▶ Understudy
    │                                                      │
    │                                                      │
◀──┘                                                      │
(3+ consecutive Monitor)                              ◀───┘
                                                    (10+ successful runs,
                                                     benchmark beat)
                                                    
Artisan ◀──(sustained excellence)─────────────────────
```

---

## API Gateway Routes

### UI → execution-service (SvelteKit proxy)

All client traffic goes through `/api/[...path]` → execution-service (no direct browser access).

### Key Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/executions` | Create execution |
| GET | `/api/executions/:id` | Execution detail |
| GET | `/api/executions/:id/events` | SSE stream |
| GET | `/api/executions/:id/logs` | Bot logs stream |
| POST | `/api/executions/:id/preflight/confirm` | Confirm pre-flight manifest |
| POST | `/api/executions/:id/preflight/cancel` | Cancel execution |
| GET | `/api/bots` | List bots |
| GET | `/api/bots/:id` | Bot detail + decision traces |
| GET | `/api/objectives` | List objectives |
| POST | `/api/objectives` | Create objective |
| GET | `/api/souls` | Soul library |
| GET | `/api/category-benchmarks` | Pioneer benchmarks |
| GET | `/api/decision-traces/:botId` | Decision traces |
| POST | `/api/verdicts/:verdictId/confirm` | Human confirm verdict |
| GET | `/api/army-builder/preview` | Population analysis |
| GET | `/api/ring-leader/:executionId/manifest` | Pre-flight manifest |

---

## Environment Variables Reference

### execution-service

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `PAPERCLIP_API_URL` | Yes | Paperclip API base URL |
| `PAPERCLIP_API_TOKEN` | Yes | Paperclip API auth token |
| `AUTH_SECRET` | Yes | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `CORS_ORIGIN` | No | Default: `http://localhost:5173` |
| `LOG_LEVEL` | No | Default: `info` |

### tool-gateway

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_JWT_SECRET` | Yes | JWT validation for bot auth |
| `TOOL_ENCRYPTION_KEY` | Yes | AES-256-GCM key (32 bytes base64) |
| `CACHE_TTL_SECONDS` | No | Domain allowlist cache TTL (default 60) |

### akasa-server

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Paperclip PostgreSQL URL |
| `WEBHOOK_URL_SECRET` | Yes | Webhook signature secret |
| `TOOL_ENCRYPTION_KEY` | Yes | AES-256-GCM key |

---

## Testing

```bash
# execution-service unit tests
pnpm --filter @claw/execution-service exec vitest run

# akasa-server tests
pnpm --filter @claw/akasa-server exec vitest run

# All tests
pnpm exec vitest run
```

Test files are located in `src/__tests__/` and `src/services/__tests__/` directories.

---

## Development

```bash
# Start infrastructure (Postgres, Redis, PubSub emulator)
docker compose -f docker-compose.dev.yml up -d

# Install pgvector extension
docker exec postgres-db-1 apt-get install -y postgresql-17-pgvector
docker exec postgres-db-1 psql -U postgres -d clawdb -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Run migrations
pnpm db:migrate

# Seed archetypes (required before execution works)
pnpm --filter @claw/db seed:archetypes

# Start all services
pnpm dev

# Start individual services
pnpm --filter @claw/execution-service dev
pnpm --filter @claw/akasa-server dev
pnpm --filter @claw/tool-gateway dev
pnpm --filter @claw/ui dev
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit v2 + Svelte 5 runes |
| Backend | Fastify v5 + TypeBox |
| ORM | Drizzle + node-postgres |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| LLM Routing | Vercel AI SDK (ai ^6.0.90) |
| Events | GCP Pub/Sub + SSE |
| Auth | Auth.js v5 (@auth/sveltekit) + jose |
| Embeddings | text-embedding-3-small via @ai-sdk/openai |
| Infra | GCP (Cloud SQL, GCE, Pub/Sub) + Railway |
