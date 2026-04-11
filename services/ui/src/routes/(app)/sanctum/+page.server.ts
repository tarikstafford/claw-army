import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');

  const [
    costSummaryRes,
    costsByAgentRes,
    budgetRes,
    spendTrendsRes,
    spendByAgentRes,
    spendByOpRes,
    evolutionCostRes,
    costProjectionsRes,
  ] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/costs/summary`),
    fetch(`/api/companies/${companyId}/costs/by-agent`),
    fetch(`/api/companies/${companyId}/budgets/overview`),
    fetch(`/api/companies/${companyId}/costs/trends`),
    fetch(`/api/companies/${companyId}/costs/trends/by-agent`),
    fetch(`/api/companies/${companyId}/costs/trends/by-operation`),
    fetch(`/api/companies/${companyId}/costs/evolution`),
    fetch(`/api/companies/${companyId}/costs/projections`),
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
  const spendTrends = spendTrendsRes.status === 'fulfilled' && spendTrendsRes.value.ok
    ? await spendTrendsRes.value.json()
    : [];
  const spendByAgent = spendByAgentRes.status === 'fulfilled' && spendByAgentRes.value.ok
    ? await spendByAgentRes.value.json()
    : [];
  const spendByOperation = spendByOpRes.status === 'fulfilled' && spendByOpRes.value.ok
    ? await spendByOpRes.value.json()
    : [];
  const evolutionCosts = evolutionCostRes.status === 'fulfilled' && evolutionCostRes.value.ok
    ? await evolutionCostRes.value.json()
    : null;
  const costProjections = costProjectionsRes.status === 'fulfilled' && costProjectionsRes.value.ok
    ? await costProjectionsRes.value.json()
    : null;

  return {
    costSummary,
    costsByAgent,
    budget,
    spendTrends,
    spendByAgent,
    spendByOperation,
    evolutionCosts,
    costProjections,
  };
};
