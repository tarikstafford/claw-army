import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [objRes, exRes] = await Promise.all([
    fetch(`/api/objectives/${params.id}`),
    fetch(`/api/objectives/${params.id}/executions`),
  ]);
  if (!objRes.ok) throw error(objRes.status, 'Failed to load objective');
  const objective = await objRes.json();
  const executions = exRes.ok ? await exRes.json() : [];
  return { objective, executions };
};
