import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params, parent }) => {
  const { session, companyId } = await parent();
  const userId = session?.user?.id;

  const [projectRes, connectionsRes, objectivesRes, executionsRes, issuesRes] = await Promise.allSettled([
    fetch(`/api/projects/${params.id}`),
    userId ? fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`) : Promise.resolve(null),
    fetch(`/api/objectives?projectId=${encodeURIComponent(params.id)}`),
    fetch(`/api/executions/all?projectId=${encodeURIComponent(params.id)}`),
    companyId ? fetch(`/api/companies/${companyId}/issues?projectId=${encodeURIComponent(params.id)}`) : Promise.resolve(null),
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

  let objectives: Array<{
    id: string;
    name: string;
    description: string | null;
    isArchived: boolean;
    lastRunStatus: string | null;
    runCount: number;
    createdAt: string;
    updatedAt: string;
  }> = [];
  if (objectivesRes.status === 'fulfilled' && objectivesRes.value?.ok) {
    objectives = await objectivesRes.value.json();
  }

  let executions: Array<{
    id: string;
    status: string;
    objective: string;
    createdAt: string;
    updatedAt: string;
  }> = [];
  if (executionsRes.status === 'fulfilled' && executionsRes.value?.ok) {
    executions = await executionsRes.value.json();
  }

  let issues: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }> = [];
  if (issuesRes.status === 'fulfilled' && issuesRes.value?.ok) {
    issues = await issuesRes.value.json();
  }

  return { project, githubConnection, objectives, executions, issues };
};
