import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');

  const [profileRes, preferencesRes, apiKeysRes] = await Promise.allSettled([
    fetch('/api/akasa/settings/profile'),
    fetch('/api/akasa/settings/preferences'),
    fetch('/api/akasa/settings/api-keys'),
  ]);

  const profile = profileRes.status === 'fulfilled' && profileRes.value.ok
    ? await profileRes.value.json()
    : null;

  const preferences = preferencesRes.status === 'fulfilled' && preferencesRes.value.ok
    ? await preferencesRes.value.json()
    : null;

  const apiKeys = apiKeysRes.status === 'fulfilled' && apiKeysRes.value.ok
    ? await apiKeysRes.value.json()
    : [];

  return { profile, preferences, apiKeys };
};
