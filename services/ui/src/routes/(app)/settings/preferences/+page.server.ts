import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  let preferences = null;
  try {
    const res = await fetch('/api/akasa/settings/preferences');
    if (res.ok) {
      preferences = await res.json();
    }
  } catch {
    // Preferences load failure — defaults will be used
  }

  return { preferences };
};
