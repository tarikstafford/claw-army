import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, params }) => {
  const { session } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  const { botId } = params;

  const companyId = (session as { companyId?: string }).companyId ?? '';

  const [timelineRes, lineageRes, ledgerRes, profileRes, loadoutRes, skillsRes] = await Promise.allSettled([
    fetch(`/api/akasa/evolution/bots/${botId}/timeline`),
    fetch(`/api/akasa/evolution/bots/${botId}/lineage`),
    fetch(`/api/akasa/evolution/bots/${botId}/ledger`),
    fetch(`/api/akasa/evolution/bots/${botId}/profile`),
    fetch(`/api/akasa/evolution/bots/${botId}/skills`),
    fetch(`/api/akasa/companies/${companyId}/skills`),
  ]);

  const timeline = timelineRes.status === 'fulfilled' && timelineRes.value.ok
    ? await timelineRes.value.json() : [];
  const lineage = lineageRes.status === 'fulfilled' && lineageRes.value.ok
    ? await lineageRes.value.json() : [];
  const ledger = ledgerRes.status === 'fulfilled' && ledgerRes.value.ok
    ? await ledgerRes.value.json() : [];
  const profile = profileRes.status === 'fulfilled' && profileRes.value.ok
    ? await profileRes.value.json() : null;
  const loadout = loadoutRes.status === 'fulfilled' && loadoutRes.value.ok
    ? await loadoutRes.value.json() : null;
  const skills = skillsRes.status === 'fulfilled' && skillsRes.value.ok
    ? await skillsRes.value.json() : [];

  return { botId, timeline, lineage, ledger, profile, loadout, skills };
};
