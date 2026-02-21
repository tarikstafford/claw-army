import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { db, bots } from '@claw/db';
import { eq } from 'drizzle-orm';
import {
  botRegistry,
  registerBot,
  unregisterBot,
  getBot,
  getActiveBotCount,
  getBotsForExecution,
} from './bot-registry';
import { launchBotVM, terminateBotVM } from './gce-bot-launcher';
import { publishBotStarted, publishBotStopped, publishGuardrailTriggered } from '../events/publisher';
import { queueConnection, TASK_QUEUE_NAME, type TaskJobData } from '../queue/task-queue';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** Default 5 minutes. Env override enables short-timeout E2E testing. */
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS ?? 5 * 60 * 1000);

/** Default 30 seconds. Env override enables short-interval E2E testing. */
const IDLE_CHECK_INTERVAL_MS = Number(process.env.IDLE_CHECK_INTERVAL_MS ?? 30_000);

// GCE configuration — all required for production; defaults are for local dev stubs only
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'claw-local';
const GCP_ZONE = process.env.GCP_ZONE ?? 'us-central1-a';
const GCP_NETWORK = process.env.GCP_NETWORK ?? 'default';
const GCP_SUBNET = process.env.GCP_SUBNET ?? 'default';
const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL ?? 'http://tool-gateway:3002';
// VPC-accessible URL for bot VMs (use internal IP, not Docker container name).
// Falls back to TOOL_GATEWAY_URL if not set (works for local dev where Docker DNS resolves).
const TOOL_GATEWAY_VPC_URL = process.env.TOOL_GATEWAY_VPC_URL ?? TOOL_GATEWAY_URL;
const EXECUTION_SERVICE_URL = process.env.EXECUTION_SERVICE_URL ?? 'http://localhost:3001';
const LLM_API_KEY_SECRET_NAME = process.env.LLM_API_KEY_SECRET_NAME ?? 'llm-api-key';
const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'anthropic';
// Service account for bot VMs — must have roles/secretmanager.secretAccessor
const GCP_BOT_SERVICE_ACCOUNT = process.env.GCP_BOT_SERVICE_ACCOUNT ?? 'claw-app-dev@claw-army.iam.gserviceaccount.com';

// ──────────────────────────────────────────────────────────────────────────────
// spawnBot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Provision a single bot VM for the given execution.
 *
 * Lifecycle (async — does NOT wait for VM to be ready):
 * 1. Generate botId UUID
 * 2. Insert bot row in Postgres with status 'spawning' (includes soulId)
 * 3. Submit GCE insert operation via Compute Engine API (receives soulContent for SOUL.md)
 * 4. Register in in-memory bot registry (instanceName set; internalIp + openclawClient = null)
 * 5. Publish bot_started event
 *
 * The bot transitions from 'spawning' → 'idle' when the VM's startup script
 * completes and POSTs to POST /bots/:botId/ready. That endpoint sets internalIp
 * and openclawClient on the registry entry.
 *
 * @param executionId - UUID of the execution this bot belongs to
 * @param soulId - UUID of the bot_souls row assigned to this bot
 * @param soulContent - Full SOUL.md markdown content to deliver to the VM
 * @returns botId and instanceName of the provisioned VM
 */
export async function spawnBot(
  executionId: string,
  soulId: string,
  soulContent: string,
): Promise<{ botId: string; instanceName: string }> {
  const botId = randomUUID();

  // 1. Insert bot row with status 'spawning'
  await db.insert(bots).values({
    id: botId,
    executionId,
    status: 'spawning',
    imageTag: `gce-openclaw-${GCP_ZONE}`,
    soulId,
  });

  const gatewayToken = randomUUID();
  let instanceName: string;

  try {
    // 2. Submit GCE instance creation (returns when VM is created, not when booted)
    const result = await launchBotVM({
      botId,
      executionId,
      projectId: GCP_PROJECT_ID,
      zone: GCP_ZONE,
      network: GCP_NETWORK,
      subnet: GCP_SUBNET,
      toolGatewayUrl: TOOL_GATEWAY_VPC_URL,
      executionServiceUrl: EXECUTION_SERVICE_URL,
      llmApiKeySecretName: LLM_API_KEY_SECRET_NAME,
      llmProvider: LLM_PROVIDER,
      botServiceAccount: GCP_BOT_SERVICE_ACCOUNT,
      gatewayToken,
      soulContent,
    });
    instanceName = result.instanceName;
  } catch (err) {
    console.error('[bot-orchestrator] Failed to launch VM:', {
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

  // 3. Update bot row — keep 'spawning'; GCE instance name stored in containerId column
  //    (reusing containerId column for instanceName avoids a DB migration for now)
  await db
    .update(bots)
    .set({
      containerId: instanceName,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bots.id, botId));

  // 4. Register in in-memory registry (internalIp + openclawClient filled in on /ready callback)
  registerBot({
    botId,
    executionId,
    instanceName,
    internalIp: null,
    gatewayToken,
    openclawClient: null,
    currentJobId: null,
    soulId,
    startedAt: Date.now(),
    lastTaskClaimedAt: Date.now(),
  });

  // 5. Publish bot_started event
  await publishBotStarted({
    type: 'bot_started',
    botId,
    executionId,
    timestamp: new Date().toISOString(),
    metadata: { instanceName, zone: GCP_ZONE },
  });

  console.log('[bot-orchestrator] VM provisioned (waiting for startup):', {
    botId,
    instanceName,
    executionId,
  });

  return { botId, instanceName };
}

// ──────────────────────────────────────────────────────────────────────────────
// stopBot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Stop a bot VM gracefully.
 * Disconnects the OpenClaw client then deletes the GCE instance.
 * The GCE delete operation is fire-and-forget (does not block).
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

  // Disconnect OpenClaw WebSocket client if connected
  if (botEntry.openclawClient) {
    botEntry.openclawClient.disconnect();
  }

  // Fire-and-forget GCE instance deletion (deletion is eventual, ~30-60s)
  terminateBotVM({
    projectId: GCP_PROJECT_ID,
    zone: GCP_ZONE,
    instanceName: botEntry.instanceName,
  }).catch((err: Error) => {
    console.error('[bot-orchestrator] Error terminating VM (non-fatal):', {
      botId,
      instanceName: botEntry.instanceName,
      error: err.message,
    });
  });

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
 * Provision bot VMs for the given execution, one per soul in the souls array.
 * Respects the current bot count — does not over-provision.
 *
 * Spawns in parallel using Promise.allSettled so one failure doesn't block others.
 *
 * @param executionId - UUID of the execution to spawn bots for
 * @param souls - Array of { soulId, soulContent } — length determines bot count
 */
export async function spawnBotsForExecution(
  executionId: string,
  souls: Array<{ soulId: string; soulContent: string }>,
): Promise<void> {
  const currentCount = getActiveBotCount(executionId);
  const toSpawn = Math.max(0, souls.length - currentCount);

  if (toSpawn === 0) {
    console.log('[bot-orchestrator] No bots to spawn (already at max):', {
      executionId,
      targetCount: souls.length,
      currentCount,
    });
    return;
  }

  console.log('[bot-orchestrator] Spawning bot VMs:', {
    executionId,
    toSpawn,
    currentCount,
    targetCount: souls.length,
  });

  const results = await Promise.allSettled(
    souls.slice(currentCount).map((soul) =>
      spawnBot(executionId, soul.soulId, soul.soulContent),
    ),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[bot-orchestrator] Bot VM spawn failed:', {
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
 * Only considers bots that are fully ready (internalIp set + openclawClient connected).
 * Bots still in 'spawning' state are excluded — they may legitimately take several
 * minutes before their startup script completes.
 *
 * @returns The interval timer handle (pass to stopIdleChecker to clear)
 */
export function startIdleChecker(): NodeJS.Timeout {
  return setInterval(async () => {
    const now = Date.now();

    for (const entry of botRegistry.values()) {
      // Only check bots that are fully ready (not still starting up)
      if (!entry.openclawClient?.isConnected) continue;

      if (now - entry.lastTaskClaimedAt > IDLE_TIMEOUT_MS) {
        console.log('[bot-orchestrator] Terminating idle bot:', {
          botId: entry.botId,
          executionId: entry.executionId,
          idleMs: now - entry.lastTaskClaimedAt,
        });
        try {
          await stopBot(entry.botId, 'idle_timeout');
          await publishGuardrailTriggered({
            type: 'guardrail_triggered',
            botId: entry.botId,
            executionId: entry.executionId,
            reason: 'idle_timeout',
            action: 'terminated',
            timestamp: new Date().toISOString(),
          });
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
 * Listens for 'active' events (when a job is claimed) and updates
 * lastTaskClaimedAt for ALL bots in that execution.
 *
 * This prevents the idle checker from terminating bots that are waiting
 * their turn while sibling bots are actively processing.
 *
 * @returns The QueueEvents instance (call .close() on shutdown)
 */
export function startQueueEventListener(): QueueEvents {
  const queueEventsConnection = { ...queueConnection };

  const queueEvents = new QueueEvents(TASK_QUEUE_NAME, {
    connection: queueEventsConnection,
  });

  const taskQ = new Queue<TaskJobData>(TASK_QUEUE_NAME, {
    connection: { ...queueConnection },
  });

  queueEvents.on('active', async ({ jobId }) => {
    try {
      const job = await taskQ.getJob(jobId);
      if (!job) return;

      const { executionId } = job.data;

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
