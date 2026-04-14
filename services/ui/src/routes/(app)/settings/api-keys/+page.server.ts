import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  let apiKeys: Array<{ id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null }> = [];
  try {
    const res = await fetch('/api/akasa/settings/api-keys');
    if (res.ok) {
      apiKeys = await res.json();
    }
  } catch {
    // API keys load failure
  }

  return { apiKeys };
};
