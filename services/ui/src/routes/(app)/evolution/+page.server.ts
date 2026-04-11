import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const [fleetRes, pendingRes, agentsRes, heatmapRes] = await Promise.allSettled([
    fetch('/api/akasa/evolution/fleet'),
    fetch('/api/akasa/evolution/pending'),
    fetch('/api/akasa/evolution/agents'),
    fetch(`/api/akasa/companies/${session.companyId}/skills/heatmap`),
  ]);

  const fleet = fleetRes.status === 'fulfilled' && fleetRes.value.ok
    ? await fleetRes.value.json()
    : null;
  const pendingVerdicts = pendingRes.status === 'fulfilled' && pendingRes.value.ok
    ? await pendingRes.value.json()
    : [];
  const agents = agentsRes.status === 'fulfilled' && agentsRes.value.ok
    ? await agentsRes.value.json()
    : [];
  const heatmap = heatmapRes.status === 'fulfilled' && heatmapRes.value.ok
    ? await heatmapRes.value.json()
    : null;

  return { fleet, pendingVerdicts, agents, heatmap };
};
