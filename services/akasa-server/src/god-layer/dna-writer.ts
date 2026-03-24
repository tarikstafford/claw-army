/**
 * DNA Writer
 *
 * Captures high-performing behavioral patterns to dna_store.
 * Version is computed as MAX(version for same taskCategory) + 1.
 * Uses ioredis for category-level lock to prevent concurrent version conflicts.
 * Fail-open: if Redis unavailable, skips lock and inserts directly.
 */

import { max, eq } from 'drizzle-orm';
import IORedis from 'ioredis';
import { db, dnaStore } from '@claw/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DNA_LOCK_KEY_PREFIX = 'dna:lock:';
const LOCK_TTL_SECONDS = 10;

// ---------------------------------------------------------------------------
// Redis instance (fail-open per coding conventions)
// ---------------------------------------------------------------------------

let redis: InstanceType<typeof IORedis> | null = null;

function getRedis(): InstanceType<typeof IORedis> | null {
  if (redis !== null) return redis;
  try {
    redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });
    return redis;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Insert a new versioned DNA entry into dna_store.
 *
 * Version is computed as MAX(version) + 1 scoped to taskCategory.
 * If no prior rows exist, version defaults to 1.
 *
 * Uses a Redis lock on the category to prevent concurrent version conflicts.
 * Fails open if Redis is unavailable.
 */
export async function captureDna(
  botId: string,
  executionId: string,
  soulId: string,
  taskCategory: string,
  dimensions: Record<string, unknown>,
  compositeScore: string,
): Promise<void> {
  const lockKey = `${DNA_LOCK_KEY_PREFIX}${taskCategory}`;
  const lockValue = `${botId}:${Date.now()}`;
  let lockAcquired = false;

  // Attempt to acquire category-level Redis lock (fail-open)
  try {
    const client = getRedis();
    if (client) {
      const result = await client.set(lockKey, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
      lockAcquired = result === 'OK';
    }
  } catch (err) {
    // Fail-open: skip lock on Redis error
    console.error('[dna-writer] Redis lock acquisition failed, continuing without lock:', (err as Error).message);
  }

  try {
    // Compute next version: MAX(version) WHERE objectiveCategory = taskCategory
    const [maxResult] = await db
      .select({ maxVersion: max(dnaStore.version) })
      .from(dnaStore)
      .where(eq(dnaStore.objectiveCategory, taskCategory));

    const currentMax = maxResult?.maxVersion ?? null;
    const version = currentMax !== null ? currentMax + 1 : 1;

    // Insert new DNA entry
    const dnaPayload = {
      systemPromptTemplate: '',
      toolCallSequence: [],
      argumentPatterns: {},
      retryStrategy: {},
      timingProfile: {},
      tokenDistribution: {},
      soulContent: '',
      taskCategory,
      agentClassAtWrite: 'Novice',
      compositeFitnessScore: parseFloat(compositeScore),
      fitnessDimensionBreakdown: dimensions as Record<string, number>,
    };

    await db.insert(dnaStore).values({
      botId,
      executionId,
      objectiveCategory: taskCategory,
      soulId,
      version,
      compositeScore,
      dnaPayload,
      isProvisional: false,
    });
  } finally {
    // Release Redis lock if acquired
    if (lockAcquired) {
      try {
        const client = getRedis();
        if (client) {
          // Atomic compare-and-delete: only release if still our lock
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else
              return 0
            end
          `;
          await client.eval(script, 1, lockKey, lockValue);
        }
      } catch (err) {
        console.error('[dna-writer] Redis lock release failed:', (err as Error).message);
      }
    }
  }
}
