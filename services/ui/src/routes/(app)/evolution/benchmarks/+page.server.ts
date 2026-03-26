import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const benchRes = await fetch('/api/akasa/evolution/benchmarks');
  const benchmarks = benchRes.ok ? await benchRes.json() : [];

  return { benchmarks };
};
