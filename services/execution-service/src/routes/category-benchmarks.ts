import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, categoryBenchmarks } from '@claw/db';
import { asc } from 'drizzle-orm';

const CategoryBenchmarkSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  taskCategory: Type.String(),
  pioneerBotId: Type.String({ format: 'uuid' }),
  pioneerSoulId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  pioneerExecutionId: Type.String({ format: 'uuid' }),
  baselineCompositeScore: Type.String(), // numeric comes as string from Drizzle
  confirmedRunCount: Type.Integer(),
  thinDataFlag: Type.Boolean(),
  benchmarkMature: Type.Boolean(),
  standardPromotion: Type.Boolean(),
  createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
  updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
});

export const categoryBenchmarksRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /category-benchmarks — all category benchmarks ordered by task category
  fastify.get('/', {
    schema: {
      response: {
        200: Type.Object({
          benchmarks: Type.Array(CategoryBenchmarkSchema),
        }),
      },
    },
  }, async (_request, reply) => {
    const rows = await db
      .select()
      .from(categoryBenchmarks)
      .orderBy(asc(categoryBenchmarks.taskCategory));

    return reply.code(200).send({ benchmarks: rows });
  });
};
