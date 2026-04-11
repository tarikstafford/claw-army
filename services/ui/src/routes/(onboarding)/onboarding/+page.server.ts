import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
  const { session } = await parent();
  const userId = session.user?.id;

  let connections: Array<{ id: string; toolId: string; status: string; lastUsedAt: string | null }> = [];
  if (userId) {
    const connectionsRes = await fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`);
    if (connectionsRes.ok) {
      connections = await connectionsRes.json();
    }
  }

  const justConnected = url.searchParams.get('connected');
  const oauthError = url.searchParams.get('error');

  return {
    userName: session.user.name ?? 'there',
    userId,
    connections,
    justConnected,
    oauthError,
  };
};
