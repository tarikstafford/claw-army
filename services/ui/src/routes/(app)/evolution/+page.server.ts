import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const [fleetRes, pendingRes, agentsRes] = await Promise.allSettled([
    fetch('/api/akasa/evolution/fleet'),
    fetch('/api/akasa/evolution/pending'),
    fetch('/api/akasa/evolution/agents'),
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

  return { fleet, pendingVerdicts, agents };
};
