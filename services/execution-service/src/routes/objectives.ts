import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { verifyAuthToken } from '../lib/verify-auth-token.js';
import { db, objectives, executions } from '@claw/db';
import { eq, sql } from 'drizzle-orm';

// Reusable schema for the base objective object (10 fields)
const ObjectiveSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  defaultMaxBots: Type.Integer(),
  defaultBudgetCapCents: Type.Union([Type.Integer(), Type.Null()]),
  defaultRuntimeLimitSeconds: Type.Union([Type.Integer(), Type.Null()]),
  defaultAllowedTools: Type.Array(Type.String()),
  isArchived: Type.Boolean(),
  createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
});

// Extended schema for list response — includes 4 aggregation fields
const ObjectiveWithAggregationSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  defaultMaxBots: Type.Integer(),
  defaultBudgetCapCents: Type.Union([Type.Integer(), Type.Null()]),
  defaultRuntimeLimitSeconds: Type.Union([Type.Integer(), Type.Null()]),
  defaultAllowedTools: Type.Array(Type.String()),
  isArchived: Type.Boolean(),
  createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  lastRunStatus: Type.Union([Type.String(), Type.Null()]),
  runCount: Type.Integer(),
  totalSpendCents: Type.Integer(),
  bestBotClass: Type.Union([Type.String(), Type.Null()]),
});

export const objectivesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // POST / — create a new objective (OBJ-01)
  fastify.post('/', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 255 }),
        description: Type.Optional(Type.String()),
        defaultMaxBots: Type.Integer({ minimum: 3, maximum: 20 }),
        defaultBudgetCapCents: Type.Optional(Type.Integer({ minimum: 0 })),
        defaultRuntimeLimitSeconds: Type.Optional(Type.Integer({ minimum: 60 })),
        defaultAllowedTools: Type.Optional(Type.Array(Type.String())),
      }),
      response: {
        201: ObjectiveSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
      },
    },
    preHandler: [
      async (request, reply) => {
        const valid = await verifyAuthToken(request.headers.authorization);
        if (!valid) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      },
    ],
  }, async (request, reply) => {
    const {
      name,
      description,
      defaultMaxBots,
      defaultBudgetCapCents,
      defaultRuntimeLimitSeconds,
      defaultAllowedTools = [],
    } = request.body;

    const [created] = await db
      .insert(objectives)
      .values({
        name,
        description,
        defaultMaxBots,
        defaultBudgetCapCents,
        defaultRuntimeLimitSeconds,
        defaultAllowedTools,
      })
      .returning();

    if (!created) {
      return reply.code(400).send({ error: 'Failed to create objective' });
    }

    return reply.code(201).send(created);
  });

  // GET / — list objectives with aggregation, supports ?archived=true (OBJ-03)
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        archived: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Array(ObjectiveWithAggregationSchema),
      },
    },
  }, async (_request, reply) => {
    const showArchived = _request.query?.archived === 'true';
    const rows = await db
      .select({
        id: objectives.id,
        name: objectives.name,
        description: objectives.description,
        defaultMaxBots: objectives.defaultMaxBots,
        defaultBudgetCapCents: objectives.defaultBudgetCapCents,
        defaultRuntimeLimitSeconds: objectives.defaultRuntimeLimitSeconds,
        defaultAllowedTools: objectives.defaultAllowedTools,
        isArchived: objectives.isArchived,
        createdAt: objectives.createdAt,
        updatedAt: objectives.updatedAt,
        lastRunStatus: sql<string | null>`(
          SELECT e.status
          FROM ${executions} e
          WHERE e.objective_id = "objectives"."id"
          ORDER BY e.created_at DESC
          LIMIT 1
        )`,
        runCount: sql<number>`(
          SELECT CAST(COUNT(*) AS int)
          FROM ${executions} e
          WHERE e.objective_id = "objectives"."id"
        )`,
        totalSpendCents: sql<number>`(
          SELECT CAST(COALESCE(SUM(be.amount_cents), 0) AS int)
          FROM billing_events be
          JOIN ${executions} e ON e.id = be.execution_id
          WHERE e.objective_id = "objectives"."id"
            AND be.event_type = 'tool_invoked'
        )`,
        bestBotClass: sql<string | null>`(
          SELECT ac.current_class
          FROM agent_classes ac
          JOIN bots b ON b.id = ac.bot_id
          JOIN ${executions} e ON e.id = b.execution_id
          WHERE e.objective_id = "objectives"."id"
          ORDER BY CASE ac.current_class
            WHEN 'Artisan'    THEN 3
            WHEN 'Understudy' THEN 2
            WHEN 'Novice'     THEN 1
            WHEN 'Retired'    THEN 0
            ELSE -1
          END DESC
          LIMIT 1
        )`,
      })
      .from(objectives)
      .where(eq(objectives.isArchived, showArchived))
      .orderBy(sql`${objectives.createdAt} DESC`);

    return reply.code(200).send(rows);
  });

  // GET /:id/executions — list all runs for an objective (HUB-01)
  fastify.get('/:id/executions', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(Type.Object({
          id: Type.String({ format: 'uuid' }),
          status: Type.Union([
            Type.Literal('pre_flight'),
            Type.Literal('queued'),
            Type.Literal('running'),
            Type.Literal('paused'),
            Type.Literal('stopped'),
            Type.Literal('completed'),
            Type.Literal('failed'),
          ]),
          objective: Type.String(),
          createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
          totalCostCents: Type.Integer(),
          botCount: Type.Integer(),
          avgCompositeScore: Type.Union([Type.Number(), Type.Null()]),
        })),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Verify objective exists
    const [obj] = await db
      .select({ id: objectives.id })
      .from(objectives)
      .where(eq(objectives.id, id));

    if (!obj) {
      return reply.code(404).send({ error: 'Objective not found' });
    }

    const rows = await db
      .select({
        id: executions.id,
        status: executions.status,
        objective: executions.objective,
        createdAt: executions.createdAt,
        totalCostCents: sql<number>`(
          SELECT CAST(COALESCE(SUM(be.amount_cents), 0) AS int)
          FROM billing_events be
          WHERE be.execution_id = ${executions.id}
            AND be.event_type = 'tool_invoked'
        )`,
        botCount: sql<number>`(
          SELECT CAST(COUNT(*) AS int)
          FROM bots b
          WHERE b.execution_id = ${executions.id}
        )`,
        avgCompositeScore: sql<number | null>`(
          SELECT CAST(AVG(b.composite_score) AS float)
          FROM bots b
          WHERE b.execution_id = ${executions.id}
            AND b.composite_score IS NOT NULL
        )`,
      })
      .from(executions)
      .where(eq(executions.objectiveId, id))
      .orderBy(sql`${executions.createdAt} DESC`);

    return reply.code(200).send(rows);
  });

  // GET /:id/stats — aggregate stats for an objective (HUB-02 + HUB-04)
  fastify.get('/:id/stats', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          totalSpendCents: Type.Integer(),
          totalTasksCompleted: Type.Integer(),
          totalBotHours: Type.Number(),
          runCount: Type.Integer(),
          classBreakdown: Type.Object({
            novice: Type.Integer(),
            understudy: Type.Integer(),
            artisan: Type.Integer(),
            retired: Type.Integer(),
          }),
          classTrendSummary: Type.String(),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Verify objective exists
    const [obj] = await db
      .select({ id: objectives.id })
      .from(objectives)
      .where(eq(objectives.id, id));

    if (!obj) {
      return reply.code(404).send({ error: 'Objective not found' });
    }

    // Query aggregate stats using correlated subqueries from the objectives table
    const [statsRow] = await db
      .select({
        runCount: sql<number>`(
          SELECT CAST(COUNT(*) AS int)
          FROM executions e
          WHERE e.objective_id = ${objectives.id}
        )`,
        totalSpendCents: sql<number>`(
          SELECT CAST(COALESCE(SUM(be.amount_cents), 0) AS int)
          FROM billing_events be
          JOIN executions e ON e.id = be.execution_id
          WHERE e.objective_id = ${objectives.id}
            AND be.event_type = 'tool_invoked'
        )`,
        totalTasksCompleted: sql<number>`(
          SELECT CAST(COALESCE(COUNT(*), 0) AS int)
          FROM tasks t
          JOIN executions e ON e.id = t.execution_id
          WHERE e.objective_id = ${objectives.id}
            AND t.status = 'completed'
        )`,
        totalBotHours: sql<number>`(
          SELECT CAST(COALESCE(SUM(tel.metric_value), 0) AS float)
          FROM telemetry tel
          JOIN executions e ON e.id = tel.execution_id
          WHERE e.objective_id = ${objectives.id}
            AND tel.metric_name = 'bot_hours'
        )`,
      })
      .from(objectives)
      .where(eq(objectives.id, id));

    const runCount = Number(statsRow?.runCount ?? 0);
    const totalSpendCents = Number(statsRow?.totalSpendCents ?? 0);
    const totalTasksCompleted = Number(statsRow?.totalTasksCompleted ?? 0);
    const totalBotHours = Number(statsRow?.totalBotHours ?? 0);

    // Query class breakdown using agentClasses table reference
    const classRows = await db
      .select({
        currentClass: sql<string>`ac.current_class`,
        count: sql<number>`CAST(COUNT(*) AS int)`,
      })
      .from(sql`agent_classes ac`)
      .innerJoin(sql`bots b`, sql`b.id = ac.bot_id`)
      .innerJoin(executions, sql`${executions.id} = b.execution_id`)
      .where(eq(executions.objectiveId, id))
      .groupBy(sql`ac.current_class`);

    const classBreakdown = {
      novice: 0,
      understudy: 0,
      artisan: 0,
      retired: 0,
    };

    for (const row of classRows) {
      const count = Number(row.count);
      if (row.currentClass === 'Novice') classBreakdown.novice = count;
      else if (row.currentClass === 'Understudy') classBreakdown.understudy = count;
      else if (row.currentClass === 'Artisan') classBreakdown.artisan = count;
      else if (row.currentClass === 'Retired') classBreakdown.retired = count;
    }

    // Build readable class trend summary
    let classTrendSummary: string;
    if (runCount === 0) {
      classTrendSummary = 'No runs yet';
    } else {
      const parts: string[] = [];
      if (classBreakdown.artisan > 0) parts.push(`${classBreakdown.artisan} Artisan${classBreakdown.artisan !== 1 ? 's' : ''}`);
      if (classBreakdown.understudy > 0) parts.push(`${classBreakdown.understudy} Understudy${classBreakdown.understudy !== 1 ? 's' : ''}`);
      if (classBreakdown.novice > 0) parts.push(`${classBreakdown.novice} Novice${classBreakdown.novice !== 1 ? 's' : ''}`);
      if (classBreakdown.retired > 0) parts.push(`${classBreakdown.retired} Retired`);
      classTrendSummary = parts.length > 0
        ? `${parts.join(', ')} across ${runCount} run${runCount !== 1 ? 's' : ''}`
        : `No class data across ${runCount} run${runCount !== 1 ? 's' : ''}`;
    }

    return reply.code(200).send({
      totalSpendCents,
      totalTasksCompleted,
      totalBotHours,
      runCount,
      classBreakdown,
      classTrendSummary,
    });
  });

  // GET /:id — get a single objective by ID (supports OBJ-02 pre-fill)
  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ObjectiveSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const [objective] = await db
      .select()
      .from(objectives)
      .where(eq(objectives.id, id));

    if (!objective) {
      return reply.code(404).send({ error: 'Objective not found' });
    }

    return reply.code(200).send(objective);
  });

  // DELETE /:id — delete an objective (OBJ-04)
  // ON DELETE SET NULL on executions.objective_id handles cascade automatically.
  fastify.delete('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        404: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
      },
    },
    preHandler: [
      async (request, reply) => {
        const valid = await verifyAuthToken(request.headers.authorization);
        if (!valid) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      },
    ],
  }, async (request, reply) => {
    const { id } = request.params;

    const deleted = await db
      .delete(objectives)
      .where(eq(objectives.id, id))
      .returning({ id: objectives.id });

    if (deleted.length === 0) {
      return reply.code(404).send({ error: 'Objective not found' });
    }

    return reply.code(200).send({ success: true });
  });

  // PATCH /:id — update or archive an objective (OBJ-04)
  fastify.patch('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: Type.Partial(
        Type.Object({
          name: Type.String({ minLength: 1, maxLength: 255 }),
          description: Type.String(),
          defaultMaxBots: Type.Integer({ minimum: 3, maximum: 20 }),
          defaultBudgetCapCents: Type.Integer({ minimum: 0 }),
          defaultRuntimeLimitSeconds: Type.Integer({ minimum: 60 }),
          defaultAllowedTools: Type.Array(Type.String()),
          isArchived: Type.Boolean(),
        }),
      ),
      response: {
        200: ObjectiveSchema,
        404: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
      },
    },
    preHandler: [
      async (request, reply) => {
        const valid = await verifyAuthToken(request.headers.authorization);
        if (!valid) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      },
    ],
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      description,
      defaultMaxBots,
      defaultBudgetCapCents,
      defaultRuntimeLimitSeconds,
      defaultAllowedTools,
      isArchived,
    } = request.body;

    // Build updates object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updates['name'] = name;
    if (description !== undefined) updates['description'] = description;
    if (defaultMaxBots !== undefined) updates['defaultMaxBots'] = defaultMaxBots;
    if (defaultBudgetCapCents !== undefined) updates['defaultBudgetCapCents'] = defaultBudgetCapCents;
    if (defaultRuntimeLimitSeconds !== undefined) updates['defaultRuntimeLimitSeconds'] = defaultRuntimeLimitSeconds;
    if (defaultAllowedTools !== undefined) updates['defaultAllowedTools'] = defaultAllowedTools;
    if (isArchived !== undefined) updates['isArchived'] = isArchived;

    const [updated] = await db
      .update(objectives)
      .set(updates)
      .where(eq(objectives.id, id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Objective not found' });
    }

    return reply.code(200).send(updated);
  });
};
