import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const projectId = url.searchParams.get('projectId') ?? undefined;

  const fleetRes = await Promise.allSettled([
    fetch(`/api/akasa/evolution/fleet${projectId ? `?projectId=${projectId}` : ''}`),
    fetch('/api/akasa/evolution/pending'),
    fetch(`/api/akasa/evolution/agents${projectId ? `?projectId=${projectId}` : ''}`),
  ]);

  const fleet = fleetRes[0].status === 'fulfilled' && fleetRes[0].value.ok
    ? await fleetRes[0].value.json()
    : null;
  const pendingVerdicts = fleetRes[1].status === 'fulfilled' && fleetRes[1].value.ok
    ? await fleetRes[1].value.json()
    : [];
  const agents = fleetRes[2].status === 'fulfilled' && fleetRes[2].value.ok
    ? await fleetRes[2].value.json()
    : [];

  return { fleet, pendingVerdicts, agents };
};
