import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId, session } = await parent();
  if (!companyId) {
    return { agents: [], activity: [], approvals: [], userName: session?.user?.name ?? 'there' };
  }

  const [agentsRes, activityRes, approvalsRes] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/agents`),
    fetch(`/api/companies/${companyId}/activity`),
    fetch(`/api/companies/${companyId}/approvals`),
  ]);

  const agents = agentsRes.status === 'fulfilled' && agentsRes.value.ok
    ? await agentsRes.value.json()
    : [];
  const activity = activityRes.status === 'fulfilled' && activityRes.value.ok
    ? await activityRes.value.json()
    : [];
  const approvals = approvalsRes.status === 'fulfilled' && approvalsRes.value.ok
    ? await approvalsRes.value.json()
    : [];

  return {
    agents: Array.isArray(agents) ? agents : [],
    activity: Array.isArray(activity) ? activity : [],
    approvals: Array.isArray(approvals) ? approvals : [],
    userName: session?.user?.name ?? 'there',
  };
};
