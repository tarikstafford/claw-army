import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { calculateCostProjection } from '../services/cost-projection';

export const costProjectionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /companies/:id/costs/projections — cost projection and forecasting based on burn rate
  fastify.get('/:id/costs/projections', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          dailyBurnRateCents: Type.Integer({ description: 'Average daily spend in cents over the last 7 days' }),
          projectedMonthlyCostCents: Type.Integer({ description: 'Projected total cost for the current month' }),
          daysUntilBudgetExhaustion: Type.Union([
            Type.Integer({ description: 'Days until budget runs out at current burn rate' }),
            Type.Null(),
          ]),
          trend: Type.Union([
            Type.Literal('increasing'),
            Type.Literal('decreasing'),
            Type.Literal('stable'),
          ], { description: 'Burn rate trend comparing first and second half of window' }),
          breakdown: Type.Object({
            llmInputTokensCents: Type.Integer(),
            llmOutputTokensCents: Type.Integer(),
            botHoursCents: Type.Integer(),
            toolInvocationsCents: Type.Integer(),
          }, { description: 'Per-dimension cost breakdown for the window period' }),
          windowDays: Type.Integer({ description: 'Number of days in the analysis window' }),
          dataPoints: Type.Integer({ description: 'Number of days with billing data in the window' }),
        }),
      },
    },
  }, async (request, reply) => {
    const { id: companyId } = request.params;

    // Fetch budget info from Paperclip via internal proxy
    // We need the current budget to calculate exhaustion
    let dailyBudgetCents: number | null = null;
    let monthlyBudgetCents: number | null = null;
    let monthlySpentCents = 0;

    try {
      const paperclipUrl = process.env['PAPERCLIP_URL'] ?? 'http://localhost:3100';
      const budgetRes = await fetch(`${paperclipUrl}/api/companies/${companyId}/budgets/overview`, {
        headers: { accept: 'application/json' },
      });
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json() as {
          dailyBudgetCents?: number;
          monthlyBudgetCents?: number;
          monthlyTotalCents?: number;
        };
        dailyBudgetCents = budgetData.dailyBudgetCents ?? null;
        monthlyBudgetCents = budgetData.monthlyBudgetCents ?? null;
        monthlySpentCents = budgetData.monthlyTotalCents ?? 0;
      }
    } catch (err) {
      console.warn('[cost-projections] Could not fetch budget overview from Paperclip:', (err as Error).message);
    }

    const projection = await calculateCostProjection(
      dailyBudgetCents,
      monthlyBudgetCents,
      monthlySpentCents,
    );

    return reply.code(200).send(projection);
  });
};
