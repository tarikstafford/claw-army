import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  // Fetch existing imported tools for the registry list
  const [registryRes] = await Promise.allSettled([
    fetch(`/api/akasa/tool-registry?userId=${encodeURIComponent(userId)}`),
  ]);

  const registry = registryRes.status === 'fulfilled' && registryRes.value.ok
    ? await registryRes.value.json()
    : [];

  return { userId, registry };
};
