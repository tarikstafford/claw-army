import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, councilVerdicts } from '@claw/db';
import { eq, and, inArray } from 'drizzle-orm';

export const verdictsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /verdicts/pending — List pending Promote/Retire verdicts awaiting operator action
  fastify.get('/pending', {
    schema: {
      response: {
        200: Type.Array(
          Type.Object({
            id: Type.String({ format: 'uuid' }),
            botId: Type.String({ format: 'uuid' }),
            executionId: Type.String({ format: 'uuid' }),
            verdictType: Type.String(),
            weightedConfidenceScore: Type.Number(),
            verdictSummary: Type.String(),
            hasUnresolvedDevilsAdvocate: Type.Boolean(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
          }),
        ),
      },
    },
  }, async () => {
    const rows = await db
      .select({
        id: councilVerdicts.id,
        botId: councilVerdicts.botId,
        executionId: councilVerdicts.executionId,
        verdictType: councilVerdicts.verdictType,
        weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
        verdictSummary: councilVerdicts.verdictSummary,
        hasUnresolvedDevilsAdvocate: councilVerdicts.hasUnresolvedDevilsAdvocate,
        createdAt: councilVerdicts.createdAt,
      })
      .from(councilVerdicts)
      .where(
        and(
          inArray(councilVerdicts.verdictType, ['Promote', 'Retire']),
          eq(councilVerdicts.status, 'pending'),
        ),
      )
      .orderBy(councilVerdicts.createdAt);

    return rows.map((r) => ({
      ...r,
      weightedConfidenceScore: Number(r.weightedConfidenceScore),
    }));
  });

  // GET /verdicts/:verdictId — Get single verdict with full evidence columns
  fastify.get('/:verdictId', {
    schema: {
      params: Type.Object({
        verdictId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          id: Type.String({ format: 'uuid' }),
          botId: Type.String({ format: 'uuid' }),
          executionId: Type.String({ format: 'uuid' }),
          verdictType: Type.String(),
          status: Type.String(),
          weightedConfidenceScore: Type.Number(),
          verdictSummary: Type.String(),
          hasUnresolvedDevilsAdvocate: Type.Boolean(),
          devilsAdvocateOutput: Type.Unknown(),
          performanceJudgeOutput: Type.Unknown(),
          soulAnalystOutput: Type.Unknown(),
          requiresHumanConfirmation: Type.Boolean(),
          createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { verdictId } = request.params;

    const [row] = await db
      .select({
        id: councilVerdicts.id,
        botId: councilVerdicts.botId,
        executionId: councilVerdicts.executionId,
        verdictType: councilVerdicts.verdictType,
        status: councilVerdicts.status,
        weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
        verdictSummary: councilVerdicts.verdictSummary,
        hasUnresolvedDevilsAdvocate: councilVerdicts.hasUnresolvedDevilsAdvocate,
        devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
        performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
        soulAnalystOutput: councilVerdicts.soulAnalystOutput,
        requiresHumanConfirmation: councilVerdicts.requiresHumanConfirmation,
        createdAt: councilVerdicts.createdAt,
      })
      .from(councilVerdicts)
      .where(eq(councilVerdicts.id, verdictId));

    if (!row) {
      return reply.code(404).send({ error: 'Verdict not found' });
    }

    return reply.code(200).send({
      ...row,
      weightedConfidenceScore: Number(row.weightedConfidenceScore),
    });
  });

  // POST /verdicts/:verdictId/confirm — Confirm a pending Promote/Retire verdict
  fastify.post('/:verdictId/confirm', {
    schema: {
      params: Type.Object({
        verdictId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        userId: Type.String(),
        timeOnScreenMs: Type.Integer({ minimum: 0 }),
      }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        409: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { verdictId } = request.params;
    const { userId, timeOnScreenMs } = request.body;

    const updated = await db
      .update(councilVerdicts)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userId,
        timeOnScreenMs,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(councilVerdicts.id, verdictId),
          eq(councilVerdicts.status, 'pending'),
          inArray(councilVerdicts.verdictType, ['Promote', 'Retire']),
        ),
      )
      .returning({ id: councilVerdicts.id });

    if (updated.length === 0) {
      return reply.code(409).send({
        error: 'Verdict already resolved or not eligible for confirmation',
      });
    }

    return reply.send({ ok: true });
  });

  // POST /verdicts/:verdictId/reject — Reject a pending Promote/Retire verdict
  fastify.post('/:verdictId/reject', {
    schema: {
      params: Type.Object({
        verdictId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        userId: Type.String(),
        timeOnScreenMs: Type.Integer({ minimum: 0 }),
      }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        409: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { verdictId } = request.params;
    const { userId, timeOnScreenMs } = request.body;

    const updated = await db
      .update(councilVerdicts)
      .set({
        status: 'rejected',
        confirmedBy: userId,
        timeOnScreenMs,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(councilVerdicts.id, verdictId),
          eq(councilVerdicts.status, 'pending'),
          inArray(councilVerdicts.verdictType, ['Promote', 'Retire']),
        ),
      )
      .returning({ id: councilVerdicts.id });

    if (updated.length === 0) {
      return reply.code(409).send({
        error: 'Verdict already resolved or not eligible for confirmation',
      });
    }

    return reply.send({ ok: true });
  });

  // GET /verdicts/calibration — Per-user confirmation rate with anti-rubber-stamp warning
  fastify.get('/calibration', {
    schema: {
      querystring: Type.Object({
        userId: Type.String(),
      }),
      response: {
        200: Type.Object({
          total: Type.Integer(),
          confirmed: Type.Integer(),
          rate: Type.Number(),
          warningTriggered: Type.Boolean(),
        }),
      },
    },
  }, async (request) => {
    const { userId } = request.query;

    const results = await db
      .select({ status: councilVerdicts.status })
      .from(councilVerdicts)
      .where(
        and(
          eq(councilVerdicts.confirmedBy, userId),
          inArray(councilVerdicts.status, ['confirmed', 'rejected']),
        ),
      );

    const total = results.length;
    const confirmed = results.filter((r) => r.status === 'confirmed').length;
    const rate = total > 0 ? confirmed / total : 0;
    const warningTriggered = total >= 10 && rate > 0.95;

    return { total, confirmed, rate, warningTriggered };
  });
};
