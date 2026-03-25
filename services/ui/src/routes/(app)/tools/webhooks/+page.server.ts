import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session, companyId } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  const [rulesRes, logsRes, connectionsRes, agentsRes] = await Promise.allSettled([
    fetch(`/api/akasa/webhook-routing-rules?userId=${encodeURIComponent(userId)}`),
    fetch(`/api/akasa/webhooks/logs?userId=${encodeURIComponent(userId)}`),
    fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`),
    companyId ? fetch(`/api/companies/${companyId}/agents`) : Promise.reject('no company'),
  ]);

  const rules = rulesRes.status === 'fulfilled' && rulesRes.value.ok
    ? await rulesRes.value.json() : [];
  const logs = logsRes.status === 'fulfilled' && logsRes.value.ok
    ? await logsRes.value.json() : [];
  const connections = connectionsRes.status === 'fulfilled' && connectionsRes.value.ok
    ? await connectionsRes.value.json() : [];
  const agents = agentsRes.status === 'fulfilled' && agentsRes.value.ok
    ? await agentsRes.value.json() : [];

  return { rules, logs, connections, agents, userId };
};
