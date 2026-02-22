import { Queue } from 'bullmq';
import { queueConnection } from './task-queue';

// Queue name used by both producer and god layer worker — must match on both sides.
export const GOD_LAYER_QUEUE_NAME = 'soul-verdicts';

/**
 * Data carried by each god layer evaluation job.
 * Identifies the verdict and associated execution/bot/soul context.
 */
export interface GodLayerJobData {
  verdictId: string;      // council_verdicts.id
  executionId: string;
  botId: string;
  soulId: string | null;
  taskCategory: string | null;
}

/**
 * Producer-side god layer queue.
 * Reuses the same Redis connection as the task queue — no separate connection needed.
 * The god layer worker (Plan 04) will create its own Worker instance using workerConnection.
 */
export const godLayerQueue = new Queue<GodLayerJobData>(GOD_LAYER_QUEUE_NAME, {
  connection: queueConnection,
});
