import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');
  const res = await fetch(`/api/companies/${companyId}/agents`);
  if (!res.ok) throw error(res.status, 'Failed to load agents');
  const agents = await res.json();
  return { agents };
};
