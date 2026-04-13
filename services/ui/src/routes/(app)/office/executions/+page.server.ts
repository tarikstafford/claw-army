import type { PageServerLoad } from './$types';
import { getExecutions, type ExecutionStatus } from '$lib/api';

export const load: PageServerLoad = async ({ url }) => {
  const status = url.searchParams.get('status') as ExecutionStatus | null;
  const sortBy = url.searchParams.get('sortBy') as 'date' | 'duration' | null;
  const sortOrder = url.searchParams.get('sortOrder') as 'asc' | 'desc' | null;

  const executions = await getExecutions({
    status: status ?? undefined,
    sortBy: sortBy ?? undefined,
    sortOrder: sortOrder ?? undefined,
  });

  return {
    executions,
    filters: {
      status,
      sortBy,
      sortOrder,
    },
  };
};
