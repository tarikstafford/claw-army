import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, bots, toolInvocations } from '@claw/db';
import { eq, gt, and } from 'drizzle-orm';
import { computeBotMetrics } from '../performance/metrics-computer';
import { PubSub } from '@google-cloud/pubsub';
import { randomUUID } from 'node:crypto';
import { getBot } from '../orchestrator/bot-registry';
import { OpenClawClient } from '../orchestrator/openclaw-client';
import { publishBotStarted } from '../events/publisher';

const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID ?? 'claw-local',
});

const BOT_LIFECYCLE_TOPIC = process.env.BOT_LIFECYCLE_TOPIC ?? 'bot-lifecycle';
const TASK_LIFECYCLE_TOPIC = process.env.TASK_LIFECYCLE_TOPIC ?? 'task-lifecycle';
const GUARDRAIL_EVENTS_TOPIC = process.env.GUARDRAIL_EVENTS_TOPIC ?? 'guardrail-events';

export const botsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /by-execution/:executionId — list all bots for an execution
  fastify.get('/by-execution/:executionId', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(
          Type.Object({
            id: Type.String({ format: 'uuid' }),
            status: Type.Union([
              Type.Literal('spawning'),
              Type.Literal('idle'),
              Type.Literal('working'),
              Type.Literal('stopping'),
              Type.Literal('stopped'),
              Type.Literal('failed'),
            ]),
            tasksClaimed: Type.Integer(),
            tasksCompleted: Type.Integer(),
            tasksFailed: Type.Integer(),
            startedAt: Type.Union([
              Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
              Type.Null(),
            ]),
          }),
        ),
      },
    },
  }, async (request) => {
    const { executionId } = request.params;
    return db
      .select({
        id: bots.id,
        status: bots.status,
        tasksClaimed: bots.tasksClaimed,
        tasksCompleted: bots.tasksCompleted,
        tasksFailed: bots.tasksFailed,
        startedAt: bots.startedAt,
      })
      .from(bots)
      .where(eq(bots.executionId, executionId))
      .orderBy(bots.startedAt);
  });

  // GET /:botId/detail — per-bot metrics and step trace from tool_invocations
  fastify.get('/:botId/detail', {
    schema: {
      params: Type.Object({
        botId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          bot: Type.Object({
            id: Type.String({ format: 'uuid' }),
            status: Type.Union([
              Type.Literal('spawning'),
              Type.Literal('idle'),
              Type.Literal('working'),
              Type.Literal('stopping'),
              Type.Literal('stopped'),
              Type.Literal('failed'),
            ]),
            compositeScore: Type.Union([Type.Number(), Type.Null()]),
            tier: Type.Union([Type.String(), Type.Null()]),
            startedAt: Type.Union([
              Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
              Type.Null(),
            ]),
            stoppedAt: Type.Union([
              Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
              Type.Null(),
            ]),
          }),
          metrics: Type.Object({
            botId: Type.String({ format: 'uuid' }),
            tasksCompleted: Type.Integer(),
            tasksFailed: Type.Integer(),
            totalTasks: Type.Integer(),
            successRate: Type.Number(),
            totalCostCents: Type.Integer(),
            costPerTaskCents: Type.Integer(),
            totalTokens: Type.Integer(),
            tokensPerTask: Type.Number(),
            toolCallsPerTask: Type.Number(),
            totalToolCalls: Type.Integer(),
            botHours: Type.Number(),
            tasksPerMinute: Type.Number(),
            totalRetries: Type.Integer(),
            errorRate: Type.Number(),
            idleRatio: Type.Number(),
          }),
          steps: Type.Array(
            Type.Object({
              toolName: Type.String(),
              invocationId: Type.String({ format: 'uuid' }),
              rejected: Type.Boolean(),
              rejectionReason: Type.Union([Type.String(), Type.Null()]),
              durationMs: Type.Union([Type.Integer(), Type.Null()]),
              promptTokens: Type.Union([Type.Integer(), Type.Null()]),
              completionTokens: Type.Union([Type.Integer(), Type.Null()]),
              totalTokens: Type.Union([Type.Integer(), Type.Null()]),
              requestSummary: Type.Union([Type.Unknown(), Type.Null()]),
              responseSummary: Type.Union([Type.Unknown(), Type.Null()]),
              invokedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            }),
          ),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { botId } = request.params;

    // Look up bot by botId
    const [bot] = await db
      .select()
      .from(bots)
      .where(eq(bots.id, botId));

    if (!bot) {
      return reply.code(404).send({ error: 'Bot not found' });
    }

    // Compute full BotMetrics using the existing metrics-computer
    const metrics = await computeBotMetrics(bot.executionId, botId);

    // Query step trace from tool_invocations ordered by invoked_at ASC
    const steps = await db
      .select({
        toolName: toolInvocations.toolName,
        invocationId: toolInvocations.invocationId,
        rejected: toolInvocations.rejected,
        rejectionReason: toolInvocations.rejectionReason,
        durationMs: toolInvocations.durationMs,
        promptTokens: toolInvocations.promptTokens,
        completionTokens: toolInvocations.completionTokens,
        totalTokens: toolInvocations.totalTokens,
        requestSummary: toolInvocations.requestSummary,
        responseSummary: toolInvocations.responseSummary,
        invokedAt: toolInvocations.invokedAt,
      })
      .from(toolInvocations)
      .where(eq(toolInvocations.botId, botId))
      .orderBy(toolInvocations.invokedAt);

    return reply.code(200).send({
      bot: {
        id: bot.id,
        status: bot.status,
        // compositeScore is numeric in Postgres — cast to Number for JSON response
        compositeScore: bot.compositeScore ? Number(bot.compositeScore) : null,
        tier: bot.tier,
        startedAt: bot.startedAt,
        stoppedAt: bot.stoppedAt,
      },
      metrics,
      steps,
    });
  });

  // GET /:botId/logs — SSE stream of per-bot process log events
  // Subscribes to bot-lifecycle, task-lifecycle, guardrail-events Pub/Sub topics
  // filtered by botId, and polls tool_invocations table every 2s for new entries.
  fastify.get('/:botId/logs', {
    sse: true,
    schema: {
      params: Type.Object({
        botId: Type.String({ format: 'uuid' }),
      }),
    },
  }, async (request, reply) => {
    const { botId } = request.params;
    const connId = randomUUID().slice(0, 8);

    const topicNames = [BOT_LIFECYCLE_TOPIC, TASK_LIFECYCLE_TOPIC, GUARDRAIL_EVENTS_TOPIC];

    // Create a per-connection subscription on each topic
    const subs = await Promise.all(
      topicNames.map(async (topicName) => {
        const subName = `blog-${botId.slice(0, 8)}-${connId}-${topicName}`;
        await pubsub.topic(topicName).createSubscription(subName);
        return pubsub.subscription(subName);
      }),
    );

    // Track cursor for tool invocation polling — start from now so we only stream new entries
    let lastPolledAt = new Date();

    // Pub/Sub message handler — filter by botId, forward to SSE stream
    const handler = async (message: { data: Buffer; ack: () => void; nack: () => void }) => {
      try {
        const payload = JSON.parse(message.data.toString()) as { botId?: string; type?: string };
        if (payload.botId !== botId) {
          message.ack();
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

    // Poll tool_invocations every 2s for new entries after cursor
    const pollInterval = setInterval(async () => {
      if (!reply.sse.isConnected) return;
      try {
        const pollTime = lastPolledAt;
        lastPolledAt = new Date();

        const newSteps = await db
          .select({
            toolName: toolInvocations.toolName,
            invocationId: toolInvocations.invocationId,
            rejected: toolInvocations.rejected,
            rejectionReason: toolInvocations.rejectionReason,
            durationMs: toolInvocations.durationMs,
            totalTokens: toolInvocations.totalTokens,
            invokedAt: toolInvocations.invokedAt,
          })
          .from(toolInvocations)
          .where(
            and(
              eq(toolInvocations.botId, botId),
              gt(toolInvocations.invokedAt, pollTime),
            ),
          )
          .orderBy(toolInvocations.invokedAt);

        for (const step of newSteps) {
          if (reply.sse.isConnected) {
            await reply.sse.send({
              event: 'tool_invocation',
              data: JSON.stringify({ type: 'tool_invocation', botId, ...step }),
            });
          }
        }
      } catch {
        // ignore poll errors — connection may be closing
      }
    }, 2000);

    let cleanedUp = false;

    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(pollInterval);
      subs.forEach((sub) => sub.removeAllListeners());
      await Promise.allSettled(subs.map((sub) => sub.close()));
      await Promise.allSettled(subs.map((sub) => sub.delete().catch(() => {})));
    };

    reply.sse.onClose(cleanup);
    request.raw.on('close', cleanup);
  });

  // POST /:botId/ready — called by bot VM startup script when OpenClaw Gateway is ready
  fastify.post('/:botId/ready', {
    schema: {
      params: Type.Object({
        botId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        internalIp: Type.String(),
        port: Type.Integer({ minimum: 1, maximum: 65535 }),
      }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        404: Type.Object({ error: Type.String() }),
        409: Type.Object({ error: Type.String() }),
        503: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { botId } = request.params;
    const { internalIp, port } = request.body;

    // Verify bot exists in Postgres
    const [bot] = await db.select().from(bots).where(eq(bots.id, botId));
    if (!bot) {
      return reply.code(404).send({ error: 'Bot not found' });
    }

    // Look up registry entry (must have been registered by spawnBot)
    const entry = getBot(botId);
    if (!entry) {
      return reply.code(404).send({ error: 'Bot not in registry — may have been stopped' });
    }

    if (entry.openclawClient) {
      return reply.code(409).send({ error: 'Bot already marked as ready' });
    }

    // Connect to OpenClaw Gateway on the bot VM
    const wsUrl = `ws://${internalIp}:${port}`;
    const client = new OpenClawClient(wsUrl);

    try {
      await client.connect();
    } catch (err) {
      console.error('[bots/ready] Failed to connect to OpenClaw Gateway:', {
        botId,
        wsUrl,
        error: (err as Error).message,
      });
      await db
        .update(bots)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(bots.id, botId));
      return reply.code(503).send({ error: 'Failed to connect to OpenClaw Gateway' } as never);
    }

    // Update registry entry with internalIp and connected client
    entry.internalIp = internalIp;
    entry.openclawClient = client;
    entry.lastTaskClaimedAt = Date.now();

    // Transition bot status from 'spawning' → 'idle' in Postgres
    await db
      .update(bots)
      .set({ status: 'idle', updatedAt: new Date() })
      .where(eq(bots.id, botId));

    // Publish bot_started with VM readiness info
    await publishBotStarted({
      type: 'bot_started',
      botId,
      executionId: entry.executionId,
      timestamp: new Date().toISOString(),
      metadata: { instanceName: entry.instanceName, internalIp, port },
    }).catch((err: Error) => {
      console.error('[bots/ready] Failed to publish bot_started (non-fatal):', err.message);
    });

    console.log('[bots/ready] Bot VM ready:', { botId, internalIp, port, instanceName: entry.instanceName });
    return reply.code(200).send({ ok: true });
  });
};
