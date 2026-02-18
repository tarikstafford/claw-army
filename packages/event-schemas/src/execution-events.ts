import { z } from 'zod';

/** Execution status values — mirrored from shared-types to avoid circular deps */
const executionStatusSchema = z.enum([
  'queued',
  'running',
  'paused',
  'stopped',
  'completed',
  'failed',
]);

/** Schema for execution_created event */
export const executionCreatedEventSchema = z.object({
  type: z.literal('execution_created'),
  executionId: z.uuid(),
  objective: z.string(),
  maxBots: z.number().int().positive(),
  budgetCapCents: z.number().int().nonnegative().nullable(),
  timestamp: z.iso.datetime(),
});

/** Schema for execution_status_changed event */
export const executionStatusChangedEventSchema = z.object({
  type: z.literal('execution_status_changed'),
  executionId: z.uuid(),
  fromStatus: executionStatusSchema,
  toStatus: executionStatusSchema,
  timestamp: z.iso.datetime(),
});

/** Schema for task_claimed event */
export const taskClaimedEventSchema = z.object({
  type: z.literal('task_claimed'),
  taskId: z.uuid(),
  botId: z.uuid(),
  executionId: z.uuid(),
  timestamp: z.iso.datetime(),
});

/** Schema for task_completed event */
export const taskCompletedEventSchema = z.object({
  type: z.literal('task_completed'),
  taskId: z.uuid(),
  botId: z.uuid(),
  executionId: z.uuid(),
  durationMs: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type ExecutionCreatedEvent = z.infer<typeof executionCreatedEventSchema>;
export type ExecutionStatusChangedEvent = z.infer<typeof executionStatusChangedEventSchema>;
export type TaskClaimedEvent = z.infer<typeof taskClaimedEventSchema>;
export type TaskCompletedEvent = z.infer<typeof taskCompletedEventSchema>;
