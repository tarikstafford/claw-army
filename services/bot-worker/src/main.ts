import 'dotenv/config';
import { Worker } from 'bullmq';
import { runReasoningLoop } from './reasoning-loop.js';

// ──────────────────────────────────────────────────────────────────────────────
// Environment variables
// ──────────────────────────────────────────────────────────────────────────────

const BOT_ID = process.env.BOT_ID ?? '';
const EXECUTION_ID = process.env.EXECUTION_ID ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

if (!BOT_ID) {
  console.error('[bot-worker] BOT_ID env var is required');
  process.exit(1);
}

if (!EXECUTION_ID) {
  console.error('[bot-worker] EXECUTION_ID env var is required');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Redis connection parsing
// ──────────────────────────────────────────────────────────────────────────────

function parseRedisUrl(
  url: string,
): { host: string; port: number; password?: string; db?: number; maxRetriesPerRequest: null } {
  try {
    const parsed = new URL(url);
    const opts: {
      host: string;
      port: number;
      password?: string;
      db?: number;
      maxRetriesPerRequest: null;
    } = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      maxRetriesPerRequest: null,
    };
    if (parsed.password) {
      opts.password = parsed.password;
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      const dbNum = parseInt(parsed.pathname.slice(1), 10);
      if (!isNaN(dbNum)) {
        opts.db = dbNum;
      }
    }
    return opts;
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

const redisConnection = parseRedisUrl(REDIS_URL);

// ──────────────────────────────────────────────────────────────────────────────
// BullMQ Worker
// ──────────────────────────────────────────────────────────────────────────────

const TASK_QUEUE_NAME = 'claw-tasks';

const worker = new Worker(
  TASK_QUEUE_NAME,
  async (job) => {
    const {
      taskId,
      executionId: jobExecutionId,
      description,
    } = job.data as { taskId: string; executionId: string; description: string };

    console.log(`[bot-worker] Claiming task ${taskId} for execution ${jobExecutionId}`);

    const result = await runReasoningLoop(description);

    console.log(`[bot-worker] Completed task ${taskId}`);

    return result;
  },
  {
    connection: redisConnection,
    // 5 minutes — real LLM calls take time, prevents BullMQ from treating
    // in-progress jobs as stalled while the reasoning loop runs
    lockDuration: 300_000,
    concurrency: 1,
  },
);

worker.on('error', (err) => {
  console.error('[bot-worker] Worker error:', err);
});

worker.on('completed', (job) => {
  console.log(`[bot-worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[bot-worker] Job ${job?.id} failed:`, err);
});

console.log(`[bot-worker] Started for bot ${BOT_ID}, execution ${EXECUTION_ID}`);

// ──────────────────────────────────────────────────────────────────────────────
// Graceful shutdown — drain current job before exiting
// ──────────────────────────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('[bot-worker] Received SIGTERM, draining current job and shutting down...');
  await worker.close();
  process.exit(0);
});
