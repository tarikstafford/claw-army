import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const taskCategory = url.searchParams.get('taskCategory') ?? undefined;
  const minClass = url.searchParams.get('minClass') ?? undefined;
  const minScore = url.searchParams.get('minScore') ?? undefined;
  const sortBy = url.searchParams.get('sortBy') ?? 'score';
  const page = url.searchParams.get('page') ?? '1';

  const browseRes = await fetch(
    `/api/akasa/akashic/browse?${new URLSearchParams({
      ...(taskCategory ? { taskCategory } : {}),
      ...(minClass ? { minClass } : {}),
      ...(minScore ? { minScore } : {}),
      sortBy,
      page,
    }).toString()}`
  );

  const browse = browseRes.ok ? await browseRes.json() : { entries: [], total: 0, page: 1, totalPages: 1 };

  return {
    browse,
    filters: { taskCategory, minClass, minScore, sortBy, page },
  };
};
