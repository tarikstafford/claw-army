import { Worker, type Job } from 'bullmq';
import { db, bots, tasks } from '@claw/db';
import { eq, sql } from 'drizzle-orm';
import {
  workerConnection,
  TASK_QUEUE_NAME,
  type TaskJobData,
} from './task-queue';
import {
  acquireIdleBot,
  releaseBot,
  getBotsForExecution,
} from '../orchestrator/bot-registry';
import { publishTaskCompleted } from '../events/publisher';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/**
 * How long to wait for a ready bot VM before abandoning the job.
 * GCE VMs take 2-5 minutes to boot + install OpenClaw. 10 minutes is generous.
 */
const BOT_WAIT_TIMEOUT_MS = Number(process.env.BOT_WAIT_TIMEOUT_MS ?? 10 * 60 * 1000);

/**
 * Poll interval when waiting for a bot VM to become available.
 */
const BOT_WAIT_POLL_MS = 5_000;

/**
 * Lock duration for dispatcher jobs — must exceed BOT_WAIT_TIMEOUT_MS so jobs
 * don't go stale while waiting for a bot VM to boot.
 */
const DISPATCH_LOCK_DURATION_MS = BOT_WAIT_TIMEOUT_MS + 60_000; // timeout + 1min buffer

/**
 * How long to wait for a task to complete on an OpenClaw bot VM.
 * Tasks that exceed this are failed and the bot is released.
 */
const TASK_EXECUTION_TIMEOUT_MS = Number(process.env.TASK_EXECUTION_TIMEOUT_MS ?? 30 * 60 * 1000);

// ──────────────────────────────────────────────────────────────────────────────
// waitForAvailableBot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Poll the bot registry until an idle, connected bot is available for the
 * given execution, then atomically acquire it.
 *
 * Returns null if no bot becomes available within BOT_WAIT_TIMEOUT_MS.
 */
async function waitForAvailableBot(
  executionId: string,
  jobId: string,
): Promise<ReturnType<typeof acquireIdleBot>> {
  const deadline = Date.now() + BOT_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const bot = acquireIdleBot(executionId, jobId);
    if (bot) return bot;

    // Check if there are any bots for this execution at all
    const allBots = getBotsForExecution(executionId);
    if (allBots.length === 0) {
      console.warn('[openclaw-dispatcher] No bots registered for execution:', executionId);
      // Bots may not have been spawned yet (race between spawnBotsForExecution and job processing)
    }

    await new Promise((resolve) => setTimeout(resolve, BOT_WAIT_POLL_MS));
  }

  console.error('[openclaw-dispatcher] Timed out waiting for available bot:', {
    executionId,
    timeoutMs: BOT_WAIT_TIMEOUT_MS,
  });
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// dispatchTaskToBot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Send a task to an acquired bot's OpenClaw Gateway and wait for completion.
 * Returns the task result string or throws on failure/timeout.
 */
async function dispatchTaskToBot(
  bot: NonNullable<ReturnType<typeof acquireIdleBot>>,
  job: Job<TaskJobData>,
): Promise<string> {
  const { openclawClient, botId } = bot;

  if (!openclawClient) {
    throw new Error(`Bot ${botId} has no OpenClaw client`);
  }

  const { taskId, executionId, description } = job.data;
  const taskStartMs = Date.now();

  console.log('[openclaw-dispatcher] Dispatching task to bot:', {
    taskId,
    executionId,
    botId,
    instanceName: bot.instanceName,
    jobId: job.id,
  });

  // Update task in DB: mark as claimed
  await db
    .update(tasks)
    .set({
      status: 'claimed',
      claimedByBotId: botId,
      attemptCount: sql`${tasks.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Increment bot tasksClaimed counter
  await db
    .update(bots)
    .set({
      tasksClaimed: sql`${bots.tasksClaimed} + 1`,
      status: 'working',
      updatedAt: new Date(),
    })
    .where(eq(bots.id, botId));

  // Keep the job lock alive while waiting (renew every 20s)
  const renewInterval = setInterval(() => {
    job.extendLock(job.token!, DISPATCH_LOCK_DURATION_MS).catch(() => {});
  }, 20_000);

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task execution timed out after ${TASK_EXECUTION_TIMEOUT_MS}ms`));
      }, TASK_EXECUTION_TIMEOUT_MS);

      openclawClient.onComplete((taskResult) => {
        clearTimeout(timeout);
        resolve(taskResult);
      });

      openclawClient.onError((error) => {
        clearTimeout(timeout);
        reject(new Error(`OpenClaw task failed: ${error}`));
      });

      openclawClient.sendTask(description).catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Task succeeded — update DB
    await db
      .update(tasks)
      .set({ status: 'completed', result, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    await db
      .update(bots)
      .set({
        tasksCompleted: sql`${bots.tasksCompleted} + 1`,
        status: 'idle',
        updatedAt: new Date(),
      })
      .where(eq(bots.id, botId));

    // Publish task_completed event
    await publishTaskCompleted({
      type: 'task_completed',
      taskId,
      executionId,
      botId,
      durationMs: Date.now() - taskStartMs,
      timestamp: new Date().toISOString(),
    }).catch((err: Error) => {
      console.error('[openclaw-dispatcher] Failed to publish task_completed (non-fatal):', err.message);
    });

    console.log('[openclaw-dispatcher] Task completed:', { taskId, botId, resultPreview: result.slice(0, 100) });
    return result;
  } catch (err) {
    // Task failed — update DB
    await db
      .update(tasks)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    await db
      .update(bots)
      .set({
        tasksFailed: sql`${bots.tasksFailed} + 1`,
        status: 'idle',
        updatedAt: new Date(),
      })
      .where(eq(bots.id, botId));

    console.error('[openclaw-dispatcher] Task failed:', { taskId, botId, error: (err as Error).message });
    throw err;
  } finally {
    clearInterval(renewInterval);
    releaseBot(botId);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// startOpenClawDispatcher
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start the OpenClaw dispatcher — a BullMQ Worker that pulls tasks from the
 * claw-tasks queue and dispatches them to available bot VMs via OpenClaw WebSocket.
 *
 * This replaces the per-container bot-worker BullMQ worker. The dispatcher
 * runs inside execution-service and manages all bot VMs centrally.
 *
 * Concurrency is set to 20 to allow multiple tasks to be processed in parallel
 * (one per bot VM). Each concurrency slot waits for an available bot.
 */
export function startOpenClawDispatcher(): Worker<TaskJobData, string> {
  const worker = new Worker<TaskJobData, string>(
    TASK_QUEUE_NAME,
    async (job: Job<TaskJobData>) => {
      const { executionId } = job.data;

      // Wait for an available bot VM with a connected OpenClaw client
      const bot = await waitForAvailableBot(executionId, job.id!);
      if (!bot) {
        throw new Error(
          `No bot VM became available for execution ${executionId} within ${BOT_WAIT_TIMEOUT_MS}ms`,
        );
      }

      // Dispatch and wait for completion
      return dispatchTaskToBot(bot, job);
    },
    {
      connection: workerConnection,
      lockDuration: DISPATCH_LOCK_DURATION_MS,
      stalledInterval: 30_000,
      maxStalledCount: 1,
      concurrency: 20, // support up to 20 concurrent bot VMs per dispatcher
    },
  );

  worker.on('error', (err) => {
    console.error('[openclaw-dispatcher] Worker error:', err);
  });

  worker.on('failed', (job, err) => {
    console.error('[openclaw-dispatcher] Job failed:', {
      jobId: job?.id,
      taskId: job?.data?.taskId,
      error: err.message,
    });
  });

  console.log('[openclaw-dispatcher] Dispatcher started');
  return worker;
}
