import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const [fleetRes, pendingRes, agentsRes, delegationsRes] = await Promise.allSettled([
    fetch('/api/akasa/evolution/fleet'),
    fetch('/api/akasa/evolution/pending'),
    fetch('/api/akasa/evolution/agents'),
    fetch('/api/akasa/evolution/delegations'),
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

  const delegations = delegationsRes.status === 'fulfilled' && delegationsRes.value.ok
    ? await delegationsRes.value.json()
    : { chains: [], stats: { totalDelegations: 0, successRate: 0, avgDepth: 0, executionCount: 0 } };

  return { fleet, pendingVerdicts, agents, delegations };
};
