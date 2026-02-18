import { Queue, Worker, type Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';

// Queue name used by both producer and worker — must match on both sides.
export const TASK_QUEUE_NAME = 'claw-tasks';

// Lock duration: bots must complete or heartbeat within this window.
// If the lock expires without completion, BullMQ marks the job as stalled.
export const LOCK_DURATION_MS = 30_000; // 30 seconds

// How often BullMQ checks for stalled jobs and reassigns them.
export const STALLED_INTERVAL_MS = 15_000; // 15 seconds

// Allow 2 stalls before marking a job as permanently failed.
// This prevents hot-looping on a single broken job while still allowing transient failures.
export const MAX_STALLED_COUNT = 2;

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * Producer-side Redis connection options.
 * Passed as a plain options object so BullMQ creates its own IORedis connection internally.
 * This avoids the dual-version IORedis type conflict that arises when passing a pre-constructed
 * IORedis instance (bullmq@5 bundles ioredis@5.9.2; this service has ioredis@5.9.3).
 * Default maxRetriesPerRequest for fast-fail on queue add operations.
 */
export const queueConnection: RedisOptions = {
  ...(parseRedisUrl(REDIS_URL)),
};

/**
 * Worker-side Redis connection options.
 * CRITICAL: maxRetriesPerRequest must be null for workers.
 * Workers use blocking commands (BRPOPLPUSH) that take seconds to respond.
 * With the default maxRetriesPerRequest (3), ioredis will error out after reconnection
 * because the command hasn't completed in <3 attempts — the worker silently stops processing.
 * null = infinite retries, which is required for long-running blocking commands.
 */
export const workerConnection: RedisOptions = {
  ...(parseRedisUrl(REDIS_URL)),
  maxRetriesPerRequest: null,
};

/**
 * Parse a Redis URL string into ioredis RedisOptions object.
 * Handles redis:// and rediss:// schemes.
 * BullMQ's own ConnectionOptions accepts a url field, but to keep queueConnection
 * and workerConnection as plain RedisOptions (not wrapped), we parse it here.
 */
function parseRedisUrl(url: string): RedisOptions {
  try {
    const parsed = new URL(url);
    const opts: RedisOptions = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
    if (parsed.password) {
      opts.password = parsed.password;
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      const db = parseInt(parsed.pathname.slice(1), 10);
      if (!isNaN(db)) {
        opts.db = db;
      }
    }
    return opts;
  } catch {
    // If URL parsing fails, fall back to localhost defaults
    return { host: 'localhost', port: 6379 };
  }
}

/**
 * Data carried by each task job in the queue.
 * taskId and executionId are UUIDs from Postgres.
 * description is the human-readable subtask text from the planner.
 */
export interface TaskJobData {
  taskId: string;
  executionId: string;
  description: string;
}

/**
 * Producer-side task queue.
 * Used by the POST /executions handler to enqueue planned tasks.
 * Uses queueConnection options (not workerConnection) — producers do not need blocking command support.
 *
 * Dual-write strategy (per RESEARCH.md Open Question 2):
 * Write to Postgres first (create task row), then add to BullMQ queue.
 * If BullMQ fails, the task stays 'pending' in Postgres — a reconciler can re-enqueue later.
 * This avoids orphan queue jobs with no corresponding DB record.
 */
export const taskQueue = new Queue<TaskJobData>(TASK_QUEUE_NAME, {
  connection: queueConnection,
});

/**
 * Factory function that creates a BullMQ Worker bound to the task queue.
 *
 * @param processor - Async function that receives a job and returns a result string.
 *   Called by BullMQ for each dequeued job. Must resolve before lockDuration expires,
 *   or implement heartbeat renewal (job.extendLock) for long-running tasks.
 *
 * Configuration:
 * - lockDuration: 30s — bot must complete or renew lock within this window
 * - stalledInterval: 15s — check every 15s for jobs whose lock has expired
 * - maxStalledCount: 2 — allow 2 stalls before permanently failing the job
 * - concurrency: 1 — each worker processes one job at a time (one bot = one task)
 *
 * CRITICAL: The error handler is attached immediately to prevent silent failures.
 * Without worker.on('error', ...), unhandled errors are swallowed by Node's EventEmitter.
 */
export function createTaskWorker(
  processor: (job: Job<TaskJobData>) => Promise<string>,
): Worker<TaskJobData, string> {
  const worker = new Worker<TaskJobData, string>(TASK_QUEUE_NAME, processor, {
    connection: workerConnection,
    lockDuration: LOCK_DURATION_MS,
    stalledInterval: STALLED_INTERVAL_MS,
    maxStalledCount: MAX_STALLED_COUNT,
    concurrency: 1,
  });

  // CRITICAL: Attach error handler immediately.
  // Without this, worker errors are swallowed by Node's EventEmitter
  // and the worker stops processing silently.
  worker.on('error', (err) => {
    console.error('[TaskWorker] Error:', err);
  });

  return worker;
}

/**
 * Convenience wrapper to add a task job to the queue.
 * Includes retry logic: 3 attempts with exponential backoff starting at 1s.
 * Returns the created BullMQ job.
 */
export async function addTaskToQueue(data: TaskJobData) {
  return taskQueue.add('task', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}
