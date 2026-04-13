import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { companyId } = await parent();
  if (!companyId) throw error(500, 'No company found');

  const status = url.searchParams.get('status') ?? '';
  const q = url.searchParams.get('q') ?? '';
  const assignee = url.searchParams.get('assignee') ?? '';
  const project = url.searchParams.get('project') ?? '';
  const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') ?? 'desc';
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (assignee) params.set('assigneeAgentId', assignee);
  if (project) params.set('projectId', project);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortOrder) params.set('sortOrder', sortOrder);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  const qs = params.toString();
  const res = await fetch(`/api/companies/${companyId}/issues${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw error(res.status, 'Failed to load issues');

  let issues: unknown[] = [];
  let totalCount = 0;

  const data = await res.json();
  if (Array.isArray(data)) {
    issues = data;
    totalCount = data.length;
  } else if (data.issues && Array.isArray(data.issues)) {
    issues = data.issues;
    totalCount = data.total ?? data.issues.length;
  } else if (data.data && Array.isArray(data.data)) {
    issues = data.data;
    totalCount = data.total ?? data.data.length;
  } else {
    issues = [];
    totalCount = 0;
  }

  const agentsRes = await fetch(`/api/companies/${companyId}/agents`);
  const agents: { id: string; name: string }[] = agentsRes.ok ? await agentsRes.json() : [];

  const projectsRes = await fetch(`/api/companies/${companyId}/projects`);
  const projects: { id: string; name: string }[] = projectsRes.ok ? await projectsRes.json() : [];

  return {
    issues,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize) || 1,
    agents,
    projects,
    filters: { status, q, assignee, project, sortBy, sortOrder },
  };
};
