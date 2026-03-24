import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/agents/${params.id}`);
  if (!res.ok) throw error(res.status, 'Failed to load agent');
  const agent = await res.json();
  return { agent };
};
