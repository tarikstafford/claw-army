import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const status = url.searchParams.get('status');
  const sort = url.searchParams.get('sort') ?? 'date';
  const order = url.searchParams.get('order') ?? 'desc';

  const queryParams = new URLSearchParams();
  if (status) queryParams.set('status', status);
  queryParams.set('sort', sort);
  queryParams.set('order', order);

  const res = await fetch(`/api/executions/all?${queryParams}`);
  if (!res.ok) throw error(res.status, 'Failed to load executions');

  const executions = await res.json();

  return {
    executions,
    filters: { status, sort, order },
  };
};