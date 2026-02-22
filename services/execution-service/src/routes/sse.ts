import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PubSub } from '@google-cloud/pubsub';
import { randomUUID } from 'node:crypto';

const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
});

// Topic name constants — must match publisher.ts to subscribe to the same topics
const EXECUTION_LIFECYCLE_TOPIC = process.env.EXECUTION_LIFECYCLE_TOPIC ?? 'execution-lifecycle';
const TASK_LIFECYCLE_TOPIC = process.env.TASK_LIFECYCLE_TOPIC ?? 'task-lifecycle';
const BOT_LIFECYCLE_TOPIC = process.env.BOT_LIFECYCLE_TOPIC ?? 'bot-lifecycle';
const GUARDRAIL_EVENTS_TOPIC = process.env.GUARDRAIL_EVENTS_TOPIC ?? 'guardrail-events';
const SOUL_LIFECYCLE_TOPIC = process.env.SOUL_LIFECYCLE_TOPIC ?? 'soul-lifecycle';

export const sseRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /:id/events — SSE bridge: Pub/Sub subscription per connection, event forwarding, cleanup on disconnect
  fastify.get('/:id/events', {
    sse: true,
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
    },
  }, async (request, reply) => {
    const { id: executionId } = request.params;
    const connId = randomUUID().slice(0, 8);

    const topicNames = [
      EXECUTION_LIFECYCLE_TOPIC,
      TASK_LIFECYCLE_TOPIC,
      BOT_LIFECYCLE_TOPIC,
      GUARDRAIL_EVENTS_TOPIC,
    ];

    // Create a per-connection subscription on each topic
    const subs = await Promise.all(
      topicNames.map(async (topicName) => {
        const subName = `sse-${executionId.slice(0, 8)}-${connId}-${topicName}`;
        await pubsub.topic(topicName).createSubscription(subName);
        return pubsub.subscription(subName);
      }),
    );

    // Message handler: filter by executionId, forward matching events to SSE stream
    const handler = async (message: { data: Buffer; ack: () => void; nack: () => void }) => {
      try {
        const payload = JSON.parse(message.data.toString()) as { executionId?: string; type?: string };
        if (payload.executionId !== executionId) {
          message.ack(); // Not for this execution — acknowledge and discard
          return;
        }
        if (reply.sse.isConnected) {
          await reply.sse.send({
            event: payload.type ?? 'message',
            data: JSON.stringify(payload),
          });
        }
        message.ack();
      } catch {
        message.nack();
      }
    };

    subs.forEach((sub) => sub.on('message', handler));

    // Guard against double cleanup (Pitfall 7: abnormal disconnects may trigger both handlers)
    let cleanedUp = false;

    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;

      subs.forEach((sub) => sub.removeAllListeners());
      await Promise.allSettled(subs.map((sub) => sub.close()));
      // Delete temporary subscriptions to avoid GCP quota leakage (Pitfall 1)
      // Wrapped in catch for emulator compatibility (Pitfall 4)
      await Promise.allSettled(subs.map((sub) => sub.delete().catch(() => {})));
    };

    // Primary cleanup: SSE close event
    reply.sse.onClose(cleanup);

    // Backup cleanup: raw TCP close for abnormal disconnects (Pitfall 7)
    request.raw.on('close', cleanup);
  });
};

export const lifecycleSseRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /lifecycle — global soul lifecycle SSE stream (not execution-scoped)
  fastify.get('/lifecycle', {
    sse: true,
  }, async (request, reply) => {
    const connId = randomUUID().slice(0, 8);
    const subName = `sse-lifecycle-${connId}`;

    await pubsub.topic(SOUL_LIFECYCLE_TOPIC).createSubscription(subName);
    const sub = pubsub.subscription(subName);

    const handler = async (message: { data: Buffer; ack: () => void; nack: () => void }) => {
      try {
        const payload = JSON.parse(message.data.toString()) as { type?: string };
        if (reply.sse.isConnected) {
          await reply.sse.send({
            event: payload.type ?? 'lifecycle',
            data: JSON.stringify(payload),
          });
        }
        message.ack();
      } catch {
        message.nack();
      }
    };

    sub.on('message', handler);

    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      sub.removeAllListeners();
      await sub.close();
      await sub.delete().catch(() => {});
    };

    reply.sse.onClose(cleanup);
    request.raw.on('close', cleanup);
  });
};
