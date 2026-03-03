import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, negativeSignalRegister, botSouls } from '@claw/db';
import { eq, sql } from 'drizzle-orm';

const NegativeSignalSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  soulId: Type.String({ format: 'uuid' }),
  botId: Type.String({ format: 'uuid' }),
  executionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  failureType: Type.String(),
  directiveFailureSummary: Type.Union([Type.String(), Type.Null()]),
  registeredAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  taskCategory: Type.Union([Type.String(), Type.Null()]),
  generation: Type.Union([Type.Integer(), Type.Null()]),
});

export const negativeSignalsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /negative-signals — paginated negative signal register with soul metadata
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        failureType: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          signals: Type.Array(NegativeSignalSchema),
          total: Type.Integer(),
          hasMore: Type.Boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    const { failureType, limit: queryLimit, offset: queryOffset } = request.query;
    const limit = queryLimit ?? 50;
    const offset = queryOffset ?? 0;

    interface SignalRow {
      id: string;
      soulId: string;
      botId: string;
      executionId: string | null;
      failureType: string;
      directiveFailureSummary: string | null;
      registeredAt: Date;
      taskCategory: string | null;
      generation: number | null;
    }

    const baseQuery = db
      .select({
        id: negativeSignalRegister.id,
        soulId: negativeSignalRegister.soulId,
        botId: negativeSignalRegister.botId,
        executionId: negativeSignalRegister.executionId,
        failureType: negativeSignalRegister.failureType,
        directiveFailureSummary: negativeSignalRegister.directiveFailureSummary,
        registeredAt: negativeSignalRegister.registeredAt,
        taskCategory: sql<string | null>`bs.task_category`,
        generation: sql<number | null>`bs.generation`,
      })
      .from(negativeSignalRegister)
      .leftJoin(
        sql`bot_souls bs`,
        sql`bs.id = ${negativeSignalRegister.soulId}`,
      )
      .$dynamic();

    const countBase = db
      .select({ count: sql<number>`CAST(COUNT(*) AS int)` })
      .from(negativeSignalRegister)
      .$dynamic();

    let dataQuery = baseQuery;
    let totalQuery = countBase;

    if (failureType) {
      dataQuery = dataQuery.where(eq(negativeSignalRegister.failureType, failureType));
      totalQuery = totalQuery.where(eq(negativeSignalRegister.failureType, failureType));
    }

    const [rows, countResult] = await Promise.all([
      dataQuery
        .orderBy(sql`${negativeSignalRegister.registeredAt} DESC`)
        .limit(limit)
        .offset(offset) as Promise<SignalRow[]>,
      totalQuery,
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return reply.code(200).send({
      signals: rows.map((r) => ({
        ...r,
        generation: r.generation != null ? Number(r.generation) : null,
      })),
      total,
      hasMore: offset + limit < total,
    });
  });
};
