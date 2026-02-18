import Docker from 'dockerode';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { db, bots } from '@claw/db';
import { eq } from 'drizzle-orm';
import { mintBotJwt } from './jwt';
import {
  botRegistry,
  registerBot,
  unregisterBot,
  getBot,
  getActiveBotCount,
  getBotsForExecution,
} from './bot-registry';
import { publishBotStarted, publishBotStopped } from '../events/publisher';
import { queueConnection, TASK_QUEUE_NAME, type TaskJobData } from '../queue/task-queue';

// ──────────────────────────────────────────────────────────────────────────────
// Docker client
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Docker client connected via Unix socket.
 * macOS Docker Desktop 4.18+ may put the socket at $HOME/.docker/run/docker.sock —
 * the DOCKER_SOCKET_PATH env variable override handles this.
 */
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock',
});

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** Default 5 minutes. Env override enables short-timeout E2E testing. */
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS ?? 5 * 60 * 1000);

/** Default 30 seconds. Env override enables short-interval E2E testing. */
const IDLE_CHECK_INTERVAL_MS = Number(process.env.IDLE_CHECK_INTERVAL_MS ?? 30_000);

const BOT_IMAGE = process.env.BOT_IMAGE ?? 'claw-bot-worker:latest';
const BOT_NETWORK = process.env.BOT_NETWORK ?? 'bot-internal';
const BOT_MEMORY_LIMIT = 512 * 1024 * 1024; // 512 MB
const BOT_CPU_LIMIT = 1_000_000_000; // 1 CPU in nanocpus

// ──────────────────────────────────────────────────────────────────────────────
// spawnBot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Spawn a single bot container for the given execution.
 *
 * Lifecycle:
 * 1. Generate botId UUID
 * 2. Mint 24-hour JWT and inject into container env
 * 3. Insert bot row in Postgres with status 'spawning'
 * 4. Create container via dockerode (memory + CPU caps, no persistent filesystem)
 * 5. Start container, inspect to get stable containerId
 * 6. Update bot row to status 'idle'
 * 7. Register in in-memory bot registry
 * 8. Publish bot_started event to Pub/Sub
 *
 * @param executionId - UUID of the execution this bot belongs to
 * @returns botId and containerId of the spawned container
 */
export async function spawnBot(
  executionId: string,
): Promise<{ botId: string; containerId: string }> {
  const botId = randomUUID();

  // 1. Mint JWT before container creation — injected as BOT_JWT env var
  const jwt = await mintBotJwt(botId, executionId);

  // 2. Insert bot row with status 'spawning' — Postgres is the durable record
  await db.insert(bots).values({
    id: botId,
    executionId,
    status: 'spawning',
    imageTag: BOT_IMAGE,
  });

  let container: Docker.Container;
  let containerId: string;

  try {
    // 3. Create container with resource limits (ORCH-04)
    //    - Memory: 512 MB hard limit
    //    - NanoCpus: 1 CPU
    //    - NetworkMode: isolated network (no internet access)
    //    - AutoRemove: container cleans up automatically on exit (no persistent filesystem)
    container = await docker.createContainer({
      Image: BOT_IMAGE,
      name: `claw-bot-${botId}`,
      Env: [
        `BOT_ID=${botId}`,
        `EXECUTION_ID=${executionId}`,
        `BOT_JWT=${jwt}`,
        `REDIS_URL=${process.env.REDIS_URL ?? 'redis://localhost:6379'}`,
        `DATABASE_URL=${process.env.DATABASE_URL ?? ''}`,
        `PUBSUB_EMULATOR_HOST=${process.env.PUBSUB_EMULATOR_HOST ?? ''}`,
        `GCP_PROJECT_ID=${process.env.GCP_PROJECT_ID ?? 'claw-local'}`,
        `TOOL_GATEWAY_URL=${process.env.TOOL_GATEWAY_URL ?? 'http://tool-gateway:3002'}`,
        `LLM_MODEL=${process.env.BOT_LLM_MODEL ?? 'gpt-4o-mini'}`,
      ],
      HostConfig: {
        Memory: BOT_MEMORY_LIMIT,
        NanoCpus: BOT_CPU_LIMIT,
        NetworkMode: BOT_NETWORK,
        AutoRemove: true,
      },
    });

    // 4. Start the container
    await container.start();

    // 5. Inspect to get the stable containerId (long SHA256 form)
    const info = await container.inspect();
    containerId = info.Id;
  } catch (err) {
    // Container creation or start failed — mark bot as failed in Postgres
    console.error('[bot-orchestrator] Failed to spawn container:', {
      botId,
      executionId,
      error: (err as Error).message,
    });
    await db
      .update(bots)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(bots.id, botId));
    throw err;
  }

  // 6. Update bot row to 'idle' with container metadata
  await db
    .update(bots)
    .set({
      status: 'idle',
      containerId,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bots.id, botId));

  // 7. Register in in-memory bot registry
  registerBot({
    botId,
    executionId,
    containerId,
    container,
    startedAt: Date.now(),
    lastTaskClaimedAt: Date.now(),
  });

  // 8. Publish bot_started event
  await publishBotStarted({
    type: 'bot_started',
    botId,
    executionId,
    timestamp: new Date().toISOString(),
    metadata: { imageTag: BOT_IMAGE, containerId },
  });

  return { botId, containerId };
}

// ──────────────────────────────────────────────────────────────────────────────
// stopBot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Stop a bot container gracefully.
 * Sends SIGTERM with a 5-second grace period before SIGKILL.
 *
 * With AutoRemove: true, the container is removed automatically on exit.
 * container.stop() may throw 409 Conflict if the container already exited — ignored.
 *
 * @param botId - UUID of the bot to stop
 * @param reason - Why the bot was stopped (for event metadata)
 */
export async function stopBot(
  botId: string,
  reason: 'completed' | 'terminated' | 'failed' | 'idle_timeout',
): Promise<void> {
  const botEntry = getBot(botId);

  if (!botEntry) {
    console.warn('[bot-orchestrator] stopBot called for unknown botId:', botId);
    return;
  }

  // Stop the container with 5-second SIGTERM grace period
  try {
    await botEntry.container.stop({ t: 5 });
  } catch (err) {
    const error = err as { statusCode?: number; message?: string };
    // 409 Conflict = container already exited (AutoRemove cleaned it up)
    // 304 Not Modified = container already stopped
    if (error.statusCode !== 409 && error.statusCode !== 304) {
      console.error('[bot-orchestrator] Error stopping container:', {
        botId,
        error: error.message,
      });
    }
  }

  // Update bot row in Postgres
  await db
    .update(bots)
    .set({ status: 'stopped', stoppedAt: new Date(), updatedAt: new Date() })
    .where(eq(bots.id, botId));

  // Remove from in-memory registry
  unregisterBot(botId);

  // Publish bot_stopped event
  await publishBotStopped({
    type: 'bot_stopped',
    botId,
    executionId: botEntry.executionId,
    timestamp: new Date().toISOString(),
    reason,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// spawnBotsForExecution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Spawn enough bots to reach maxBots for the given execution.
 * Respects the current bot count — does not over-spawn (ORCH-01).
 *
 * Spawns bots in parallel using Promise.allSettled so one failure
 * doesn't block the others.
 *
 * @param executionId - UUID of the execution to spawn bots for
 * @param maxBots - Maximum number of bots allowed for this execution
 */
export async function spawnBotsForExecution(
  executionId: string,
  maxBots: number,
): Promise<void> {
  const currentCount = getActiveBotCount(executionId);
  const toSpawn = Math.max(0, maxBots - currentCount);

  if (toSpawn === 0) {
    console.log('[bot-orchestrator] No bots to spawn (already at max):', {
      executionId,
      maxBots,
      currentCount,
    });
    return;
  }

  console.log('[bot-orchestrator] Spawning bots:', {
    executionId,
    toSpawn,
    currentCount,
    maxBots,
  });

  const results = await Promise.allSettled(
    Array.from({ length: toSpawn }, () => spawnBot(executionId)),
  );

  // Log any failed spawns without throwing
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[bot-orchestrator] Bot spawn failed:', {
        executionId,
        error: (result.reason as Error).message,
      });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Idle bot checker
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start the idle bot checker.
 * Runs every IDLE_CHECK_INTERVAL_MS and terminates bots that have not had any
 * task activity for IDLE_TIMEOUT_MS (default: 5 minutes).
 *
 * Idle detection: if Date.now() - entry.lastTaskClaimedAt > IDLE_TIMEOUT_MS
 * The lastTaskClaimedAt timestamp is kept fresh by the QueueEvents 'active'
 * listener — when any task in the execution becomes active, ALL bots in that
 * execution have their lastTaskClaimedAt reset.
 *
 * @returns The interval timer handle (pass to stopIdleChecker to clear)
 */
export function startIdleChecker(): NodeJS.Timeout {
  return setInterval(async () => {
    const now = Date.now();

    for (const entry of botRegistry.values()) {
      if (now - entry.lastTaskClaimedAt > IDLE_TIMEOUT_MS) {
        console.log('[bot-orchestrator] Terminating idle bot:', {
          botId: entry.botId,
          executionId: entry.executionId,
          idleMs: now - entry.lastTaskClaimedAt,
        });
        try {
          await stopBot(entry.botId, 'idle_timeout');
        } catch (err) {
          console.error('[bot-orchestrator] Failed to stop idle bot:', {
            botId: entry.botId,
            error: (err as Error).message,
          });
        }
      }
    }
  }, IDLE_CHECK_INTERVAL_MS);
}

/**
 * Stop the idle bot checker.
 * @param timer - The timer handle returned by startIdleChecker
 */
export function stopIdleChecker(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}

// ──────────────────────────────────────────────────────────────────────────────
// Queue event listener (for idle-check accuracy)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start a QueueEvents listener on the task queue.
 * Listens for 'active' events (when a worker claims a job) and updates
 * lastTaskClaimedAt for ALL bots in that execution.
 *
 * WHY update ALL bots for the execution?
 * Each execution has N bots processing a shared queue. When any task becomes
 * active, it proves the execution's bots are still productive. This prevents
 * the idle checker from terminating bots waiting their turn while sibling bots
 * are actively processing.
 *
 * IMPORTANT: Uses queueConnection.duplicate() because QueueEvents requires a
 * dedicated blocking connection. Sharing with other clients causes issues.
 * Since queueConnection is a plain options object (not an IORedis instance),
 * we create a new connection object by spreading it.
 *
 * @returns The QueueEvents instance (call .close() on shutdown)
 */
export function startQueueEventListener(): QueueEvents {
  // Create a dedicated connection for QueueEvents (blocking subscribe mode)
  const queueEventsConnection = { ...queueConnection };

  const queueEvents = new QueueEvents(TASK_QUEUE_NAME, {
    connection: queueEventsConnection,
  });

  // Shared queue instance for job lookups
  const taskQ = new Queue<TaskJobData>(TASK_QUEUE_NAME, {
    connection: { ...queueConnection },
  });

  queueEvents.on('active', async ({ jobId }) => {
    try {
      const job = await taskQ.getJob(jobId);
      if (!job) return;

      const { executionId } = job.data;

      // Reset lastTaskClaimedAt for ALL bots in this execution
      const activeBots = getBotsForExecution(executionId);
      for (const entry of activeBots) {
        entry.lastTaskClaimedAt = Date.now();
      }

      if (activeBots.length > 0) {
        console.log('[QueueEvents] Task active — refreshed idle timer:', {
          jobId,
          executionId,
          botsRefreshed: activeBots.length,
        });
      }
    } catch (err) {
      console.error('[QueueEvents] Error handling active event:', err);
    }
  });

  return queueEvents;
}

/**
 * Stop the QueueEvents listener and close its connection.
 * @param queueEvents - The QueueEvents instance from startQueueEventListener
 */
export async function stopQueueEventListener(queueEvents: QueueEvents): Promise<void> {
  await queueEvents.close();
}
