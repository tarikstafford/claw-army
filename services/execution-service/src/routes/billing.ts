import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, executions } from '@claw/db';
import { sql } from 'drizzle-orm';
import { constructWebhookEvent } from '../services/stripe-service';

export const billingRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /history — list all executions with rolled-up cost, bot-hours, task count
  // Uses correlated subselects — avoids N+1 (following report-builder.ts pattern)
  fastify.get('/history', {
    schema: {
      response: {
        200: Type.Array(
          Type.Object({
            executionId: Type.String({ format: 'uuid' }),
            objective: Type.String(),
            status: Type.Union([
              Type.Literal('pre_flight'),
              Type.Literal('queued'),
              Type.Literal('running'),
              Type.Literal('paused'),
              Type.Literal('stopped'),
              Type.Literal('completed'),
              Type.Literal('failed'),
            ]),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            totalCostCents: Type.Integer(),
            totalBotHours: Type.Number(),
            taskCount: Type.Integer(),
          }),
        ),
      },
    },
  }, async (_request, reply) => {
    const rows = await db
      .select({
        executionId: executions.id,
        objective: executions.objective,
        status: executions.status,
        createdAt: executions.createdAt,
        totalCostCents: sql<number>`
          cast(coalesce(
            (SELECT SUM(be.amount_cents)
             FROM billing_events be
             WHERE be.execution_id = ${executions.id}
               AND be.event_type = 'tool_invoked'),
            0
          ) as int)`,
        totalBotHours: sql<number>`
          cast(coalesce(
            (SELECT SUM(t.metric_value)
             FROM telemetry t
             WHERE t.execution_id = ${executions.id}
               AND t.metric_name = 'bot_hours'),
            0
          ) as float)`,
        taskCount: sql<number>`
          cast(coalesce(
            (SELECT COUNT(*)
             FROM tasks tk
             WHERE tk.execution_id = ${executions.id}
               AND tk.status = 'completed'),
            0
          ) as int)`,
      })
      .from(executions)
      .orderBy(sql`${executions.createdAt} DESC`);

    return reply.code(200).send(
      rows.map((row) => ({
        executionId: row.executionId,
        objective: row.objective,
        status: row.status,
        createdAt: row.createdAt,
        totalCostCents: row.totalCostCents,
        totalBotHours: row.totalBotHours,
        taskCount: row.taskCount,
      })),
    );
  });

  // GET /summary — monthly totals for current month
  fastify.get('/summary', {
    schema: {
      response: {
        200: Type.Object({
          monthlyBotHours: Type.Number(),
          monthlySpendCents: Type.Integer(),
          executionCount: Type.Integer(),
        }),
      },
    },
  }, async (_request, reply) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [summaryRow] = await db
      .select({
        monthlyBotHours: sql<number>`
          cast(coalesce(
            (SELECT SUM(t.metric_value)
             FROM telemetry t
             JOIN executions e2 ON e2.id = t.execution_id
             WHERE e2.created_at >= ${monthStart}
               AND t.metric_name = 'bot_hours'),
            0
          ) as float)`,
        monthlySpendCents: sql<number>`
          cast(coalesce(
            (SELECT SUM(be.amount_cents)
             FROM billing_events be
             JOIN executions e2 ON e2.id = be.execution_id
             WHERE e2.created_at >= ${monthStart}
               AND be.event_type = 'tool_invoked'),
            0
          ) as int)`,
        executionCount: sql<number>`
          cast(coalesce(
            (SELECT COUNT(*)
             FROM executions e2
             WHERE e2.created_at >= ${monthStart}),
            0
          ) as int)`,
      })
      .from(executions)
      .limit(1);

    return reply.code(200).send({
      monthlyBotHours: summaryRow?.monthlyBotHours ?? 0,
      monthlySpendCents: summaryRow?.monthlySpendCents ?? 0,
      executionCount: summaryRow?.executionCount ?? 0,
    });
  });

  // POST /webhook — handle Stripe webhooks
  fastify.post('/webhook', {
    schema: {
      response: {
        200: Type.Object({ received: Type.Boolean() }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    let event;
    try {
      event = await constructWebhookEvent(
        JSON.stringify(request.body),
        signature,
      );
    } catch {
      return reply.code(400).send({ error: 'Invalid webhook signature' });
    }

    switch (event.type) {
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'customer.subscription.updated':
        console.log('[billing] Stripe webhook received:', event.type);
        break;
      default:
        console.log('[billing] Stripe webhook ignored:', event.type);
    }

    return reply.code(200).send({ received: true });
  });
};
