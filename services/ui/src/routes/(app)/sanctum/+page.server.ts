import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');

  const [
    costSummaryRes,
    costsByAgentRes,
    budgetRes,
    spendTrendRes,
    spendTrendByAgentRes,
    spendTrendByOpRes,
    evolutionCostRes,
  ] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/costs/summary`),
    fetch(`/api/companies/${companyId}/costs/by-agent`),
    fetch(`/api/companies/${companyId}/budgets/overview`),
    fetch(`/api/companies/${companyId}/costs/trend`),
    fetch(`/api/companies/${companyId}/costs/trend/by-agent`),
    fetch(`/api/companies/${companyId}/costs/trend/by-operation`),
    fetch(`/api/companies/${companyId}/evolution/costs`),
  ]);

  const costSummary = costSummaryRes.status === 'fulfilled' && costSummaryRes.value.ok
    ? await costSummaryRes.value.json()
    : null;
  const costsByAgent = costsByAgentRes.status === 'fulfilled' && costsByAgentRes.value.ok
    ? await costsByAgentRes.value.json()
    : [];
  const budget = budgetRes.status === 'fulfilled' && budgetRes.value.ok
    ? await budgetRes.value.json()
    : null;
  const spendTrend = spendTrendRes.status === 'fulfilled' && spendTrendRes.value.ok
    ? await spendTrendRes.value.json()
    : [];
  const spendTrendByAgent = spendTrendByAgentRes.status === 'fulfilled' && spendTrendByAgentRes.value.ok
    ? await spendTrendByAgentRes.value.json()
    : [];
  const spendTrendByOperation = spendTrendByOpRes.status === 'fulfilled' && spendTrendByOpRes.value.ok
    ? await spendTrendByOpRes.value.json()
    : [];
  const evolutionCost = evolutionCostRes.status === 'fulfilled' && evolutionCostRes.value.ok
    ? await evolutionCostRes.value.json()
    : null;

  return {
    costSummary,
    costsByAgent,
    budget,
    spendTrend,
    spendTrendByAgent,
    spendTrendByOperation,
    evolutionCost,
    companyId,
  };
};
