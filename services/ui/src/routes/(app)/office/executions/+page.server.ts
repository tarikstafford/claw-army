import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const status = url.searchParams.get('status') ?? '';
  const sort = url.searchParams.get('sort') ?? 'date';
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await fetch(`/api/executions/all${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw error(res.status, 'Failed to load executions');
  const executions = await res.json();

  const sorted = [...executions].sort((a, b) => {
    if (sort === 'duration') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return { executions: sorted, status, sort };
};