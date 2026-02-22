# Technology Stack — SOUL System v2.0

**Project:** Claw Army — SOUL System milestone
**Researched:** 2026-02-21
**Scope:** Stack ADDITIONS and changes only. The existing validated stack (Node.js/Fastify, SvelteKit/Svelte 5, PostgreSQL/Drizzle 0.45.1, BullMQ 5.69.x/Redis, Pub/Sub, Auth.js v5, Vercel AI SDK `ai ^6.0.90`, `ws ^8.18.0`) is not re-evaluated here.

---

## Summary

Four new capability domains require evaluation:

1. **Embedding + soul differentiation** — generate embeddings, enforce pairwise uniqueness across the soul population
2. **OpenClaw WebSocket integration** — extend the existing client for soul-aware task dispatch
3. **LLM-as-judge orchestration** — parallel Council evaluation (Performance Judge, Soul Analyst, Devil's Advocate)
4. **DNA schema extensions** — mutation lineage, directive activation maps, causal attribution

**Net new packages: 1.** Only `pgvector` (npm) needs to be added to `@claw/db`. Everything else uses what is already installed. No vector database. No orchestration framework. No embedding library.

---

## Embedding / Similarity

### Recommendation: Vercel AI SDK `embed()` + `text-embedding-3-small` + inline cosine similarity function

**Why this combination:**

The existing `@ai-sdk/openai ^3.0.29` provider already includes the `.embedding()` factory. The `embed()` function from `ai ^6.0.90` is already importable. Zero new packages needed for embedding generation.

`text-embedding-3-small` is the correct model at this scale:
- 1,536 dimensions (can be reduced to 512 via `providerOptions.openai.dimensions` without significant quality loss)
- 8,191 token context window — well above any SOUL.md document
- $0.02 / 1M tokens (Batch API: $0.01 / 1M tokens)
- Embedding 7 SOUL.md documents at ~1,000 tokens each costs approximately $0.00014 — negligible

Source: OpenAI model page (MEDIUM confidence — page returned 403 but pricing confirmed via Helicone calculator cross-reference and OpenAI community posts).

**Cosine similarity — no library:**

OpenAI embeddings are normalized to unit length, making cosine similarity equivalent to a dot product. A 10-line pure TypeScript function is more maintainable than any npm dependency at a population of 3–7 souls. The most popular alternatives (`compute-cosine-similarity`, `fast-cosine-similarity`, `cosinity`) add package surface area for a function that is simpler to own directly.

```typescript
// Add to packages/shared-types/src/utils/cosine-similarity.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Soul Differentiation Enforcement:
// Reject any soul whose embedding has cosine similarity > 0.85
// with ANY existing active soul in the population.
export const SOUL_SIMILARITY_REJECTION_THRESHOLD = 0.85;
```

**Threshold rationale (MEDIUM confidence — based on community guidance, not empirical testing against SOUL.md corpus):**
- `> 0.90` is used for near-duplicate detection; would allow too much behavioral overlap between souls
- `> 0.85` catches meaningful semantic overlap while allowing souls to share a domain
- This constant must be tunable — expose it as a config value so it can be tightened post-observation

**Embedding API call (using existing SDK):**

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: soulMarkdownText,
  // Optional dimension reduction — only enable if storage becomes a concern:
  // providerOptions: { openai: { dimensions: 512 } }
});
// embedding: number[]  (length 1536)
```

Source: [AI SDK OpenAI Provider docs](https://ai-sdk.dev/providers/ai-sdk-providers/openai) — HIGH confidence.

**Storage — pgvector in existing PostgreSQL:**

Store soul embeddings in the existing Cloud SQL PostgreSQL instance using the pgvector extension. Drizzle ORM has first-party `vector()` column support built into `drizzle-orm/pg-core` — no adapter package needed.

**New package required in `@claw/db`:**

```bash
pnpm --filter @claw/db add pgvector
```

`pgvector` npm: version `^0.2.0` — typed vector helpers for node-postgres. Used for serializing/deserializing vector arrays from PostgreSQL. The Drizzle `vector()` column handles the DDL; `pgvector` handles the wire format. Weekly downloads ~99K, actively maintained (last release May 2025).

Source: [pgvector-node GitHub](https://github.com/pgvector/pgvector-node), [Drizzle pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) — HIGH confidence.

**Prerequisite migration step:**

```sql
-- Must run manually before Drizzle migration; Drizzle-kit does NOT auto-enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
```

Confirm pgvector is available on the Cloud SQL instance with `\dx` before running migrations.

---

## OpenClaw Integration

### Recommendation: Extend existing `openclaw-client.ts` — no new packages

`ws ^8.18.0` and `@types/ws ^8.5.13` are already installed. The existing `OpenClawClient` class in `services/execution-service/src/orchestrator/openclaw-client.ts` already handles connect/reconnect (3 attempts, 2s delay, 10s timeout), message routing, and callback management.

**Critical finding — protocol verification gap:**

Research into the live OpenClaw gateway protocol shows the actual framing is JSON-RPC style:

```json
// Request frame
{ "type": "req", "id": "uuid", "method": "method.name", "params": { ... } }

// Response frame
{ "type": "res", "id": "uuid", "ok": true, "payload": { ... } }

// Event frame
{ "type": "event", "event": "event.name", "payload": { ... }, "seq": 42 }
```

The current implementation uses `type: "run_task"` / `type: "task_complete"` / `type: "task_failed"` which the existing code itself flags as unverified ("NOTE: The exact OpenClaw sessions API message schema is pending verification"). The real agent invocation methods appear to be `agent.send` or `agent.execute` (referenced in OpenClaw DeepWiki source mappings), but this could not be confirmed from public documentation.

**BLOCKER (LOW confidence on exact method names):** The OpenClaw WebSocket task dispatch protocol must be verified against a running instance before the SOUL System ships. The soul context injection approach depends on which field carries the task prompt.

**Extensions needed on `openclaw-client.ts` for SOUL System:**

1. **Soul context injection** — `sendTask()` must accept an optional `soulContext` parameter. Until the protocol is verified, inject soul context by prepending to the prompt payload:

```typescript
async sendTask(taskDescription: string, soulContext?: string): Promise<string> {
  const effectivePrompt = soulContext
    ? `[SOUL CONSTITUTION]\n${soulContext}\n\n[TASK]\n${taskDescription}`
    : taskDescription;
  // ... existing send logic using effectivePrompt
}
```

2. **Event streaming for Council** — The Council needs to observe task events during execution, not just terminal states. Extend `handleMessage()` to emit typed events on a `EventEmitter` or expose an `onEvent` callback, rather than only firing on `task_complete` / `task_failed`.

3. **Idempotency key** — OpenClaw's protocol requires idempotency keys for side-effecting operations. Add this field to outbound messages once the method name is confirmed.

**No new packages.** `ws` handles everything.

---

## LLM-as-Judge (Council Orchestration)

### Recommendation: Vercel AI SDK `generateObject()` + `Promise.all()` — no new packages or frameworks

`ai ^6.0.90` already provides `generateObject()` with Zod schema support. `zod ^4.3.6` is already installed. This is the complete stack for the Council. LangChain, LangGraph, LlamaIndex are explicitly not needed — they add abstraction complexity for three parallel function calls.

Source: [AI SDK generateObject reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) — HIGH confidence.

**Council architecture — three parallel judge calls:**

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const JudgeOutputSchema = z.object({
  score: z.number().min(0).max(10),
  rationale: z.string(),
  specificFindings: z.array(z.string()),
  recommendation: z.enum(['promote', 'maintain', 'demote', 'mutate']),
});

const DevilsAdvocateSchema = z.object({
  challengePoints: z.array(z.string()),
  counterEvidence: z.array(z.string()),
  revisedRecommendation: z.enum(['promote', 'maintain', 'demote', 'mutate']).optional(),
});

async function runCouncil(botId: string, executionSummary: string, soulMd: string) {
  // Three judges run in parallel — reduces latency by ~2/3 vs sequential
  const [performanceJudge, soulAnalyst, devilsAdvocate] = await Promise.all([
    generateObject({
      model: openai('gpt-4o'),
      schema: JudgeOutputSchema,
      system: PERFORMANCE_JUDGE_SYSTEM_PROMPT,
      prompt: `Bot: ${botId}\n\nExecution summary:\n${executionSummary}`,
    }),
    generateObject({
      model: openai('gpt-4o'),
      schema: JudgeOutputSchema,
      system: SOUL_ANALYST_SYSTEM_PROMPT,
      prompt: `Soul Constitution:\n${soulMd}\n\nExecution:\n${executionSummary}`,
    }),
    generateObject({
      model: openai('gpt-4o'),
      schema: DevilsAdvocateSchema,
      system: DEVILS_ADVOCATE_SYSTEM_PROMPT,
      // Devil's Advocate sees raw execution data, NOT the other judges' outputs
      // — prevents anchoring bias
      prompt: executionSummary,
    }),
  ]);

  return {
    performanceScore: performanceJudge.object,
    soulAlignment: soulAnalyst.object,
    challenges: devilsAdvocate.object,
  };
}
```

**Model choice:** Use `gpt-4o` for all three judges. Reasoning quality matters more than cost at 3–7 soul populations. Each council run costs $0.01–$0.05 depending on context length — acceptable. Do not use `gpt-4o-mini` for the Council; the Devil's Advocate role in particular requires genuine adversarial reasoning capability.

**BullMQ rate limiting:** At `concurrency=20` bots, three parallel `gpt-4o` calls per evaluation creates 60 simultaneous LLM calls per council sweep. BullMQ's built-in `limiter: { max: N, duration: Ms }` on the council queue prevents OpenAI TPM limit violations. The existing BullMQ installation supports this natively.

**God Layer (mutation engine):** Receives all three judge outputs as a single structured payload and synthesizes the final mutation directive. This is a fourth `generateObject()` call, run sequentially after the council completes (it depends on their outputs).

---

## DNA Schema Extensions

### Recommendation: Extend `dna_store` + add `soul_mutations` and `souls` tables

The existing `dna_store` table (`packages/db/src/schema/dna-store.ts`) has the correct foundation: `dna_payload JSONB`, `version INTEGER`, `objective_category VARCHAR`. Extend it in place rather than creating a parallel table.

Source: Verified against existing schema file — HIGH confidence.

**Extension 1: New columns on `dna_store`**

```typescript
// Add these columns to the existing dnaStore table definition in dna-store.ts
// (requires a Drizzle migration)

import { jsonb, boolean, text } from 'drizzle-orm/pg-core';

{
  // NEW: Which SOUL.md directives were active during this execution
  // key = directive identifier, value = was this directive triggered
  directiveActivationMap: jsonb('directive_activation_map')
    .$type<Record<string, boolean>>()
    .notNull()
    .default(sql`'{}'::jsonb`),

  // NEW: Causal attribution — which DNA traits drove which outcomes
  causalAttribution: jsonb('causal_attribution')
    .$type<CausalAttributionPayload>()
    .default(null),

  // NEW: Link to the parent DNA version this was mutated from (null = genesis)
  parentDnaId: uuid('parent_dna_id'),

  // NEW: Whether the God Layer selected this version as fit
  isSelected: boolean('is_selected').notNull().default(false),

  // NEW: Council verdict stored for audit trail
  councilVerdict: jsonb('council_verdict')
    .$type<CouncilVerdictPayload>()
    .default(null),
}

// TypeScript interfaces for JSONB payloads — add to DnaPayload or alongside it:
export interface CausalAttributionPayload {
  traitImpacts: Array<{
    traitKey: string;           // e.g. "retryStrategy.maxRetries"
    direction: 'positive' | 'negative' | 'neutral';
    confidenceScore: number;    // 0.0–1.0
    evidenceSnippets: string[]; // quotes from execution log
  }>;
}

export interface CouncilVerdictPayload {
  performanceScore: number;    // 0–10
  soulAlignmentScore: number;  // 0–10
  challenges: string[];
  finalRecommendation: 'promote' | 'maintain' | 'demote' | 'mutate';
  councilRunAt: string;        // ISO timestamp
}
```

**Extension 2: New `soul_mutations` table (mutation lineage)**

```typescript
// packages/db/src/schema/soul-mutations.ts
export const soulMutations = pgTable(
  'soul_mutations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    parentDnaId: uuid('parent_dna_id'),              // null = genesis
    childDnaId: uuid('child_dna_id').notNull(),       // FK → dna_store.id
    mutationType: varchar('mutation_type', { length: 64 }).notNull(),
    // 'directive_add' | 'directive_remove' | 'directive_modify' | 'full_rewrite'
    mutationDiff: jsonb('mutation_diff').$type<MutationDiff>().notNull(),
    godLayerRationale: text('god_layer_rationale'),  // LLM-generated synthesis
    fitnessScoreBefore: numeric('fitness_score_before', { precision: 5, scale: 2 }),
    fitnessScoreAfter: numeric('fitness_score_after', { precision: 5, scale: 2 }),
    mutatedAt: timestamp('mutated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('soul_mutations_bot_id_idx').on(t.botId),
    index('soul_mutations_parent_dna_id_idx').on(t.parentDnaId),
    index('soul_mutations_mutated_at_idx').on(t.mutatedAt),
  ]
);

export interface MutationDiff {
  removedDirectives: string[];
  addedDirectives: string[];
  modifiedDirectives: Array<{
    directiveKey: string;
    before: string;
    after: string;
  }>;
}
```

**Extension 3: New `souls` table (SOUL.md constitution storage)**

```typescript
// packages/db/src/schema/souls.ts
export const souls = pgTable(
  'souls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    version: integer('version').notNull().default(1),
    soulMarkdown: text('soul_markdown').notNull(),     // Full SOUL.md content
    isActive: boolean('is_active').notNull().default(true),
    embeddingCaptured: boolean('embedding_captured').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('souls_bot_id_idx').on(t.botId),
    index('souls_bot_id_version_idx').on(t.botId, t.version),
    index('souls_is_active_idx').on(t.isActive),
  ]
);
```

**Extension 4: New `soul_embeddings` table (vector store)**

```typescript
// packages/db/src/schema/soul-embeddings.ts
import { vector } from 'drizzle-orm/pg-core';

export const soulEmbeddings = pgTable(
  'soul_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    soulVersion: integer('soul_version').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    capturedAt: timestamp('captured_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('soul_embeddings_bot_id_idx').on(t.botId),
    // HNSW index — unnecessary at 3–7 souls but costs nothing and supports growth
    index('soul_embeddings_hnsw_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ]
);
```

**Ancestry queries:** The `parentDnaId` self-referential pattern on `soul_mutations` supports recursive CTE queries for full lineage trees. SQL handles this without a graph database.

```sql
-- Example: Full mutation ancestry for a bot
WITH RECURSIVE lineage AS (
  SELECT id, bot_id, parent_dna_id, child_dna_id, mutation_type, mutated_at, 0 AS depth
  FROM soul_mutations
  WHERE bot_id = $1 AND parent_dna_id IS NULL  -- start from genesis
  UNION ALL
  SELECT m.id, m.bot_id, m.parent_dna_id, m.child_dna_id, m.mutation_type, m.mutated_at, l.depth + 1
  FROM soul_mutations m
  JOIN lineage l ON m.parent_dna_id = l.child_dna_id
)
SELECT * FROM lineage ORDER BY depth;
```

---

## What NOT to Add

| Category | Rejected Option | Reason |
|----------|----------------|--------|
| Vector database | Pinecone, Weaviate, Qdrant, Milvus | Overkill for 3–7 soul populations. pgvector in the existing PostgreSQL instance is sufficient indefinitely until population reaches thousands. Adds a new managed service with zero benefit at this scale. |
| Embedding library | `compute-cosine-similarity`, `fast-cosine-similarity`, `cosinity` | A 10-line pure function is more maintainable than a package dependency. No license risk, no update burden, no transitive deps. |
| Orchestration framework | LangChain.js, LangGraph.js, LlamaIndex.TS | The Council is 3 parallel `generateObject()` calls. These frameworks add ~50-200KB bundle weight and abstraction layers for zero benefit at this call volume. They also impose their own async patterns that conflict with the existing Fastify + BullMQ architecture. |
| Local embedding model | Ollama + `nomic-embed-text` | Embedding 7 souls costs fractions of a cent via OpenAI API. Local models add GPU/CPU deployment complexity on the GCE VM, require model download at startup, and reduce reproducibility. Not worth it at this scale. |
| Separate job scheduler | Temporal, Inngest, cron | BullMQ 5 already installed and supports delayed, repeatable, and rate-limited jobs natively. No new infrastructure. |
| Graph database | Neo4j, ArangoDB | The `soul_mutations` table with `parentDnaId` FK gives a self-referential tree. SQL recursive CTEs handle ancestry queries up to dozens of generations. Not a use case that warrants a graph database. |
| Evaluation platform | Langfuse, Braintrust, Evidently | The Council IS the evaluation layer. A third-party eval platform would add vendor dependency for what is core product logic. Log council verdicts to the existing `dna_store.councilVerdict` JSONB column. |

---

## Versions Reference

| Package | Current in Repo | Action | Notes |
|---------|-----------------|--------|-------|
| `ai` | `^6.0.90` | No change | `embed()` and `generateObject()` already available |
| `@ai-sdk/openai` | `^3.0.29` | No change | `.embedding('text-embedding-3-small')` works |
| `ws` | `^8.18.0` | No change | OpenClaw client already uses this |
| `@types/ws` | `^8.5.13` | No change | Already installed |
| `zod` | `^4.3.6` | No change | Use for judge output schemas |
| `drizzle-orm` | `0.45.1` | No change | `vector()` column type is built in |
| `drizzle-kit` | `0.31.9` | No change | Generates migrations for new tables |
| `pgvector` | NOT INSTALLED | **ADD to `@claw/db`** | `^0.2.0` — wire-format helpers for pg + Drizzle |

**Install command:**

```bash
pnpm --filter @claw/db add pgvector
```

---

## Integration Points with Existing Stack

| New Capability | Integrates With | Integration Pattern |
|----------------|----------------|---------------------|
| Soul embedding generation | `bot-orchestrator.ts` → bot ready path | Embed SOUL.md after bot reaches `idle` state; store in `soul_embeddings`; set `souls.embeddingCaptured = true` |
| Soul differentiation check | `bot-orchestrator.ts` → spawn path | Before activating new soul, fetch all active bot embeddings, compute pairwise cosine similarity; reject if any pair > 0.85 threshold |
| Council evaluation | `performance-engine.ts` → post-execution | `Promise.all([judgeA, judgeB, judgeC])` after each execution; result saved to `dna_store.councilVerdict` |
| God Layer mutation | BullMQ delayed job | Triggered by council verdict; runs after council; writes to `soul_mutations` and new `souls` version |
| DNA mutation lineage | `dna-capture.ts` | On each DNA capture, set `parentDnaId` from previous version; insert row into `soul_mutations` |
| OpenClaw soul context | `openclaw-client.ts` → `sendTask()` | Append soul context to task prompt; no new OpenClaw protocol changes needed |
| Rate limiting council | Existing BullMQ | Dedicated council queue with `limiter: { max: 10, duration: 60000 }` to avoid OpenAI TPM limits |

---

## Open Questions (Require Verification Before Shipping)

1. **OpenClaw actual task dispatch protocol** — The `run_task` / `task_complete` types in `openclaw-client.ts` are explicitly flagged as unverified placeholders. The real protocol uses `{ type: "req", method: "agent.send" | "agent.execute", ... }` framing, but the exact method name and params structure could not be confirmed from public docs. Must verify against a live OpenClaw instance on `claw-app-dev`. This is a BLOCKER for soul context injection correctness.

2. **pgvector extension on Cloud SQL** — Cloud SQL for PostgreSQL supports pgvector, but the extension must be enabled on the `claw-army` database. Confirm availability with `\dx` in psql. If not available, it may require a Cloud SQL flag change or instance version upgrade.

3. **Council cost at concurrency=20** — Three parallel `gpt-4o` calls per execution evaluation × 20 concurrent bots = up to 60 simultaneous LLM calls. Measure actual TPM consumption in staging before enabling in production. May need to reduce council queue concurrency below 20.

4. **Soul embedding dimension sizing** — 1,536 dimensions = ~6KB per embedding. For 7 bots × 10 soul versions = 420KB — negligible. Dimension reduction to 512 is available but not needed until population scales to thousands of souls.

5. **SOUL.md token length** — If SOUL.md documents exceed 8,191 tokens (the `text-embedding-3-small` context window), they must be truncated or chunked before embedding. Document a maximum SOUL.md size constraint.

---

## Sources

- [Vercel AI SDK — OpenAI Provider (embed, embedding models)](https://ai-sdk.dev/providers/ai-sdk-providers/openai) — HIGH confidence
- [Vercel AI SDK — generateObject reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) — HIGH confidence
- [OpenAI text-embedding-3-small pricing — Helicone calculator](https://www.helicone.ai/llm-cost/provider/openai/model/text-embedding-3-small) — MEDIUM confidence (pricing cross-referenced with community posts)
- [Drizzle ORM — Vector similarity search with pgvector](https://orm.drizzle.team/docs/guides/vector-similarity-search) — HIGH confidence
- [Drizzle ORM — PostgreSQL column types (JSONB, vector)](https://orm.drizzle.team/docs/column-types/pg) — HIGH confidence
- [pgvector-node GitHub](https://github.com/pgvector/pgvector-node) — HIGH confidence
- [OpenClaw Gateway Protocol docs](https://docs.openclaw.ai/gateway/protocol) — MEDIUM confidence (JSON-RPC framing confirmed; specific task method names not fully documented publicly)
- [OpenClaw DeepWiki — Agent Commands](https://deepwiki.com/openclaw/openclaw/12.2-agent-commands) — LOW confidence (method names inferred from source file references, not confirmed in live docs)
- [Cosine similarity threshold guidance — OpenAI Community](https://community.openai.com/t/rule-of-thumb-cosine-similarity-thresholds/693670) — MEDIUM confidence
- [BullMQ rate limiting](https://docs.bullmq.io/guide/rate-limiting) — HIGH confidence
- Codebase review: `services/execution-service/package.json`, `packages/db/package.json`, `packages/db/src/schema/dna-store.ts`, `services/execution-service/src/orchestrator/openclaw-client.ts` — HIGH confidence (authoritative source of truth for what is currently installed)
