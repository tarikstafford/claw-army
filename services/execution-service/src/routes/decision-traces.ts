import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, decisionTraces } from '@claw/db';
import { eq, sql } from 'drizzle-orm';

const DecisionTraceSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  decisionType: Type.String(),
  directiveReferenced: Type.Union([Type.String(), Type.Null()]),
  attributionConfidence: Type.Union([Type.String(), Type.Null()]),
  outcome: Type.Union([Type.String(), Type.Null()]),
  decidedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  executionId: Type.String({ format: 'uuid' }),
});

export const decisionTracesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /decision-traces/:botId — paginated decision traces for a specific bot
  fastify.get('/:botId', {
    schema: {
      params: Type.Object({
        botId: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          traces: Type.Array(DecisionTraceSchema),
          total: Type.Integer(),
          hasMore: Type.Boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    const { botId } = request.params;
    const limit = request.query.limit ?? 50;
    const offset = request.query.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: decisionTraces.id,
          decisionType: decisionTraces.decisionType,
          directiveReferenced: decisionTraces.directiveReferenced,
          attributionConfidence: decisionTraces.attributionConfidence,
          outcome: decisionTraces.outcome,
          decidedAt: decisionTraces.decidedAt,
          executionId: decisionTraces.executionId,
        })
        .from(decisionTraces)
        .where(eq(decisionTraces.botId, botId))
        .orderBy(sql`${decisionTraces.decidedAt} DESC`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`CAST(COUNT(*) AS int)` })
        .from(decisionTraces)
        .where(eq(decisionTraces.botId, botId)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return reply.code(200).send({
      traces: rows,
      total,
      hasMore: offset + limit < total,
    });
  });
};
