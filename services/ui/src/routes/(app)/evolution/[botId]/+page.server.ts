import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, params }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const { botId } = params;

  const [timelineRes, lineageRes, ledgerRes] = await Promise.allSettled([
    fetch(`/api/akasa/evolution/bots/${botId}/timeline`),
    fetch(`/api/akasa/evolution/bots/${botId}/lineage`),
    fetch(`/api/akasa/evolution/bots/${botId}/ledger`),
  ]);

  const timeline = timelineRes.status === 'fulfilled' && timelineRes.value.ok
    ? await timelineRes.value.json() : [];
  const lineage = lineageRes.status === 'fulfilled' && lineageRes.value.ok
    ? await lineageRes.value.json() : [];
  const ledger = ledgerRes.status === 'fulfilled' && ledgerRes.value.ok
    ? await ledgerRes.value.json() : [];

  return { botId, timeline, lineage, ledger };
};
