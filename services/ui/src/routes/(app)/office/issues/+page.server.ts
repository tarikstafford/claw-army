import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');
  const status = url.searchParams.get('status') ?? '';
  const q = url.searchParams.get('q') ?? '';
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  const res = await fetch(`/api/companies/${companyId}/issues${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw error(res.status, 'Failed to load issues');
  const issues = await res.json();
  return { issues };
};
