import { db, executions, executionStatusEnum } from '@claw/db';
import { eq, and } from 'drizzle-orm';

type ExecutionStatus = (typeof executionStatusEnum.enumValues)[number];

export interface CreateExecutionInput {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
}

export async function createExecution(
  input: CreateExecutionInput,
): Promise<{ executionId: string; status: 'queued' }> {
  const result = await db
    .insert(executions)
    .values({
      objective: input.objective,
      maxBots: input.maxBots,
      budgetCapCents: input.budgetCapCents,
      runtimeLimitSeconds: input.runtimeLimitSeconds,
      allowedTools: input.allowedTools,
      status: 'queued',
    })
    .returning({ id: executions.id });

  if (result.length === 0 || !result[0]) {
    throw new Error('Failed to create execution: no row returned');
  }

  return { executionId: result[0].id, status: 'queued' };
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
