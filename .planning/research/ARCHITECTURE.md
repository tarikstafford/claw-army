# Architecture Research

**Domain:** AI Bot Orchestration Platform (Claw Bot Army)
**Researched:** 2026-02-18
**Confidence:** HIGH (control plane patterns, GCP services, container isolation) / MEDIUM (tool gateway auth, telemetry from isolated containers)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PLANE                                │
│  ┌─────────────┐  ┌─────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │  Execution  │  │ Planner │  │     Bot      │  │   Guardrail   │   │
│  │   Service   │─▶│        │─▶│ Orchestrator │  │   Watchdog    │   │
│  │  (REST API) │  │        │  │              │  │               │   │
│  └─────────────┘  └────────┘  └──────┬───────┘  └───────────────┘   │
│          │                           │                    ▲           │
│          ▼                           ▼                    │           │
│  ┌─────────────┐  ┌────────────────────────────┐         │           │
│  │  Task Queue │  │     Event Bus (Pub/Sub)     │─────────┘           │
│  │ (Cloud Tasks│  │   (Guardrail / Billing /    │                     │
│  │  or PG row) │  │    Telemetry events)        │                     │
│  └──────┬──────┘  └────────────────────────────┘                     │
│         │                 ▲                                           │
│  ┌──────▼──────┐  ┌───────┴────────┐  ┌─────────────┐               │
│  │  Performance│  │ Billing Engine │  │ DNA Capture │               │
│  │   Engine    │  │                │  │   Engine    │               │
│  └─────────────┘  └────────────────┘  └─────────────┘               │
└────────────────────────────────────────────────────────────────────────┘
                              │ spawn / monitor / terminate
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NETWORK BOUNDARY                                │
│                    (VPC firewall: bots → gateway only)                 │
└────────────────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────────────────┐
│                            DATA PLANE                                  │
│                                                                        │
│  ┌───────────────────────────────────────────────────┐                │
│  │               Bot Worker Pool                      │                │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │                │
│  │  │  Bot #1  │  │  Bot #2  │  │  Bot #N  │  ...   │                │
│  │  │(Cloud Run│  │(Cloud Run│  │(Cloud Run│        │                │
│  │  │ Worker)  │  │ Worker)  │  │ Worker)  │        │                │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘        │                │
│  └───────┼─────────────┼─────────────┼───────────────┘                │
│          │             │             │                                 │
│          └─────────────▼─────────────┘                                │
│                   POST /tool.invoke                                    │
│                        │                                               │
│  ┌─────────────────────▼───────────────────────────────────────────┐  │
│  │                    Tool Gateway                                  │  │
│  │  (allowlist enforcement, schema validation, rate limits,         │  │
│  │   budget checks, audit log, telemetry forwarding)                │  │
│  └──────────┬───────────────────────────────────────────────────────┘  │
│             │                                                           │
│   ┌─────────▼──────┐  ┌───────────────┐  ┌───────────────────────┐    │
│   │ External APIs   │  │ Artifact Store│  │   Telemetry Store     │    │
│   │ (LLM, Web, etc) │  │ (Cloud Storage│  │ (Firestore / TSDB)    │    │
│   └─────────────────┘  │  + Postgres)  │  │                       │    │
│                         └───────────────┘  └───────────────────────┘    │
│                                                           │             │
│                                            ┌──────────────┘             │
│                                            ▼                            │
│                                    ┌───────────────┐                    │
│                                    │   DNA Store   │                    │
│                                    │  (Postgres)   │                    │
│                                    └───────────────┘                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| **Execution Service** | Accept POST /executions, validate input, persist execution record, trigger planning | Planner, Task Queue, Event Bus, DB |
| **Planner** | Decompose objective into N parallelizable tasks, write tasks to queue | Task Queue |
| **Task Queue** | Durable ordered task store; bots pull (lease) tasks; handles reassignment on timeout | Bot Orchestrator (reads), Bots (claim) |
| **Bot Orchestrator** | Spawn/terminate Cloud Run worker containers; maintain bot registry; enforce max_bots cap | Cloud Run API, Task Queue, Event Bus |
| **Guardrail Watchdog** | Monitor per-bot tool call rates, token burn, idle time, loop detection; issue revoke signals | Event Bus (subscribes to telemetry events), Bot Orchestrator |
| **Performance Engine** | Compute post-run metrics (tasks/min, success rate, cost/task); generate composite bot scores | Telemetry Store, DB |
| **Billing Engine** | Consume bot_started/bot_stopped/tool_invoked events; accumulate cost; enforce budget cap | Event Bus, DB |
| **DNA Capture Engine** | Identify elite bots post-execution; extract structural patterns; write versioned DNA records | Telemetry Store, DNA Store |
| **Tool Gateway** | Single egress point for all bot external calls; enforces allowlist, schema, rate limits, budget | External APIs, Artifact Store, Telemetry Store, Event Bus |
| **Bot Workers** | Execute LLM reasoning loop; claim tasks via lease; emit telemetry to gateway; produce artifacts | Tool Gateway ONLY |
| **Event Bus** | Internal pub/sub backbone; decouples control plane components | All control plane services |
| **Artifact Store** | Immutable file outputs from bot write_file calls (Cloud Storage + metadata in Postgres) | Tool Gateway writes, UI reads |
| **Telemetry Store** | Structured per-step trace data; append-only | Tool Gateway writes, Performance Engine reads |
| **DNA Store** | Versioned execution templates from elite bots; tagged by objective category | DNA Capture Engine writes, Replay Engine reads |

---

## Recommended Project Structure

```
claw-army/
├── apps/
│   ├── api/                      # Control plane Node.js/TypeScript service
│   │   ├── src/
│   │   │   ├── executions/       # POST /executions, lifecycle state machine
│   │   │   ├── planner/          # Objective → task decomposition
│   │   │   ├── orchestrator/     # Container spawn/monitor/terminate
│   │   │   ├── watchdog/         # Guardrail enforcement
│   │   │   ├── billing/          # Metering, cost accumulation
│   │   │   ├── performance/      # Post-run scoring
│   │   │   ├── dna/              # Elite bot capture engine
│   │   │   ├── gateway/          # Tool Gateway HTTP handler
│   │   │   ├── events/           # Internal event bus (Pub/Sub adapter)
│   │   │   ├── queue/            # Task queue read/write/lease operations
│   │   │   └── ws/               # WebSocket server for UI real-time feed
│   │   └── Dockerfile
│   │
│   ├── bot-runtime/              # Bot Worker Docker image
│   │   ├── src/
│   │   │   ├── agent/            # LLM reasoning loop
│   │   │   ├── tools/            # Tool invocation client (only calls gateway)
│   │   │   └── telemetry/        # Structured trace emission to gateway
│   │   └── Dockerfile
│   │
│   └── web/                      # Svelte frontend
│       ├── src/
│       │   ├── routes/           # New Execution, Live View, Post-Run, Bot Detail
│       │   ├── stores/           # Execution state, real-time event stream
│       │   └── lib/              # UI components
│       └── Dockerfile
│
├── packages/
│   ├── shared-types/             # Execution, Task, Bot, Event TypeScript interfaces
│   ├── event-schemas/            # Canonical event payloads (bot_started, tool_invoked, etc.)
│   └── tool-contracts/           # Tool allowlist schema definitions (JSON Schema)
│
├── infra/
│   ├── terraform/                # GCP resource provisioning
│   │   ├── vpc.tf                # VPC + firewall rules (bot egress restriction)
│   │   ├── cloud-run.tf          # API service + bot worker pool
│   │   ├── pubsub.tf             # Pub/Sub topics and subscriptions
│   │   ├── cloudtasks.tf         # Cloud Tasks queues
│   │   └── cloudsql.tf           # Postgres (or Firestore config)
│   └── docker/
│       └── bot-network.json      # Docker network config for local dev isolation
│
└── .planning/
    └── research/
```

### Structure Rationale

- **apps/api/**: Single deployable Node.js service for the entire control plane in MVP. Modules are separated by domain so they can be extracted later without rewrites.
- **apps/bot-runtime/**: Completely separate Docker image. Bots know nothing about control plane internals. Their only interface is the Tool Gateway HTTP endpoint injected as an environment variable at spawn time.
- **apps/web/**: Svelte SPA served from Cloud Run or Cloud Storage + CDN. Connects to API via REST + WebSocket.
- **packages/shared-types/**: Prevents drift between services on canonical data shapes. Critical for event schemas because Billing, Watchdog, and Performance Engine all consume the same events.
- **packages/tool-contracts/**: Centralizes tool allowlist schemas. Both the gateway (enforcer) and bot runtime (client) reference the same contract, preventing mismatches.
- **infra/**: Infrastructure as code from day one. VPC firewall rules that restrict bot egress are non-negotiable security requirements, not afterthoughts.

---

## Architectural Patterns

### Pattern 1: Pull-Based Task Leasing

**What:** Workers pull tasks from a queue and acquire an exclusive lease for a fixed duration. If the lease expires without a completion acknowledgment, the task becomes available again for reassignment. Workers send periodic heartbeats to extend leases on long-running tasks.

**When to use:** Any system where tasks must be processed exactly once under unreliable workers. Required for bot task assignment in Claw Bot Army because bots are ephemeral and can be killed mid-task by guardrails or budget limits.

**Trade-offs:** Simpler than push (no fan-out logic in orchestrator); requires bots to poll; lease duration requires tuning (too short = unnecessary reassignment, too long = slow recovery after failure).

**Example:**
```typescript
// Task Queue service — lease acquisition
async function claimTask(executionId: string, botId: string): Promise<Task | null> {
  const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  // Atomic update: find unclaimed task, set lease atomically
  const task = await db.transaction(async (tx) => {
    const t = await tx.query(`
      SELECT id, payload FROM tasks
      WHERE execution_id = $1
        AND status = 'pending'
        AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [executionId]);

    if (!t.rows[0]) return null;

    await tx.query(`
      UPDATE tasks SET
        status = 'claimed',
        bot_id = $1,
        lease_expires_at = NOW() + INTERVAL '5 minutes',
        claimed_at = NOW()
      WHERE id = $2
    `, [botId, t.rows[0].id]);

    return t.rows[0];
  });

  return task;
}

// Bot runtime — heartbeat extension
async function heartbeat(taskId: string, botId: string): Promise<void> {
  await fetch(`${GATEWAY_URL}/task.heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${BOT_TOKEN}` },
    body: JSON.stringify({ task_id: taskId, bot_id: botId })
  });
}
```

---

### Pattern 2: Tool Gateway as Security Membrane

**What:** The Tool Gateway is the ONLY egress point from the data plane. Bots call `POST /tool.invoke` with a tool name, arguments, and their short-lived bot token. The gateway validates the token, checks the tool against the execution's allowlist, validates argument schema, enforces per-bot rate limits and budget, logs the call, and then executes the external call on behalf of the bot. The bot never holds any external credentials.

**When to use:** Required whenever untrusted or sandboxed compute (bots) needs controlled access to external resources. Prevents credential leakage, enables centralized rate limiting and audit trails.

**Trade-offs:** Single point of failure (mitigate with redundant deployment); all external latency passes through gateway; gateway becomes a natural telemetry collection point (advantage).

**Example:**
```typescript
// Tool Gateway handler
app.post('/tool.invoke', async (req, res) => {
  const { tool_name, arguments: args } = req.body;
  const botToken = req.headers.authorization?.replace('Bearer ', '');

  // 1. Validate short-lived bot JWT
  const botContext = await validateBotToken(botToken);
  if (!botContext) return res.status(401).json({ error: 'invalid_token' });

  // 2. Check tool against execution allowlist
  const allowed = await getAllowedTools(botContext.execution_id);
  if (!allowed.includes(tool_name)) {
    return res.status(403).json({ error: 'tool_not_allowed' });
  }

  // 3. Validate argument schema
  const schema = TOOL_SCHEMAS[tool_name];
  const valid = ajv.validate(schema, args);
  if (!valid) return res.status(400).json({ error: 'invalid_arguments', details: ajv.errors });

  // 4. Rate limit check (per bot, per execution)
  const allowed_rate = await checkRateLimit(botContext.bot_id, tool_name);
  if (!allowed_rate) return res.status(429).json({ error: 'rate_limit_exceeded' });

  // 5. Budget check
  const withinBudget = await checkBudget(botContext.execution_id);
  if (!withinBudget) return res.status(402).json({ error: 'budget_exceeded' });

  // 6. Execute tool (gateway holds credentials, bot never sees them)
  const result = await executeTool(tool_name, args, botContext);

  // 7. Emit telemetry event (async, non-blocking)
  emitTelemetryEvent({
    type: 'tool_invoked',
    bot_id: botContext.bot_id,
    execution_id: botContext.execution_id,
    tool_name,
    duration_ms: result.duration_ms,
    tokens_used: result.tokens_used,
    success: result.success,
    timestamp: new Date().toISOString()
  });

  return res.json({ result: result.output });
});
```

---

### Pattern 3: Event-Driven Internal Coordination

**What:** Control plane components (Billing Engine, Guardrail Watchdog, Performance Engine) do not call each other directly. Instead, the Tool Gateway and Bot Orchestrator emit canonical events to an internal event bus (Google Cloud Pub/Sub topics). Consumers subscribe independently. This decouples guardrail enforcement from billing from telemetry collection.

**When to use:** When multiple consumers need the same events and direct coupling would create brittle dependencies or ordering issues. Especially important for guardrails, which must react to tool_invoked events without blocking the gateway.

**Trade-offs:** Eventual consistency (guardrail may react 50-200ms after an event); requires event schema discipline; harder to trace causality in debugging.

**Example:**
```typescript
// Canonical event types (packages/event-schemas)
interface BotEvent {
  event_type: 'bot_started' | 'bot_stopped' | 'tool_invoked' |
              'task_claimed' | 'task_completed' | 'guardrail_triggered' |
              'budget_exceeded';
  execution_id: string;
  bot_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// Guardrail Watchdog subscriber
pubSubClient.subscription('guardrail-watchdog-sub').on('message', async (msg) => {
  const event: BotEvent = JSON.parse(msg.data.toString());

  if (event.event_type === 'tool_invoked') {
    const violation = await checkGuardrails(event);
    if (violation) {
      await revokeBot(event.bot_id);
      await emitEvent({ event_type: 'guardrail_triggered', ...violation });
    }
  }

  msg.ack();
});
```

---

### Pattern 4: Short-Lived Bot Identity Tokens

**What:** When the Bot Orchestrator spawns a container, it generates a short-lived JWT signed with a platform secret. The JWT embeds: `bot_id`, `execution_id`, `allowed_tools[]`, `expires_at` (TTL: bot's max runtime + buffer). The token is injected as `BOT_TOKEN` environment variable at container start. The Tool Gateway validates this token on every request. No bot ever holds an API key or long-lived credential.

**When to use:** Ephemeral worker systems where credentials must not persist beyond the worker's lifetime. Prevents credential reuse if a container is compromised or if bot logs are leaked.

**Trade-offs:** Token rotation requires container restart; JWT must be short enough to expire promptly after container termination; platform secret must be kept in Secret Manager.

**Example:**
```typescript
// Bot Orchestrator — token generation at spawn time
async function generateBotToken(botId: string, executionId: string,
                                 allowedTools: string[], maxRuntimeMinutes: number): Promise<string> {
  const secret = await getSecret('BOT_JWT_SECRET'); // Cloud Secret Manager

  return jwt.sign({
    sub: botId,
    execution_id: executionId,
    allowed_tools: allowedTools,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (maxRuntimeMinutes + 10) * 60
  }, secret, { algorithm: 'HS256' });
}

// Injected into Cloud Run container as env var at spawn
const envVars = {
  BOT_TOKEN: await generateBotToken(botId, executionId, allowedTools, maxRuntime),
  TOOL_GATEWAY_URL: 'https://tool-gateway.internal.claw-army.com',
  TASK_QUEUE_URL: 'https://api.internal.claw-army.com/tasks',
  BOT_ID: botId,
  EXECUTION_ID: executionId,
};
```

---

### Pattern 5: Telemetry via Gateway (No Direct Export)

**What:** Bots cannot reach external telemetry backends (no internet access). Instead, bots emit structured trace events as part of every tool call response OR via a dedicated `POST /telemetry.emit` endpoint on the Tool Gateway. The gateway writes these to the Telemetry Store (Firestore or Postgres). Alternatively, the Tool Gateway itself generates the telemetry record from every tool invocation, so bots don't need to emit separately.

**When to use:** Required when workers are network-isolated. The gateway-generated approach is simpler (bot runtime is dumber) but misses bot-internal reasoning steps. A hybrid approach (gateway records tool calls, bot emits reasoning steps via dedicated endpoint) captures full traces.

**Trade-offs:** All telemetry passes through gateway (adds latency on telemetry.emit calls); gateway becomes source of truth for structured traces; simpler bot runtime code.

**Example:**
```typescript
// Dedicated telemetry endpoint on Tool Gateway
app.post('/telemetry.emit', async (req, res) => {
  const botContext = await validateBotToken(req.headers.authorization);
  if (!botContext) return res.status(401).end();

  const event = {
    bot_id: botContext.bot_id,
    execution_id: botContext.execution_id,
    step_type: req.body.step_type, // 'reasoning' | 'tool_call' | 'task_complete'
    prompt_tokens: req.body.prompt_tokens,
    completion_tokens: req.body.completion_tokens,
    content_summary: req.body.content_summary, // truncated, no raw PII
    timestamp: new Date().toISOString(),
  };

  await telemetryStore.append(event); // append-only Firestore document

  res.status(204).end(); // fire and forget from bot's perspective
});
```

---

### Pattern 6: Real-Time UI via WebSocket + Event Bus Bridge

**What:** The API service maintains a WebSocket server. When a browser connects (authenticated user, specific execution_id), the server subscribes to the internal event bus filtered by that execution_id. Incoming events (bot_started, tool_invoked, guardrail_triggered, etc.) are forwarded over the WebSocket connection as JSON messages. For horizontal scaling, use Redis Pub/Sub as the WebSocket fan-out layer between API instances.

**When to use:** Live execution dashboards where server-to-client push is required. Server-Sent Events (SSE) are simpler for unidirectional use and are equally valid for this pattern — prefer SSE over WebSocket if bidirectional communication is not needed.

**Trade-offs:** WebSocket connections are stateful (complicates horizontal scaling without Redis layer); SSE is simpler but less flexible; both require sticky sessions or a shared pub/sub layer for multi-instance deployments.

**Example:**
```typescript
// WebSocket bridge — subscribes to Pub/Sub and forwards to browser
wss.on('connection', async (ws, req) => {
  const executionId = extractExecutionId(req); // from query param or auth token

  // Subscribe to execution-specific Pub/Sub subscription
  const subscription = pubSubClient.subscription(`execution-${executionId}-live`);

  const messageHandler = (msg: Message) => {
    const event = JSON.parse(msg.data.toString());
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
    msg.ack();
  };

  subscription.on('message', messageHandler);

  ws.on('close', () => {
    subscription.removeListener('message', messageHandler);
  });
});
```

---

### Pattern 7: Versioned DNA Records

**What:** After execution, the DNA Capture Engine identifies elite bots (score above threshold, low error rate). It assembles a DNA document from the bot's full telemetry trace: system prompt pattern, tool call sequence, argument distributions, retry strategies, timing distributions. The DNA is stored as a versioned Postgres JSONB record tagged by `objective_category` and `execution_id`. PII is stripped during capture; only structural patterns are retained.

**When to use:** Continuous improvement moat — each elite run produces a replayable template for future runs on similar objectives. Version field enables tracking improvement over time.

**Trade-offs:** DNA capture is async/post-hoc (does not affect live execution latency); JSONB is flexible but requires careful schema governance; objective_category tagging requires a controlled vocabulary.

**Example:**
```typescript
interface BotDNA {
  id: string;
  version: number;                    // auto-incremented per objective_category
  objective_category: string;         // e.g. 'email_processing', 'data_extraction'
  source_execution_id: string;
  source_bot_id: string;
  score: number;
  captured_at: string;

  // Structural patterns — no raw customer data
  system_prompt_template: string;     // PII-scrubbed version
  tool_sequence_pattern: string[];    // ['llm_call', 'fetch_url', 'llm_call', 'write_file']
  avg_tool_args_schema: Record<string, unknown>; // argument shape patterns
  retry_strategy: {
    max_retries: number;
    backoff_ms: number;
    retry_on: string[];               // error types that triggered retries
  };
  timing_profile: {
    avg_step_ms: number;
    p95_step_ms: number;
    token_distribution: { p50: number; p95: number };
  };
}
```

---

## Data Flow

### Execution Creation Flow

```
User (browser)
  │
  ▼ POST /executions { objective, max_bots, allowed_tools, max_budget }
API (Execution Service)
  │── validate input
  │── persist execution record (status: queued)
  │── call Planner
  ▼
Planner
  │── decompose objective → N tasks
  │── write N task rows to Task Queue (status: pending)
  ▼
Bot Orchestrator
  │── spawn up to min(max_bots, N) Cloud Run worker containers
  │── generate short-lived JWT per bot
  │── inject TOOL_GATEWAY_URL + BOT_TOKEN + EXECUTION_ID as env vars
  │── update execution status: running
  │── emit bot_started events to Event Bus
  ▼
Event Bus (Pub/Sub)
  │── Billing Engine: start bot billing meter
  │── UI WebSocket bridge: push bot_started to browser
```

### Bot Task Execution Flow

```
Bot Worker
  │── poll Task Queue: POST /tasks/claim { execution_id, bot_id }
  │── receive task payload (or null if no tasks left)
  │── execute LLM reasoning loop:
  │     - call POST /tool.invoke { tool: 'llm_call', arguments: { prompt } }
  │     - call POST /tool.invoke { tool: 'fetch_url', arguments: { url } }
  │     - call POST /tool.invoke { tool: 'write_file', arguments: { content } }
  │     - call POST /telemetry.emit { step data } (non-blocking)
  │── POST /tasks/complete { task_id, result_summary }
  │── poll next task
  ▼
Tool Gateway (on each /tool.invoke)
  │── validate bot JWT
  │── check allowlist, schema, rate limit, budget
  │── execute external call (holds credentials)
  │── write telemetry record to Telemetry Store
  │── emit tool_invoked event to Event Bus
  ▼
Event Bus
  │── Guardrail Watchdog: check rate limits, detect loops
  │── Billing Engine: accumulate tool cost
  │── UI WebSocket bridge: push tool_invoked to browser live feed
```

### Guardrail Enforcement Flow

```
Guardrail Watchdog (subscribes to Event Bus)
  │── receives tool_invoked event
  │── check: tokens/min this bot, tool calls/min this bot, loop pattern
  │── if violation detected:
  │     - call Bot Orchestrator: terminate container (Cloud Run delete instance)
  │     - revoke bot JWT (add to short-lived deny list in Redis/Firestore)
  │     - emit guardrail_triggered event
  │     - update task status: pending (reassign to next bot)
```

### Post-Execution Flow

```
All tasks complete OR budget exceeded OR max_runtime reached
  │
Bot Orchestrator
  │── terminate all remaining bot containers
  │── emit bot_stopped events
  │── update execution status: completed
  ▼
Performance Engine (triggered by execution_completed event)
  │── read all telemetry from Telemetry Store
  │── compute per-bot scores (success rate, efficiency, cost efficiency, stability)
  │── write bot_scores to DB
  ▼
DNA Capture Engine (triggered by performance scores)
  │── identify bots scoring above threshold + elite criteria
  │── extract structural patterns from telemetry
  │── strip PII
  │── write versioned DNA record to DNA Store
```

---

## GCP-Specific Architecture

### Service Mapping

| Component | GCP Service | Notes |
|-----------|-------------|-------|
| Execution Service API | Cloud Run (service) | HTTP, autoscales to 0 |
| Tool Gateway | Cloud Run (service, internal-only ingress) | Internal VPC endpoint; bots reach via VPC |
| Bot Workers | Cloud Run Worker Pool | Pull-based, no HTTP endpoint, autoscale manually or via custom scaler |
| Task Queue | Cloud Tasks OR Postgres row-level locking | Postgres lease pattern is simpler for MVP; Cloud Tasks adds durability for production |
| Internal Event Bus | Cloud Pub/Sub | Fan-out to Billing, Watchdog, Performance, WebSocket bridge |
| Telemetry Store | Firestore (append-only collection per execution) | Time-ordered step traces; cheap reads for post-run analysis |
| Artifact Store | Cloud Storage (objects) + Postgres (metadata) | bot write_file → object in GCS, metadata row in Postgres |
| DNA Store | Cloud SQL (Postgres) — JSONB | Structured versioned records; queryable by objective_category |
| Bot JWT Secret | Secret Manager | Accessed by Orchestrator at spawn time |
| Container Registry | Artifact Registry | Bot Worker image stored, versioned here |
| WebSocket Server | Cloud Run (service) | ws:// or wss:// endpoint; Redis Pub/Sub for multi-instance fan-out |
| Redis (fan-out layer) | Memorystore for Redis | WebSocket multi-instance coordination; guardrail deny list |

### Network Isolation for Bots

```
VPC: claw-army-vpc
  │
  ├── Subnet: control-plane (10.0.0.0/24)
  │   Cloud Run: API service, Tool Gateway
  │   Firewall: allow ingress from internet (API), allow internal
  │
  └── Subnet: bot-worker (10.0.1.0/24)
      Cloud Run Worker Pool: Bot Workers
      Firewall rules:
        - ALLOW egress to Tool Gateway (10.0.0.X:443) ONLY
        - DENY all other egress (blocks direct internet, LLM APIs, etc.)
        - ALLOW ingress from Orchestrator (spawn/terminate control signals)
```

Bot workers use Cloud Run's Direct VPC Egress. Firewall rules enforce that bots can only reach the Tool Gateway IP range. No egress to `0.0.0.0/0`. This is implemented as a GCP VPC firewall rule with priority 500 (below default allow rules), explicitly denying all other egress.

### Bot Spawning via Cloud Run Admin API

```typescript
// Bot Orchestrator — spawn bot worker
import { run_v2 } from 'googleapis';

async function spawnBot(executionId: string, botId: string): Promise<string> {
  const runClient = new run_v2.CloudRun({ auth: googleAuth });

  const botToken = await generateBotToken(botId, executionId, allowedTools, maxRuntime);

  // Create a Cloud Run Job execution for each bot
  const operation = await runClient.projects.locations.jobs.run({
    name: `projects/${PROJECT}/locations/${REGION}/jobs/bot-worker`,
    requestBody: {
      overrides: {
        containerOverrides: [{
          env: [
            { name: 'BOT_ID', value: botId },
            { name: 'EXECUTION_ID', value: executionId },
            { name: 'BOT_TOKEN', value: botToken },
            { name: 'TOOL_GATEWAY_URL', value: GATEWAY_INTERNAL_URL },
          ]
        }]
      }
    }
  });

  return operation.data.name; // operation name for monitoring
}
```

Note: Cloud Run Jobs (not Worker Pools) are better suited for ephemeral per-task bots in MVP because each job execution is a discrete, trackable unit with a clear start/end lifecycle. Worker Pools are better for long-running continuous processors. Evaluate at Phase 2.

---

## Scaling Considerations

| Scale | Architecture Notes |
|-------|-------------------|
| 0-50 concurrent bots | Single Cloud Run API instance; Postgres task queue with row-level locks; no Redis needed; Pub/Sub handles event fan-out |
| 50-500 concurrent bots | Add Redis for WebSocket fan-out and guardrail deny list; Cloud Run API autoscales; consider Cloud Tasks instead of Postgres for task queue durability |
| 500+ concurrent bots | Separate Tool Gateway into its own independently-scalable service; add Cloud Armor for DDoS protection on gateway; partition Firestore telemetry by execution; consider Bigtable for high-volume telemetry |

### Scaling Priorities

1. **First bottleneck: Task Queue contention.** Postgres row-level locking works well to ~200 concurrent workers but degrades with more. Migrate to Cloud Tasks at this threshold. Detect via P95 claim latency rising above 500ms.
2. **Second bottleneck: Tool Gateway.** At high bot counts, the gateway becomes a latency bottleneck. Horizontal scaling via Cloud Run's concurrency settings (`--concurrency=100`) handles most cases. If needed, deploy Tool Gateway as a separate Cloud Run service with its own scaling policy.
3. **Third bottleneck: WebSocket fan-out.** Single-instance WebSocket server breaks under multiple API instances. Redis Pub/Sub fan-out (Memorystore) solves this. Add from the start if deploying more than one API instance.

---

## Anti-Patterns

### Anti-Pattern 1: Bots Calling External APIs Directly

**What people do:** Give bots LLM API keys and let them call OpenAI/Anthropic directly from inside the container to "simplify" the architecture.
**Why it's wrong:** Credentials leak via container inspection, logs, or environment variable exposure. No centralized rate limiting, budget enforcement, or audit trail. A rogue bot can exhaust the entire API budget in seconds with no guardrails.
**Do this instead:** All external calls go through Tool Gateway. The gateway holds all credentials in Secret Manager. Bots hold only a short-lived, scoped JWT that expires with the container.

### Anti-Pattern 2: Push-Based Task Assignment

**What people do:** Have the Bot Orchestrator push tasks to bots via HTTP when bots start up, rather than having bots pull from a queue.
**Why it's wrong:** If a bot dies mid-task, the orchestrator must detect the failure and re-push the task. This creates complex orchestrator-side state management. Tasks are lost if the orchestrator crashes between push and acknowledgment.
**Do this instead:** Pull-based leasing. Bots pull tasks; lease expiry handles failure recovery automatically. The orchestrator only manages container lifecycle, not task assignment.

### Anti-Pattern 3: Synchronous Guardrail Enforcement

**What people do:** Have the Tool Gateway synchronously check guardrails (call Watchdog service) on every tool invocation before responding.
**Why it's wrong:** Adds latency to every tool call (bots wait for guardrail check). If the Watchdog is slow or down, the gateway is blocked.
**Do this instead:** Gateway enforces only stateless, local guardrails synchronously (schema validation, cached rate limit counters in Redis). The Watchdog subscribes to events asynchronously and issues termination signals. Acceptable eventual consistency because guardrails catch violations within 1-2 tool calls.

### Anti-Pattern 4: Storing Raw Prompt/Response Text in DNA

**What people do:** Save the full prompt and response text of elite bots as DNA for future use.
**Why it's wrong:** Raw text contains customer data, PII, task-specific content that cannot safely be reused across tenants. Creates GDPR/compliance exposure. Overfits DNA to specific inputs instead of capturing structural patterns.
**Do this instead:** Extract structural patterns only — tool call sequences, argument schemas, timing profiles, system prompt templates (with variable placeholders). DNA should describe HOW a bot approaches a problem, not WHAT data it processed.

### Anti-Pattern 5: Treating the Planner as an Autonomous Agent in MVP

**What people do:** Build a complex recursive planner that dynamically re-plans based on intermediate bot results (DAG orchestration, sub-task spawning).
**Why it's wrong:** Dramatically increases system complexity before core execution reliability is proven. Inter-task dependencies require a DAG engine, cycle detection, and partial failure recovery — none of which are needed for parallel independent task execution.
**Do this instead:** MVP Planner is a simple function: objective string → N independent task strings. No re-planning. No dependencies between tasks. This covers the majority of real workloads (batch processing, parallel research) and can be replaced in a later phase.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| LLM APIs (OpenAI, Anthropic) | Tool Gateway outbound HTTP (credentials in Secret Manager) | Metered via tool_invoked events; rate limited per bot |
| Cloud Run Admin API | Bot Orchestrator → googleapis SDK | Spawn, monitor, terminate bot containers |
| Google Secret Manager | API service on startup, Orchestrator at spawn time | Bot JWT secret, LLM API keys, DB credentials |
| Cloud Pub/Sub | Event producer/consumer pattern across all control plane services | Canonical internal event bus |
| Firestore | Append-only write from Tool Gateway; batch read by Performance Engine | Telemetry storage |
| Cloud Storage | Tool Gateway writes bot artifacts; UI/API reads | write_file tool target |
| Cloud SQL (Postgres) | Core relational store: executions, tasks, bots, DNA, billing | Single DB in MVP |
| Memorystore (Redis) | WebSocket fan-out; guardrail rate limit counters; bot deny list | Add when multi-instance API needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Execution Service → Planner | Direct function call (same process in MVP) | Extract to separate service if planning becomes async |
| Planner → Task Queue | DB write (Postgres INSERT) | Task rows created synchronously |
| Bot Orchestrator → Cloud Run API | REST via googleapis SDK | Async; orchestrator tracks operation names |
| Bot Workers → Tool Gateway | HTTPS POST (VPC-internal) | Only permitted egress for bots |
| Tool Gateway → Event Bus | Pub/Sub publish (fire-and-forget) | Does not block tool response |
| Event Bus → Billing/Watchdog/Performance | Pub/Sub subscriptions | Each consumer has independent subscription |
| API WebSocket → Event Bus | Pub/Sub subscription filtered by execution_id | Bridge: Pub/Sub events → WebSocket frames |
| Control Plane → Telemetry Store | Firestore SDK writes from Tool Gateway | Single writer; multiple readers |
| DNA Capture Engine → DNA Store | Postgres JSONB INSERT with version management | Post-execution async job |

---

## Suggested Build Order

This order respects hard dependencies. Each phase produces a runnable, testable system.

```
Phase 1: Data Foundation
  ├── Postgres schema (executions, tasks, bots, billing_events)
  ├── Shared types package (TypeScript interfaces)
  ├── Event schema package (canonical event payloads)
  └── Local Docker network config (bot isolation simulation)

Phase 2: Core Execution Pipeline (no real LLMs yet)
  ├── Execution Service: POST /executions → persists execution
  ├── Planner: objective → task rows
  ├── Task Queue: claim/complete/heartbeat endpoints
  └── Bot Orchestrator: spawn/terminate Cloud Run containers

Phase 3: Bot Runtime + Tool Gateway
  ├── Tool Gateway: /tool.invoke with JWT validation, allowlist, schema
  ├── Bot Worker: reasoning loop stub (no real LLM), tool client
  ├── Network isolation: VPC firewall rules (bots → gateway only)
  └── Short-lived JWT token lifecycle

Phase 4: Control Plane Services
  ├── Guardrail Watchdog: rate limit enforcement, loop detection
  ├── Billing Engine: bot-hour metering, budget cap enforcement
  └── Event Bus: Pub/Sub topics and subscriptions wired up

Phase 5: Intelligence Layer
  ├── Performance Engine: post-run scoring
  ├── DNA Capture Engine: elite bot identification, pattern extraction
  └── DNA Store: versioned templates with objective_category tagging

Phase 6: UI Command Center
  ├── WebSocket bridge: Pub/Sub → WebSocket
  ├── Svelte: New Execution screen
  ├── Svelte: Live Execution View (real-time feed)
  ├── Svelte: Post-Execution Dashboard + Bot Leaderboard
  └── Svelte: Bot Detail + Usage/Billing screens
```

**Dependency rationale:**
- Task Queue must exist before bots can claim work
- Tool Gateway must exist before bot runtime can be tested (no other egress)
- JWT token lifecycle must be solved before gateway can validate bot identity
- Event Bus must be wired before Billing and Watchdog can function
- Performance scores must exist before DNA Capture can identify elite bots
- All backend must be stable before UI real-time feed can be built

---

## Sources

- [Control Planes in Agentic AI Environments — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-multitenant/employing-control-planes-in-agentic-environments.html) — HIGH confidence
- [Executing Asynchronous Tasks with Cloud Run and Cloud Tasks — Google Cloud](https://docs.cloud.google.com/run/docs/triggering/using-tasks) — HIGH confidence
- [Cloud Run Worker Pools — Google Cloud Pub/Sub Pull Pattern](https://github.com/GoogleCloudPlatform/cloud-run-pubsub-pull) — HIGH confidence
- [Direct VPC Egress — Cloud Run Network Isolation](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc) — HIGH confidence
- [OpenTelemetry Sidecar vs Agent for Docker](https://last9.io/blog/opentelemetry-sidecar-vs-agent/) — MEDIUM confidence
- [JWTs for AI Agents — Non-Human Identity Authentication](https://securityboulevard.com/2025/11/jwts-for-ai-agents-authenticating-non-human-identities/) — MEDIUM confidence
- [Redis Pub/Sub for Real-Time Node.js Communication](https://www.chapimaster.com/redis-pub_sub-in-node.js-real-time-messaging-made-simple) — MEDIUM confidence
- [Streaming Pub/Sub Messages over WebSockets — Google Cloud](https://cloud.google.com/pubsub/docs/streaming-cloud-pub-sub-messages-over-websockets) — HIGH confidence
- [GCP Leasing Pull Tasks Pattern — App Engine Task Queue](https://cloud.google.com/appengine/docs/legacy/standard/python/taskqueue/pull/leasing-pull-tasks) — HIGH confidence (leasing pattern is portable to Postgres/Cloud Tasks)
- [Versioning AI Agents — Decagon Agent Versioning](https://decagon.ai/resources/decagon-agent-versioning) — LOW confidence (single source)

---

*Architecture research for: AI Bot Orchestration Platform (Claw Bot Army)*
*Researched: 2026-02-18*
