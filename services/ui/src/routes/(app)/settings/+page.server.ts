import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  const user = session.user;

  const [prefsRes, apiKeysRes] = await Promise.allSettled([
    fetch(`/api/akasa/user-preferences/${encodeURIComponent(userId)}`),
    fetch(`/api/akasa/api-keys/${encodeURIComponent(userId)}`),
  ]);

  const preferences = prefsRes.status === 'fulfilled' && prefsRes.value.ok
    ? await prefsRes.value.json()
    : null;

  const apiKeys = apiKeysRes.status === 'fulfilled' && apiKeysRes.value.ok
    ? await apiKeysRes.value.json()
    : [];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
    preferences,
    apiKeys,
    userId,
  };
};
