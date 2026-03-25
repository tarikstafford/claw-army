import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  const [connectionsRes] = await Promise.allSettled([
    fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`),
  ]);

  const connections = connectionsRes.status === 'fulfilled' && connectionsRes.value.ok
    ? await connectionsRes.value.json()
    : [];

  // Pass OAuth callback params for toast display
  const connected = url.searchParams.get('connected');
  const oauthError = url.searchParams.get('error');
  const tool = url.searchParams.get('tool');

  return { connections, userId, connected, oauthError, tool };
};
