import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');

  const [costSummaryRes, costsByAgentRes, budgetRes] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/costs/summary`),
    fetch(`/api/companies/${companyId}/costs/by-agent`),
    fetch(`/api/companies/${companyId}/budgets/overview`),
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

  return { costSummary, costsByAgent, budget };
};
