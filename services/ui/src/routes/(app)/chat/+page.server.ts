import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');

  const [threadsRes, agentsRes] = await Promise.all([
    fetch(`/api/companies/${companyId}/chat/threads`),
    fetch(`/api/companies/${companyId}/agents`),
  ]);

  if (!threadsRes.ok) throw error(threadsRes.status, 'Failed to load chat threads');
  if (!agentsRes.ok) throw error(agentsRes.status, 'Failed to load agents');
  
  const threads = await threadsRes.json();
  const agents = await agentsRes.json();
  
  return { threads, agents, companyId };
};
