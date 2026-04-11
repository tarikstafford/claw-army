import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  const skillsRes = await fetch(`/api/akasa/skills?userId=${encodeURIComponent(userId)}`);
  const skills = skillsRes.ok ? await skillsRes.json() : [];

  return { skills, userId };
};
