# Domain Model — Akasa

> Entity relationships and domain concepts.

## Core Entities

### Execution

A run of an objective. Spawns bots, dispatches tasks, collects results.

```
Execution
  ├── id: UUID
  ├── objectiveId: UUID (nullable — can be ad-hoc)
  ├── status: pending | pre_flight | running | completed | failed | cancelled
  ├── maxBots: number
  ├── budgetCapCents: number
  ├── runtimeLimitMinutes: number
  └── 1:N → Bot[]
```

### Objective

Reusable execution template with default configuration.

```
Objective
  ├── id: UUID
  ├── name: string
  ├── description: text
  ├── defaultConfig: { maxBots, budgetCap, runtimeLimit, allowedTools }
  └── 1:N → Execution[] (ON DELETE SET NULL)
```

### Bot

An AI agent instance running on a GCE VM.

```
Bot
  ├── id: UUID
  ├── executionId: UUID (FK → Execution)
  ├── status: spawning | idle | working | stopping | stopped | failed
  ├── soulId: UUID (logical FK → BotSoul)
  ├── paperclipAgentId: UUID (logical FK → Paperclip agents)
  ├── compositeScore: numeric(5,2)
  ├── tier: string (haiku/sonnet/opus)
  ├── tasksClaimed / tasksCompleted / tasksFailed: integer
  └── startedAt / stoppedAt / lastHeartbeatAt: timestamp
```

### BotSoul

Behavioral constitution document. Every bot gets a unique soul at spawn.

```
BotSoul
  ├── id: UUID
  ├── isArchetype: boolean (true for the 6 canonical templates)
  ├── archetypeName: string (null for non-archetypes)
  ├── botId: UUID
  ├── executionId: UUID
  ├── taskCategory: string
  ├── soulContent: text (full SOUL.md markdown)
  ├── contentHash: SHA-256
  ├── generation: integer (1 = archetype, 2+ = mutated)
  ├── parentSoulId: UUID (self-referential — mutation lineage)
  ├── dimensions: JSONB { 7 behavioral axes }
  ├── constitutionDirectives: JSONB (inviolable rules)
  ├── embedding: vector(1536) (for similarity search)
  └── humanReviewFlag: boolean
```

### AgentClass

Class progression tracked per bot per task category.

```
AgentClass
  ├── id: UUID
  ├── botId: UUID
  ├── taskCategory: string
  ├── currentClass: Novice | Understudy | Artisan | Retired
  ├── isPioneer: boolean
  ├── aboveBenchmarkCount / belowBenchmarkCount: integer
  ├── consecutiveBelowCount: integer
  ├── humanConfirmationCount: integer
  └── UNIQUE(botId, taskCategory)
```

### CouncilVerdict

Output from the 3-judge evaluation council.

```
CouncilVerdict
  ├── id: UUID
  ├── executionId: UUID (FK → Execution)
  ├── botId: UUID
  ├── soulId: UUID (logical FK → BotSoul)
  ├── verdictType: Promote | Maintain | Monitor | Demote | Retire
  ├── status: pending | confirmed | rejected
  ├── weightedConfidenceScore: numeric(4,3)
  ├── requiresHumanConfirmation: boolean
  ├── verdictSummary: text
  ├── performanceJudgeOutput: JSONB
  ├── soulAnalystOutput: JSONB
  ├── devilsAdvocateOutput: JSONB
  ├── confirmedAt / confirmedBy: timestamp / string
  └── godLayerProcessedAt: timestamp (idempotency marker)
```

### DnaStore

Captured behavioral patterns from high-performing agents.

```
DnaStore
  ├── id: UUID
  ├── botId: UUID
  ├── executionId: UUID
  ├── objectiveCategory: string
  ├── version: integer
  ├── compositeScore: numeric
  ├── dnaPayload: JSONB { soulContent, agentClass, fitnessBreakdown, councilScores, toolSequences, retryStrategy }
  ├── soulId: UUID
  ├── parentSoulIds: UUID[]
  ├── mutationLineage: JSONB
  └── isProvisional: boolean
```

### ToolConnection

User's connected external tools (OAuth or API key).

```
ToolConnection
  ├── id: UUID
  ├── userId: string
  ├── toolId: string (hubspot | slack | google_sheets)
  ├── authType: oauth | api_key
  ├── encryptedCredentials: text (AES-256-GCM)
  ├── keyVersion: integer
  ├── status: connected | expired | rate_limited | errored
  └── expiresAt: timestamp
```

### WebhookRoutingRule

Rules for dispatching incoming webhooks to agents.

```
WebhookRoutingRule
  ├── id: UUID
  ├── connectionId: UUID (logical FK → ToolConnection)
  ├── eventType: string
  ├── condition: JSONB
  ├── targetAgentId: UUID
  └── enabled: boolean
```

## Relationships

```
Objective ──1:N──> Execution ──1:N──> Bot ──1:1──> BotSoul
                                  │            │
                                  │            └──> parentSoulId (lineage chain)
                                  │
                                  ├──1:N──> CouncilVerdict
                                  └──1:1──> AgentClass (per task category)

AgentClass ──triggers──> CouncilVerdict ──confirmed──> God Layer
                                                          │
                                                          ├── Class transition
                                                          ├── DnaStore write
                                                          └── Negative signal update

User ──1:N──> ToolConnection ──1:N──> WebhookRoutingRule
                    │
                    └── ToolInvocationLog (audit trail)
```

## Logical Foreign Keys

Several tables use logical foreign keys (no SQL `REFERENCES` constraint) to avoid circular TypeScript inference at module load time. This is intentional:

- `bots.soulId` → `bot_souls.id`
- `bots.paperclipAgentId` → Paperclip `agents.id`
- `council_verdicts.soulId` → `bot_souls.id`
- `webhook_routing_rules.connectionId` → `tool_connections.id`

## Category Benchmarks

Pioneer events (first agent to achieve a category benchmark) instantiate baseline scores. Benchmarks mature after 3+ confirmed runs. Thin-data flags indicate insufficient evaluation history.

## Evolution Flow

```
Spawn → Execute → Score → Council (3 judges) → Verdict
    → Human Confirmation (Promote/Retire only)
    → God Layer: class transition + DNA capture + negative signals
    → Mutate soul for next generation
```
