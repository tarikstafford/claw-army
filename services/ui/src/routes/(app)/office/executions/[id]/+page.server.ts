import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  getExecution,
  getExecutionBots,
  getExecutionTasks,
  getExecutionRingLeader,
  getExecutionSynthesis,
} from '$lib/api';

export const load: PageServerLoad = async ({ params }) => {
  const { id } = params;

  try {
    const [execution, bots, tasks, ringLeader] = await Promise.allSettled([
      getExecution(id),
      getExecutionBots(id),
      getExecutionTasks(id),
      getExecutionRingLeader(id),
    ]);

    if (execution.status === 'rejected' || !execution.value) {
      throw error(404, 'Execution not found');
    }

    const synthesis = execution.value.status === 'completed' || execution.value.status === 'failed'
      ? await getExecutionSynthesis(id).catch(() => null)
      : null;

    return {
      execution: execution.value,
      bots: bots.status === 'fulfilled' ? bots.value : [],
      tasks: tasks.status === 'fulfilled' ? tasks.value : [],
      ringLeader: ringLeader.status === 'fulfilled' ? ringLeader.value : null,
      synthesis,
    };
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw err;
    }
    throw error(500, 'Failed to load execution');
  }
};
