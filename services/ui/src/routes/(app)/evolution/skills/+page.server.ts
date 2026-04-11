import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session, companyId } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const [skillsRes, pendingRes, heatmapRes] = await Promise.allSettled([
    fetch(`/api/akasa/companies/${companyId}/skills`),
    fetch(`/api/akasa/companies/${companyId}/skills/pending`),
    fetch(`/api/akasa/companies/${companyId}/skills/heatmap`),
  ]);

  const skills = skillsRes.status === 'fulfilled' && skillsRes.value.ok
    ? await skillsRes.value.json() : [];
  const pendingApprovals = pendingRes.status === 'fulfilled' && pendingRes.value.ok
    ? await pendingRes.value.json() : [];
  const heatmap = heatmapRes.status === 'fulfilled' && heatmapRes.value.ok
    ? await heatmapRes.value.json() : [];

  return { skills, pendingApprovals, heatmap };
};
