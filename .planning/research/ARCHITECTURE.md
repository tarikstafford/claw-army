# Architecture Research — Akasa v6.0 Paperclip Foundation

**Domain:** AI Agent Fleet Platform — Paperclip Integration + Tool Nexus + Evolution Dashboard
**Researched:** 2026-03-23
**Confidence:** HIGH — based on direct codebase analysis, PRD, design guide, and CLAUDE.md

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (SvelteKit UI)                       │
│  ┌─────────────┐  ┌───────────────┐  ┌───────────┐  ┌────────────┐ │
│  │  Screenplay  │  │ Director's Cut │  │  Command  │  │  Tool Nexus│ │
│  │  (Onboarding │  │  (Evolution    │  │  Channel  │  │     UI     │ │
│  │   / Chat)    │  │   Dashboard)   │  │  (Chat)   │  │            │ │
│  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘  └─────┬──────┘ │
│         └──────────────────┴─────────────────┴──────────────┘        │
│                          /api/[...path] reverse proxy                 │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ HTTPS (SvelteKit server action)
┌───────────────────────────────────▼─────────────────────────────────┐
│                      execution-service (Fastify v5)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Orchestrator │  │   Council +   │  │ God Layer  │  │Paperclip  │  │
│  │  (pre-flight) │  │ Soul/DNA/EVO  │  │ (class tns)│  │  Client   │  │
│  └──────┬───────┘  └──────┬───────┘  └────┬───────┘  └─────┬─────┘  │
│         │                 │               │                 │         │
│  ┌──────▼───────────────────────────────────────────────────▼─────┐  │
│  │              BullMQ Queues (Redis)                              │  │
│  │  task-queue  council-queue  god-layer-queue  evolution-queue    │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────┬───────────────────────────────────────────┬───────────────┘
           │ HTTP CONNECT tunnel (bot egress)           │ HTTPS API calls
           │                                            │
┌──────────▼────────┐                      ┌────────────▼────────────┐
│   tool-gateway    │                      │  Paperclip Service      │
│   (Fastify v5)    │                      │  (claw-paper-clip,      │
│  ┌─────────────┐  │                      │   Railway-hosted)       │
│  │  Forward    │  │                      │  - 7 adapters           │
│  │  Proxy +    │  │                      │  - agent sessions       │
│  │ Tool Nexus  │  │                      │  - issue-backed comms   │
│  │  Invoker    │  │                      │  - WebSocket events     │
│  └─────────────┘  │                      └─────────────────────────┘
└──────────┬────────┘
           │ deploys
┌──────────▼────────────────────────────────┐
│  GCE Bot VMs (10.0.0.0/24 subnet)         │
│  OpenClaw gateway (WebSocket :18789)      │
│  HTTP_PROXY → tool-gateway               │
└───────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `services/ui` | SvelteKit frontend, two-world CSS, reverse proxy to execution-service | EXISTING — extend with new routes |
| `services/execution-service` | Fastify backend: orchestration, council, god-layer, evolution, Paperclip client | EXISTING — add paperclip-client, evolution routes |
| `services/tool-gateway` | HTTP forward proxy + Tool Nexus: typed tool invocation, auth injection, OpenAPI import, webhooks | EXISTING — generalize significantly |
| `services/telegram-bot` | Telegram ↔ Paperclip bridge for Command Channel | EXISTING — rewire to Paperclip comms API |
| `packages/db` | Drizzle schema, migrations, seeds | EXISTING — add 4 new tables |
| `packages/shared-types` | Pure TS types mirroring DB | EXISTING — extend with tool/skill types |
| `packages/tool-contracts` | Zod v4 schemas for Tool Nexus request/response | EXISTING — populate with typed contracts |
| Paperclip (external) | Agent dispatch, adapter selection, session management, issue-backed comms | EXTERNAL SERVICE — consumed via HTTPS API |

---

## Integration: Akasa ↔ Paperclip

### Boundary Definition

Paperclip owns: agent lifecycle (spawn, run, stop), adapter dispatch (Claude/Codex/Gemini/OpenClaw/Cursor/OpenCode/PI), session continuity (task-key strategy), issue-backed communication (comments as durable record), WebSocket streaming events.

Akasa owns: everything above the execution layer — soul generation, mutation, council evaluation, DNA capture, class transitions, tool connections, skill loadouts, billing, UI, marketplaces.

### New Component: `paperclip-client.ts`

**Location:** `services/execution-service/src/services/paperclip-client.ts`

**What it replaces:** Direct GCE VM provisioning (`gce-bot-launcher.ts`) and OpenClaw WebSocket dispatch (`openclaw-client.ts`, `openclaw-dispatcher.ts`) are superseded for the agent dispatch path. GCE provisioning may remain for agent-authored tool containers, but bot lifecycle moves to Paperclip.

**Calls it makes:**

```
POST /api/companies/{companyId}/agents                — create/provision agent
POST /api/companies/{companyId}/agents/{id}/sessions  — start session with soul+task context
GET  /api/companies/{companyId}/events/ws             — WebSocket for streaming agent output
POST /api/companies/{companyId}/issues/{id}/comments  — Command Channel messages
GET  /api/companies/{companyId}/issues/{id}/comments  — read conversation thread
POST /api/companies/{companyId}/heartbeat/wakeup      — wake agent for @-mention
```

**Auth pattern:** Paperclip API key stored as env var `PAPERCLIP_API_KEY` in execution-service. Never exposed to browser. All calls server-to-server.

**Error handling:** Paperclip unavailability must not crash execution — treat as a temporary failure, retry with exponential backoff via BullMQ job retry semantics. Log `[paperclip-client]` prefix with structured error context.

### Data Flow: Agent Dispatch (v6.0 path)

```
User submits execution
        ↓
execution-service: createExecution()
        ↓
orchestrator: validateBudget() + planObjective() [EXISTING]
        ↓
soul-generator: generate SOUL.md per bot [EXISTING]
        ↓
paperclip-client: POST /agents for each bot (passes soul as system prompt)
        ↓
Paperclip: selects adapter (Claude/Gemini/etc.), provisions session
        ↓
Paperclip: runs task, streams output via WebSocket
        ↓
execution-service: receives completion event
        ↓
council-worker: evaluates via 3 LLM judges [EXISTING]
        ↓
god-layer-worker: class transitions, DNA capture [EXISTING]
```

### Data Flow: Command Channel

```
User types message in chat UI
        ↓
SvelteKit server action → execution-service POST /command/message
        ↓
execution-service: paperclip-client.createIssueComment(ceoAgentId, text)
        ↓
Paperclip: stores comment, wakes CEO agent session, streams response
        ↓
execution-service: WebSocket listener receives streaming chunks
        ↓
Pub/Sub publish → SSE stream → UI renders streaming tokens
```

---

## Integration: Tool Nexus Generalization

### What Changes in `tool-gateway`

The existing `tool-gateway` has three specific tools hardcoded: `llm-call.ts`, `fetch-url.ts`, `write-file.ts`. v6.0 replaces this with a generalized invocation layer.

**New file structure:**

```
services/tool-gateway/src/
├── app.ts                 [EXISTING — minimal changes]
├── main.ts                [EXISTING — minimal changes]
├── middleware/            [EXISTING]
├── routes/
│   ├── proxy.ts           [EXISTING — HTTP CONNECT tunnel, keep as-is]
│   ├── tool-invoke.ts     [EXISTING — transform into generic dispatcher]
│   └── webhooks.ts        [NEW — per-user-per-tool webhook receiver]
├── services/
│   ├── tool-invoker.ts    [NEW — schema validation, auth injection, retry]
│   ├── openapi-importer.ts [NEW — Swagger spec → tool contract]
│   └── webhook-router.ts  [NEW — payload verification, routing rules]
└── tools/                 [EXISTING specific tools, kept for backward compat]
    ├── fetch-url.ts        [EXISTING]
    ├── llm-call.ts         [EXISTING]
    └── write-file.ts       [EXISTING]
```

**Tool invocation data flow:**

```
Agent calls HTTP_PROXY → CONNECT tunnel → tool-gateway
        ↓
POST /tools/invoke { toolId, action, params, agentJwt }
        ↓
tool-invoker: validate agentJwt (BOT_JWT_SECRET)
        ↓
tool-invoker: load tool-definition from DB (input schema, auth config)
        ↓
tool-invoker: validate params against input schema (Zod)
        ↓
tool-invoker: inject credentials (OAuth token or API key from tool-connections)
        ↓
tool-invoker: forward HTTP request to external API
        ↓
tool-invoker: normalize response { success, data, error }
        ↓
tool-invoker: write audit log row to tool_invocations
        ↓
return normalized response to agent
```

**Webhook receiver data flow:**

```
External service POSTs to /webhooks/{userId}/{toolId}/{secret}
        ↓
webhook-router: verify signature (HMAC or tool-specific scheme)
        ↓
webhook-router: load routing rules from DB for userId+toolId
        ↓
webhook-router: match event type to routing rule
        ↓
webhook-router: create task in execution-service queue (via internal HTTP)
        OR
webhook-router: write to dead-letter queue if no rule matches
        ↓
return 200 (always — to prevent external retry storms)
```

---

## New Database Tables

Four tables added in `packages/db/src/schema/`:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tool_definitions` | Typed tool contracts | `id`, `userId`, `name`, `baseUrl`, `authMethod`, `actions (JSONB)`, `triggers (JSONB)`, `source` ('builtin'/'custom'/'openapi') |
| `tool_connections` | Encrypted credentials per user per tool | `id`, `userId`, `toolDefinitionId`, `encryptedCredentials`, `status`, `expiresAt` |
| `tool_invocations` | Audit log (replaces basic log) | `id`, `botId`, `toolId`, `action`, `success`, `latencyMs`, `cost`, `executionId` |
| `agent_skills` | Skill definitions (SKILL.md + metadata) | `id`, `userId`, `name`, `content`, `metadata (JSONB)`, `category`, `source`, `effectivenessScore` |
| `skill_loadouts` | Agent ↔ skill junction | `agentId`, `skillId`, `equippedAt`, `activationCount` |

Note: `tool_invocations` already exists in the schema — confirm columns before migrating. Extend rather than replace if overlap exists.

---

## New vs. Modified Components

### New Components (v6.0)

| Component | Location | Purpose |
|-----------|----------|---------|
| `paperclip-client.ts` | `execution-service/src/services/` | HTTP client wrapping all Paperclip API calls |
| `evolution-worker.ts` | `execution-service/src/queue/` | Karpathy loop BullMQ worker |
| `evolution.ts` route | `execution-service/src/routes/` | Evolution Dashboard API endpoints |
| `tool-invoker.ts` | `tool-gateway/src/services/` | Generalized tool invocation logic |
| `openapi-importer.ts` | `tool-gateway/src/services/` | Swagger → tool contract parser |
| `webhook-router.ts` | `tool-gateway/src/services/` | Webhook verification and routing |
| `webhooks.ts` route | `tool-gateway/src/routes/` | Webhook receiver endpoints |
| `tool-nexus.ts` route | `execution-service/src/routes/` | Tool connection management API |
| `skills.ts` route | `execution-service/src/routes/` | Skill Bazaar API |
| `billing.ts` route | `execution-service/src/routes/` (new) | Budget management, Stripe usage |
| `dashboard/` | `ui/src/routes/(app)/` | Evolution Dashboard rebuild |
| `command/` | `ui/src/routes/(app)/` | Command Channel chat UI |
| `tools/` | `ui/src/routes/(app)/` | Tool Nexus management UI |
| `akashic/` | `ui/src/routes/(app)/` | Akashic Library marketplace |
| `bazaar/` | `ui/src/routes/(app)/` | Skill Bazaar marketplace |
| `app.css` (design tokens) | `ui/src/` | Two-world CSS token system |
| `paperclip.ts` | `ui/src/lib/` | Frontend Paperclip WebSocket client for Command Channel |

### Modified Components (v6.0)

| Component | Location | What Changes |
|-----------|----------|-------------|
| `bot-orchestrator.ts` | `execution-service/src/orchestrator/` | Replace GCE VM spawn with paperclip-client.createAgent() |
| `openclaw-dispatcher.ts` | `execution-service/src/queue/` | Replace WebSocket dispatch with paperclip-client.startSession() |
| `tool-invoke.ts` route | `tool-gateway/src/routes/` | Route to new tool-invoker instead of hardcoded tools |
| `soul-generator.ts` | `execution-service/src/services/` | No logic change — output used as Paperclip system prompt |
| `council-worker.ts` | `execution-service/src/queue/` | Add skill effectiveness evaluation per FR-36 |
| `god-layer-worker.ts` | `execution-service/src/queue/` | Add skill loadout capture to DNA snapshots |
| `sse.ts` | `execution-service/src/routes/` | Add evolution-queue and command-channel event topics |
| `app.css` | `ui/src/` | Replace dark violet system with two-world token system |
| `+layout.svelte` (app) | `ui/src/routes/(app)/` | Add world-toggle, new nav items (Command, Tools, Bazaar) |

---

## Design System Architecture

### Two-World CSS Token System

The existing 28-token dark violet system is replaced by a two-world system. Both worlds share one `:root` token block; the Director's Cut overrides are scoped to `body.system`.

**Token architecture:**

```css
/* Screenplay (light) — always on :root */
:root {
  --h-bg: #F5F2EC;
  --h-bg2: #EDE9E0;
  --h-card: #FDFAF6;
  --h-border: #D9CEBB;
  --ink: #0E0D0B;
  --muted: #7A766D;
  --plum: #3D3560;
  --plum-m: #6B5FA0;
  --gold: #B8965A;
  /* spacing tokens */
  --space-xs: 4px; --space-sm: 8px; --space-md: 14px;
  --space-lg: 20px; --space-xl: 28px; --space-2xl: 40px;
}

/* Director's Cut — scoped to body.system */
body.system {
  --d-bg: #06050E;
  --d-card: #100F20;
  --d-border: rgba(148, 110, 255, 0.13);
  --d-text: #ECE8FF;
  --d-muted: rgba(236, 232, 255, 0.52);
  --d-vio: #7C3AED;
  --d-amb: #FBBF24;
  --d-teal: #2DD4BF;
  --d-rose: #F472B6;
}
```

**World routing:** The SvelteKit layout for the Evolution Dashboard and technical routes sets `body.system`; the Command Channel, Office, and onboarding routes clear it. This is a client-side toggle via `$effect()` — no server-side routing involved.

**Font loading strategy:** Google Fonts preconnect + stylesheet link in `app.html`. Three families: Cormorant Garamond (display, 300/400/600 italic), DM Sans (body, 400/500), Press Start 2P (labels, 400 only). Press Start 2P is never above 8px in production — enforce via CSS comment in token file.

**Component scoping rule:** Each `.svelte` component declares whether it renders in Screenplay or Director's Cut context by referencing the appropriate token prefix (`--h-*` vs `--d-*`). Components that render in both worlds use a local CSS variable indirection:

```css
/* Inside a component that works in both worlds */
.card {
  background: var(--card-bg);
}
/* In +layout.svelte for Screenplay context */
:global(.screenplay) { --card-bg: var(--h-card); }
/* In +layout.svelte for Director's Cut context */
:global(body.system) { --card-bg: var(--d-card); }
```

---

## Data Flows

### Evolution Dashboard Data Flow

```
User loads /dashboard
        ↓
SvelteKit load() → GET /evolution/fleet-overview
        ↓
execution-service: aggregate agent_classes + council_verdicts + dna_store
        ↓
return: { bitRate, effectiveBitRate, classDist, recentVerdicts, topDna }
        ↓
SSE stream for live updates (existing subscription fan-out)
        ↓
Dashboard renders: fleet overview (Director's Cut world)
```

```
User clicks into per-agent timeline
        ↓
GET /evolution/agents/{botId}/timeline
        ↓
execution-service: join council_verdicts + dna_store + agent_classes + bot_souls
        ↓
return: ordered event list { verdict, mutation, classTransition, dnaCapture }
        ↓
Per-agent evolution timeline component renders lineage tree + verdict history
```

### Skill Loading at Execution Time

```
Execution dispatched to Paperclip via paperclip-client.startSession()
        ↓
Before session creation: skill-manager.buildContext(botId, taskCategory)
        ↓
skill-manager: query skill_loadouts for botId → get equipped skills
        ↓
skill-manager: Level 1 (always): inject name + description for all skills
skill-manager: Level 2 (trigger match): inject full SKILL.md body for category matches
        ↓
System prompt = SOUL.md + skill context block
        ↓
Passed to Paperclip session as system_prompt field
```

### Tool Invocation Flow (Tool Nexus)

```
Agent calls tool-gateway via HTTP_PROXY
  POST /tools/invoke { toolId, action, params }
        ↓
tool-invoker: validate JWT → check tool-connections for userId
        ↓
tool-invoker: load tool_definitions.actions[action].inputSchema
tool-invoker: validate params (Zod parse) — reject 400 if invalid
        ↓
tool-invoker: decrypt credentials from tool_connections
tool-invoker: inject into request (Bearer header / query param / API key header)
        ↓
tool-invoker: forward to baseUrl + path (HTTP method from action schema)
        ↓
tool-invoker: normalize response → { success, data, error }
tool-invoker: write tool_invocations audit row (fire-and-forget)
tool-invoker: publish tool-invocation event to Pub/Sub (for billing/metering)
        ↓
return normalized envelope to agent
```

---

## Build Order (Phase Dependencies)

The milestone has four major feature areas. Their dependencies create a natural build order:

### Phase 1: Design System Foundation (no dependencies)

Build first — all subsequent UI work depends on it. Replace `app.css` with the two-world token system. Migrate existing routes to new tokens. Typography (fonts + scale) established here. The Evolution Dashboard and Command Channel both need this before they can be styled correctly.

### Phase 2: Paperclip API Client (blocks agent dispatch)

`paperclip-client.ts` is the integration seam. Build and test in isolation (unit test against a mock Paperclip instance) before wiring into bot-orchestrator. The existing OpenClaw/GCE path can remain as a fallback during development. Migration: once paperclip-client is proven, swap bot-orchestrator to call paperclip-client instead of gce-bot-launcher.

Dependency: Paperclip service must be reachable. Confirm `PAPERCLIP_API_URL` and `PAPERCLIP_API_KEY` are provisioned before this phase.

### Phase 3: Tool Nexus Generalization (blocks Tool UI and agent-authored tools)

Generalize tool-gateway before building the Tool Nexus UI, since the UI depends on the API contracts. Order within this phase:
1. `tool_definitions` + `tool_connections` schema migration
2. `tool-invoker.ts` core logic
3. `tool-nexus.ts` CRUD routes in execution-service
4. Built-in tool contract definitions (HubSpot, Slack, etc.)
5. `openapi-importer.ts` (can be deferred if needed)
6. Webhook receiver (can be deferred if needed)
7. Tool Nexus UI

### Phase 4: Evolution Dashboard (depends on Phase 1 design system)

The dashboard is primarily a new UI layer over existing data. It needs Phase 1 (design tokens) but is independent of Paperclip integration. Order within this phase:
1. `evolution.ts` API routes (fleet overview, agent timeline, lineage, experiment ledger)
2. CSS component library for the Director's Cut world (card, badge, timeline, tree primitives)
3. Dashboard routes in SvelteKit
4. Command Channel UI (depends on Paperclip client from Phase 2 for WebSocket streaming)

---

## Component Boundaries

| Boundary | Communication Pattern | Notes |
|----------|-----------------------|-------|
| UI ↔ execution-service | HTTP via `/api/[...path]` SvelteKit reverse proxy | Browser never calls execution-service directly |
| execution-service ↔ Paperclip | HTTPS REST + WebSocket events | Server-to-server only, PAPERCLIP_API_KEY in env |
| execution-service ↔ tool-gateway | Internal HTTP (Railway private networking or VPC) | tool-gateway validates BOT_JWT_SECRET, not session tokens |
| Bot VMs ↔ tool-gateway | HTTP CONNECT tunnel via HTTP_PROXY env var | All bot egress routes through tool-gateway, no direct internet |
| execution-service ↔ Redis | BullMQ queues + Redis locks + rate limits | 3 named queues + evolution-queue in v6.0 |
| execution-service ↔ Pub/Sub | GCP Pub/Sub publish → SSE fan-out | Per-connection subscription, 4 topics + RING_LEADER_EVENTS |
| telegram-bot ↔ Paperclip | Paperclip issue comments API | Telegram messages → issue comments; responses polled back |
| tool-gateway ↔ external APIs | Direct HTTPS per tool definition | Credentials injected at invocation, never stored in memory |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Exposing Paperclip Credentials to the Browser

**What happens:** Frontend SvelteKit code calls Paperclip's WebSocket directly with a stored API key.
**Why wrong:** API key visible in browser network tab; any user can exfiltrate it.
**Do this instead:** All Paperclip calls go through execution-service server-side. The UI subscribes to SSE from execution-service, which proxies Paperclip streaming events. WebSocket connection for Command Channel is execution-service ↔ Paperclip (server-side), not browser ↔ Paperclip.

### Anti-Pattern 2: Letting Agents Call Tool-Gateway Directly by IP

**What happens:** Agent session config contains the internal tool-gateway IP and port, bypassing the HTTP_PROXY tunnel.
**Why wrong:** Removes the CONNECT tunnel inspection layer; agents can attempt direct TCP connections to internal services.
**Do this instead:** Always set `HTTP_PROXY` to tool-gateway in agent session config. Tool-gateway is the only egress path — non-negotiable per CLAUDE.md.

### Anti-Pattern 3: Storing Raw Credentials in `tool_connections`

**What happens:** OAuth access tokens or API keys stored as plaintext in the `encryptedCredentials` column.
**Why wrong:** Database dump exposes all user credentials to all connected tools.
**Do this instead:** AES-256-GCM encryption with a per-row IV and a server-side KMS-managed key. Decrypt only at invocation time in memory; never log decrypted values.

### Anti-Pattern 4: Building Two Separate CSS Systems

**What happens:** Evolution Dashboard gets its own token file; Screenplay UI keeps the old one; new components hardcode hex values.
**Why wrong:** Token drift between pages, impossible to maintain, breaks the "two modes one product" principle from the design guide.
**Do this instead:** Single `app.css` with one `:root` block for Screenplay tokens and one `body.system {}` block for Director's Cut overrides. All components reference tokens exclusively — zero hardcoded hex outside SVG fills and brand-locked colors (Google blue, etc.).

### Anti-Pattern 5: Running Paperclip Migration as a Big Bang Swap

**What happens:** Remove all GCE/OpenClaw code on day 1, switch to Paperclip, discover integration issues with no fallback.
**Why wrong:** High risk — the existing GCE path is proven in production.
**Do this instead:** Build `paperclip-client.ts` alongside existing infrastructure. Add a feature flag (`AGENT_RUNTIME=paperclip|openclaw`). Test Paperclip path in staging, validate, then flip the flag. Remove the GCE path in a subsequent cleanup phase.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (small fleet, <20 bots) | Monolith is fine. BullMQ concurrency=20 is appropriate. Per-connection Pub/Sub subscriptions are acceptable. |
| 100+ concurrent users | Move tool-gateway to dedicated Railway service with autoscale. Add Redis connection pooling. Switch SSE from per-connection Pub/Sub subscription to EventEmitter fan-out backed by a single Pub/Sub subscription per topic. |
| 1000+ users | Paperclip becomes the scaling bottleneck — confirm Paperclip's rate limits and adapter quotas. Shard council-queue by user to prevent single-user evaluation from blocking the queue. Add read replica for evolution dashboard queries (heavy aggregations). |

### First bottleneck

Council evaluation is the most LLM-intensive workload — 3 LLM calls per agent per execution. At high concurrency, this will hit provider rate limits before any infrastructure limit. Rate-limit the council-queue at 5 jobs/min (already present) and add provider-level retry with exponential backoff.

### Second bottleneck

Tool-gateway is stateless and easily horizontally scaled, but the `tool_connections` decryption is CPU-bound per request. At high tool invocation frequency, move credential decryption to a dedicated cache (decrypt once, store decrypted token in Redis with short TTL, re-decrypt on 401).

---

## Sources

- `tasks/prd-akasa-mvp.md` — Technical Considerations, Repository Structure, FR-1 through FR-52
- `tasks/akasa-design-guide.md` — Two-world CSS token system, typography rules, world switching pattern
- `.planning/PROJECT.md` — v6.0 milestone definition, tech stack, key architecture decisions
- `CLAUDE.md` — Coding conventions, service responsibilities, monorepo structure
- Direct codebase analysis: `services/execution-service/src/`, `services/tool-gateway/src/`, `packages/db/src/schema/`, `services/ui/src/`

---
*Architecture research for: Akasa v6.0 Paperclip Foundation*
*Researched: 2026-03-23*
