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

  const connected = url.searchParams.get('connected');
  const oauthError = url.searchParams.get('error');

  // Fetch usage analytics for each connection
  const analyticsMap: Record<string, { callCount: number; avgLatencyMs: number | null; errorCount: number; lastSuccessAt: string | null }> = {};
  await Promise.allSettled(
    connections.map(async (conn: { id: string }) => {
      try {
        const logsRes = await fetch(`/api/akasa/tool-connections/${conn.id}/logs`);
        if (logsRes.ok) {
          const logs = await logsRes.json();
          const successLogs = logs.filter((l: { success: boolean }) => l.success);
          const errorLogs = logs.filter((l: { success: boolean }) => !l.success);
          const latencies = logs
            .filter((l: { latencyMs: number | null }) => l.latencyMs != null)
            .map((l: { latencyMs: number }) => l.latencyMs);
          const avgLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
            : null;
          const lastSuccess = successLogs.length > 0 ? successLogs[0].createdAt : null;
          analyticsMap[conn.id] = {
            callCount: logs.length,
            avgLatencyMs: avgLatency,
            errorCount: errorLogs.length,
            lastSuccessAt: lastSuccess,
          };
        }
      } catch {
        // Ignore individual connection errors
      }
    })
  );

  return { connections, userId, connected, oauthError, analytics: analyticsMap };
};
