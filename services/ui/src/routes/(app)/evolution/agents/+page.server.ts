import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const agentsRes = await fetch('/api/akasa/evolution/agents');
  const agents = agentsRes.ok ? await agentsRes.json() : [];

  return { agents };
};
