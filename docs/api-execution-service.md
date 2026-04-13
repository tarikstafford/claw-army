# Execution Service API Reference

The execution service is the primary backend for Akasa. It manages bot executions, objectives, billing, metrics, souls, verdicts, and the Ring Leader orchestration layer.

**Framework:** Fastify v5 with TypeBox schema validation

**Base URL:** `http://localhost:3001` (local) or the deployed Railway URL

## Authentication

Most routes use JWT bearer token authentication via the `Authorization` header. The token is validated by `verifyAuthToken()` against the `AUTH_SECRET` environment variable.

Some routes also support an internal API key bypass via the `X-Internal-Key` header (for CLI testing without a browser session). This is only active when `INTERNAL_API_KEY` is set in the environment.

```
Authorization: Bearer <jwt-token>
X-Internal-Key: <internal-api-key>   # optional bypass
```

---

## Health Check

### `GET /health`

Basic health check endpoint.

**Response 200:**
```json
{ "status": "ok" }
```

---

## Executions

Prefix: `/executions`

### `POST /executions`

Create a new execution. Parses the objective into a task graph, validates pre-flight, and spawns a Ring Leader.

**Auth:** Required (JWT or internal API key)

**Request Body:**
```json
{
  "objective": "string (required, minLength: 1)",
  "maxBots": "integer (required, 3-20)",
  "budgetCapCents": "integer (optional, min: 0)",
  "runtimeLimitSeconds": "integer (optional, min: 60)",
  "allowedTools": ["string"] ,
  "llmProvider": "string (optional)",
  "allowedDomains": ["string"],
  "objectiveId": "uuid (optional)",
  "campaignType": "'ad_hoc' | 'campaign' (optional)",
  "projectId": "uuid (optional)",
  "enableEvolution": "boolean (optional, enables Karpathy Loop)",
  "maxIterations": "integer (optional, 1-50)",
  "campaignBudgetCapCents": "integer (optional, min: 0)"
}
```

**Response 201:**
```json
{
  "executionId": "uuid",
  "status": "pre_flight",
  "evolutionCampaignId": "uuid (only when enableEvolution=true)"
}
```

**Response 400:** Pre-flight validation failed or invalid input
**Response 401:** Unauthorized
**Response 500:** Failed to parse objective

---

### `GET /executions/:id`

Get a single execution by ID.

**Params:** `id` (uuid)

**Response 200:**
```json
{
  "id": "uuid",
  "status": "pre_flight | queued | running | paused | stopped | completed | failed",
  "objective": "string",
  "maxBots": 5,
  "budgetCapCents": 10000,
  "runtimeLimitSeconds": 3600,
  "allowedTools": ["tool-a"],
  "llmProvider": "string | null",
  "allowedDomains": ["string"] ,
  "campaignType": "string | null",
  "projectId": "uuid | null",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Response 404:** Execution not found

---

### `GET /executions/all`

List all executions. Optionally filter by project.

**Query:** `projectId` (uuid, optional)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "status": "running",
    "objective": "string",
    "maxBots": 5,
    "budgetCapCents": 10000,
    "allowedTools": [],
    "projectId": "uuid | null",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601",
    "activeBotCount": 3
  }
]
```

---

### `GET /executions/:id/tasks`

Get all tasks for an execution.

**Params:** `id` (uuid)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "executionId": "uuid",
    "status": "pending | claimed | completed | failed",
    "description": "string",
    "result": "string | null",
    "claimedByBotId": "uuid | null",
    "attemptCount": 0,
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
]
```

---

### `GET /executions/:id/bots`

Get all bots for an execution.

**Params:** `id` (uuid)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "executionId": "uuid",
    "status": "spawning | idle | working | stopping | stopped | failed",
    "containerId": "string | null",
    "imageTag": "string",
    "tasksClaimed": 0,
    "tasksCompleted": 0,
    "tasksFailed": 0,
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
]
```

---

### `GET /executions/:id/report`

Get execution summary report with cost, performance, and soul tier distribution.

**Params:** `id` (uuid)

**Response 200:**
```json
{
  "executionId": "uuid",
  "totalBots": 5,
  "totalBotHours": 2.5,
  "totalCostCents": 500,
  "averageBotScore": 0.85,
  "topPerformingBotId": "uuid | null",
  "errorDistribution": { "timeout": 2, "crash": 1 },
  "costPerTaskCents": 50,
  "totalTasks": 10,
  "completedTasks": 8,
  "failedTasks": 2,
  "soulTierDistribution": {
    "novice": 2,
    "understudy": 2,
    "artisan": 1,
    "retired": 0
  }
}
```

---

### `GET /executions/:id/leaderboard`

Bot leaderboard sorted by composite score.

**Params:** `id` (uuid)

**Response 200:**
```json
[
  {
    "botId": "uuid",
    "compositeScore": 0.92,
    "tier": "string | null",
    "tasksCompleted": 5,
    "tasksFailed": 0,
    "botHours": 1.2,
    "agentClass": "Novice | Understudy | Artisan | Retired | null",
    "isPioneer": false,
    "verdictSummary": "string | null",
    "verdictType": "string | null"
  }
]
```

---

### `GET /executions/:id/pending-verdicts`

Get pending Promote/Retire verdicts for a specific execution.

**Params:** `id` (uuid)

**Response 200:** Array of pending verdict objects with full council output

---

### `POST /executions/:id/stop`

Stop a running execution and all its bots.

**Params:** `id` (uuid)

**Response 200:** `{ "success": true }`
**Response 404:** Execution not found

---

### `POST /executions/:id/confirm`

Confirm a pre-flight execution, transitioning to queued then running. Spawns agents.

**Auth:** Required

**Params:** `id` (uuid)

**Response 200:** `{ "success": true }`
**Response 401:** Unauthorized
**Response 404:** Execution not found
**Response 409:** Not in pre_flight status or manifest not assembled

---

### `POST /executions/:id/cancel`

Cancel a pre-flight execution, transitioning to stopped.

**Auth:** Required

**Params:** `id` (uuid)

**Response 200:** `{ "success": true }`
**Response 401:** Unauthorized
**Response 404:** Execution not found
**Response 409:** Not in pre_flight status

---

## Execution Metrics

Prefix: `/executions`

### `GET /executions/:id/metrics`

Live execution metrics from Redis budget keys and DB.

**Params:** `id` (uuid)

**Response 200:**
```json
{
  "activeBotCount": 3,
  "totalBotHours": 1.5,
  "spentCents": 250,
  "budgetCapCents": 1000,
  "remainingCents": 750,
  "estimatedCostCents": 250
}
```

---

### `GET /executions/projects/:id/metrics`

Aggregate metrics for all executions in a project.

**Params:** `id` (uuid -- project ID)

**Response 200:**
```json
{
  "totalExecutions": 5,
  "totalBotHours": 12.3,
  "totalSpentCents": 2500,
  "activeBotCount": 2,
  "completedExecutions": 3,
  "failedExecutions": 1
}
```

---

## Execution SSE Streams

Prefix: `/executions`

### `GET /executions/:id/events` (SSE)

Server-Sent Events stream for execution lifecycle, task lifecycle, bot lifecycle, guardrail, Ring Leader, and billing events. Creates per-connection Pub/Sub subscriptions filtered by execution ID.

**Params:** `id` (uuid)

**Event types:** `execution_status_changed`, `task_claimed`, `task_completed`, `bot_started`, `bot_stopped`, `guardrail_triggered`, `ring_leader_*`, `billing_*`

---

## Soul Lifecycle SSE

Prefix: `/events`

### `GET /events/lifecycle` (SSE)

Global soul lifecycle SSE stream (not execution-scoped). Subscribes to the `soul-lifecycle` Pub/Sub topic.

---

## Bots

Prefix: `/bots`

### `GET /bots/by-execution/:executionId`

List all bots for an execution with enriched data (agent class, current task, tool call count, token burn rate).

**Response 200:**
```json
[
  {
    "id": "uuid",
    "status": "working",
    "tasksClaimed": 3,
    "tasksCompleted": 2,
    "tasksFailed": 0,
    "startedAt": "ISO 8601 | null",
    "errorMessage": "string | null",
    "agentClass": "Novice | Understudy | Artisan | Retired | null",
    "currentTaskDescription": "string | null",
    "toolCallCount": 15,
    "tokenBurnRate": 500
  }
]
```

---

### `GET /bots/:botId/soul`

Get soul content, lineage metadata, council verdict, and agent class for a bot.

**Response 200:**
```json
{
  "soulId": "uuid | null",
  "soulContent": "string | null",
  "generation": 2,
  "parentSoulId": "uuid | null",
  "isArchetype": false,
  "taskCategory": "string | null",
  "constitutionDirectives": ["string"],
  "dimensions": {},
  "agentClass": "Understudy | null",
  "verdict": {
    "verdictType": "Promote",
    "weightedConfidenceScore": 0.87,
    "verdictSummary": "string",
    "soulAnalystOutput": {},
    "performanceJudgeOutput": {}
  }
}
```

---

### `GET /bots/:botId/detail`

Per-bot metrics and step trace from tool invocations.

**Response 200:**
```json
{
  "bot": {
    "id": "uuid",
    "status": "working",
    "compositeScore": 0.85,
    "tier": "string | null",
    "startedAt": "ISO 8601 | null",
    "stoppedAt": "ISO 8601 | null"
  },
  "metrics": {
    "botId": "uuid",
    "tasksCompleted": 5,
    "tasksFailed": 1,
    "totalTasks": 6,
    "successRate": 0.83,
    "totalCostCents": 150,
    "costPerTaskCents": 25,
    "totalTokens": 50000,
    "tokensPerTask": 8333,
    "toolCallsPerTask": 3.5,
    "totalToolCalls": 21,
    "botHours": 0.5,
    "tasksPerMinute": 0.2,
    "totalRetries": 2,
    "errorRate": 0.17,
    "idleRatio": 0.1
  },
  "steps": [
    {
      "toolName": "web_search",
      "invocationId": "uuid",
      "rejected": false,
      "rejectionReason": null,
      "durationMs": 1200,
      "promptTokens": 500,
      "completionTokens": 200,
      "totalTokens": 700,
      "requestSummary": {},
      "responseSummary": {},
      "invokedAt": "ISO 8601"
    }
  ]
}
```

---

### `GET /bots/:botId/logs` (SSE)

Per-bot process log SSE stream. Subscribes to bot-lifecycle, task-lifecycle, and guardrail-events Pub/Sub topics filtered by bot ID. Also polls tool_invocations every 2 seconds.

---

### `POST /bots/:botId/ready`

Called by bot VM startup script when OpenClaw Gateway is ready. Accepts success or failure payload.

**Request Body (success):**
```json
{
  "success": true,
  "internalIp": "10.0.0.5",
  "port": 8080,
  "gatewayToken": "string",
  "openclawVersion": "string (optional)"
}
```

**Request Body (failure):**
```json
{
  "success": false,
  "error": "string"
}
```

**Response 200:** `{ "ok": true }`
**Response 404:** Bot not found or not in registry
**Response 409:** Bot already marked as ready
**Response 503:** Failed to connect to OpenClaw Gateway

---

## Billing

Prefix: `/billing`

### `GET /billing/history`

List all executions with rolled-up cost, bot-hours, and task count.

**Response 200:**
```json
[
  {
    "executionId": "uuid",
    "objective": "string",
    "status": "completed",
    "createdAt": "ISO 8601",
    "totalCostCents": 500,
    "totalBotHours": 2.5,
    "taskCount": 10
  }
]
```

---

### `GET /billing/summary`

Monthly totals for the current month.

**Response 200:**
```json
{
  "monthlyBotHours": 15.3,
  "monthlySpendCents": 3000,
  "executionCount": 8
}
```

---

### `POST /billing/webhook`

Handle Stripe webhooks. Validates the `stripe-signature` header.

**Headers:** `stripe-signature` (required)

**Response 200:** `{ "received": true }`
**Response 400:** Missing signature or invalid signature

---

## Verdicts

Prefix: `/verdicts`

### `GET /verdicts/pending`

List all pending Promote/Retire verdicts awaiting operator action.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "botId": "uuid",
    "executionId": "uuid",
    "verdictType": "Promote",
    "weightedConfidenceScore": 0.87,
    "verdictSummary": "string",
    "hasUnresolvedDevilsAdvocate": false,
    "createdAt": "ISO 8601"
  }
]
```

---

### `GET /verdicts/:verdictId`

Get a single verdict with full evidence columns (all three judge outputs).

**Response 200:** Full verdict object with `devilsAdvocateOutput`, `performanceJudgeOutput`, `soulAnalystOutput`
**Response 404:** Verdict not found

---

### `POST /verdicts/:verdictId/confirm`

Confirm a pending Promote/Retire verdict. Enqueues a God Layer job.

**Request Body:**
```json
{
  "userId": "string",
  "timeOnScreenMs": 5000
}
```

**Response 200:** `{ "ok": true }`
**Response 409:** Already resolved or not eligible

---

### `POST /verdicts/:verdictId/reject`

Reject a pending Promote/Retire verdict.

**Request Body:**
```json
{
  "userId": "string",
  "timeOnScreenMs": 3000
}
```

**Response 200:** `{ "ok": true }`
**Response 409:** Already resolved or not eligible

---

### `GET /verdicts/calibration`

Per-user confirmation rate with anti-rubber-stamp warning.

**Query:** `userId` (string, required)

**Response 200:**
```json
{
  "total": 20,
  "confirmed": 19,
  "rate": 0.95,
  "warningTriggered": true
}
```

---

## Army Builder

Prefix: `/army-builder`

### `GET /army-builder/analysis`

Pre-execution composition analysis. Uses LLM to extract task categories from the objective and returns library depth and budget tier calculations.

**Query:**
- `objective` (string, required)
- `maxBots` (integer, required, min: 1)

**Response 200:**
```json
{
  "categories": ["lead-generation", "content-writing"],
  "libraryDepth": [
    {
      "taskCategory": "lead-generation",
      "noviceCount": 5,
      "understudyCount": 2,
      "artisanCount": 1,
      "totalAgents": 8
    }
  ],
  "budgetTiers": {
    "full": { "label": "Full crew -- 5 agents per category", "agentCount": 10, "perCategory": 5 },
    "reduced": { "label": "75% crew -- 3 agents per category", "agentCount": 8, "perCategory": 3 },
    "minimumViable": { "label": "Minimum viable -- 3 Novices per category", "agentCount": 6, "perCategory": 3 }
  },
  "blocked": false,
  "blockReason": null
}
```

---

## Objectives

Prefix: `/objectives`

### `POST /objectives`

Create a new objective.

**Auth:** Required

**Request Body:**
```json
{
  "name": "string (1-255 chars)",
  "description": "string (optional)",
  "defaultMaxBots": 5,
  "defaultBudgetCapCents": 10000,
  "defaultRuntimeLimitSeconds": 3600,
  "defaultAllowedTools": ["tool-a"],
  "projectId": "uuid (optional)"
}
```

**Response 201:** Objective object
**Response 400:** Validation error
**Response 401:** Unauthorized

---

### `GET /objectives`

List objectives with aggregation (last run status, run count, total spend, best bot class).

**Query:**
- `archived` (string, optional -- `"true"` to show archived)
- `projectId` (uuid, optional)

**Response 200:** Array of objective objects with aggregation fields

---

### `GET /objectives/:id`

Get a single objective by ID.

**Response 200:** Objective object
**Response 404:** Not found

---

### `PATCH /objectives/:id`

Update or archive an objective. All fields are optional.

**Auth:** Required

**Request Body:** Partial objective fields

**Response 200:** Updated objective
**Response 404:** Not found

---

### `DELETE /objectives/:id`

Delete an objective. Linked executions get `objective_id` set to NULL.

**Auth:** Required

**Response 200:** `{ "success": true }`
**Response 404:** Not found

---

### `GET /objectives/:id/executions`

List all runs for an objective with cost and score aggregations.

**Response 200:** Array of execution objects with `totalCostCents`, `botCount`, `avgCompositeScore`

---

### `GET /objectives/:id/stats`

Aggregate stats for an objective (spend, tasks, bot-hours, class breakdown).

**Response 200:**
```json
{
  "totalSpendCents": 5000,
  "totalTasksCompleted": 50,
  "totalBotHours": 25.5,
  "runCount": 5,
  "classBreakdown": { "novice": 10, "understudy": 5, "artisan": 2, "retired": 1 },
  "classTrendSummary": "2 Artisans, 5 Understudys, 10 Novices across 5 runs"
}
```

---

### `GET /objectives/:id/timeline`

DNA evolution timeline events for an objective. Merges council verdicts and pioneer benchmark events.

**Query:**
- `limit` (integer, 1-100, default: 20)
- `offset` (integer, min: 0)
- `filter` (string: `all`, `promote`, `demote`, `retire`, `monitor_maintain`, `pioneer`)

**Response 200:**
```json
{
  "events": [
    {
      "id": "uuid",
      "eventType": "Promote | Demote | Retire | Monitor | Maintain | Pioneer",
      "botId": "uuid",
      "executionId": "uuid",
      "runNumber": 3,
      "taskCategory": "string | null",
      "fromClass": "Novice | null",
      "toClass": "Understudy | null",
      "weightedConfidenceScore": 0.87,
      "compositeScore": 0.85,
      "verdictSummary": "string",
      "hasMutationLineage": true,
      "isPioneer": false,
      "occurredAt": "ISO 8601"
    }
  ],
  "total": 15,
  "hasMore": false
}
```

---

## Ring Leader

Prefix: `/ring-leader`

### `GET /ring-leader/runs/:runId/manifest`

Get the full population manifest for a Ring Leader run.

**Response 200:**
```json
{
  "runId": "uuid",
  "executionId": "uuid",
  "status": "string",
  "manifests": [
    {
      "taskId": "string",
      "taskDescription": "string",
      "assignedSouls": [
        {
          "soulId": "uuid",
          "agentClass": "Artisan | Understudy | Novice",
          "source": "library | generated | mutated",
          "parentSoulId": "uuid | null",
          "mutationApplied": "string | null",
          "selectionRationale": "string",
          "differentiationScore": 0.85
        }
      ],
      "pioneerFlag": false,
      "varianceIntent": "string | null"
    }
  ],
  "missionBrief": {}
}
```

---

### `GET /ring-leader/runs/by-execution/:executionId`

Look up a Ring Leader run by execution ID.

**Response 200:** Same as manifest response above
**Response 404:** Not found

---

### `GET /ring-leader/runs/by-execution/:executionId/state`

Get live run state including budget, task states, drift score, and anomalies.

**Response 200:**
```json
{
  "runId": "uuid",
  "executionId": "uuid",
  "status": "string",
  "runState": {
    "runId": "string",
    "elapsedTimeSeconds": 120.5,
    "budgetConsumedCents": 250,
    "taskStates": {},
    "objectiveDriftScore": 0.05,
    "anomalies": []
  }
}
```

---

### `GET /ring-leader/runs/by-execution/:executionId/events`

Get coordination event log for a Ring Leader run.

**Response 200:**
```json
{
  "runId": "uuid",
  "events": [
    { "type": "string", "timestamp": "ISO 8601", "payload": {} }
  ]
}
```

---

### `GET /ring-leader/runs/by-execution/:executionId/synthesis`

Get run synthesis and fitness scores for completed runs.

**Response 200:**
```json
{
  "runId": "uuid",
  "executionId": "uuid",
  "status": "string",
  "synthesis": {},
  "fitness": {
    "coordinationScore": {
      "collectiveOutcome": 0.9,
      "driftPrevention": 0.85,
      "reallocationEffectiveness": 0.8,
      "budgetManagement": 0.95
    },
    "soulSelectionScore": {
      "librarySearchQuality": 0.88,
      "differentiationEffectiveness": 0.82,
      "mutationDecisionQuality": 0.75,
      "pioneerHandling": 0.9,
      "selectionRetrospectiveQuality": 0.85
    },
    "compositeScore": 0.86
  }
}
```

---

## Souls

Prefix: `/souls`

### `GET /souls`

Paginated soul library with optional filtering.

**Query:**
- `category` (string, optional)
- `agentClass` (string, optional)
- `limit` (integer, 1-100, default: 50)
- `offset` (integer, min: 0)

**Response 200:**
```json
{
  "souls": [
    {
      "id": "uuid",
      "taskCategory": "string | null",
      "generation": 2,
      "isArchetype": false,
      "archetypeName": "string | null",
      "agentClass": "Novice | Understudy | Artisan | Retired | null",
      "compositeScore": 0.85,
      "createdAt": "ISO 8601"
    }
  ],
  "total": 100,
  "hasMore": true
}
```

---

### `GET /souls/categories`

List distinct task categories in the soul library.

**Response 200:**
```json
{ "categories": ["lead-generation", "content-writing"] }
```

---

### `GET /souls/:id`

Get full soul detail including content, dimensions, and linked bot data.

**Response 200:** Full soul object with `soulContent`, `dimensions`, `constitutionDirectives`
**Response 404:** Soul not found

---

## Category Benchmarks

Prefix: `/category-benchmarks`

### `GET /category-benchmarks`

List all category benchmarks ordered by task category.

**Response 200:**
```json
{
  "benchmarks": [
    {
      "id": "uuid",
      "taskCategory": "string",
      "pioneerBotId": "uuid",
      "pioneerSoulId": "uuid | null",
      "pioneerExecutionId": "uuid",
      "baselineCompositeScore": "string",
      "confirmedRunCount": 3,
      "thinDataFlag": false,
      "benchmarkMature": true,
      "standardPromotion": true,
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ]
}
```

---

## Decision Traces

Prefix: `/decision-traces`

### `GET /decision-traces/:botId`

Paginated decision traces for a specific bot.

**Query:**
- `limit` (integer, 1-100, default: 50)
- `offset` (integer, min: 0)

**Response 200:**
```json
{
  "traces": [
    {
      "id": "uuid",
      "decisionType": "string",
      "directiveReferenced": "string | null",
      "attributionConfidence": "string | null",
      "outcome": "string | null",
      "decidedAt": "ISO 8601",
      "executionId": "uuid"
    }
  ],
  "total": 50,
  "hasMore": false
}
```

---

## Negative Signals

Prefix: `/negative-signals`

### `GET /negative-signals`

Paginated negative signal register with soul metadata.

**Query:**
- `failureType` (string, optional)
- `limit` (integer, 1-100, default: 50)
- `offset` (integer, min: 0)

**Response 200:**
```json
{
  "signals": [
    {
      "id": "uuid",
      "soulId": "uuid",
      "botId": "uuid",
      "executionId": "uuid | null",
      "failureType": "string",
      "directiveFailureSummary": "string | null",
      "registeredAt": "ISO 8601",
      "taskCategory": "string | null",
      "generation": 2
    }
  ],
  "total": 25,
  "hasMore": false
}
```

---

## Admin

Prefix: `/admin`

### `GET /admin/health`

Deep health check probing GCE, Cloud SQL, Redis, and BullMQ. Returns 503 if any subsystem is unreachable.

**Response 200:**
```json
{
  "status": "healthy",
  "subsystems": {
    "gce": { "ok": true, "instanceCount": 1 },
    "cloudSQL": { "ok": true, "latencyMs": 5 },
    "redis": { "ok": true, "latencyMs": 2 },
    "bullMQ": { "ok": true, "counts": { "waiting": 0, "active": 1, "failed": 0 } }
  }
}
```

---

### `POST /admin/cleanup/decision-traces`

Trigger TTL-based pruning of the decision_traces table (90-day / 5M-row policy).

**Response 200:** `{ "status": "ok", "deleted": 1500 }`

---

### `POST /admin/waitlist`

Accept an email for the early-access waitlist. Logs to Cloud Logging.

**Request Body:** `{ "email": "string" }`

**Response 200:** `{ "ok": true }`
**Response 400:** Invalid email

---

### `POST /admin/retention/run`

Trigger an immediate data retention sweep.

**Response 200:** `{ "status": "ok", ... }`

---

### `GET /admin/retention/config`

Get active retention configuration and next scheduled run time.

**Response 200:**
```json
{
  "config": { ... },
  "nextScheduledRun": "ISO 8601 | null"
}
```

---

## Onboarding

Prefix: `/onboarding`

### `GET /onboarding/status`

Check if the current user has completed onboarding (has a company in Paperclip).

**Auth:** Session cookie required

**Response 200:**
```json
{ "onboarded": true, "companyId": "uuid" }
```

**Response 401:** Not authenticated

---

### `POST /onboarding/summon`

Create a company in Paperclip and spawn the initial agent team.

**Auth:** Session cookie required

**Request Body:**
```json
{
  "businessType": "string",
  "firstGoal": "string",
  "budget": "<50 | 50-200 | 200+",
  "companyName": "string",
  "toolConnections": [{ "toolId": "string", "connectionId": "string" }]
}
```

**Response 200:**
```json
{
  "companyId": "uuid",
  "companyName": "string",
  "agents": [
    { "id": "uuid", "name": "Mira", "role": "marketing", "tier": "sonnet", "archetype": "Creative Synthesizer" }
  ],
  "quickWins": [
    { "agent": "Kael", "message": "Found 50 cold leads in HubSpot", "toolId": "hubspot" }
  ]
}
```

---

## Cost Projections

Prefix: `/companies`

### `GET /companies/:id/costs/projections`

Cost projection and forecasting based on burn rate.

**Params:** `id` (uuid -- company ID)

**Response 200:**
```json
{
  "dailyBurnRateCents": 500,
  "projectedMonthlyCostCents": 15000,
  "daysUntilBudgetExhaustion": 20,
  "trend": "increasing | decreasing | stable",
  "breakdown": {
    "llmInputTokensCents": 200,
    "llmOutputTokensCents": 150,
    "botHoursCents": 100,
    "toolInvocationsCents": 50
  },
  "windowDays": 7,
  "dataPoints": 5
}
```

---

## Paperclip Proxy

The execution service proxies several path prefixes to the Paperclip API server. The browser never talks directly to Paperclip; all requests go through this proxy which forwards session cookies for auth.

**Proxied prefixes:**
- `/companies` and `/companies/*`
- `/agents` and `/agents/*`
- `/issues` and `/issues/*`
- `/goals` and `/goals/*`
- `/projects` and `/projects/*`
- `/chat` and `/chat/*`
- `/costs` and `/costs/*`
- `/approvals` and `/approvals/*`
- `/activity` and `/activity/*`
- `/dashboard` and `/dashboard/*`
- `/sidebar-badges` and `/sidebar-badges/*`
- `/secrets` and `/secrets/*`

**Methods:** GET, POST, PATCH, PUT, DELETE

---

## Auth

### `GET /auth/*` and `POST /auth/*`

BetterAuth routes for Google OAuth and session management. Bridges Web API Request/Response to Fastify.
