import { PubSub, type Message } from '@google-cloud/pubsub';
import IORedis from 'ioredis';
import { db, billingEvents, telemetry, bots, executions } from '@claw/db';
import { eq } from 'drizzle-orm';
import { publishBudgetExceeded, publishBillingEvent, publishBudgetAlert } from './publisher';
import { stopBot } from '../orchestrator/bot-orchestrator';
import { getBotsForExecution } from '../orchestrator/bot-registry';
import { transitionExecution } from '../services/execution.service';
import {
  submitTokenUsage,
  submitBotHoursUsage,
} from '../services/stripe';

// ──────────────────────────────────────────────────────────────────────────────
// Cost rate constants (env-var configurable)
// ──────────────────────────────────────────────────────────────────────────────

/** LLM input token cost in cents per million tokens (default: $0.15/M tokens = 15 cents/M) */
const LLM_INPUT_RATE_CENTS_PER_M = Number(process.env.LLM_INPUT_RATE_CENTS_PER_M ?? 15);

/** LLM output token cost in cents per million tokens (default: $0.60/M tokens = 60 cents/M) */
const LLM_OUTPUT_RATE_CENTS_PER_M = Number(process.env.LLM_OUTPUT_RATE_CENTS_PER_M ?? 60);

/** Bot hourly rate in cents (for bot-hours cost component, default: $1.00/hour = 100 cents) */
const BOT_HOURLY_RATE_CENTS = Number(process.env.BOT_HOURLY_RATE_CENTS ?? 100);

// ──────────────────────────────────────────────────────────────────────────────
// Module-level clients
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Redis client for atomic budget enforcement and message deduplication.
 * Uses default enableOfflineQueue: true (write-path should queue, not fail fast).
 */
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

/**
 * Pub/Sub client.
 * When PUBSUB_EMULATOR_HOST is set, the client automatically routes to the local emulator.
 */
const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
});

// ──────────────────────────────────────────────────────────────────────────────
// Atomic budget enforcement Lua script (GARD-01)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Lua script for atomic budget enforcement via Redis EVAL.
 *
 * KEYS[1] = budget:spend:{executionId}
 * KEYS[2] = budget:cap:{executionId}
 * ARGV[1] = amount in cents to add
 *
 * Returns: [new_total_cents, exceeded_flag]
 *   - exceeded_flag = 0 → within budget
 *   - exceeded_flag = 1 → budget exceeded
 *
 * If no cap key exists, spending is always allowed (no cap = allow all spending).
 * This prevents execution creation failures from blocking all spending.
 */
const BUDGET_ENFORCE_SCRIPT = `
local spend_key = KEYS[1]
local cap_key = KEYS[2]
local amount = tonumber(ARGV[1])
local cap = tonumber(redis.call('GET', cap_key))
if cap == nil then
  local new_total = redis.call('INCRBY', spend_key, amount)
  return {new_total, 0}
end
local new_total = redis.call('INCRBY', spend_key, amount)
if new_total > cap then
  return {new_total, 1}
end
return {new_total, 0}
`;

// ──────────────────────────────────────────────────────────────────────────────
// Budget alert tracking
// ──────────────────────────────────────────────────────────────────────────────

const BUDGET_ALERT_THRESHOLDS = [0.5, 0.75, 0.9] as const;

async function checkAndEmitBudgetAlerts(
  executionId: string,
  totalSpentCents: number,
  budgetCapCents: number,
): Promise<void> {
  if (budgetCapCents <= 0) return;

  for (const threshold of BUDGET_ALERT_THRESHOLDS) {
    const thresholdCents = Math.floor(budgetCapCents * threshold);
    const alertedKey = `budget:alert:${executionId}:${threshold}`;

    const alreadyAlerted = await redis.get(alertedKey);
    if (alreadyAlerted) continue;

    if (totalSpentCents >= thresholdCents) {
      await redis.set(alertedKey, '1');
      const pct = Math.round(threshold * 100);

      await publishBudgetAlert({
        type: 'budget_alert',
        executionId,
        threshold: String(pct) as '50' | '75' | '90',
        budgetCapCents,
        totalSpentCents,
        timestamp: new Date().toISOString(),
      });

      console.log(`[billing-engine] Budget alert ${pct}% triggered:`, {
        executionId,
        totalSpentCents,
        budgetCapCents,
      });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Stripe billing helpers
// ──────────────────────────────────────────────────────────────────────────────

interface StripeCustomerInfo {
  stripeCustomerId: string;
  subscriptionItemMap: Record<string, string>;
}

async function getStripeCustomerByProjectId(
  projectId: string,
): Promise<StripeCustomerInfo | null> {
  try {
    const response = await fetch(
      `http://localhost:${process.env.AKASA_SERVER_PORT ?? '3100'}/api/akasa/internal/stripe-customer/${projectId}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      stripeCustomerId?: string;
      subscriptionItemMap?: Record<string, string>;
    };
    if (!data.stripeCustomerId) return null;
    return {
      stripeCustomerId: data.stripeCustomerId,
      subscriptionItemMap: data.subscriptionItemMap ?? {},
    };
  } catch {
    return null;
  }
}

async function submitBillingToStripe(params: {
  executionId: string;
  inputTokens?: number;
  outputTokens?: number;
  botHours?: number;
}): Promise<void> {
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) return;

  try {
    const [execRow] = await db
      .select({ projectId: executions.projectId })
      .from(executions)
      .where(eq(executions.id, params.executionId))
      .limit(1);

    if (!execRow?.projectId) return;

    const customerInfo = await getStripeCustomerByProjectId(execRow.projectId);
    if (!customerInfo) return;

    if ((params.inputTokens ?? 0) > 0 && customerInfo.subscriptionItemMap.input_tokens) {
      await submitTokenUsage({
        subscriptionItemId: customerInfo.subscriptionItemMap.input_tokens,
        quantity: params.inputTokens!,
      });
    }

    if ((params.outputTokens ?? 0) > 0 && customerInfo.subscriptionItemMap.output_tokens) {
      await submitTokenUsage({
        subscriptionItemId: customerInfo.subscriptionItemMap.output_tokens,
        quantity: params.outputTokens!,
      });
    }

    if (params.botHours !== undefined && customerInfo.subscriptionItemMap.bot_hours) {
      await submitBotHoursUsage({
        subscriptionItemId: customerInfo.subscriptionItemMap.bot_hours,
        quantity: params.botHours,
      });
    }
  } catch (err) {
    console.warn('[billing-engine] Stripe submission failed (non-fatal):', (err as Error).message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Core billing functions (exported for direct testing)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Atomically enforce the budget cap for an execution via Redis Lua script.
 * Uses INCRBY inside a Lua script to prevent any application-level read-then-write race condition.
 *
 * GARD-01: No application-level read-then-write — this Lua script is the ONLY budget check.
 *
 * @param executionId - UUID of the execution to charge
 * @param amountCents - Amount to add (integer cents, must be >= 0)
 * @returns { newTotalCents, capExceeded }
 */
export async function enforceAtomicBudget(
  executionId: string,
  amountCents: number,
): Promise<{ newTotalCents: number; capExceeded: boolean }> {
  const result = await redis.eval(
    BUDGET_ENFORCE_SCRIPT,
    2,
    `budget:spend:${executionId}`,
    `budget:cap:${executionId}`,
    amountCents.toString(),
  ) as [number, number];

  return {
    newTotalCents: result[0],
    capExceeded: result[1] === 1,
  };
}

/**
 * Calculate the token cost for an LLM call in integer cents.
 * Uses integer arithmetic throughout — no float values for monetary amounts.
 *
 * @param promptTokens - Input tokens consumed
 * @param completionTokens - Output tokens generated
 * @returns Cost in integer cents (rounded)
 */
export function calculateTokenCost(promptTokens: number, completionTokens: number): number {
  return Math.round(
    (promptTokens * LLM_INPUT_RATE_CENTS_PER_M + completionTokens * LLM_OUTPUT_RATE_CENTS_PER_M) /
      1_000_000,
  );
}

/**
 * Calculate bot-hours from wall-clock runtime and write to the telemetry table.
 * Called when a bot_stopped event arrives — requires both startedAt and stoppedAt to be set.
 *
 * METR-02: Bot-hours are calculated from wall-clock bot_started/bot_stopped pairs.
 *
 * @param botId - UUID of the bot whose hours to record
 * @param executionId - UUID of the execution this bot belongs to
 */
export async function recordBotHours(botId: string, executionId: string): Promise<void> {
  const [botRow] = await db
    .select({ startedAt: bots.startedAt, stoppedAt: bots.stoppedAt })
    .from(bots)
    .where(eq(bots.id, botId));

  if (!botRow?.startedAt || !botRow?.stoppedAt) {
    console.warn('[billing-engine] Cannot record bot hours — missing startedAt or stoppedAt:', {
      botId,
      executionId,
    });
    return 0;
  }

  const wallClockMs = botRow.stoppedAt.getTime() - botRow.startedAt.getTime();
  const botHours = wallClockMs / (1000 * 60 * 60);

  await db.insert(telemetry).values({
    executionId,
    botId,
    metricName: 'bot_hours',
    metricValue: botHours.toFixed(6),
  });

  console.log('[billing-engine] Recorded bot hours:', {
    botId,
    executionId,
    botHours: botHours.toFixed(6),
    wallClockMs,
  });

  return botHours;
}

// ──────────────────────────────────────────────────────────────────────────────
// Billing event persistence
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Insert a billing event row into the billing_events table.
 * Called for every billing-relevant action to provide full auditability (METR-01).
 */
async function writeBillingEvent(params: {
  executionId: string;
  botId?: string;
  eventType: 'bot_started' | 'bot_stopped' | 'tool_invoked' | 'execution_completed' | 'budget_exceeded';
  amountCents?: number;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Look up projectId from parent execution
  let projectId: string | null = null;
  try {
    const [exec] = await db
      .select({ projectId: executions.projectId })
      .from(executions)
      .where(eq(executions.id, params.executionId));
    projectId = exec?.projectId ?? null;
  } catch {
    // Non-fatal: billing events can still be written without projectId
  }

  await db.insert(billingEvents).values({
    executionId: params.executionId,
    botId: params.botId,
    projectId,
    eventType: params.eventType,
    amountCents: params.amountCents,
    tokenCount: params.tokenCount,
    metadata: params.metadata,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Budget exceeded handler
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Handle a budget exceeded event:
 * 1. Write budget_exceeded billing event to Postgres
 * 2. Publish budget_exceeded Pub/Sub event
 * 3. Stop all bots in the execution
 * 4. Transition execution to 'stopped'
 *
 * GARD-01: Budget cap enforcement — execution is stopped when cap is breached.
 */
async function handleBudgetExceeded(executionId: string): Promise<void> {
  try {
    const [capStr, spendStr] = await Promise.all([
      redis.get(`budget:cap:${executionId}`),
      redis.get(`budget:spend:${executionId}`),
    ]);

    const currentSpend = Number(spendStr ?? 0);
    const budgetCap = Number(capStr ?? 0);

    // 1. Write budget_exceeded billing event
    await writeBillingEvent({
      executionId,
      eventType: 'budget_exceeded',
      amountCents: currentSpend,
    });

    // 2. Publish budget_exceeded Pub/Sub event
    await publishBudgetExceeded({
      type: 'budget_exceeded',
      executionId,
      budgetCapCents: budgetCap,
      totalSpentCents: currentSpend,
      timestamp: new Date().toISOString(),
    });

    // 3. Stop all bots in the execution
    const activeBots = getBotsForExecution(executionId);
    await Promise.allSettled(
      activeBots.map((entry) => stopBot(entry.botId, 'terminated')),
    );

    // 4. Transition execution to 'stopped'
    await transitionExecution(executionId, 'running', 'stopped');

    console.log('[billing-engine] Budget exceeded — execution stopped:', {
      executionId,
      currentSpend,
      budgetCap,
    });
  } catch (err) {
    console.error('[billing-engine] Error handling budget exceeded (non-fatal):', {
      executionId,
      error: (err as Error).message,
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Message handlers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Handle billing events from the billing-events Pub/Sub topic.
 *
 * These messages have type: 'billing_event' and are published by:
 * - Tool Gateway (tool_invoked events after successful dispatch)
 * - Completion Checker (execution_completed events)
 *
 * CRITICAL: This handler is for billing-events topic ONLY.
 * Bot lifecycle events (bot_started/bot_stopped) come from the bot-lifecycle topic
 * and are handled by handleBotLifecycleMessage — they have a different type field.
 */
async function handleBillingMessage(message: Message): Promise<void> {
  const payload = JSON.parse(message.data.toString()) as {
    type: string;
    eventType?: string;
    executionId?: string;
    botId?: string;
    amountCents?: number;
    inputTokenCount?: number;
    outputTokenCount?: number;
    tokenCount?: number;
  };

  if (payload.type !== 'billing_event') {
    // Only process billing_event messages on this subscription
    return;
  }

  const { eventType, executionId, botId, amountCents, tokenCount } = payload;

  if (!executionId) {
    console.error('[billing-engine] Missing executionId in billing message');
    return;
  }

  if (eventType === 'tool_invoked') {
    // Enforce budget atomically via Lua script (GARD-01)
    const costCents = amountCents ?? 0;

    if (costCents > 0) {
      const { newTotalCents, capExceeded } = await enforceAtomicBudget(executionId, costCents);

      await writeBillingEvent({
        executionId,
        botId,
        eventType: 'tool_invoked',
        amountCents: costCents,
        tokenCount,
      });

      // Check for budget alerts at 50%, 75%, 90% thresholds
      const [capStr] = await Promise.all([redis.get(`budget:cap:${executionId}`)]);
      const budgetCap = Number(capStr ?? 0);
      if (budgetCap > 0) {
        void checkAndEmitBudgetAlerts(executionId, newTotalCents, budgetCap);
      }

      // Submit token usage to Stripe (fire-and-forget)
      void submitBillingToStripe({
        executionId,
        inputTokens: payload.inputTokenCount,
        outputTokens: payload.outputTokenCount ?? payload.tokenCount,
      });

      if (capExceeded) {
        await handleBudgetExceeded(executionId);
      }
    } else {
      // Tool invoked with zero cost (non-LLM tool or no token data)
      await writeBillingEvent({
        executionId,
        botId,
        eventType: 'tool_invoked',
        amountCents: costCents,
        tokenCount,
      });
    }
  } else if (eventType === 'execution_completed') {
    await writeBillingEvent({
      executionId,
      eventType: 'execution_completed',
    });

    console.log('[billing-engine] Execution completed billing event recorded:', { executionId });
  }
}

/**
 * Handle bot lifecycle events from the bot-lifecycle Pub/Sub topic.
 *
 * These messages have type: 'bot_started' or type: 'bot_stopped' (NOT 'billing_event').
 * They are published by bot-orchestrator's publishBotStarted/publishBotStopped functions.
 *
 * CRITICAL: This handler uses a DIFFERENT subscription from handleBillingMessage.
 * The bot-lifecycle events are NOT wrapped in a billing_event envelope — they have
 * their own type field. Routing both subscriptions through handleBillingMessage would
 * silently drop bot lifecycle events because the type field won't match 'billing_event'.
 */
async function handleBotLifecycleMessage(message: Message): Promise<void> {
  const payload = JSON.parse(message.data.toString()) as {
    type: string;
    botId?: string;
    executionId?: string;
  };

  const { type, botId, executionId } = payload;

  if (!executionId || !botId) {
    console.error('[billing-engine] Missing executionId or botId in bot lifecycle message');
    return;
  }

  if (type === 'bot_started') {
    await writeBillingEvent({
      executionId,
      botId,
      eventType: 'bot_started',
    });

    console.log('[billing-engine] Bot started billing event recorded:', { botId, executionId });
  } else if (type === 'bot_stopped') {
    await writeBillingEvent({
      executionId,
      botId,
      eventType: 'bot_stopped',
    });

    // Calculate and record bot-hours from wall-clock runtime (METR-02)
    const botHours = await recordBotHours(botId, executionId);

    // Submit bot-hours usage to Stripe (fire-and-forget)
    if (botHours > 0) {
      void submitBillingToStripe({
        executionId,
        botHours,
      });
    }

    console.log('[billing-engine] Bot stopped billing event recorded:', { botId, executionId });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Billing Engine lifecycle
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start the Billing Engine.
 *
 * Subscribes to TWO Pub/Sub topics with distinct handlers:
 *
 * 1. billing-events-sub (billing-events topic):
 *    - tool_invoked events → atomic budget enforcement + billing_events row
 *    - execution_completed events → billing_events row
 *    Handler: handleBillingMessage (expects type: 'billing_event')
 *
 * 2. bot-lifecycle-billing-sub (bot-lifecycle topic):
 *    - bot_started events → billing_events row
 *    - bot_stopped events → billing_events row + telemetry row (bot-hours)
 *    Handler: handleBotLifecycleMessage (expects type: 'bot_started' | 'bot_stopped')
 *
 * Message deduplication via Redis SETNX prevents double-counting from Pub/Sub
 * at-least-once delivery guarantees.
 *
 * TODO (Production): Terraform needs to add the 'bot-lifecycle-billing-sub' subscription
 * to the bot-lifecycle topic. In the emulator, subscriptions are auto-created on first use.
 *
 * @returns { shutdown } — call shutdown() to close both subscriptions gracefully
 */
export function startBillingEngine(): { shutdown: () => Promise<void> } {
  // ── Billing events subscription (tool_invoked, execution_completed) ──────────
  const subName = process.env.BILLING_SUBSCRIPTION ?? 'billing-events-sub';
  const subscription = pubsub.subscription(subName);

  subscription.on('message', async (message: Message) => {
    // Deduplication: Redis SETNX with 24-hour TTL prevents double-counting
    const isNew = await redis.set(`processed:${message.id}`, '1', 'EX', 86400, 'NX');
    if (!isNew) {
      message.ack();
      return;
    }
    try {
      await handleBillingMessage(message);
      message.ack();
    } catch (err) {
      console.error('[billing-engine] Failed to process billing message:', err);
      message.nack();
    }
  });

  subscription.on('error', (err) => {
    console.error('[billing-engine] Billing subscription error (non-fatal):', err);
  });

  console.log('[billing-engine] Started, listening on subscription:', subName);

  // ── Bot lifecycle subscription (bot_started, bot_stopped) ────────────────────
  // Uses a DIFFERENT subscription name so it doesn't compete with the Guardrail Watchdog's
  // subscription. The Guardrail Watchdog (04-02) uses 'bot-lifecycle-sub'; the Billing Engine
  // uses 'bot-lifecycle-billing-sub' — each maintains its own cursor/position.
  //
  // TODO (Production): Add 'bot-lifecycle-billing-sub' subscription to Terraform config.
  const botLifecycleSubName = process.env.BOT_LIFECYCLE_SUBSCRIPTION ?? 'bot-lifecycle-billing-sub';
  const botLifecycleSubscription = pubsub.subscription(botLifecycleSubName);

  botLifecycleSubscription.on('message', async (message: Message) => {
    const isNew = await redis.set(`processed:${message.id}`, '1', 'EX', 86400, 'NX');
    if (!isNew) {
      message.ack();
      return;
    }
    try {
      await handleBotLifecycleMessage(message);
      message.ack();
    } catch (err) {
      console.error('[billing-engine] Failed to process bot lifecycle message:', err);
      message.nack();
    }
  });

  botLifecycleSubscription.on('error', (err) => {
    console.error('[billing-engine] Bot lifecycle subscription error (non-fatal):', err);
  });

  console.log('[billing-engine] Also listening on bot lifecycle subscription:', botLifecycleSubName);

  return {
    shutdown: async () => {
      await subscription.close();
      await botLifecycleSubscription.close();
      console.log('[billing-engine] Shutdown complete.');
    },
  };
}

/**
 * Stop the Billing Engine gracefully.
 * Alias for the shutdown function returned by startBillingEngine — for symmetry with
 * other lifecycle exports in this service.
 */
export async function stopBillingEngine(
  engine: { shutdown: () => Promise<void> },
): Promise<void> {
  await engine.shutdown();
}
