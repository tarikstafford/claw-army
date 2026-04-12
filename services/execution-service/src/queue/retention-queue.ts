import { Queue, Worker } from 'bullmq';
import { queueConnection, workerConnection } from './task-queue';
import { runRetention } from '../services/data-retention';

export const RETENTION_QUEUE_NAME = 'data-retention';

/**
 * Repeat schedule: once daily at 03:00 UTC.
 * Chosen to run during low-traffic hours to minimize lock contention.
 */
const RETENTION_CRON = '0 3 * * *';

/**
 * Producer-side retention queue.
 * Reuses the shared Redis connection from task-queue.
 */
export const retentionQueue = new Queue(RETENTION_QUEUE_NAME, {
  connection: queueConnection,
});

/**
 * Registers the repeatable retention job.
 * Idempotent — BullMQ deduplicates by repeat key, so calling this
 * multiple times on service restart is safe.
 */
export async function registerRetentionSchedule(): Promise<void> {
  await retentionQueue.upsertJobScheduler(
    'daily-retention',
    {
      pattern: RETENTION_CRON,
    },
    {
      name: 'retention-sweep',
    },
  );

  console.log(`[data-retention] Scheduled daily retention job (${RETENTION_CRON})`);
}

/**
 * Creates and starts the retention worker.
 * Processes one job at a time — retention sweeps should not run concurrently.
 */
export function createRetentionWorker(): Worker {
  const worker = new Worker(
    RETENTION_QUEUE_NAME,
    async () => {
      const result = await runRetention();
      return JSON.stringify(result);
    },
    {
      connection: workerConnection,
      concurrency: 1,
    },
  );

  worker.on('error', (err) => {
    console.error('[data-retention] Worker error:', (err as Error).message);
  });

  worker.on('completed', (_job, returnvalue) => {
    console.log('[data-retention] Scheduled sweep completed:', returnvalue);
  });

  worker.on('failed', (_job, err) => {
    console.error('[data-retention] Scheduled sweep failed:', (err as Error).message);
  });

  return worker;
}
