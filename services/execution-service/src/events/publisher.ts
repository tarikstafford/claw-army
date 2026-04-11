import { PubSub } from '@google-cloud/pubsub';
import {
  botStartedEventSchema,
  botStoppedEventSchema,
  taskClaimedEventSchema,
  taskCompletedEventSchema,
  executionStatusChangedEventSchema,
  billingEventSchema,
  budgetExceededEventSchema,
  budgetAlertEventSchema,
  guardrailTriggeredEventSchema,
  soulLifecycleEventSchema,
  ringLeaderEventSchema,
  type BotStartedEvent,
  type BotStoppedEvent,
  type TaskClaimedEvent,
  type TaskCompletedEvent,
  type ExecutionStatusChangedEvent,
  type BillingEvent,
  type BudgetExceededEvent,
  type BudgetAlertEvent,
  type GuardrailTriggeredEvent,
  type SoulLifecycleEvent,
  type RingLeaderEvent,
} from '@claw/event-schemas';

/**
 * Pub/Sub client.
 * When PUBSUB_EMULATOR_HOST is set, the client automatically routes to the local emulator.
 * GCP_PROJECT_ID defaults to 'claw-local' for local dev (matches docker-compose.dev.yml).
 */
const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
});

// Topic name constants — configurable via env vars, defaulting to Terraform-provisioned names.
// The env suffix (-{env}) is not included here; Terraform appends it for GCP topics.
// The Pub/Sub emulator auto-creates topics on first publish, so local dev works without the suffix.
const BOT_LIFECYCLE_TOPIC = process.env.BOT_LIFECYCLE_TOPIC ?? 'bot-lifecycle';
const RING_LEADER_EVENTS_TOPIC = process.env.RING_LEADER_EVENTS_TOPIC ?? 'ring-leader-events';
const EXECUTION_LIFECYCLE_TOPIC = process.env.EXECUTION_LIFECYCLE_TOPIC ?? 'execution-lifecycle';
const TASK_LIFECYCLE_TOPIC = process.env.TASK_LIFECYCLE_TOPIC ?? 'task-lifecycle';
const GUARDRAIL_EVENTS_TOPIC = process.env.GUARDRAIL_EVENTS_TOPIC ?? 'guardrail-events';
const BILLING_EVENTS_TOPIC = process.env.BILLING_EVENTS_TOPIC ?? 'billing-events';
const SOUL_LIFECYCLE_TOPIC = process.env.SOUL_LIFECYCLE_TOPIC ?? 'soul-lifecycle';

/**
 * Internal helper: validate with Zod, serialize, and publish to a Pub/Sub topic.
 * Errors are logged but NOT re-thrown — event emission must not crash the orchestrator.
 */
async function publish<T>(
  topicName: string,
  schema: { parse: (data: T) => T },
  event: T,
): Promise<void> {
  try {
    // Validate payload with Zod schema — throws ZodError on invalid data
    const validated = schema.parse(event);
    const data = Buffer.from(JSON.stringify(validated));
    await pubsub.topic(topicName).publishMessage({ data });
  } catch (err) {
    console.error(`[publisher] Failed to publish to ${topicName}:`, err);
  }
}

/**
 * Publish a bot_started lifecycle event.
 * Emitted immediately after a bot container is started and registered.
 */
export async function publishBotStarted(event: BotStartedEvent): Promise<void> {
  await publish(BOT_LIFECYCLE_TOPIC, botStartedEventSchema, event);
}

/**
 * Publish a bot_stopped lifecycle event.
 * Emitted when a bot container is stopped for any reason (idle_timeout, completed, etc.).
 */
export async function publishBotStopped(event: BotStoppedEvent): Promise<void> {
  await publish(BOT_LIFECYCLE_TOPIC, botStoppedEventSchema, event);
}

/**
 * Publish an execution_status_changed event.
 * Emitted when an execution transitions between states (queued -> running, running -> completed, etc.).
 */
export async function publishExecutionStatusChanged(
  event: ExecutionStatusChangedEvent,
): Promise<void> {
  await publish(EXECUTION_LIFECYCLE_TOPIC, executionStatusChangedEventSchema, event);
}

/**
 * Publish a task_claimed event.
 * Emitted when a bot claims a task from the BullMQ queue (job becomes 'active').
 */
export async function publishTaskClaimed(event: TaskClaimedEvent): Promise<void> {
  await publish(TASK_LIFECYCLE_TOPIC, taskClaimedEventSchema, event);
}

/**
 * Publish a task_completed event.
 * Emitted when a bot finishes processing a task (job completes successfully).
 */
export async function publishTaskCompleted(
  event: TaskCompletedEvent,
): Promise<void> {
  await publish(TASK_LIFECYCLE_TOPIC, taskCompletedEventSchema, event);
}

/**
 * Publish a billing event.
 * Emitted by the Billing Engine (04-03) for every billing-relevant action
 * (bot started, tool invoked, execution completed, etc.).
 */
export async function publishBillingEvent(event: BillingEvent): Promise<void> {
  await publish(BILLING_EVENTS_TOPIC, billingEventSchema, event);
}

/**
 * Publish a budget_exceeded event.
 * Emitted when cumulative spend for an execution exceeds its budget cap.
 */
export async function publishBudgetExceeded(event: BudgetExceededEvent): Promise<void> {
  await publish(BILLING_EVENTS_TOPIC, budgetExceededEventSchema, event);
}

/**
 * Publish a budget_alert event.
 * Emitted at 50%, 75%, and 90% of budget cap to warn users before they exceed it.
 */
export async function publishBudgetAlert(event: BudgetAlertEvent): Promise<void> {
  await publish(BILLING_EVENTS_TOPIC, budgetAlertEventSchema, event);
}

/**
 * Publish a guardrail_triggered event.
 * Emitted by the Guardrail Watchdog (04-02) on every revocation or safety action.
 */
export async function publishGuardrailTriggered(event: GuardrailTriggeredEvent): Promise<void> {
  await publish(GUARDRAIL_EVENTS_TOPIC, guardrailTriggeredEventSchema, event);
}

/**
 * Publish a soul lifecycle event (promotion, demotion, retirement, or pioneer detection).
 * Emitted by the God Layer worker (Phase 14 — UIEX-03) after class transitions.
 */
export async function publishSoulLifecycleEvent(event: SoulLifecycleEvent): Promise<void> {
  await publish(SOUL_LIFECYCLE_TOPIC, soulLifecycleEventSchema, event);
}

/**
 * Publish a Ring Leader coordination event (status change, intelligence routing,
 * reallocation, reanchoring, or budget degradation).
 * Emitted by the coordination loop during the 'coordinating' phase (Phase 29+).
 */
export async function publishRingLeaderEvent(event: RingLeaderEvent): Promise<void> {
  await publish(RING_LEADER_EVENTS_TOPIC, ringLeaderEventSchema, event);
}
