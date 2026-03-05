import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, botSouls, agentClasses, bots } from '@claw/db';
import { eq, sql, and, isNotNull } from 'drizzle-orm';

const SoulSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  taskCategory: Type.Union([Type.String(), Type.Null()]),
  generation: Type.Integer(),
  isArchetype: Type.Boolean(),
  archetypeName: Type.Union([Type.String(), Type.Null()]),
  agentClass: Type.Union([
    Type.Literal('Novice'),
    Type.Literal('Understudy'),
    Type.Literal('Artisan'),
    Type.Literal('Retired'),
    Type.Null(),
  ]),
  compositeScore: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
});

export const soulsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /souls/:id — single soul detail
  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          taskCategory: Type.Union([Type.String(), Type.Null()]),
          generation: Type.Integer(),
          isArchetype: Type.Boolean(),
          archetypeName: Type.Union([Type.String(), Type.Null()]),
          soulContent: Type.String(),
          dimensions: Type.Any(),
          constitutionDirectives: Type.Any(),
          parentSoulId: Type.Union([Type.String(), Type.Null()]),
          botId: Type.Union([Type.String(), Type.Null()]),
          executionId: Type.Union([Type.String(), Type.Null()]),
          agentClass: Type.Union([
            Type.Literal('Novice'),
            Type.Literal('Understudy'),
            Type.Literal('Artisan'),
            Type.Literal('Retired'),
            Type.Null(),
          ]),
          compositeScore: Type.Union([Type.Number(), Type.Null()]),
          createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const rows = await db
      .select({
        id: botSouls.id,
        taskCategory: botSouls.taskCategory,
        generation: botSouls.generation,
        isArchetype: botSouls.isArchetype,
        archetypeName: botSouls.archetypeName,
        soulContent: botSouls.soulContent,
        dimensions: botSouls.dimensions,
        constitutionDirectives: botSouls.constitutionDirectives,
        parentSoulId: botSouls.parentSoulId,
        botId: botSouls.botId,
        executionId: botSouls.executionId,
        agentClass: sql<string | null>`ac.current_class`,
        compositeScore: sql<string | null>`b.composite_score`,
        createdAt: botSouls.createdAt,
      })
      .from(botSouls)
      .leftJoin(
        sql`agent_classes ac`,
        sql`ac.bot_id = ${botSouls.botId} AND ac.task_category = ${botSouls.taskCategory}`,
      )
      .leftJoin(
        sql`bots b`,
        sql`b.id = ${botSouls.botId}`,
      )
      .where(eq(botSouls.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return reply.code(404).send({ error: 'Soul not found' });
    }

    return reply.code(200).send({
      id: row.id,
      taskCategory: row.taskCategory,
      generation: row.generation,
      isArchetype: row.isArchetype,
      archetypeName: row.archetypeName,
      soulContent: row.soulContent,
      dimensions: row.dimensions,
      constitutionDirectives: row.constitutionDirectives,
      parentSoulId: row.parentSoulId,
      botId: row.botId,
      executionId: row.executionId,
      agentClass: row.agentClass as 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null,
      compositeScore: row.compositeScore != null ? Number(row.compositeScore) : null,
      createdAt: row.createdAt,
    });
  });

  // GET /souls/categories — distinct task categories in the soul library
  fastify.get('/categories', {
    schema: {
      response: {
        200: Type.Object({
          categories: Type.Array(Type.String()),
        }),
      },
    },
  }, async (_request, reply) => {
    const rows = await db
      .selectDistinct({ taskCategory: botSouls.taskCategory })
      .from(botSouls)
      .where(isNotNull(botSouls.taskCategory))
      .orderBy(botSouls.taskCategory);

    const categories = rows
      .map((r) => r.taskCategory)
      .filter((c): c is string => c !== null);

    return reply.code(200).send({ categories });
  });

  // GET /souls — paginated soul library with optional category/class filtering
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        category: Type.Optional(Type.String()),
        agentClass: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          souls: Type.Array(SoulSchema),
          total: Type.Integer(),
          hasMore: Type.Boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    const category = request.query.category;
    const agentClass = request.query.agentClass;
    const limit = request.query.limit ?? 50;
    const offset = request.query.offset ?? 0;

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];
    if (category) {
      conditions.push(eq(botSouls.taskCategory, category));
    }

    // Base query with LEFT JOINs on agentClasses and bots
    // agentClass join: match via botId + taskCategory (1:1 when not null)
    // bots join: for compositeScore

    interface SoulRow {
      id: string;
      taskCategory: string | null;
      generation: number;
      isArchetype: boolean;
      archetypeName: string | null;
      agentClass: string | null;
      compositeScore: string | null;
      createdAt: Date;
    }

    // Use raw SQL joins to get agentClass and compositeScore efficiently
    let query = db
      .select({
        id: botSouls.id,
        taskCategory: botSouls.taskCategory,
        generation: botSouls.generation,
        isArchetype: botSouls.isArchetype,
        archetypeName: botSouls.archetypeName,
        agentClass: sql<string | null>`ac.current_class`,
        compositeScore: sql<string | null>`b.composite_score`,
        createdAt: botSouls.createdAt,
      })
      .from(botSouls)
      .leftJoin(
        sql`agent_classes ac`,
        sql`ac.bot_id = ${botSouls.botId} AND ac.task_category = ${botSouls.taskCategory}`,
      )
      .leftJoin(
        sql`bots b`,
        sql`b.id = ${botSouls.botId}`,
      )
      .$dynamic();

    // Apply WHERE conditions
    if (category && agentClass) {
      query = query.where(
        and(
          eq(botSouls.taskCategory, category),
          sql`ac.current_class = ${agentClass}`,
        ),
      );
    } else if (category) {
      query = query.where(eq(botSouls.taskCategory, category));
    } else if (agentClass) {
      query = query.where(sql`ac.current_class = ${agentClass}`);
    }

    // Get total count using a subquery approach
    const countQuery = db
      .select({ count: sql<number>`CAST(COUNT(*) AS int)` })
      .from(botSouls)
      .leftJoin(
        sql`agent_classes ac`,
        sql`ac.bot_id = ${botSouls.botId} AND ac.task_category = ${botSouls.taskCategory}`,
      );

    let countResult: { count: number }[];
    if (category && agentClass) {
      countResult = await countQuery.where(
        and(
          eq(botSouls.taskCategory, category),
          sql`ac.current_class = ${agentClass}`,
        ),
      );
    } else if (category) {
      countResult = await countQuery.where(eq(botSouls.taskCategory, category));
    } else if (agentClass) {
      countResult = await countQuery.where(sql`ac.current_class = ${agentClass}`);
    } else {
      countResult = await countQuery;
    }

    const total = Number(countResult[0]?.count ?? 0);

    // Apply ordering and pagination
    const rows: SoulRow[] = await query
      .orderBy(sql`${botSouls.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const souls = rows.map((r) => ({
      id: r.id,
      taskCategory: r.taskCategory,
      generation: r.generation,
      isArchetype: r.isArchetype,
      archetypeName: r.archetypeName,
      agentClass: r.agentClass as 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null,
      compositeScore: r.compositeScore != null ? Number(r.compositeScore) : null,
      createdAt: r.createdAt,
    }));

    return reply.code(200).send({ souls, total, hasMore: offset + limit < total });
  });
};
