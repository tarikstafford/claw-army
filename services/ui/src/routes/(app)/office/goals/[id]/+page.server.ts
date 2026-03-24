import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/goals/${params.id}`);
  if (!res.ok) throw error(res.status, 'Failed to load goal');
  const goal = await res.json();
  return { goal };
};
