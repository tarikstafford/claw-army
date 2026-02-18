import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, bots, toolInvocations } from '@claw/db';
import { eq } from 'drizzle-orm';
import { computeBotMetrics } from '../performance/metrics-computer';

export const botsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
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
};
