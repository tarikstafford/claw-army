import 'dotenv/config';
import { Worker } from 'bullmq';
import { PubSub } from '@google-cloud/pubsub';
import { db, tasks, bots } from '@claw/db';
import { eq, sql } from 'drizzle-orm';
import {
  taskClaimedEventSchema,
  taskCompletedEventSchema,
  type TaskClaimedEvent,
  type TaskCompletedEvent,
} from '@claw/event-schemas';

// ──────────────────────────────────────────────────────────────────────────────
// Environment variables
// ──────────────────────────────────────────────────────────────────────────────

const BOT_ID = process.env.BOT_ID ?? '';
const EXECUTION_ID = process.env.EXECUTION_ID ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

if (!BOT_ID) {
  console.error('[stub-bot] BOT_ID env var is required');
  process.exit(1);
}

if (!EXECUTION_ID) {
  console.error('[stub-bot] EXECUTION_ID env var is required');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Redis connection parsing
// ──────────────────────────────────────────────────────────────────────────────

function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number; maxRetriesPerRequest: null } {
  try {
    const parsed = new URL(url);
    const opts: { host: string; port: number; password?: string; db?: number; maxRetriesPerRequest: null } = {
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
// Pub/Sub publisher
// ──────────────────────────────────────────────────────────────────────────────

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID ?? 'claw-local' });
const TASK_EVENTS_TOPIC = 'task-events';

async function publishTaskClaimed(event: TaskClaimedEvent): Promise<void> {
  try {
    taskClaimedEventSchema.parse(event);
    await pubsub.topic(TASK_EVENTS_TOPIC).publishMessage({
      data: Buffer.from(JSON.stringify(event)),
    });
  } catch (err) {
    console.error('[stub-bot] Failed to publish task_claimed:', err);
  }
}

async function publishTaskCompleted(event: TaskCompletedEvent): Promise<void> {
  try {
    taskCompletedEventSchema.parse(event);
    await pubsub.topic(TASK_EVENTS_TOPIC).publishMessage({
      data: Buffer.from(JSON.stringify(event)),
    });
  } catch (err) {
    console.error('[stub-bot] Failed to publish task_completed:', err);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// BullMQ Worker
// ──────────────────────────────────────────────────────────────────────────────

const TASK_QUEUE_NAME = 'claw-tasks';

const worker = new Worker(
  TASK_QUEUE_NAME,
  async (job) => {
    const { taskId } = job.data as { taskId: string; executionId: string; description: string };
    const claimStartMs = Date.now();

    console.log(`[stub-bot] Claiming task ${taskId}`);

    // Update Postgres: mark task as claimed
    await db
      .update(tasks)
      .set({
        status: 'claimed',
        claimedByBotId: BOT_ID,
        leaseExpiresAt: new Date(Date.now() + 30_000),
        attemptCount: sql`${tasks.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish task_claimed event
    await publishTaskClaimed({
      type: 'task_claimed',
      taskId,
      botId: BOT_ID,
      executionId: EXECUTION_ID,
      timestamp: new Date().toISOString(),
    });

    // Simulate work: 1-2 second random delay
    await new Promise<void>((r) => setTimeout(r, 1000 + Math.random() * 1000));

    // Update Postgres: mark task as completed
    await db
      .update(tasks)
      .set({
        status: 'completed',
        result: 'Stub completion',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Increment bot's tasksCompleted counter
    await db
      .update(bots)
      .set({
        tasksCompleted: sql`${bots.tasksCompleted} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(bots.id, BOT_ID));

    // Publish task_completed event
    await publishTaskCompleted({
      type: 'task_completed',
      taskId,
      botId: BOT_ID,
      executionId: EXECUTION_ID,
      durationMs: Date.now() - claimStartMs,
      timestamp: new Date().toISOString(),
    });

    console.log(`[stub-bot] Completed task ${taskId}`);

    return 'Stub completion';
  },
  {
    connection: redisConnection,
    lockDuration: 30_000,
    stalledInterval: 15_000,
    maxStalledCount: 2,
    concurrency: 1,
  },
);

worker.on('error', (err) => {
  console.error('[stub-bot] Worker error:', err);
});

worker.on('completed', (job) => {
  console.log(`[stub-bot] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[stub-bot] Job ${job?.id} failed:`, err);
});

console.log(`[stub-bot] Stub bot ${BOT_ID} ready, waiting for tasks...`);

// ──────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('[stub-bot] Received SIGTERM, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[stub-bot] Received SIGINT, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});
