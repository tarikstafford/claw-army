import type { UUID, ISOTimestamp } from './common';

/** Mirrors the task_status pgEnum in packages/db/src/schema/tasks.ts */
export type TaskStatus = 'pending' | 'claimed' | 'completed' | 'failed';

/** Runtime-iterable array of all task status values */
export const TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'claimed',
  'completed',
  'failed',
] as const;

/**
 * Domain entity for an individual task within an execution.
 * Mirrors the tasks table shape without importing Drizzle.
 */
export interface Task {
  id: UUID;
  executionId: UUID;
  status: TaskStatus;
  description: string;
  result: string | null;
  claimedByBotId: UUID | null;
  leaseExpiresAt: ISOTimestamp | null;
  attemptCount: number;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Input type for creating a new task */
export type NewTask = Omit<Task, 'id' | 'status' | 'result' | 'claimedByBotId' | 'leaseExpiresAt' | 'attemptCount' | 'createdAt' | 'updatedAt'>;
