import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params, parent }) => {
  const { session } = await parent();
  const userId = session?.user?.id;

  const [projectRes, connectionsRes] = await Promise.allSettled([
    fetch(`/api/projects/${params.id}`),
    userId ? fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`) : Promise.resolve(null),
  ]);

  if (projectRes.status === 'rejected' || !projectRes.value?.ok) {
    throw error(500, 'Failed to load project');
  }
  const project = await projectRes.value!.json();

  let githubConnection = null;
  if (connectionsRes.status === 'fulfilled' && connectionsRes.value?.ok) {
    const connections = await connectionsRes.value.json() as Array<{
      id: string;
      toolId: string;
      status: string;
      displayLabel: string | null;
    }>;
    githubConnection = connections.find(c => c.toolId === 'github') ?? null;
  }

  return { project, githubConnection };
};
