import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [objRes, statsRes, executionsRes] = await Promise.all([
    fetch(`/api/objectives/${params.id}`),
    fetch(`/api/objectives/${params.id}/stats`),
    fetch(`/api/objectives/${params.id}/executions`),
  ]);

  if (!objRes.ok) throw error(objRes.status, 'Failed to load objective');
  if (!statsRes.ok) throw error(statsRes.status, 'Failed to load stats');
  if (!executionsRes.ok) throw error(executionsRes.status, 'Failed to load executions');

  const [objective, stats, executions] = await Promise.all([
    objRes.json(),
    statsRes.json(),
    executionsRes.json(),
  ]);

  return { objective, stats, executions };
};
