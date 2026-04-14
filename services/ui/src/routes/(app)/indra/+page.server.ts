import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId, session } = await parent();
  if (!companyId) {
    return {
      agents: [],
      goals: [],
      activity: [],
      approvals: [],
      dashboard: null,
      userName: session?.user?.name ?? 'there',
      companyId: null,
    };
  }

  const [dashboardRes, agentsRes, goalsRes, activityRes, approvalsRes] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/dashboard`),
    fetch(`/api/companies/${companyId}/agents`),
    fetch(`/api/companies/${companyId}/goals`),
    fetch(`/api/companies/${companyId}/activity`),
    fetch(`/api/companies/${companyId}/approvals`),
  ]);

  const dashboard = dashboardRes.status === 'fulfilled' && dashboardRes.value.ok
    ? await dashboardRes.value.json()
    : null;
  const agents = agentsRes.status === 'fulfilled' && agentsRes.value.ok
    ? await agentsRes.value.json()
    : [];
  const goals = goalsRes.status === 'fulfilled' && goalsRes.value.ok
    ? await goalsRes.value.json()
    : [];
  const activity = activityRes.status === 'fulfilled' && activityRes.value.ok
    ? await activityRes.value.json()
    : [];
  const approvals = approvalsRes.status === 'fulfilled' && approvalsRes.value.ok
    ? await approvalsRes.value.json()
    : [];

  return {
    dashboard,
    agents: Array.isArray(agents) ? agents : [],
    goals: Array.isArray(goals) ? goals : [],
    activity: Array.isArray(activity) ? activity : [],
    approvals: Array.isArray(approvals) ? approvals : [],
    userName: session?.user?.name ?? 'there',
    companyId,
  };
};
