import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [execRes, botsRes, tasksRes, ringLeaderRes] = await Promise.allSettled([
    fetch(`/api/executions/${params.id}`),
    fetch(`/api/executions/${params.id}/bots`),
    fetch(`/api/executions/${params.id}/tasks`),
    fetch(`/api/ring-leader/runs/by-execution/${params.id}/state`),
  ]);

  if (execRes.status !== 'fulfilled' || !execRes.value.ok) {
    throw error(execRes.status === 'fulfilled' ? execRes.value.status : 500, 'Failed to load execution');
  }

  const execution = await execRes.value.json();
  const bots = botsRes.status === 'fulfilled' && botsRes.value.ok
    ? await botsRes.value.json()
    : [];
  const tasks = tasksRes.status === 'fulfilled' && tasksRes.value.ok
    ? await tasksRes.value.json()
    : [];
  const ringLeader = ringLeaderRes.status === 'fulfilled' && ringLeaderRes.value.ok
    ? await ringLeaderRes.value.json()
    : null;

  return { execution, bots, tasks, ringLeader };
};