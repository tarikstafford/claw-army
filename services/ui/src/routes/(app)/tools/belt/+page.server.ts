import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

interface InvocationStats {
  totalCalls: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number | null;
  lastSuccessfulCallAt: string | null;
}

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

  const statsMap: Record<string, InvocationStats> = {};
  for (const conn of connections as Array<{ id: string }>) {
    const logsRes = await fetch(`/api/akasa/tool-connections/${conn.id}/logs`);
    if (logsRes.ok) {
      const logs = await logsRes.json();
      const successLogs = logs.filter((l: { success: boolean }) => l.success);
      const errorLogs = logs.filter((l: { success: boolean }) => !l.success);
      const latencyValues = logs
        .map((l: { latencyMs: number | null }) => l.latencyMs)
        .filter((v: number | null): v is number => v !== null && v > 0);
      const avgLatency = latencyValues.length > 0
        ? Math.round(latencyValues.reduce((a: number, b: number) => a + b, 0) / latencyValues.length)
        : null;
      const lastSuccess = successLogs.length > 0 ? successLogs[0].createdAt : null;
      statsMap[conn.id] = {
        totalCalls: logs.length,
        successCount: successLogs.length,
        errorCount: errorLogs.length,
        avgLatencyMs: avgLatency,
        lastSuccessfulCallAt: lastSuccess,
      };
    } else {
      statsMap[conn.id] = {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        avgLatencyMs: null,
        lastSuccessfulCallAt: null,
      };
    }
  }

  const connected = url.searchParams.get('connected');
  const oauthError = url.searchParams.get('error');

  return { connections, userId, connected, oauthError, connectionStats: statsMap };
};
