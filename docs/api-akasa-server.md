# Akasa Server API Reference

The Akasa server handles evolution-specific product logic: council verdicts, God Layer, soul management, skill system, Tool Nexus connections, webhooks, Akashic Library marketplace, and the evolution dashboard.

**Framework:** Express.js (mounted alongside Paperclip's Express server)

**Base URL:** All routes are prefixed with `/api/akasa/`

**Authentication:** Most routes expect a `userId` parameter (query or body). Internal endpoints at `/akasa/internal/*` have no auth and rely on localhost-only access.

---

## Health Check

### `GET /api/akasa/health`

Basic health check for Akasa routes.

**Response 200:**
```json
{ "status": "ok", "service": "akasa", "timestamp": "ISO 8601" }
```

---

## Council Verdicts

Prefix: `/api/akasa/verdicts`

### `GET /api/akasa/verdicts`

List verdicts for a given execution.

**Query:** `executionId` (uuid, required)

**Response 200:** Array of full verdict objects ordered by creation date desc
**Response 400:** Missing executionId

---

### `GET /api/akasa/verdicts/:id`

Get a single verdict by UUID.

**Response 200:** Full verdict object
**Response 404:** Verdict not found

---

## God Layer (Verdict Actions)

Prefix: `/api/akasa/verdicts`

### `PATCH /api/akasa/verdicts/:id/confirm`

Confirm a pending verdict and trigger the God Layer pipeline.

**Request Body:**
```json
{ "confirmedBy": "string (optional, defaults to 'system')" }
```

**Response 200:**
```json
{ "confirmed": true, "godLayerResult": { ... } }
```

**Response 404:** Verdict not found
**Response 409:** Verdict already processed

---

### `PATCH /api/akasa/verdicts/:id/reject`

Reject a pending verdict. No God Layer triggered.

**Request Body:**
```json
{ "confirmedBy": "string (optional)" }
```

**Response 200:** `{ "rejected": true }`
**Response 404:** Verdict not found
**Response 409:** Verdict already processed

---

### `POST /api/akasa/verdicts/batch`

Batch confirm or reject multiple pending verdicts.

**Request Body:**
```json
{
  "verdictIds": ["uuid", "uuid"],
  "action": "confirm | reject",
  "userId": "string",
  "timeOnScreenMs": 5000
}
```

**Response 200:**
```json
{
  "processed": [
    { "id": "uuid", "success": true, "action": "confirmed" },
    { "id": "uuid", "success": false, "error": "Verdict not found" }
  ],
  "summary": { "total": 2, "succeeded": 1, "failed": 1 }
}
```

---

## Evolution Trigger

Prefix: `/api/akasa/evolution`

### `POST /api/akasa/evolution/trigger`

Manually trigger a council evaluation check cycle. Polls Paperclip's `heartbeat_runs` table for completed runs linked to Akasa bots that have no verdict yet.

**Response 200:**
```json
{ "triggered": 3 }
```

---

## Evolution Dashboard

Prefix: `/api/akasa/evolution`

### `GET /api/akasa/evolution/fleet`

Fleet overview with class counts, score history, average composite score, and pending verdict count.

**Response 200:**
```json
{
  "classCounts": { "Novice": 10, "Understudy": 5, "Artisan": 2, "Retired": 1 },
  "totalBots": 18,
  "averageCompositeScore": "0.75",
  "pendingVerdictCount": 3,
  "scoreHistory": [
    { "date": "2026-04-01", "score": "0.72" }
  ]
}
```

---

### `GET /api/akasa/evolution/fleet/events`

Chronological feed of fleet events (verdicts, class transitions, DNA captures, pioneers).

**Query:**
- `limit` (integer, max: 100, default: 50)
- `types` (comma-separated: `verdict,class_transition,dna_capture,pioneer`)

**Response 200:** Array of event objects sorted by timestamp desc

---

### `GET /api/akasa/evolution/agents`

Agent list with current class, composite score, pioneer status, and last verdict date.

**Response 200:** Array of agent objects

---

### `GET /api/akasa/evolution/bots/:botId/profile`

Full bot profile with soul dimensions, class history, pioneer status, and archetype.

**Response 200:**
```json
{
  "botId": "uuid",
  "compositeScore": "0.85",
  "status": "idle",
  "currentClass": "Understudy",
  "isPioneer": false,
  "taskCategory": "lead-generation",
  "archetypeName": "Aggressive Executor",
  "soulId": "uuid",
  "soulContent": "string",
  "dimensions": {},
  "constitutionDirectives": [],
  "generation": 2,
  "classHistory": [
    { "class": "Novice", "transitionAt": "ISO 8601", "category": "lead-generation" }
  ]
}
```

**Response 404:** Bot not found

---

### `GET /api/akasa/evolution/bots/:botId/timeline`

Merged timeline of verdict, class transition, and DNA capture events for a bot.

**Response 200:** Array of typed event objects sorted by timestamp desc

---

### `GET /api/akasa/evolution/bots/:botId/lineage`

Soul ancestry chain (root-first, max depth 10).

**Response 200:**
```json
[
  {
    "id": "uuid",
    "label": "Cautious Verifier",
    "generation": 0,
    "isArchetype": true,
    "isPioneer": false,
    "parentSoulId": null
  },
  {
    "id": "uuid",
    "label": "a1b2c3d4",
    "generation": 1,
    "isArchetype": false,
    "isPioneer": false,
    "parentSoulId": "uuid"
  }
]
```

---

### `GET /api/akasa/evolution/bots/:botId/ledger`

Run-by-run experiment ledger with score delta and keep/discard decision.

**Response 200:**
```json
[
  {
    "executionId": "uuid",
    "executionDate": "ISO 8601",
    "compositeScore": "0.85",
    "scoreDelta": "0.05",
    "verdictType": "Promote",
    "status": "confirmed",
    "keepDiscard": "keep",
    "mutationApplied": true,
    "soulId": "uuid"
  }
]
```

---

### `GET /api/akasa/evolution/bots/:botId/runtime`

Token consumption, cost, and budget utilization from Paperclip shared DB.

**Response 200:**
```json
{
  "sessionId": "uuid | null",
  "lastRunStatus": "string | null",
  "totalInputTokens": 50000,
  "totalOutputTokens": 15000,
  "totalCachedInputTokens": 10000,
  "totalCostCents": 250,
  "budgetMonthlyCents": 10000,
  "spentMonthlyCents": 2500,
  "budgetUtilization": 25,
  "lastError": "string | null",
  "updatedAt": "ISO 8601"
}
```

Returns `null` if no Paperclip agent is linked to this bot.

---

### `GET /api/akasa/evolution/org`

Hierarchical fleet tree for D3 visualization (fleet -> category -> class_tier -> agent).

**Response 200:**
```json
{
  "id": "fleet",
  "label": "Fleet",
  "type": "fleet",
  "children": [
    {
      "id": "category:lead-generation",
      "label": "lead-generation",
      "type": "category",
      "children": [
        {
          "id": "class:lead-generation:Artisan",
          "label": "Artisan",
          "type": "class_tier",
          "children": [
            { "id": "agent:uuid", "label": "a1b2c3d4", "type": "agent", "botId": "uuid", "currentClass": "Artisan", "compositeScore": "0.92", "status": "idle" }
          ]
        }
      ]
    }
  ]
}
```

---

### `GET /api/akasa/evolution/benchmarks`

All category benchmarks with thin data flag and benchmark maturity status.

**Response 200:** Array of category benchmark objects

---

### `GET /api/akasa/evolution/pending`

Pending verdicts that require human confirmation (subset of all pending verdicts).

**Response 200:** Array of verdict objects with full judge outputs

---

### `GET /api/akasa/evolution/delegations`

Delegation chains from task assignments, grouped by execution.

**Query:**
- `executionId` (uuid, optional)
- `from` (ISO date, optional)
- `to` (ISO date, optional)

**Response 200:**
```json
{
  "chains": [
    {
      "executionId": "uuid",
      "objective": "string",
      "delegations": [
        {
          "taskId": "uuid",
          "description": "string",
          "status": "completed",
          "assignedBotId": "uuid",
          "botTier": "string",
          "botCompositeScore": "0.85",
          "ringLeaderTaskId": "string | null",
          "createdAt": "ISO 8601"
        }
      ]
    }
  ],
  "stats": {
    "totalDelegations": 50,
    "successRate": 85,
    "avgDepth": 5.2,
    "executionCount": 3
  }
}
```

---

## Akashic Library (Marketplace)

Prefix: `/api/akasa/akashic`

### `GET /api/akasa/akashic/browse`

Browse published DNA entries in the Akashic Library marketplace.

**Query:**
- `taskCategory` (string, optional)
- `minScore` (number, optional)
- `sortBy` (`score` | `generation` | `acquiredCount`, default: score)
- `page` (integer, default: 1)

**Response 200:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "compositeScore": 0.92,
      "objectiveCategory": "string",
      "generation": 3,
      "mutationLineageDepth": 2,
      "taskCategory": "string",
      "acquiredCount": 5,
      "capturedAt": "ISO 8601"
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

---

### `POST /api/akasa/akashic/:dnaId/publish`

Publish a DNA entry to the Akashic Library. Only Artisan-class agents can publish.

**Request Body:**
```json
{
  "title": "string",
  "description": "string"
}
```

**Response 200:** `{ "published": true }`
**Response 403:** Only Artisan-class agents can publish
**Response 404:** DNA entry not found

---

### `DELETE /api/akasa/akashic/:dnaId/unpublish`

Unpublish a DNA entry from the marketplace.

**Response 200:** `{ "unpublished": true }`
**Response 400:** Not currently published
**Response 404:** DNA entry not found

---

### `POST /api/akasa/akashic/:dnaId/acquire`

Acquire a published DNA entry, generating a mutated soul and injecting it into an agent.

**Request Body:**
```json
{
  "agentId": "string",
  "companyId": "string",
  "adapterType": "string (optional)"
}
```

**Response 201:**
```json
{
  "acquired": true,
  "newSoulId": "uuid",
  "generation": 4
}
```

---

## Souls (Akasa Server)

Prefix: `/api/akasa/souls`

### `GET /api/akasa/souls`

List all non-archetype souls.

**Response 200:** Array of soul objects

---

### `GET /api/akasa/souls/:id`

Get a single soul by UUID.

**Response 200:** Full soul object
**Response 404:** Soul not found

---

### `GET /api/akasa/souls/search`

Find top-N similar souls by cosine similarity using pgvector embeddings.

**Query:**
- `query` (string, required)
- `limit` (integer, max: 100, default: 10)

**Response 200:** Array of soul objects with `similarity_score`

---

### `POST /api/akasa/souls/generate`

Generate a new soul from an archetype.

**Request Body:**
```json
{
  "archetypeName": "Cautious Verifier",
  "taskCategory": "lead-generation",
  "botId": "uuid (optional)",
  "executionId": "uuid (optional)"
}
```

**Response 201:** Generated soul object

---

### `POST /api/akasa/souls/:id/mutate`

Generate a mutated child soul from a parent soul.

**Request Body:**
```json
{ "mutationStrength": 0.2 }
```

**Response 201:** Mutated soul object
**Response 404:** Parent soul not found

---

### `POST /api/akasa/souls/inject`

Inject a soul into a Paperclip agent.

**Request Body:**
```json
{
  "agentId": "string",
  "companyId": "string",
  "soulId": "uuid",
  "adapterType": "string (optional)"
}
```

**Response 200:** `{ "injected": true }`
**Response 404:** Soul not found

---

## Tool Connections

Prefix: `/api/akasa/tool-connections`

### `GET /api/akasa/tool-connections`

List all tool connections for a user. Encrypted credential fields are stripped from the response.

**Query:** `userId` (string, required)

**Response 200:** Array of connection objects (without encrypted fields)

---

### `POST /api/akasa/tool-connections`

Create a new tool connection (OAuth or API key). Credentials are encrypted with AES-256-GCM before storage.

**Request Body:**
```json
{
  "userId": "string",
  "toolId": "string",
  "connectionType": "oauth | api_key",
  "accessToken": "string (required for oauth)",
  "refreshToken": "string (optional)",
  "apiKey": "string (required for api_key)",
  "displayLabel": "string (optional)",
  "tokenExpiresAt": "ISO 8601 (optional)",
  "scopes": "string (optional)"
}
```

**Response 201:** Created connection (without encrypted fields)
**Response 400:** Missing required fields
**Response 409:** Connection already exists for this user/tool

---

### `DELETE /api/akasa/tool-connections/:id`

Delete a tool connection.

**Response 200:** `{ "ok": true }`
**Response 404:** Connection not found

---

### `PATCH /api/akasa/tool-connections/:id/refresh`

Update OAuth tokens after a refresh.

**Request Body:**
```json
{
  "accessToken": "string (required)",
  "refreshToken": "string (optional)",
  "tokenExpiresAt": "ISO 8601 (optional)"
}
```

**Response 200:** Updated connection (without encrypted fields)

---

### `POST /api/akasa/tool-connections/:id/test`

Test a connection by verifying credential decryption.

**Response 200:**
```json
{ "success": true, "toolId": "hubspot", "connectionType": "oauth" }
```

Or on failure:
```json
{ "success": false, "error": "Credential decryption failed" }
```

---

### `GET /api/akasa/tool-connections/:id/logs`

Get invocation logs for a specific connection (last 100 entries).

**Response 200:** Array of invocation log objects

---

## OAuth Flow

Prefix: `/api/akasa/tool-connections`

### `GET /api/akasa/tool-connections/oauth/:toolId/start`

Redirect user to the OAuth provider's authorization page.

**Query:**
- `userId` (string, required)
- `redirectUri` (string, optional)

**Response 302:** Redirect to provider authorization URL

---

### `GET /api/akasa/tool-connections/oauth/:toolId/callback`

OAuth callback handler. Exchanges authorization code for tokens, encrypts and persists the connection.

**Query:**
- `code` (string, required)
- `state` (base64url-encoded JSON, required)

**Response 302:** Redirect to success page (`/tools?connected=<toolId>`)

---

## Webhooks

Prefix: `/api/akasa/webhooks`

### `POST /api/akasa/webhooks/generate-url`

Generate a unique webhook URL for a tool connection.

**Request Body:**
```json
{ "connectionId": "uuid" }
```

**Response 200:**
```json
{
  "webhookUrl": "/api/akasa/webhooks/hubspot/<token>",
  "token": "string",
  "toolId": "hubspot"
}
```

---

### `POST /api/akasa/webhooks/:toolId/:token`

Receive an incoming webhook. Validates signature (HubSpot, Slack, Stripe, GitHub, Linear), logs the receipt, evaluates routing rules, and dispatches to the matched agent.

**Response 200:** `{ "received": true }`
**Response 401:** Invalid token or signature

---

### `POST /api/akasa/webhooks/:toolId/simulate`

Dry-run webhook routing rule evaluation.

**Request Body:**
```json
{
  "userId": "string",
  "eventType": "string",
  "payload": {}
}
```

**Response 200:**
```json
{
  "matched": true,
  "eventType": "contact.creation",
  "toolId": "hubspot",
  "matchedRule": { "id": "uuid", "eventType": "contact.creation", "assignToAgentId": "uuid" },
  "agentId": "uuid",
  "dryRun": true
}
```

---

### `GET /api/akasa/webhooks/logs`

Aggregated webhook event log for a user.

**Query:** `userId` (string, required)

**Response 200:** Array of webhook-prefixed invocation log objects (last 100)

---

## Webhook Routing Rules

Prefix: `/api/akasa/webhook-routing-rules`

### `GET /api/akasa/webhook-routing-rules`

List all routing rules for a user.

**Query:** `userId` (string, required)

**Response 200:** Array of routing rule objects

---

### `POST /api/akasa/webhook-routing-rules`

Create a new routing rule.

**Request Body:**
```json
{
  "userId": "string",
  "connectionId": "uuid",
  "toolId": "string",
  "eventType": "string (or '*' for wildcard)",
  "condition": "string (optional)",
  "assignToAgentId": "uuid (optional)"
}
```

**Response 201:** Created routing rule object

---

### `DELETE /api/akasa/webhook-routing-rules/:id`

Delete a routing rule.

**Response 204:** No content
**Response 404:** Rule not found

---

## Commands

Prefix: `/api/akasa/commands`

### `POST /api/akasa/commands/execute`

Execute a quick command for fleet management.

**Request Body:**
```json
{
  "command": "status | pause | resume | assign",
  "args": ["agentName", "issueId"],
  "companyId": "uuid"
}
```

**Response 200:**
```json
{
  "ok": true,
  "message": "Fleet status: 3 active bots, 1 running execution, 2 pending verdicts.",
  "data": { "activeBots": 3, "runningExecutions": 1, "pendingVerdicts": 2 }
}
```

---

## Settings

Prefix: `/api/akasa/settings`

### `GET /api/akasa/settings/profile`

Get the current user's profile.

**Response 200:**
```json
{ "id": "uuid", "name": "string", "email": "string", "image": "string | null" }
```

---

### `GET /api/akasa/settings/preferences`

Get notification preferences for the current user.

**Response 200:** Preferences object with email/in-app toggle booleans

---

### `PUT /api/akasa/settings/preferences`

Create or update notification preferences.

**Request Body:**
```json
{
  "emailEvolutionEvents": true,
  "emailBudgetAlerts": true,
  "emailSkillEvents": true,
  "inAppEvolutionEvents": true,
  "inAppBudgetAlerts": true,
  "inAppSkillEvents": true,
  "budgetAlertThreshold50": true,
  "budgetAlertThreshold75": true,
  "budgetAlertThreshold90": true
}
```

**Response 200:** Updated preferences object

---

### `GET /api/akasa/settings/api-keys`

List active (non-revoked) API keys for the current user.

**Response 200:** Array of API key objects (no raw key, only prefix)

---

### `POST /api/akasa/settings/api-keys`

Create a new API key. The raw key is returned only once in the response.

**Request Body:**
```json
{ "name": "string" }
```

**Response 201:**
```json
{
  "id": "string",
  "key": "aka_<hex>",
  "keyPrefix": "aka_1234",
  "name": "string",
  "createdAt": "ISO 8601"
}
```

---

### `DELETE /api/akasa/settings/api-keys/:id`

Revoke an API key (soft delete via `revokedAt` timestamp).

**Response 204:** No content

---

### `DELETE /api/akasa/settings/account`

Delete the current user's account.

**Response 204:** No content

---

## Skills

Prefix: `/api/akasa/skills`

### `GET /api/akasa/skills`

List all skills for a user with optional category/source filtering.

**Query:**
- `userId` (string, required)
- `category` (string, optional)
- `source` (string, optional)

**Response 200:** Array of skill objects

---

### `POST /api/akasa/skills`

Create a new skill from SKILL.md content. Validates frontmatter, progressive disclosure structure, and trigger patterns.

**Request Body:**
```json
{
  "userId": "string",
  "content": "--- SKILL.md content ---",
  "source": "user_created | imported | curated (optional)",
  "isPublic": false
}
```

**Response 201:** Created skill object
**Response 400:** Validation errors array
**Response 409:** Skill name already exists

---

### `GET /api/akasa/skills/:id`

Get a single skill by ID.

**Response 200:** Full skill object
**Response 404:** Skill not found

---

### `PATCH /api/akasa/skills/:id`

Update a skill's content, name, or description.

**Request Body:** `{ "content": "string", "name": "string", "description": "string" }` (at least one required)

**Response 200:** Updated skill object
**Response 400:** Validation errors
**Response 404:** Skill not found

---

### `DELETE /api/akasa/skills/:id`

Delete a skill.

**Response 200:** `{ "ok": true }`
**Response 404:** Skill not found

---

## Agent Skills (Loadout)

Prefix: `/api/akasa/agents`

### `GET /api/akasa/agents/:agentId/skills`

List all equipped skills for an agent.

**Response 200:**
```json
[
  {
    "skillId": "uuid",
    "equippedAt": "ISO 8601",
    "equippedBy": "string",
    "skillName": "string",
    "skillDescription": "string",
    "skillCategory": "string",
    "skillVersion": "1.0.0"
  }
]
```

---

### `POST /api/akasa/agents/:agentId/skills/:skillId`

Equip a skill to an agent. Checks agent class capacity limits (Novice: 3, Understudy: 5, Artisan: 8).

**Request Body:**
```json
{ "equippedBy": "string" }
```

**Response 201:** Equipped skill record
**Response 400:** Capacity exceeded
**Response 404:** Skill or agent class not found
**Response 409:** Skill already equipped

---

### `DELETE /api/akasa/agents/:agentId/skills/:skillId`

Unequip a skill from an agent.

**Response 200:** `{ "ok": true }`
**Response 404:** Equipped skill not found

---

## Tool Registry (OpenAPI Import)

Prefix: `/api/akasa/tool-registry`

### `POST /api/akasa/tool-registry/preview`

Parse an OpenAPI/Swagger spec and return discovered endpoints without persisting.

**Request Body:**
```json
{
  "specUrl": "string (URL to spec)",
  "specJson": {}
}
```

One of `specUrl` or `specJson` is required.

**Response 200:** Parsed spec with discovered endpoints
**Response 422:** Failed to parse spec

---

### `POST /api/akasa/tool-registry/import`

Import selected endpoints from an OpenAPI spec.

**Request Body:**
```json
{
  "userId": "string",
  "specUrl": "string (optional)",
  "specJson": {},
  "selectedEndpoints": [{ "method": "GET", "path": "/users" }]
}
```

**Response 201:** Imported endpoint records
**Response 422:** Import failed

---

### `GET /api/akasa/tool-registry`

List all imported tool endpoints for a user.

**Query:** `userId` (string, required)

**Response 200:** Array of registry entry objects

---

### `DELETE /api/akasa/tool-registry/:specId`

Remove all endpoints from a specific import.

**Query:** `userId` (string, required)

**Response 200:** `{ "deleted": 5 }`

---

### `PATCH /api/akasa/tool-registry/:id/toggle`

Enable or disable a specific endpoint.

**Request Body:**
```json
{ "userId": "string", "isEnabled": true }
```

**Response 200:** Updated registry entry
**Response 404:** Entry not found

---

## Marketplace Reviews

Prefix: `/api/akasa/reviews`

### `POST /api/akasa/reviews`

Submit or update a review (one per user per target, upsert behavior).

**Request Body:**
```json
{
  "userId": "string",
  "targetId": "uuid",
  "targetType": "soul | skill",
  "rating": 5,
  "reviewText": "string (optional)"
}
```

**Response 201:** Created review (or 200 if updated)
**Response 400:** Invalid rating or missing fields

---

### `GET /api/akasa/reviews`

List reviews for a target.

**Query:**
- `targetId` (string, required)
- `targetType` (`soul` | `skill`, optional)

**Response 200:** Array of review objects

---

### `GET /api/akasa/reviews/summary`

Average rating and count for a target.

**Query:** `targetId` (string, required)

**Response 200:**
```json
{ "targetId": "uuid", "avgRating": 4.5, "count": 12 }
```

---

### `DELETE /api/akasa/reviews/:id`

Delete own review.

**Query:** `userId` (string, required -- must match review owner)

**Response 200:** `{ "deleted": true }`
**Response 403:** Can only delete own reviews
**Response 404:** Review not found

---

## GitHub Integration

Prefix: `/api/akasa/github`

These routes use the user's GitHub OAuth connection from tool_connections.

### `GET /api/akasa/github/repos`

List authenticated user's GitHub repositories.

**Query:** `userId` (string, required)

**Response 200:** Array of repo objects with `name`, `fullName`, `owner`, `isPrivate`, `cloneUrl`, `defaultBranch`

---

### `GET /api/akasa/github/repos/:owner/:repo`

Get details for a specific repository.

**Query:** `userId` (string, required)

**Response 200:** Repo detail object

---

### `GET /api/akasa/github/repos/:owner/:repo/branches`

List branches for a repository.

**Query:** `userId` (string, required)

**Response 200:** Array of branch objects with `name`, `sha`, `isProtected`

---

## Internal Endpoints

Prefix: `/api/akasa/internal`

**WARNING:** No authentication -- relies on localhost-only access. Never expose on a public interface.

### `GET /api/akasa/internal/user-by-company/:companyId`

Translate a Paperclip company ID to a BetterAuth user ID.

**Response 200:** `{ "userId": "string" }`
**Response 404:** No user found

---

### `GET /api/akasa/internal/tool-credential/:userId/:toolId`

Resolve a valid tool credential (handles token refresh transparently).

**Response 200:** `{ "token": "string", "connectionId": "uuid" }`
**Response 404:** No connection found
**Response 410:** Connection not active

---

### `POST /api/akasa/internal/log-invocation`

Log a tool invocation from the plugin worker.

**Request Body:**
```json
{
  "toolId": "string",
  "action": "string",
  "agentId": "string | null",
  "userId": "string",
  "connectionId": "uuid",
  "latencyMs": 150,
  "success": true,
  "errorMessage": "string (optional)",
  "requestSummary": "string (optional)",
  "responseSummary": "string (optional)"
}
```

**Response 204:** No content

---

### `POST /api/akasa/internal/fleet-event`

Receive fleet events from the execution-service God Layer worker for WebSocket broadcast.

**Request Body:**
```json
{
  "type": "string",
  "description": "string",
  "botId": "uuid (optional)",
  "executionId": "uuid (optional)",
  "soulId": "uuid (optional)",
  "taskCategory": "string (optional)",
  "verdictType": "string (optional)",
  "fromClass": "string (optional)",
  "toClass": "string (optional)",
  "compositeScore": "string (optional)",
  "isPioneer": false
}
```

**Response 204:** No content
**Response 400:** Missing required fields
