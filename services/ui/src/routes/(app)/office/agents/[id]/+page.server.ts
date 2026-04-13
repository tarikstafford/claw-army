import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const res = await fetch(`/api/agents/${params.id}`);
  if (!res.ok) throw error(res.status, 'Failed to load agent');
  const agent = await res.json();

  return {
    agent,
    userId: session.user.id,
  };
};
