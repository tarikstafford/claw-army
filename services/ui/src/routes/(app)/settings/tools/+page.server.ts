import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { session, companyId } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  const [
    connectionsRes,
    rulesRes,
    logsRes,
    agentsRes,
    registryRes,
  ] = await Promise.allSettled([
    fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`),
    fetch(`/api/akasa/webhook-routing-rules?userId=${encodeURIComponent(userId)}`),
    fetch(`/api/akasa/webhooks/logs?userId=${encodeURIComponent(userId)}`),
    companyId ? fetch(`/api/companies/${companyId}/agents`) : Promise.reject('no company'),
    fetch(`/api/akasa/tool-registry?userId=${encodeURIComponent(userId)}`),
  ]);

  const connections = connectionsRes.status === 'fulfilled' && connectionsRes.value.ok
    ? await connectionsRes.value.json() : [];
  const rules = rulesRes.status === 'fulfilled' && rulesRes.value.ok
    ? await rulesRes.value.json() : [];
  const logs = logsRes.status === 'fulfilled' && logsRes.value.ok
    ? await logsRes.value.json() : [];
  const agents = agentsRes.status === 'fulfilled' && agentsRes.value.ok
    ? await agentsRes.value.json() : [];
  const registry = registryRes.status === 'fulfilled' && registryRes.value.ok
    ? await registryRes.value.json() : [];

  // Fetch usage analytics for each connection
  const analyticsMap: Record<string, { callCount: number; avgLatencyMs: number | null; errorCount: number; lastSuccessAt: string | null }> = {};
  await Promise.allSettled(
    connections.map(async (conn: { id: string }) => {
      try {
        const connLogsRes = await fetch(`/api/akasa/tool-connections/${conn.id}/logs`);
        if (connLogsRes.ok) {
          const connLogs = await connLogsRes.json();
          const successLogs = connLogs.filter((l: { success: boolean }) => l.success);
          const errorLogs = connLogs.filter((l: { success: boolean }) => !l.success);
          const latencies = connLogs
            .filter((l: { latencyMs: number | null }) => l.latencyMs != null)
            .map((l: { latencyMs: number }) => l.latencyMs);
          const avgLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
            : null;
          const lastSuccess = successLogs.length > 0 ? successLogs[0].createdAt : null;
          analyticsMap[conn.id] = {
            callCount: connLogs.length,
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

  const connected = url.searchParams.get('connected');
  const oauthError = url.searchParams.get('error');
  const tool = url.searchParams.get('tool');

  return {
    connections,
    rules,
    logs,
    agents,
    registry,
    analytics: analyticsMap,
    userId,
    connected,
    oauthError,
    tool,
  };
};
