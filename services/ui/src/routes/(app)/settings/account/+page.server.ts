import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  let profile = null;
  try {
    const res = await fetch('/api/akasa/settings/profile');
    if (res.ok) {
      profile = await res.json();
    }
  } catch {
    // Profile load failure
  }

  // Fall back to session data if API profile unavailable
  if (!profile && session.user) {
    profile = {
      name: (session.user as Record<string, unknown>).name ?? null,
      email: (session.user as Record<string, unknown>).email ?? null,
      image: (session.user as Record<string, unknown>).image ?? null,
    };
  }

  return { profile };
};
