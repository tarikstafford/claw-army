import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const [skillsRes, pendingRes] = await Promise.allSettled([
    fetch('/api/akasa/skills'),
    fetch('/api/akasa/skills/pending'),
  ]);

  const skills = skillsRes.status === 'fulfilled' && skillsRes.value.ok
    ? await skillsRes.value.json()
    : [];
  const pendingReviews = pendingRes.status === 'fulfilled' && pendingRes.value.ok
    ? await pendingRes.value.json()
    : [];

  return { skills, pendingReviews };
};
