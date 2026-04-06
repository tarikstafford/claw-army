import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) {
    return { dashboard: null, activity: [], approvals: [] };
  }

  const [dashboardRes, activityRes, approvalsRes] = await Promise.allSettled([
    fetch(`/api/companies/${companyId}/dashboard`),
    fetch(`/api/companies/${companyId}/activity`),
    fetch(`/api/companies/${companyId}/approvals`),
  ]);

  const dashboard = dashboardRes.status === 'fulfilled' && dashboardRes.value.ok
    ? await dashboardRes.value.json()
    : null;
  const activity = activityRes.status === 'fulfilled' && activityRes.value.ok
    ? await activityRes.value.json()
    : [];
  const approvals = approvalsRes.status === 'fulfilled' && approvalsRes.value.ok
    ? await approvalsRes.value.json()
    : [];

  return { dashboard, activity, approvals };
};
