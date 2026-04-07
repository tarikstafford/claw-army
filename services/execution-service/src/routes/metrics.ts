import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, bots, telemetry, executions, billingEvents } from '@claw/db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import Redis from 'ioredis';
import { getExecution } from '../services/execution.service';

// Singleton IORedis client for metrics reads
// enableOfflineQueue: true — write-path should queue on slow Redis, not fail fast
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  enableOfflineQueue: true,
});

export const metricsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /:id/metrics — live execution metrics from Redis budget keys and DB queries
  fastify.get('/:id/metrics', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          activeBotCount: Type.Integer(),
          totalBotHours: Type.Number(),
          spentCents: Type.Integer(),
          budgetCapCents: Type.Integer(),
          remainingCents: Type.Integer(),
          estimatedCostCents: Type.Integer(),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id: executionId } = request.params;

    // Verify execution exists
    const execution = await getExecution(executionId);
    if (!execution) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    // Active bot count: bots in spawning, idle, or working status
    const [activeBotResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bots)
      .where(
        and(
          eq(bots.executionId, executionId),
          inArray(bots.status, ['spawning', 'idle', 'working']),
        ),
      );

    const activeBotCount = activeBotResult?.count ?? 0;

    // Total bot-hours from telemetry table
    const [botHoursResult] = await db
      .select({
        total: sql<number>`cast(coalesce(sum(${telemetry.metricValue}), 0) as float)`,
      })
      .from(telemetry)
      .where(
        and(
          eq(telemetry.executionId, executionId),
          eq(telemetry.metricName, 'bot_hours'),
        ),
      );

    const totalBotHours = botHoursResult?.total ?? 0;

    // CRITICAL: Read budget from Redis (not DB billing_events SUM)
    // Redis budget:spend:{executionId} is the authoritative live counter (RESEARCH.md Pitfall 5)
    const [spendValue, capValue] = await redis.mget(
      `budget:spend:${executionId}`,
      `budget:cap:${executionId}`,
    );

    const spentCents = parseInt(spendValue ?? '0', 10);
    const budgetCapCents = parseInt(capValue ?? '0', 10);
    const remainingCents = Math.max(0, budgetCapCents - spentCents);
    // For MVP: estimated cost equals current spend
    const estimatedCostCents = spentCents;

    return reply.code(200).send({
      activeBotCount,
      totalBotHours,
      spentCents,
      budgetCapCents,
      remainingCents,
      estimatedCostCents,
    });
  });

  // GET /projects/:id/metrics — aggregate metrics for a project
  fastify.get('/projects/:id/metrics', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          totalExecutions: Type.Integer(),
          totalBotHours: Type.Number(),
          totalSpentCents: Type.Integer(),
          activeBotCount: Type.Integer(),
          completedExecutions: Type.Integer(),
          failedExecutions: Type.Integer(),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id: projectId } = request.params;

    // Get all executions for this project
    const projectExecutions = await db
      .select({ id: executions.id })
      .from(executions)
      .where(eq(executions.projectId, projectId));

    if (projectExecutions.length === 0) {
      return reply.code(200).send({
        totalExecutions: 0,
        totalBotHours: 0,
        totalSpentCents: 0,
        activeBotCount: 0,
        completedExecutions: 0,
        failedExecutions: 0,
      });
    }

    const executionIds = projectExecutions.map((e) => e.id);

    // Total execution count
    const totalExecutions = projectExecutions.length;

    // Active bot count for project
    const [activeBotResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bots)
      .where(
        and(
          inArray(bots.executionId, executionIds),
          inArray(bots.status, ['spawning', 'idle', 'working']),
        ),
      );
    const activeBotCount = activeBotResult?.count ?? 0;

    // Total bot-hours from telemetry
    const [botHoursResult] = await db
      .select({
        total: sql<number>`cast(coalesce(sum(${telemetry.metricValue}), 0) as float)`,
      })
      .from(telemetry)
      .where(
        and(
          inArray(telemetry.executionId, executionIds),
          eq(telemetry.metricName, 'bot_hours'),
        ),
      );
    const totalBotHours = botHoursResult?.total ?? 0;

    // Total spent from billing_events
    const [spentResult] = await db
      .select({
        total: sql<number>`cast(coalesce(sum(${billingEvents.amountCents}), 0) as int)`,
      })
      .from(billingEvents)
      .where(
        and(
          inArray(billingEvents.executionId, executionIds),
          eq(billingEvents.eventType, 'tool_invoked'),
        ),
      );
    const totalSpentCents = spentResult?.total ?? 0;

    // Completed and failed executions
    const [completedResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(executions)
      .where(
        and(
          eq(executions.projectId, projectId),
          eq(executions.status, 'completed'),
        ),
      );
    const [failedResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(executions)
      .where(
        and(
          eq(executions.projectId, projectId),
          eq(executions.status, 'failed'),
        ),
      );

    return reply.code(200).send({
      totalExecutions,
      totalBotHours,
      totalSpentCents,
      activeBotCount,
      completedExecutions: completedResult?.count ?? 0,
      failedExecutions: failedResult?.count ?? 0,
    });
  });
};
