import type { FastifyInstance } from 'fastify';
import { pruneDecisionTraces } from '../performance/attribution-compiler';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /admin/cleanup/decision-traces
   *
   * Triggers TTL-based pruning of the decision_traces table.
   * Deletes rows older than 90 days when total count exceeds 5M rows.
   *
   * Intended to be called by Cloud Scheduler or a manual operator.
   * Phase 8 documents the 90-day / 5M-row policy;
   * Phase 10 implements this enforcement endpoint.
   */
  app.post('/cleanup/decision-traces', async (_request, reply) => {
    const result = await pruneDecisionTraces();
    return reply.status(200).send({
      status: 'ok',
      deleted: result.deleted,
    });
  });
}
