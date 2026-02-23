import { db, executions, executionStatusEnum, objectives } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import IORedis from 'ioredis';

type ExecutionStatus = (typeof executionStatusEnum.enumValues)[number];

/**
 * Module-level Redis singleton for budget cap key initialization.
 * Uses queuing (default enableOfflineQueue: true) — execution creation is write-path
 * and should queue if Redis is temporarily slow rather than fail fast.
 */
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export interface CreateExecutionInput {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
  objectiveId?: string;
}

export async function createExecution(
  input: CreateExecutionInput,
): Promise<{ executionId: string; status: 'queued' }> {
  if (input.objectiveId) {
    const [objective] = await db
      .select({ id: objectives.id })
      .from(objectives)
      .where(
        and(
          eq(objectives.id, input.objectiveId),
          eq(objectives.isArchived, false),
        ),
      );
    if (!objective) {
      throw new Error('Objective not found or archived');
    }
  }

  const result = await db
    .insert(executions)
    .values({
      objective: input.objective,
      maxBots: input.maxBots,
      budgetCapCents: input.budgetCapCents,
      runtimeLimitSeconds: input.runtimeLimitSeconds,
      allowedTools: input.allowedTools,
      objectiveId: input.objectiveId ?? null,
      status: 'queued',
    })
    .returning({ id: executions.id });

  if (result.length === 0 || !result[0]) {
    throw new Error('Failed to create execution: no row returned');
  }

  const executionId = result[0].id;

  // Initialize Redis budget cap keys for atomic enforcement (GARD-01).
  // The Billing Engine (04-03) uses a Lua script that reads budget:cap atomically.
  // TTL = runtimeLimitSeconds + 24h buffer — ensures keys outlive the execution.
  // Non-fatal: failure is logged but does NOT prevent execution creation.
  // The billing engine handles missing keys gracefully (no cap = allow all spending).
  try {
    const ttlSeconds = input.runtimeLimitSeconds + 86400;

    // Budget cap ceiling — the maximum spend allowed for this execution
    await redis.setex(
      `budget:cap:${executionId}`,
      ttlSeconds,
      input.budgetCapCents.toString(),
    );

    // Spend accumulator — initialized to 0; INCRBY increments atomically in the Lua script.
    // Explicit SET ensures the key exists for monitoring even before any spend occurs.
    await redis.setex(
      `budget:spend:${executionId}`,
      ttlSeconds,
      '0',
    );
  } catch (err) {
    console.error('[execution.service] Failed to initialize budget cap in Redis (non-fatal):', err);
  }

  return { executionId, status: 'queued' };
}

export async function getExecution(id: string) {
  const result = await db
    .select()
    .from(executions)
    .where(eq(executions.id, id));

  if (result.length === 0) {
    return null;
  }

  return result[0] ?? null;
}

/**
 * Atomic state transition using UPDATE...WHERE...RETURNING.
 * Returns true if transition succeeded (row was in expected fromStatus).
 * Returns false if the row was not in the expected state (race condition or invalid transition).
 */
export async function transitionExecution(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
): Promise<boolean> {
  const result = await db
    .update(executions)
    .set({ status: toStatus, updatedAt: new Date() })
    .where(
      and(
        eq(executions.id, executionId),
        eq(executions.status, fromStatus),
      ),
    )
    .returning({ id: executions.id });

  return result.length === 1;
}
