import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/projects/${params.id}`);
  if (!res.ok) throw error(res.status, 'Failed to load project');
  const project = await res.json();
  return { project };
};
