import { PubSub } from '@google-cloud/pubsub';
import {
  botStartedEventSchema,
  botStoppedEventSchema,
  taskClaimedEventSchema,
  taskCompletedEventSchema,
  executionStatusChangedEventSchema,
  type BotStartedEvent,
  type BotStoppedEvent,
  type TaskClaimedEvent,
  type TaskCompletedEvent,
  type ExecutionStatusChangedEvent,
} from '@claw/event-schemas';

/**
 * Pub/Sub client.
 * When PUBSUB_EMULATOR_HOST is set, the client automatically routes to the local emulator.
 * GCP_PROJECT_ID defaults to 'claw-local' for local dev (matches docker-compose.dev.yml).
 */
const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
});

// Topic name constants — must match Terraform-provisioned topic names in production
// and the emulator topic setup in docker-compose.dev.yml.
const BOT_EVENTS_TOPIC = 'bot-events';
const EXECUTION_EVENTS_TOPIC = 'execution-events';
const TASK_EVENTS_TOPIC = 'task-events';

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
  await publish(BOT_EVENTS_TOPIC, botStartedEventSchema, event);
}

/**
 * Publish a bot_stopped lifecycle event.
 * Emitted when a bot container is stopped for any reason (idle_timeout, completed, etc.).
 */
export async function publishBotStopped(event: BotStoppedEvent): Promise<void> {
  await publish(BOT_EVENTS_TOPIC, botStoppedEventSchema, event);
}

/**
 * Publish an execution_status_changed event.
 * Emitted when an execution transitions between states (queued -> running, running -> completed, etc.).
 */
export async function publishExecutionStatusChanged(
  event: ExecutionStatusChangedEvent,
): Promise<void> {
  await publish(EXECUTION_EVENTS_TOPIC, executionStatusChangedEventSchema, event);
}

/**
 * Publish a task_claimed event.
 * Emitted when a bot claims a task from the BullMQ queue (job becomes 'active').
 */
export async function publishTaskClaimed(event: TaskClaimedEvent): Promise<void> {
  await publish(TASK_EVENTS_TOPIC, taskClaimedEventSchema, event);
}

/**
 * Publish a task_completed event.
 * Emitted when a bot finishes processing a task (job completes successfully).
 */
export async function publishTaskCompleted(
  event: TaskCompletedEvent,
): Promise<void> {
  await publish(TASK_EVENTS_TOPIC, taskCompletedEventSchema, event);
}
