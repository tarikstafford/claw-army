# Phase 13: God Layer and Agent Class System - Research

**Researched:** 2026-02-22
**Domain:** BullMQ worker orchestration, Redis distributed locks (ioredis), Drizzle ORM atomic writes, agent class state machine, DNA library versioning, pioneer benchmark system
**Confidence:** HIGH

---

## Summary

Phase 13 is the evolutionary loop closer. The God Layer BullMQ worker consumes confirmed verdicts from `council_verdicts` and executes three atomic outcomes: (1) write a versioned DNA Library entry to `dna_store`, (2) execute class transitions on a new `agent_classes` table (per bot, per task category), and (3) write retirement/below-benchmark runs to `negative_signal_register.mutationBlacklist`. The worker reads only verdicts with `status = 'confirmed'` OR `requiresHumanConfirmation = false` — the human gate from Phase 12 is a read-time pre-condition, not a queue barrier.

The primary new complexity is the **agent class state machine** (Novice → Understudy → Artisan with demotion and retirement paths) tracked per `(botId, taskCategory)` tuple. This requires a new `agent_classes` table (new Drizzle migration `0007`). The **Pioneer system** is the other novel element: when a bot is the first confirmed run in a task category, it instantiates a benchmark and receives permanent Pioneer designation. The benchmark matures after 3 confirmed comparable runs, gating promotion until data is sufficient. Pioneer state also needs a new table or columns on `agent_classes`.

The Redis lock requirement (GODL-07) uses `ioredis` directly — already available in the execution service via `ioredis ^5.9.3`. The pattern is `SET key value NX EX ttl` for acquiring an exclusive lock on `soul-library:{taskCategory}` during a campaign, with the God Layer reading only the `bot_souls` snapshot recorded at execution start (already in `bots.soulId` / `botSouls.executionId`).

The `dna_store` table already has `parentSoulIds uuid[]`, `mutationLineage jsonb`, and `soulId uuid` columns added in migration 0003 — the versioned DNA write is mostly a matter of computing the new version number (max existing version for `(objectiveCategory, soulId)` + 1) and inserting with correct lineage data. The `dnaPayload` JSONB needs to expand to hold the full SOUL.md content and the council verdict summary — the existing `DnaPayload` interface in `dna-store.ts` must be extended or the schema updated to accommodate GODL-02 requirements.

**Primary recommendation:** Implement the God Layer as a dedicated BullMQ Worker on a new `soul-verdicts` queue (mirroring the existing `council-queue` pattern). Add one Drizzle migration (`0007`) for `agent_classes` and `category_benchmarks` tables. Extend `DnaPayload` to include the required GODL-02 fields. Use ioredis `SET NX EX` for the category soul library lock.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bullmq` | `^5.69.3` (installed) | `soul-verdicts` BullMQ Worker for God Layer | Already used for `claw-tasks` and `council-queue`; same Redis connection |
| `drizzle-orm` | `^0.45.1` (installed) | Atomic updates to `agent_classes`, inserts to `dna_store`, `negative_signal_register` | Project standard ORM; `db.transaction()` for atomicity |
| `@claw/db` | `workspace:*` (installed) | All schema tables needed by God Layer | Already exports all required tables |
| `ioredis` | `^5.9.3` (installed) | Redis lock: `SET soul-library:{category} godlayer NX EX 300` | Already used in `execution.service.ts` for budget keys; direct IORedis instance |
| `zod` | `^4.3.6` (installed) | Validate job data shape | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` `db.transaction()` | built-in | Wrap class transition + DNA write + negative register in single atomic operation | Required for GODL-01 atomicity guarantee |
| `drizzle-orm` `max()` aggregate | built-in | Compute next version number: `SELECT MAX(version) FROM dna_store WHERE objectiveCategory = ? AND soulId = ?` | Needed for GODL-03 versioned writes |
| `drizzle-orm` `sql\`...\`` | built-in | `SELECT ... FOR UPDATE SKIP LOCKED` if needed for advisory locks | Fallback if Redis lock coordination is impractical; not primary approach |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ Worker on new `soul-verdicts` queue | Polling loop inside existing council worker | Separate queue gives independent concurrency, retry, and rate control — essential since God Layer writes are DB-heavy, not LLM-heavy |
| ioredis `SET NX EX` for category lock | `pg_advisory_lock` | Postgres advisory locks are connection-scoped and don't work across Fastify worker threads; Redis is the right choice |
| New `agent_classes` table | Adding class columns to `bots` table | `bots` is per-execution; class is per-(bot, category) across executions — needs its own table to survive bot VM lifecycle |
| Extending `DnaPayload` interface | New `dnaLibraryEntry` JSONB column on `dna_store` | Extending the existing `dnaPayload` JSONB is cleaner; no schema column change required if we update the TypeScript interface only |

**Installation:** No new packages needed. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
services/execution-service/src/
├── queue/
│   ├── god-layer-queue.ts       # NEW: god-layer BullMQ queue definition + job data type
│   └── god-layer-worker.ts      # NEW: BullMQ Worker processor (class transition, DNA write, neg register)
├── god-layer/
│   ├── class-machine.ts         # NEW: agent class state machine (promotion, demotion, retirement)
│   ├── dna-writer.ts            # NEW: versioned DNA Library write logic
│   ├── pioneer-tracker.ts       # NEW: pioneer event detection + benchmark management
│   └── negative-register.ts     # NEW: negative signal register write + blacklist computation
└── main.ts                      # MODIFY: start god-layer worker alongside council worker

packages/db/src/
├── schema/
│   ├── agent-classes.ts         # NEW: agent_classes table (per-bot, per-category class tracking)
│   └── category-benchmarks.ts  # NEW: category_benchmarks table (pioneer benchmarks)
└── migrations/
    └── 0007_god_layer_schema.sql # NEW: CREATE agent_classes, category_benchmarks; ALTER dna_store
```

### Pattern 1: God Layer Queue (mirrors council-queue.ts)

**What:** A new BullMQ queue `soul-verdicts` with a separate Worker. The God Layer worker is triggered by enqueuing a job whenever a council verdict is confirmed (via the `/verdicts/:id/confirm` route) OR after council processing for auto-execute verdicts (Maintain/Monitor/Demote).

**When to trigger enqueue:** Two sources:
1. `POST /verdicts/:verdictId/confirm` in `verdicts.ts` — immediately after the DB update succeeds, fire-and-forget enqueue a `soul-verdicts` job.
2. Inside `council-worker.ts` councilProcessor — after inserting the verdict, if `requiresHumanConfirmation = false` and verdictType is Maintain/Monitor/Demote, enqueue the God Layer job immediately (fire-and-forget).

```typescript
// services/execution-service/src/queue/god-layer-queue.ts
import { Queue } from 'bullmq';
import { queueConnection } from './task-queue';

export const GOD_LAYER_QUEUE_NAME = 'soul-verdicts';

export interface GodLayerJobData {
  verdictId: string;    // council_verdicts.id
  executionId: string;
  botId: string;
  soulId: string | null;
  taskCategory: string | null;
}

export const godLayerQueue = new Queue<GodLayerJobData>(GOD_LAYER_QUEUE_NAME, {
  connection: queueConnection,
});
```

### Pattern 2: Agent Class State Machine

**What:** Agent classes (Novice, Understudy, Artisan) are tracked in `agent_classes` table keyed on `(botId, taskCategory)`. The state machine is implemented as a pure function that computes the next class and any transition type given the current class, the new verdict, and the accumulated history.

**CLAS-01 through CLAS-06 threshold summary:**

| Transition | Trigger |
|-----------|---------|
| Novice → Understudy | ≥2 confirmed above-benchmark runs, ≥1 human confirmation, council confidence >0.65, no unresolved DA args above threshold |
| Understudy → Artisan | ≥5 confirmed above-benchmark (≤1 below in window), multiple human confirmations, confidence >0.80, causal attribution confirms soul directives primary; triggers notification |
| Demotion | 2 consecutive below-benchmark, confidence >0.70, Soul Analyst confirms soul-driven (not context-driven) |
| Retirement | Confirmed demotion + 2 further below-benchmark, OR catastrophic failure; soul permanently preserved |

**Key insight:** The state machine needs to count qualifying runs against the benchmark. The `agent_classes` table must carry sufficient counters to evaluate thresholds without a full history scan on every verdict. Design the table to store accumulated counts: `aboveBenchmarkCount`, `belowBenchmarkCount`, `humanConfirmationCount`, `consecutiveBelowCount`.

```typescript
// class-machine.ts — pure function, no DB I/O
export interface ClassState {
  currentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired';
  aboveBenchmarkCount: number;
  belowBenchmarkCount: number;
  humanConfirmationCount: number;
  consecutiveBelowCount: number;
}

export type ClassTransition =
  | { type: 'promote'; from: 'Novice'; to: 'Understudy' }
  | { type: 'promote'; from: 'Understudy'; to: 'Artisan' }
  | { type: 'demote'; from: 'Understudy' | 'Artisan'; to: 'Novice' }
  | { type: 'retire' }
  | { type: 'none' };

export function computeClassTransition(
  state: ClassState,
  verdict: {
    verdictType: 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';
    confidence: number;
    hasHumanConfirmation: boolean;
    isAboveBenchmark: boolean;
    isSoulDriven: boolean;         // from soulAnalystOutput
    hasUnresolvedDA: boolean;
    benchmarkMature: boolean;      // false if pioneer thin-data period
  },
): { newState: ClassState; transition: ClassTransition }
```

### Pattern 3: Versioned DNA Library Write (GODL-02, GODL-03)

**What:** Each write to `dna_store` creates a new row with `version = maxExistingVersion + 1`. Never UPDATE an existing row. Lineage is tracked via `parentSoulIds` (existing `uuid[]` column) and `mutationLineage` (existing `jsonb` column).

**Extended DnaPayload for GODL-02:** The current `DnaPayload` interface in `dna-store.ts` covers raw performance data (tool sequences, retry strategy, etc.) but does NOT cover the full SOUL.md content, council verdict summary, agent class at write time, or causal attribution report. The `dnaPayload` JSONB must hold all of these. Options:
1. **Extend the `DnaPayload` TypeScript interface** — add the missing fields to the interface. No migration needed since JSONB can hold arbitrary fields already. This is the preferred approach.
2. Add discrete columns (soulContent TEXT, verdictSummary TEXT, agentClass VARCHAR) — requires a schema migration.

**Recommendation:** Extend `DnaPayload` in TypeScript only (no new SQL columns). The GODL-02 required fields fold naturally into the existing JSONB payload.

```typescript
// packages/db/src/schema/dna-store.ts — extended interface
export interface DnaPayload {
  // Existing fields
  systemPromptTemplate: string;
  toolCallSequence: string[];
  argumentPatterns: Record<string, unknown>;
  retryStrategy: Record<string, unknown>;
  timingProfile: Record<string, unknown>;
  tokenDistribution: Record<string, unknown>;
  // GODL-02 additions
  soulContent: string;                    // full SOUL.md at time of write
  taskCategory: string;                   // from bot_souls.taskCategory
  agentClassAtWrite: string;              // Novice | Understudy | Artisan
  compositeFitnessScore: number;          // bots.compositeScore at time of verdict
  fitnessDimensionBreakdown: Record<string, number>; // from soulAnalystOutput
  causalAttributionSummary: string;       // from soulAnalystOutput summary
  councilVerdictSummary: string;          // council_verdicts.verdictSummary
  councilConfidenceScores: {
    performance: number;
    soulAnalyst: number;
    devilsAdvocate: number;
    weighted: number;
  };
  humanConfirmationTimestamp: string | null; // council_verdicts.confirmedAt ISO string
  mutationLineageOps: string[];           // operations applied from parent (from bot_souls lineage)
  isPioneer: boolean;                     // GODL-06
}
```

**Versioned insert pattern:**

```typescript
// dna-writer.ts
import { db, dnaStore } from '@claw/db';
import { eq, and, max } from 'drizzle-orm';

async function getNextVersion(objectiveCategory: string, soulId: string): Promise<number> {
  const result = await db
    .select({ maxVersion: max(dnaStore.version) })
    .from(dnaStore)
    .where(
      and(
        eq(dnaStore.objectiveCategory, objectiveCategory),
        eq(dnaStore.soulId, soulId),
      ),
    );
  return (result[0]?.maxVersion ?? 0) + 1;
}
```

### Pattern 4: Redis Category Soul Library Lock (GODL-07)

**What:** Before the God Layer processes any verdict for a given `taskCategory`, it acquires a Redis lock on `soul-library:{taskCategory}`. This ensures mid-run library mutations (new souls being written by a concurrent execution) do not contaminate the God Layer's view of the library during an active campaign.

**Lock acquisition:** Use `ioredis SET key value NX EX ttl`. The God Layer reads the `bot_souls` snapshot from `bots.soulId` (recorded at dispatch time) — it does NOT re-query the live soul library. The lock only prevents concurrent God Layer instances from racing on the same category.

```typescript
// In god-layer-worker.ts
import IORedis from 'ioredis';
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const LOCK_TTL_SECONDS = 300; // 5 minutes — cover full God Layer job duration
const LOCK_RETRY_DELAY_MS = 500;
const LOCK_MAX_RETRIES = 20;

async function acquireCategoryLock(category: string, jobId: string): Promise<boolean> {
  const key = `soul-library:${category}`;
  const result = await redis.set(key, jobId, 'NX', 'EX', LOCK_TTL_SECONDS);
  return result === 'OK';
}

async function releaseCategoryLock(category: string, jobId: string): Promise<void> {
  // Only release if we own the lock (check value matches jobId)
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `soul-library:${category}`, jobId);
}
```

**Lock contention handling:** If lock acquisition fails after max retries, fail the BullMQ job (throw an error) so BullMQ retries it with exponential backoff. This is preferable to in-process spin-wait.

### Pattern 5: Pioneer Event Detection (GODL-06, CLAS-06)

**What:** A "pioneer event" occurs when a bot is the first confirmed run in a `taskCategory`. Need a `category_benchmarks` table to track: whether a benchmark exists, how many confirmed comparable runs have been recorded, and whether the thin-data flag has been lifted.

**Benchmark schema:**

```typescript
// packages/db/src/schema/category-benchmarks.ts
export const categoryBenchmarks = pgTable('category_benchmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskCategory: varchar('task_category', { length: 255 }).notNull().unique(),
  pioneerBotId: uuid('pioneer_bot_id').notNull(),          // first confirmed bot
  pioneerSoulId: uuid('pioneer_soul_id'),                  // soul at pioneer run
  pioneerExecutionId: uuid('pioneer_execution_id').notNull(),
  baselineCompositeScore: numeric('baseline_composite_score', { precision: 5, scale: 2 }).notNull(),
  confirmedRunCount: integer('confirmed_run_count').notNull().default(1),
  thinDataFlag: boolean('thin_data_flag').notNull().default(true),  // removed after 5 runs
  benchmarkMature: boolean('benchmark_mature').notNull().default(false), // true after 3 runs
  standardPromotion: boolean('standard_promotion').notNull().default(false), // true after 3 runs
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});
```

**Pioneer detection logic:**

```typescript
// pioneer-tracker.ts
async function detectPioneer(taskCategory: string, botId: string, executionId: string, compositeScore: number) {
  const existing = await db
    .select({ id: categoryBenchmarks.id, confirmedRunCount: categoryBenchmarks.confirmedRunCount })
    .from(categoryBenchmarks)
    .where(eq(categoryBenchmarks.taskCategory, taskCategory));

  if (existing.length === 0) {
    // First confirmed run — insert pioneer benchmark
    await db.insert(categoryBenchmarks).values({
      taskCategory,
      pioneerBotId: botId,
      pioneerExecutionId: executionId,
      baselineCompositeScore: compositeScore.toFixed(2),
      confirmedRunCount: 1,
      thinDataFlag: true,
      benchmarkMature: false,
      standardPromotion: false,
    });
    return { isPioneer: true };
  }

  // Subsequent run — increment count, update flags
  const runCount = (existing[0]?.confirmedRunCount ?? 1) + 1;
  await db
    .update(categoryBenchmarks)
    .set({
      confirmedRunCount: runCount,
      benchmarkMature: runCount >= 3,
      standardPromotion: runCount >= 3,
      thinDataFlag: runCount < 5,
      updatedAt: new Date(),
    })
    .where(eq(categoryBenchmarks.taskCategory, taskCategory));

  return { isPioneer: false };
}
```

### Pattern 6: Atomic God Layer Transaction (GODL-01)

**What:** The God Layer's primary operation — class transition + DNA write + negative register — must execute atomically. Use `db.transaction()`. The idempotency guarantee is the `council_verdicts.status` atomic state transition: the God Layer first does an atomic `UPDATE council_verdicts SET status = 'processing' WHERE id = ? AND status IN ('confirmed', ...)` (using the same `.returning()` pattern as Phase 12 confirm). If 0 rows returned, the job is a duplicate — skip.

**Wait:** The existing `verdictStatusEnum` only has `['pending', 'confirmed', 'rejected']`. A fourth status `'processing'` (or `'consumed'`) is needed for the God Layer to claim verdicts idempotently. This requires a migration.

**Alternative idempotency:** Instead of a 4th status value, add a `godLayerProcessedAt timestamp` nullable column to `council_verdicts`. The God Layer checks `WHERE godLayerProcessedAt IS NULL AND (status = 'confirmed' OR ...)` and immediately sets it. This avoids changing an enum (which requires a DB migration that drops and recreates the enum type in PostgreSQL — not just an ALTER). Adding a nullable timestamp column is simpler: `ALTER TABLE council_verdicts ADD COLUMN god_layer_processed_at TIMESTAMP`.

**Recommendation:** Add `god_layer_processed_at` nullable timestamp column to `council_verdicts` via migration 0007. Atomic claim: `UPDATE council_verdicts SET god_layer_processed_at = NOW() WHERE id = ? AND god_layer_processed_at IS NULL` — if 0 rows, skip (duplicate).

```typescript
// god-layer-worker.ts — atomic claim + transaction
async function godLayerProcessor(job: Job<GodLayerJobData>): Promise<void> {
  const { verdictId, executionId, botId, soulId, taskCategory } = job.data;

  // Atomic idempotency claim
  const claimed = await db
    .update(councilVerdicts)
    .set({ godLayerProcessedAt: new Date() })
    .where(
      and(
        eq(councilVerdicts.id, verdictId),
        isNull(councilVerdicts.godLayerProcessedAt),
      ),
    )
    .returning({ id: councilVerdicts.id });

  if (claimed.length === 0) {
    console.log('[god-layer] Verdict already processed (idempotency skip):', verdictId);
    return;
  }

  // Acquire Redis lock on category soul library
  // (only if taskCategory is non-null)
  let lockAcquired = false;
  if (taskCategory) {
    for (let retry = 0; retry < LOCK_MAX_RETRIES; retry++) {
      lockAcquired = await acquireCategoryLock(taskCategory, job.id!);
      if (lockAcquired) break;
      await sleep(LOCK_RETRY_DELAY_MS);
    }
    if (!lockAcquired) throw new Error(`Failed to acquire lock for category: ${taskCategory}`);
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Pioneer detection (reads + writes category_benchmarks)
      // 2. Compute next DNA version
      // 3. Insert dna_store row with full GODL-02 payload
      // 4. Upsert agent_classes row (class transition)
      // 5. If Retire/Demote: insert negative_signal_register row
    });
  } finally {
    if (lockAcquired && taskCategory) {
      await releaseCategoryLock(taskCategory, job.id!);
    }
  }
}
```

### Pattern 7: Enqueue God Layer Jobs from Two Sources

**Source 1: Verdict confirm route** — after successful `UPDATE ... SET status = 'confirmed'`, enqueue a God Layer job:

```typescript
// routes/verdicts.ts — modify confirm handler
import { godLayerQueue } from '../queue/god-layer-queue';

// After successful confirm update:
godLayerQueue.add('process-verdict', {
  verdictId,
  executionId: row.executionId,
  botId: row.botId,
  soulId: row.soulId,
  taskCategory: row.taskCategory,  // need to SELECT this from council_verdicts
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
}).catch((err) => {
  console.error('[verdicts] Failed to enqueue God Layer job (non-fatal):', err);
});
```

**Source 2: Council worker** — after inserting verdict with `requiresHumanConfirmation = false`:

```typescript
// council-worker.ts — after db.insert(councilVerdicts)
if (!verdict.requiresHumanConfirmation) {
  godLayerQueue.add('process-verdict', {
    verdictId: insertedRow.id,
    executionId,
    botId,
    soulId,
    taskCategory: context.taskCategory,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  }).catch((err) => {
    console.error('[council-worker] Failed to enqueue God Layer job (non-fatal):', err);
  });
}
```

### Pattern 8: Negative Signal Register Write (GODL-05)

**What:** When verdict is Retire or Demote (with soul-driven confirmation), write to `negative_signal_register`. The `mutationBlacklist` JSONB is computed from the directive failure summary — which directive combinations and which mutation operations produced poor outcomes.

```typescript
// negative-register.ts
async function writeNegativeSignal(
  tx: DrizzleTransaction,
  params: {
    soulId: string;
    botId: string;
    executionId: string;
    failureType: 'retirement' | 'demotion';
    soulAnalystOutput: SoulAnalystOutput;
    parentSoulId: string | null;
    mutationOpsApplied: string[];
  }
) {
  const directiveFailed = params.soulAnalystOutput.directiveAttributionVerification
    .filter(v => v.counterfactualScore < 0.3)
    .map(v => v.directiveReferenced)
    .join('; ');

  const blacklist = {
    failedDirectives: directiveFailed ? [directiveFailed] : [],
    avoidMutationOps: params.mutationOpsApplied,  // ops that led to this failure
    parentSoulId: params.parentSoulId,
    reason: params.soulAnalystOutput.summary,
  };

  await tx.insert(negativeSignalRegister).values({
    soulId: params.soulId,
    botId: params.botId,
    executionId: params.executionId,
    failureType: params.failureType,
    directiveFailureSummary: params.soulAnalystOutput.summary,
    mutationBlacklist: blacklist,
  });
}
```

### Pattern 9: Agent Classes Table Schema

**New table required.** The `bots` table is per-execution; class is a persistent per-`(botId, taskCategory)` state. A new `agent_classes` table tracks this across executions.

```typescript
// packages/db/src/schema/agent-classes.ts
export const agentClassEnum = pgEnum('agent_class', ['Novice', 'Understudy', 'Artisan', 'Retired']);

export const agentClasses = pgTable('agent_classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  botId: uuid('bot_id').notNull(),
  taskCategory: varchar('task_category', { length: 255 }).notNull(),
  currentClass: agentClassEnum('current_class').notNull().default('Novice'),
  aboveBenchmarkCount: integer('above_benchmark_count').notNull().default(0),
  belowBenchmarkCount: integer('below_benchmark_count').notNull().default(0),
  humanConfirmationCount: integer('human_confirmation_count').notNull().default(0),
  consecutiveBelowCount: integer('consecutive_below_count').notNull().default(0),
  isPioneer: boolean('is_pioneer').notNull().default(false),
  lastVerdictId: uuid('last_verdict_id'),
  lastTransitionAt: timestamp('last_transition_at', { withTimezone: true, precision: 3 }),
  artisanGraduationAt: timestamp('artisan_graduation_at', { withTimezone: true, precision: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (t) => [
  index('agent_classes_bot_id_idx').on(t.botId),
  index('agent_classes_task_category_idx').on(t.taskCategory),
  // Unique constraint: one class record per (bot, category)
  unique('agent_classes_bot_category_unique').on(t.botId, t.taskCategory),
]);
```

### Anti-Patterns to Avoid

- **Overwriting existing DNA entries:** GODL-03 is absolute — no UPDATE on `dna_store`. Always INSERT a new row with incremented version. The version query must be inside the transaction to prevent race conditions.
- **Processing pending verdicts:** The God Layer must only act on verdicts where `status = 'confirmed'` OR `requiresHumanConfirmation = false`. Never act on `status = 'pending'` for Promote/Retire verdicts. The idempotency claim (setting `godLayerProcessedAt`) must check this guard.
- **Evaluating live soul library during campaign:** GODL-07 requires evaluating only `bot_souls` snapshot at execution start. Use `bots.soulId` (set at spawn time) — not a live query to `bot_souls WHERE taskCategory = ?`.
- **Lock without Lua script release:** Releasing a Redis lock without checking ownership (the Lua `GET then DEL` pattern) can release another process's lock. Always use the atomic Lua script shown above.
- **Pioneer benchmark re-seeding:** Once a benchmark exists for a category, do not reset `baselineCompositeScore`. Only increment `confirmedRunCount` and update maturity flags. The first run's baseline is permanent.
- **Promoting during thin-data period:** CLAS-02 and CLAS-03 promotions must check `benchmarkMature = true` before applying promotion thresholds. The state machine function receives `benchmarkMature` as input.
- **Artisan graduation without notification:** CLAS-03 explicitly triggers a notification on Artisan graduation. This is a side effect outside the DB transaction — do it after the transaction commits (fire-and-forget `godLayerQueue` → SSE push or console log for MVP).
- **Enum migration complexity:** PostgreSQL enum types cannot be altered with a simple `ADD VALUE` in a transaction with other DDL. When adding the `god_layer_processed_at` column and new enum values, use separate migration steps or avoid touching enums altogether (hence the nullable timestamp approach for idempotency).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distributed lock | Custom Redis SETNX loop without Lua release | ioredis `SET key val NX EX ttl` + Lua release script | Race condition on release without Lua atomicity |
| Atomic multi-table write | Sequential `await db.insert(...); await db.update(...)` | `db.transaction(async (tx) => {...})` | Partial writes on failure leave DB in inconsistent state |
| Version number increment | Application-level `SELECT MAX + 1` without locking | `SELECT MAX(version) FROM dna_store WHERE ... FOR UPDATE` inside transaction | Concurrent writes produce duplicate version numbers without row lock |
| Class state machine | Switch/if chains scattered across worker | Pure function `computeClassTransition(state, verdict)` | Testable, side-effect-free; DB I/O stays in worker |
| Pioneer detection | Checking `botSouls` count per category | Dedicated `category_benchmarks` table | O(1) lookup vs O(N) count; maturity flags stored explicitly |
| Idempotency via status enum | Adding 4th value to `verdict_status` enum | Nullable `god_layer_processed_at` timestamp column | PostgreSQL enum type changes require DDL that can't run in a transaction alongside other schema changes |

**Key insight:** The DB transaction is the atomicity guarantee, not the BullMQ job. BullMQ retry is the resilience layer. The job is idempotent via `godLayerProcessedAt IS NULL` guard. Keep the transaction as a single `db.transaction()` call in the worker.

---

## Common Pitfalls

### Pitfall 1: Concurrent God Layer Jobs Racing on Same Verdict

**What goes wrong:** Two BullMQ jobs for the same `verdictId` (e.g., retry after transient failure) both pass the `godLayerProcessedAt IS NULL` check before either sets it, causing double-writes to `dna_store`.

**Why it happens:** BullMQ concurrency > 1 + network timeout + retry.

**How to avoid:** The atomic `UPDATE ... WHERE godLayerProcessedAt IS NULL RETURNING id` is the correct guard. With Drizzle's `.returning()`, if both jobs run simultaneously, exactly one will get a row back (PostgreSQL UPDATE is serialized at the row level). The loser gets 0 rows and skips. This is the same pattern Phase 12 uses for confirm idempotency — proven to work.

**Warning signs:** `dna_store` has rows with the same `(objectiveCategory, soulId, version)` tuple.

### Pitfall 2: Version Race in Versioned DNA Write

**What goes wrong:** Two concurrent God Layer jobs for different bots in the same `(taskCategory, soulId)` combination both compute `version = 1` and try to insert — PostgreSQL allows both since there's no unique constraint on `(objectiveCategory, soulId, version)`.

**Why it happens:** Version is computed as `MAX(version) + 1` outside a row lock. Without a row lock, two concurrent transactions can both read `MAX = 0` and both attempt to insert `version = 1`.

**How to avoid:** Inside the `db.transaction()`, use `SELECT MAX(version) ... FOR UPDATE SKIP LOCKED` to lock the category's latest row before computing the next version. Alternatively (simpler), add a unique constraint on `(objective_category, soul_id, version)` in migration 0007 — the second insert will fail with a constraint violation, BullMQ retries, and the retry correctly gets `version = 2`.

**Recommendation:** Add `UNIQUE (objective_category, soul_id, version)` constraint to `dna_store` in migration 0007. Retry on constraint violation is safe and simpler than advisory locks.

**Warning signs:** Duplicate `(objectiveCategory, soulId, version)` rows in `dna_store`.

### Pitfall 3: Pioneer Benchmark Created Twice

**What goes wrong:** Two concurrent God Layer jobs for the same `taskCategory` both find `category_benchmarks` empty and both insert a pioneer row, violating the `UNIQUE(taskCategory)` constraint.

**Why it happens:** Pioneer detection is a read-then-write pattern that races without locking.

**How to avoid:** The Redis category lock (GODL-07) prevents concurrent God Layer jobs for the same `taskCategory`. The lock must be acquired before pioneer detection. If the lock is held, the second job waits or retries. Additionally, `category_benchmarks.taskCategory` should have a UNIQUE constraint so the constraint violation catches any race that slips through.

**Warning signs:** Multiple `category_benchmarks` rows with the same `taskCategory`.

### Pitfall 4: Provisional Register Confusion (GODL-04)

**What goes wrong:** Runs with low confidence or lacking required human confirmation are written to `dna_store` as full entries and used to seed future populations immediately.

**Why it happens:** God Layer processes all verdicts without filtering confidence threshold.

**How to avoid:** GODL-04 specifies that below-threshold runs go to a "provisional register" — referenced but not used to seed. Implementation: add a `isProvisional boolean` column to `dna_store` (default `false`). If `weightedConfidenceScore < CONFIDENCE_THRESHOLD` or (`requiresHumanConfirmation = true` AND `confirmedBy IS NULL`), set `isProvisional = true`. The soul generator (`soul-generator.ts`) already queries `botSouls` via `bots.compositeScore` — it needs a join against `dna_store.isProvisional = false` to exclude provisional entries from future populations.

**Recommendation:** Add `is_provisional boolean NOT NULL DEFAULT false` to `dna_store` in migration 0007. Set `GODL_CONFIDENCE_THRESHOLD = 0.50` as a module constant (Claude's discretion — not specified in requirements).

**Warning signs:** Low-confidence runs appearing in soul generator parent pool.

### Pitfall 5: God Layer Processes Pending Promote/Retire Verdicts

**What goes wrong:** The God Layer processes a verdict that still has `status = 'pending'` (human gate not yet cleared) by only checking `requiresHumanConfirmation = false`.

**Why it happens:** The auto-execute enqueue in the council worker enqueues after insert when `requiresHumanConfirmation = false`. But a Promote verdict with a strong DA argument could have `requiresHumanConfirmation = true` — the council worker should NOT enqueue these for auto-execute.

**How to avoid:** The council worker auto-enqueue condition must be: `requiresHumanConfirmation === false`. For Promote/Retire with `requiresHumanConfirmation = true`, God Layer is triggered only from the confirm route. The God Layer worker itself should also re-validate: fetch the verdict row and assert `status = 'confirmed'` OR `requiresHumanConfirmation = false`.

**Warning signs:** God Layer Artisan promotions happening without operator confirmation for high-DA verdicts.

### Pitfall 6: Redis Lock TTL Too Short

**What goes wrong:** The God Layer job takes longer than `LOCK_TTL_SECONDS` (e.g., DB slowness), the lock expires, a second job acquires the lock and runs concurrently.

**Why it happens:** Fixed TTL without renewal.

**How to avoid:** Implement lock renewal inside the transaction using `setInterval` (same pattern as council worker's `job.extendLock`). Renew every 60 seconds while the transaction is running. In `finally`, clear the interval and release the lock. For MVP, 300 seconds (5 minutes) TTL with 60-second renewal is sufficient.

**Warning signs:** Two God Layer jobs running simultaneously for the same `taskCategory` observed via console logs.

### Pitfall 7: Artisan Graduation Notification Never Fires

**What goes wrong:** The Artisan graduation notification (CLAS-03) is implemented inside the DB transaction and fails silently when the notification mechanism errors.

**Why it happens:** SSE or notification code throws inside `db.transaction()`, causing the entire transaction to roll back.

**How to avoid:** The transaction only handles DB writes. The notification is a side effect fired after the transaction commits:

```typescript
const { transitioned, newClass } = await db.transaction(async (tx) => { ... });
if (transitioned && newClass === 'Artisan') {
  // Fire-and-forget notification — non-fatal
  notifyArtisanGraduation(botId, taskCategory).catch((err) => {
    console.error('[god-layer] Artisan notification failed (non-fatal):', err);
  });
}
```

**Warning signs:** Artisan graduation writes are in DB but users never see a notification.

---

## Code Examples

Verified patterns from existing codebase:

### God Layer Worker Skeleton (mirrors council-worker.ts)

```typescript
// services/execution-service/src/queue/god-layer-worker.ts
import { Worker, type Job } from 'bullmq';
import { workerConnection } from './task-queue';
import { GOD_LAYER_QUEUE_NAME, type GodLayerJobData } from './god-layer-queue';

const GOD_LAYER_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const GOD_LAYER_CONCURRENCY = 3; // Lower than council — DB-heavy, not LLM-heavy

export function startGodLayerWorker(): Worker<GodLayerJobData> {
  const worker = new Worker<GodLayerJobData>(GOD_LAYER_QUEUE_NAME, godLayerProcessor, {
    connection: workerConnection,   // maxRetriesPerRequest: null — required
    concurrency: GOD_LAYER_CONCURRENCY,
    lockDuration: GOD_LAYER_LOCK_DURATION_MS,
    stalledInterval: 30_000,
    maxStalledCount: 1,
    limiter: { max: 20, duration: 60_000 }, // Higher than council — DB ops, not LLM calls
  });

  worker.on('error', (err) => console.error('[god-layer] Error:', err));
  worker.on('failed', (job, err) => console.error('[god-layer] Job failed:', { jobId: job?.id, verdictId: job?.data?.verdictId, error: err.message }));
  worker.on('completed', (job) => console.log('[god-layer] Job completed:', { jobId: job.id, verdictId: job.data.verdictId }));

  console.log('[god-layer] Started (concurrency=3)');
  return worker;
}
```

### main.ts Modification

```typescript
// services/execution-service/src/main.ts — add after councilWorker
import { startGodLayerWorker } from './queue/god-layer-worker';

const godLayerWorker = startGodLayerWorker();

// In shutdown():
godLayerWorker.close().catch((err: Error) => {
  console.error('[main] Error closing god-layer worker:', err);
});
```

### Drizzle Transaction with Returning for Idempotency

```typescript
// Source: drizzle-orm .update().where().returning() — same pattern as Phase 12 confirm
import { isNull, eq, and } from 'drizzle-orm';

const claimed = await db
  .update(councilVerdicts)
  .set({ godLayerProcessedAt: new Date() })
  .where(
    and(
      eq(councilVerdicts.id, verdictId),
      isNull(councilVerdicts.godLayerProcessedAt),
    ),
  )
  .returning({ id: councilVerdicts.id });

if (claimed.length === 0) return; // Already processed — idempotent skip
```

### Migration 0007 Overview (required DDL changes)

The following schema additions are needed:

```sql
-- 1. New enum for agent class
CREATE TYPE "public"."agent_class" AS ENUM('Novice', 'Understudy', 'Artisan', 'Retired');

-- 2. agent_classes table
CREATE TABLE "agent_classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bot_id" uuid NOT NULL,
  "task_category" varchar(255) NOT NULL,
  "current_class" "agent_class" DEFAULT 'Novice' NOT NULL,
  "above_benchmark_count" integer DEFAULT 0 NOT NULL,
  "below_benchmark_count" integer DEFAULT 0 NOT NULL,
  "human_confirmation_count" integer DEFAULT 0 NOT NULL,
  "consecutive_below_count" integer DEFAULT 0 NOT NULL,
  "is_pioneer" boolean DEFAULT false NOT NULL,
  "last_verdict_id" uuid,
  "last_transition_at" timestamp(3) with time zone,
  "artisan_graduation_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  UNIQUE("bot_id", "task_category")
);

-- 3. category_benchmarks table
CREATE TABLE "category_benchmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_category" varchar(255) NOT NULL UNIQUE,
  "pioneer_bot_id" uuid NOT NULL,
  "pioneer_soul_id" uuid,
  "pioneer_execution_id" uuid NOT NULL,
  "baseline_composite_score" numeric(5, 2) NOT NULL,
  "confirmed_run_count" integer DEFAULT 1 NOT NULL,
  "thin_data_flag" boolean DEFAULT true NOT NULL,
  "benchmark_mature" boolean DEFAULT false NOT NULL,
  "standard_promotion" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- 4. Columns added to council_verdicts for God Layer idempotency
ALTER TABLE "council_verdicts"
  ADD COLUMN "god_layer_processed_at" timestamp(3) with time zone;

-- 5. Provisional flag on dna_store
ALTER TABLE "dna_store"
  ADD COLUMN "is_provisional" boolean DEFAULT false NOT NULL;

-- 6. Unique constraint on dna_store versioning (prevents duplicate version races)
ALTER TABLE "dna_store"
  ADD CONSTRAINT "dna_store_category_soul_version_unique" UNIQUE ("objective_category", "soul_id", "version");
```

### Enqueue from verdicts.ts (after confirm)

```typescript
// After the .returning() update in confirm handler:
const confirmedRow = await db
  .select({
    executionId: councilVerdicts.executionId,
    botId: councilVerdicts.botId,
    soulId: councilVerdicts.soulId,
  })
  .from(councilVerdicts)
  .where(eq(councilVerdicts.id, verdictId));

if (confirmedRow[0]) {
  // Fetch taskCategory from bot_souls via soulId
  const taskCategory = confirmedRow[0].soulId
    ? (await db.select({ taskCategory: botSouls.taskCategory }).from(botSouls).where(eq(botSouls.id, confirmedRow[0].soulId)))[0]?.taskCategory ?? null
    : null;

  godLayerQueue.add('process-verdict', {
    verdictId,
    executionId: confirmedRow[0].executionId,
    botId: confirmedRow[0].botId,
    soulId: confirmedRow[0].soulId ?? null,
    taskCategory,
  }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
  .catch((err) => console.error('[verdicts] God Layer enqueue failed (non-fatal):', err));
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis SETNX + EXPIRE as two commands | `SET key val NX EX ttl` as single atomic command | Redis 2.6.12 (years ago) | Two-command approach has a window where key is set but TTL not applied; single command is atomic |
| Adding enum values with `ALTER TYPE ... ADD VALUE` | Separate nullable timestamp column for state flags | PostgreSQL constraint | `ALTER TYPE ADD VALUE` cannot run in a transaction; nullable timestamp column avoids this entirely |
| `db.insert().onConflictDoNothing()` for upsert | `db.update().where(unique).returning()` for idempotency | N/A — design choice | `.onConflictDoNothing()` silently swallows errors; `.returning()` explicitly detects skip vs success |

**Deprecated/outdated:**
- `SET NX` + `EXPIRE` (two Redis commands): DO NOT use. `SET key val NX EX ttl` is the correct single-command atomic pattern.
- `db.insert().onConflictDoNothing()` for idempotency: Acceptable but obscures skip vs fail; prefer `.update().returning()` for clarity (Phase 12 pattern already established).

---

## Open Questions

1. **Soul generator integration with God Layer output**
   - What we know: `soul-generator.ts` queries `botSouls` joined with `bots.compositeScore` for historical parents. The God Layer writes `dna_store` entries. The soul generator does NOT currently read `dna_store`.
   - What's unclear: Should the soul generator switch from reading `botSouls` directly to reading `dna_store` entries? GODL-02 implies the DNA Library IS the canonical source for future soul generation. The requirement says "negative register queries this register to identify which directive combinations produced poor outcomes" — implying the soul generator also reads `negative_signal_register`.
   - Recommendation: Phase 13 scope is limited to **writing** the DNA library and negative register. The soul generator **reads** from them. The soul generator update (reading from `dna_store` where `isProvisional = false`, excluding `negative_signal_register.mutationBlacklist`) is a natural follow-on enhancement. For Phase 13, the write side is sufficient.

2. **`isAboveBenchmark` determination**
   - What we know: Class transition logic (CLAS-02, CLAS-03) requires knowing if a run was "above benchmark." The benchmark is `category_benchmarks.baselineCompositeScore`.
   - What's unclear: Is "above benchmark" simply `bots.compositeScore > baseline`? Or does it use the weighted council confidence score?
   - Recommendation: Use `bots.compositeScore > category_benchmarks.baselineCompositeScore` as the "above benchmark" determination. Simple, measurable, already stored. The council confidence score is a separate signal (used for threshold checks, not benchmark comparison).

3. **Context-driven vs soul-driven demotion check (CLAS-04)**
   - What we know: CLAS-04 says demotion proceeds if Soul Analyst confirms soul-driven. If context-driven, a Monitor verdict is issued instead.
   - What's unclear: The council worker already produces a `verdictType`. If the council says "Demote" and the Soul Analyst confirms soul-driven causation, the God Layer demotes. But if context-driven, is the God Layer supposed to override the verdict to Monitor? This would require re-writing the verdict type.
   - Recommendation: The God Layer should NOT modify the verdict type in `council_verdicts`. Instead, the class state machine's `computeClassTransition` function checks `isSoulDriven` from the Soul Analyst output. If `verdictType = 'Demote'` but `isSoulDriven = false`, the transition is `type: 'none'` (Monitor treatment — no class change). The council verdict row stays as `Demote` in the DB. Only the class machine's output matters for the class transition.

4. **Artisan graduation notification mechanism**
   - What we know: CLAS-03 "triggers notification." The project has SSE routes for real-time updates.
   - What's unclear: Is the notification an SSE event pushed to the UI, a console log, or a separate notification table?
   - Recommendation: For Phase 13 MVP, log to console and push an SSE event using the existing `sseRoutes` infrastructure. The notification should include `botId`, `taskCategory`, and `artisanGraduationAt`. Full notification system is out of scope for this phase.

5. **Provisional register definition**
   - What we know: GODL-04 says runs below confidence threshold or lacking required human confirmation go to a "provisional register."
   - What's unclear: Is this a separate DB table or the `is_provisional` flag on `dna_store`? The requirement says "referenced but not used to seed future populations."
   - Recommendation: The `is_provisional` flag on `dna_store` IS the provisional register. No separate table needed. The distinction is `WHERE is_provisional = false` in soul generator queries. This keeps the schema minimal.

---

## Sources

### Primary (HIGH confidence)

- `packages/db/src/schema/dna-store.ts` — existing columns confirmed: `parentSoulIds uuid[]`, `mutationLineage jsonb`, `soulId uuid`, `version integer`, `objectiveCategory varchar` — Phase 13 builds on these
- `packages/db/src/schema/council-verdicts.ts` — existing columns confirmed: `status`, `requiresHumanConfirmation`, `confirmedAt`, `confirmedBy`, `weightedConfidenceScore`, `soulId`, `verdictType`, `performanceJudgeOutput JSONB`, `soulAnalystOutput JSONB`, `devilsAdvocateOutput JSONB`
- `packages/db/src/schema/negative-signal-register.ts` — existing table confirmed: `mutationBlacklist jsonb` column present and noted as "populated in Phase 13"
- `packages/db/src/schema/bot-souls.ts` — confirmed `parentSoulId`, `generation`, `constitutionDirectives`, `dimensions`, `taskCategory` columns
- `packages/db/src/schema/bots.ts` — confirmed `soulId uuid` column (set at spawn, represents execution-start snapshot)
- `services/execution-service/src/queue/council-worker.ts` — confirmed BullMQ Worker pattern with lock renewal, `startCouncilWorker()` export, `concurrency`, `limiter`, `lockDuration` options
- `services/execution-service/src/queue/council-queue.ts` — confirmed queue definition pattern with `queueConnection` reuse
- `services/execution-service/src/main.ts` — confirmed `startCouncilWorker()` called alongside dispatcher; pattern for adding God Layer worker
- `services/execution-service/src/services/execution.service.ts` — confirmed `ioredis` `new IORedis(REDIS_URL)` pattern already in use; `SET NX EX` compatible
- `services/execution-service/src/routes/verdicts.ts` — confirmed Phase 12 confirm endpoint pattern with `.returning()` idempotency; God Layer enqueue goes here
- `packages/db/migrations/0006_add_time_on_screen_ms.sql` — confirmed most recent migration number is 0006; Phase 13 migration is 0007
- Phase 12 RESEARCH.md — Phase 12 integration contract confirmed: God Layer reads `status = 'confirmed'` OR `requiresHumanConfirmation = false`; auto-execute verdicts are Maintain/Monitor/Demote

### Secondary (MEDIUM confidence)

- `services/execution-service/package.json` — `ioredis ^5.9.3`, `bullmq ^5.69.3`, `drizzle-orm ^0.45.1` all confirmed installed; no new packages needed
- `services/execution-service/src/services/soul-generator.ts` — confirmed how the soul generator currently queries parents (reads `botSouls` joined with `bots.compositeScore`); Phase 13 writes the DNA library which future phases will wire back in
- Phase 11 RESEARCH.md — `VERDICT_VALUES` map (Promote=4 to Retire=0), `VERDICT_FROM_VALUE` lookup, weighted aggregation pattern — confirmed already implemented in `council-worker.ts`

### Tertiary (LOW confidence)

- PostgreSQL documentation on `ALTER TYPE ... ADD VALUE` transaction limitations — this is well-known PostgreSQL behavior (cannot run in transaction with other DDL) but not directly verified from official docs in this session. The nullable timestamp column workaround is the established safe alternative.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all required packages already installed and in use; no new dependencies
- Architecture (queue pattern): HIGH — directly mirrors existing `council-queue.ts` and `council-worker.ts` which are verified in codebase
- Schema design (agent_classes, category_benchmarks): HIGH — derived from requirements spec with no ambiguity; Drizzle patterns follow established conventions
- DnaPayload extension: HIGH — no migration needed; TypeScript interface change only; JSONB is schema-flexible
- Redis lock pattern: HIGH — `SET NX EX` is established Redis primitive; ioredis usage confirmed in codebase
- Class state machine thresholds: HIGH — thresholds exactly specified in CLAS-01 through CLAS-06
- Pioneer benchmark maturity logic (3/5 run thresholds): HIGH — exactly specified in GODL-06
- Provisional register implementation: MEDIUM — GODL-04 says "provisional register" but doesn't specify it as a column vs table; column recommendation is Claude's discretion
- Context-driven vs soul-driven demotion (CLAS-04): MEDIUM — interpretation that God Layer class machine handles this (not council verdict override) is Claude's discretion; spec is ambiguous

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — all dependencies stable; no fast-moving external APIs involved)
