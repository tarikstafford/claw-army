import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const res = await fetch('/api/akasa/evolution/org');
  const orgData = res.ok ? await res.json() : null;

  return { orgData };
};
