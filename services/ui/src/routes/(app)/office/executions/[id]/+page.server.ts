import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [execRes, botsRes, ringLeaderRes] = await Promise.allSettled([
    fetch(`/api/executions/${params.id}`),
    fetch(`/api/executions/${params.id}/bots`),
    fetch(`/api/ring-leader/runs/by-execution/${params.id}/state`),
  ]);

  if (execRes.status === 'rejected' || !execRes.value.ok) {
    throw error(404, 'Execution not found');
  }
  const execution = await execRes.value.json();

  let bots: unknown[] = [];
  if (botsRes.status === 'fulfilled' && botsRes.value.ok) {
    bots = await botsRes.value.json();
  }

  let ringLeader: unknown = null;
  if (ringLeaderRes.status === 'fulfilled' && ringLeaderRes.value.ok) {
    ringLeader = await ringLeaderRes.value.json();
  }

  return {
    execution,
    bots,
    ringLeader,
  };
};

export const actions: Actions = {
  pause: async ({ fetch, params }) => {
    const res = await fetch(`/api/executions/${params.id}/pause`, { method: 'POST' });
    if (!res.ok) {
      return fail(res.status, { error: 'Failed to pause execution' });
    }
    return { success: true };
  },
  resume: async ({ fetch, params }) => {
    const res = await fetch(`/api/executions/${params.id}/resume`, { method: 'POST' });
    if (!res.ok) {
      return fail(res.status, { error: 'Failed to resume execution' });
    }
    return { success: true };
  },
  cancel: async ({ fetch, params }) => {
    const res = await fetch(`/api/executions/${params.id}/stop`, { method: 'POST' });
    if (!res.ok) {
      return fail(res.status, { error: 'Failed to cancel execution' });
    }
    return { success: true };
  },
};