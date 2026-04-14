import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params, parent }) => {
  const { session, companyId } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id ?? '';

  const agentRes = await fetch(`/api/agents/${params.id}`);
  if (!agentRes.ok) throw error(agentRes.status, 'Failed to load agent');
  const agent = await agentRes.json();

  const [activityRes, spendByAgentRes, toolConnectionsRes] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/activity?agentId=${encodeURIComponent(params.id)}`),
    fetch(`/api/companies/${companyId}/costs/trends/by-agent`),
    fetch(`/api/akasa/tool-connections?companyId=${encodeURIComponent(companyId!)}`),
  ]);

  const activity = activityRes.status === 'fulfilled' && activityRes.value.ok
    ? await activityRes.value.json()
    : [];
  const spendByAgent = spendByAgentRes.status === 'fulfilled' && spendByAgentRes.value.ok
    ? await spendByAgentRes.value.json()
    : [];
  const toolConnections = toolConnectionsRes.status === 'fulfilled' && toolConnectionsRes.value.ok
    ? await toolConnectionsRes.value.json()
    : [];

  return {
    agent,
    activity,
    spendByAgent,
    toolConnections,
    userId,
  };
};
