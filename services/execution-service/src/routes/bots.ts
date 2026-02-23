import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, bots, toolInvocations, botSouls, councilVerdicts, agentClasses, tasks } from '@claw/db';
import { eq, gt, and, desc, inArray, sql } from 'drizzle-orm';
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
            errorMessage: Type.Union([Type.String(), Type.Null()]),
            agentClass: Type.Union([
              Type.Literal('Novice'),
              Type.Literal('Understudy'),
              Type.Literal('Artisan'),
              Type.Literal('Retired'),
              Type.Null(),
            ]),
            currentTaskDescription: Type.Union([Type.String(), Type.Null()]),
            toolCallCount: Type.Integer(),
            tokenBurnRate: Type.Union([Type.Number(), Type.Null()]),
          }),
        ),
      },
    },
  }, async (request) => {
    const { executionId } = request.params;
    const botRows = await db
      .select({
        id: bots.id,
        status: bots.status,
        tasksClaimed: bots.tasksClaimed,
        tasksCompleted: bots.tasksCompleted,
        tasksFailed: bots.tasksFailed,
        startedAt: bots.startedAt,
        errorMessage: bots.errorMessage,
      })
      .from(bots)
      .where(eq(bots.executionId, executionId))
      .orderBy(bots.startedAt);

    const botIds = botRows.map(b => b.id);

    // Batch agent class lookup using CLASS_RANK precedence map (Artisan > Understudy > Novice > Retired)
    const CLASS_RANK: Record<string, number> = { Artisan: 3, Understudy: 2, Novice: 1, Retired: 0 };
    const agentClassMap = new Map<string, 'Novice' | 'Understudy' | 'Artisan' | 'Retired'>();

    if (botIds.length > 0) {
      const agentClassRows = await db
        .select({ botId: agentClasses.botId, currentClass: agentClasses.currentClass })
        .from(agentClasses)
        .where(inArray(agentClasses.botId, botIds));
      for (const row of agentClassRows) {
        const existing = agentClassMap.get(row.botId);
        if (!existing || (CLASS_RANK[row.currentClass] ?? -1) > (CLASS_RANK[existing] ?? -1)) {
          agentClassMap.set(row.botId, row.currentClass as 'Novice' | 'Understudy' | 'Artisan' | 'Retired');
        }
      }
    }

    // Batch current task description lookup — tasks WHERE executionId AND status = 'claimed'
    const taskDescMap = new Map<string, string>();
    if (botIds.length > 0) {
      const claimedTasks = await db
        .select({ claimedByBotId: tasks.claimedByBotId, description: tasks.description })
        .from(tasks)
        .where(and(eq(tasks.executionId, executionId), eq(tasks.status, 'claimed')));
      for (const t of claimedTasks) {
        if (t.claimedByBotId) taskDescMap.set(t.claimedByBotId, t.description);
      }
    }

    // Batch tool call count — COUNT from toolInvocations WHERE botId IN botIds AND rejected = false, grouped by botId
    const toolCountMap = new Map<string, number>();
    if (botIds.length > 0) {
      const toolCountRows = await db
        .select({
          botId: toolInvocations.botId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(toolInvocations)
        .where(and(inArray(toolInvocations.botId, botIds), eq(toolInvocations.rejected, false)))
        .groupBy(toolInvocations.botId);
      for (const row of toolCountRows) {
        toolCountMap.set(row.botId, row.count);
      }
    }

    // Batch token total — SUM(totalTokens) from toolInvocations WHERE botId IN botIds, grouped by botId
    const tokenTotalMap = new Map<string, number>();
    if (botIds.length > 0) {
      const tokenRows = await db
        .select({
          botId: toolInvocations.botId,
          totalTokens: sql<number>`cast(coalesce(sum(${toolInvocations.totalTokens}), 0) as int)`,
        })
        .from(toolInvocations)
        .where(inArray(toolInvocations.botId, botIds))
        .groupBy(toolInvocations.botId);
      for (const row of tokenRows) {
        tokenTotalMap.set(row.botId, row.totalTokens);
      }
    }

    return botRows.map(b => {
      const totalTokens = tokenTotalMap.get(b.id) ?? 0;
      const activeMinutes = b.startedAt ? (Date.now() - new Date(b.startedAt).getTime()) / 60000 : 0;
      const tokenBurnRate = activeMinutes >= 1 ? Math.round(totalTokens / activeMinutes) : null;
      return {
        ...b,
        agentClass: agentClassMap.get(b.id) ?? null,
        currentTaskDescription: taskDescMap.get(b.id) ?? null,
        toolCallCount: toolCountMap.get(b.id) ?? 0,
        tokenBurnRate,
      };
    });
  });

  // GET /:botId/soul — soul content, lineage metadata, council verdict, and agent class
  fastify.get('/:botId/soul', {
    schema: {
      params: Type.Object({
        botId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          soulId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
          soulContent: Type.Union([Type.String(), Type.Null()]),
          generation: Type.Union([Type.Integer(), Type.Null()]),
          parentSoulId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
          isArchetype: Type.Union([Type.Boolean(), Type.Null()]),
          taskCategory: Type.Union([Type.String(), Type.Null()]),
          constitutionDirectives: Type.Union([Type.Array(Type.String()), Type.Null()]),
          dimensions: Type.Union([Type.Unknown(), Type.Null()]),
          agentClass: Type.Union([
            Type.Literal('Novice'),
            Type.Literal('Understudy'),
            Type.Literal('Artisan'),
            Type.Literal('Retired'),
            Type.Null(),
          ]),
          verdict: Type.Union([
            Type.Object({
              verdictType: Type.String(),
              weightedConfidenceScore: Type.Number(),
              verdictSummary: Type.String(),
              soulAnalystOutput: Type.Unknown(),
              performanceJudgeOutput: Type.Unknown(),
            }),
            Type.Null(),
          ]),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { botId } = request.params;

    // 1. Get bot record to find soulId
    const [bot] = await db
      .select({ soulId: bots.soulId })
      .from(bots)
      .where(eq(bots.id, botId));

    if (!bot) {
      return reply.code(404).send({ error: 'Bot not found' });
    }

    // 2. If soulId is non-null, fetch full soul data
    let soulData: {
      soulContent: string;
      generation: number;
      parentSoulId: string | null;
      isArchetype: boolean;
      taskCategory: string | null;
      constitutionDirectives: unknown;
      dimensions: unknown;
    } | null = null;

    if (bot.soulId) {
      const [soul] = await db
        .select({
          soulContent: botSouls.soulContent,
          generation: botSouls.generation,
          parentSoulId: botSouls.parentSoulId,
          isArchetype: botSouls.isArchetype,
          taskCategory: botSouls.taskCategory,
          constitutionDirectives: botSouls.constitutionDirectives,
          dimensions: botSouls.dimensions,
        })
        .from(botSouls)
        .where(eq(botSouls.id, bot.soulId));

      soulData = soul ?? null;
    }

    // 3. Get most recent council verdict for this bot
    const [verdictRow] = await db
      .select({
        verdictType: councilVerdicts.verdictType,
        weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
        verdictSummary: councilVerdicts.verdictSummary,
        soulAnalystOutput: councilVerdicts.soulAnalystOutput,
        performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
      })
      .from(councilVerdicts)
      .where(eq(councilVerdicts.botId, botId))
      .orderBy(desc(councilVerdicts.createdAt))
      .limit(1);

    // 4. Get best agent class using CLASS_RANK precedence map
    const CLASS_RANK: Record<string, number> = {
      Artisan: 3,
      Understudy: 2,
      Novice: 1,
      Retired: 0,
    };

    const agentClassRows = await db
      .select({ currentClass: agentClasses.currentClass })
      .from(agentClasses)
      .where(eq(agentClasses.botId, botId));

    let bestAgentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null = null;
    for (const row of agentClassRows) {
      const rowRank = CLASS_RANK[row.currentClass] ?? -1;
      const bestRank = bestAgentClass != null ? (CLASS_RANK[bestAgentClass] ?? -1) : -2;
      if (rowRank > bestRank) {
        bestAgentClass = row.currentClass;
      }
    }

    return reply.code(200).send({
      soulId: bot.soulId,
      soulContent: soulData?.soulContent ?? null,
      generation: soulData?.generation ?? null,
      parentSoulId: soulData?.parentSoulId ?? null,
      isArchetype: soulData?.isArchetype ?? null,
      taskCategory: soulData?.taskCategory ?? null,
      constitutionDirectives: (soulData?.constitutionDirectives as string[] | null) ?? null,
      dimensions: soulData?.dimensions ?? null,
      agentClass: bestAgentClass,
      verdict: verdictRow
        ? {
            verdictType: verdictRow.verdictType,
            // Cast to Number to avoid PG numeric-as-string (decision [17-01])
            weightedConfidenceScore: Number(verdictRow.weightedConfidenceScore),
            verdictSummary: verdictRow.verdictSummary,
            soulAnalystOutput: verdictRow.soulAnalystOutput,
            performanceJudgeOutput: verdictRow.performanceJudgeOutput,
          }
        : null,
    });
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
  // Accepts either a success payload (success:true) or a failure payload (success:false).
  fastify.post('/:botId/ready', {
    schema: {
      params: Type.Object({
        botId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Union([
        // Success payload — startup script completed successfully
        Type.Object({
          success: Type.Literal(true),
          internalIp: Type.String(),
          port: Type.Integer({ minimum: 1, maximum: 65535 }),
          gatewayToken: Type.String(),
          openclawVersion: Type.Optional(Type.String()),
        }),
        // Failure payload — startup script encountered an error
        Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
      ]),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        404: Type.Object({ error: Type.String() }),
        409: Type.Object({ error: Type.String() }),
        503: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { botId } = request.params;
    const body = request.body;

    // ── Failure payload path ─────────────────────────────────────────────────
    // The startup script encountered an error and reported back.
    // Write errorMessage + set status to failed. Return 200 to acknowledge receipt.
    if (body.success === false) {
      console.error('[bots/ready] Bot VM startup script reported failure:', {
        botId,
        error: body.error,
      });
      await db
        .update(bots)
        .set({
          status: 'failed',
          errorMessage: body.error,
          updatedAt: new Date(),
        })
        .where(eq(bots.id, botId));
      return reply.code(200).send({ ok: true });
    }

    // ── Success payload path ─────────────────────────────────────────────────
    const { internalIp, port, gatewayToken } = body;

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
    const client = new OpenClawClient(wsUrl, gatewayToken);

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
        .set({
          status: 'failed',
          errorMessage: `Failed to connect to OpenClaw Gateway at ${wsUrl}: ${(err as Error).message}`,
          updatedAt: new Date(),
        })
        .where(eq(bots.id, botId));
      return reply.code(503).send({ error: 'Failed to connect to OpenClaw Gateway' } as never);
    }

    // WebSocket liveness check — confirm the connection is still open after connect().
    // A stale connection that opened but immediately closed (e.g. token mismatch,
    // gateway crash) is caught here before we transition the bot to idle.
    if (!client.isConnected) {
      console.error('[bots/ready] WebSocket connected but immediately disconnected:', {
        botId,
        wsUrl,
      });
      await db
        .update(bots)
        .set({
          status: 'failed',
          errorMessage: 'WebSocket connected but immediately disconnected — gateway may have rejected the token',
          updatedAt: new Date(),
        })
        .where(eq(bots.id, botId));
      return reply.code(503).send({ error: 'WebSocket not live after connect' });
    }

    // Update registry entry with internalIp, token, and connected client
    entry.internalIp = internalIp;
    entry.gatewayToken = gatewayToken;
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
