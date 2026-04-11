const BASE = '/api';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body || res.statusText} — ${url}`);
  }
  return res.json() as Promise<T>;
}

// ── Domain types ──────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  adapter?: string | null;
  status?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  adapter?: string;
}

export interface Issue {
  id: string;
  companyId: string;
  title: string;
  body?: string | null;
  status: string;
  projectId?: string | null;
  assigneeAgentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueInput {
  title: string;
  body?: string;
  projectId?: string;
  assigneeAgentId?: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  body: string;
  senderType?: string | null;
  senderId?: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface ChatThread {
  id: string;
  companyId: string;
  agentId: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  body: string;
  senderType?: string | null;
  senderId?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalAgents: number;
  activeAgents: number;
  openIssues: number;
  pendingApprovals: number;
  recentActivity?: ActivityEvent[];
}

export interface ActivityEvent {
  id: string | number;
  type: string;
  description?: string;
  createdAt: string;
  agentId?: string | null;
  payload?: Record<string, unknown>;
}

export interface SidebarBadges {
  pendingApprovals?: number;
  openIssues?: number;
  activeAgents?: number;
}

export interface Approval {
  id: string;
  companyId: string;
  type: string;
  status: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CostSummary {
  totalCents: number;
  periodStart: string;
  periodEnd: string;
  breakdown?: Record<string, number>;
}

export interface CostByAgent {
  agentId: string;
  agentName?: string | null;
  totalCents: number;
}

export interface BudgetOverview {
  dailyBudgetCents: number;
  spentTodayCents: number;
  remainingTodayCents: number;
  monthlyTotalCents: number;
  monthlyBudgetCents?: number;
  karma?: number | null;
}

export interface BudgetUpdateInput {
  dailyBudgetCents?: number;
  monthlyBudgetCents?: number;
}

export interface SpendTrendPoint {
  date: string;
  totalCents: number;
  byAgent?: Record<string, number>;
  byOperation?: {
    llmCallsCents: number;
    botHoursCents: number;
    toolInvocationsCents: number;
  };
}

// ── Companies ─────────────────────────────────────────────────────

export async function getCompanies(): Promise<Company[]> {
  return apiFetch(`${BASE}/companies`);
}

// ── Dashboard (INDRA) ─────────────────────────────────────────────

export async function getDashboard(companyId: string): Promise<DashboardSummary> {
  return apiFetch(`${BASE}/companies/${companyId}/dashboard`);
}

export async function getActivity(companyId: string, params?: { agentId?: string }): Promise<ActivityEvent[]> {
  const query = params?.agentId ? `?agentId=${encodeURIComponent(params.agentId)}` : '';
  return apiFetch(`${BASE}/companies/${companyId}/activity${query}`);
}

export async function getSidebarBadges(companyId: string): Promise<SidebarBadges> {
  return apiFetch(`${BASE}/companies/${companyId}/sidebar-badges`);
}

// ── Approvals ─────────────────────────────────────────────────────

export async function getApprovals(companyId: string): Promise<Approval[]> {
  return apiFetch(`${BASE}/companies/${companyId}/approvals`);
}

// ── Agents ────────────────────────────────────────────────────────

export async function getAgents(companyId: string): Promise<Agent[]> {
  return apiFetch(`${BASE}/companies/${companyId}/agents`);
}

export async function getAgent(agentId: string): Promise<Agent> {
  return apiFetch(`${BASE}/agents/${agentId}`);
}

export async function createAgent(companyId: string, body: CreateAgentInput): Promise<Agent> {
  return apiFetch(`${BASE}/companies/${companyId}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateAgent(agentId: string, body: Partial<Agent>): Promise<Agent> {
  return apiFetch(`${BASE}/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Issues ────────────────────────────────────────────────────────

export async function getIssues(
  companyId: string,
  params?: { status?: string; projectId?: string; assigneeAgentId?: string; q?: string },
): Promise<Issue[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.assigneeAgentId) query.set('assigneeAgentId', params.assigneeAgentId);
  if (params?.q) query.set('q', params.q);
  const qs = query.toString();
  return apiFetch(`${BASE}/companies/${companyId}/issues${qs ? `?${qs}` : ''}`);
}

export async function getIssue(issueId: string): Promise<Issue> {
  return apiFetch(`${BASE}/issues/${issueId}`);
}

export async function createIssue(companyId: string, body: CreateIssueInput): Promise<Issue> {
  return apiFetch(`${BASE}/companies/${companyId}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateIssue(issueId: string, body: Partial<Issue>): Promise<Issue> {
  return apiFetch(`${BASE}/issues/${issueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getIssueComments(issueId: string): Promise<IssueComment[]> {
  return apiFetch(`${BASE}/issues/${issueId}/comments`);
}

export async function addIssueComment(
  issueId: string,
  body: { body: string; reopen?: boolean; interrupt?: boolean },
): Promise<IssueComment> {
  return apiFetch(`${BASE}/issues/${issueId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Goals ─────────────────────────────────────────────────────────

export async function getGoals(companyId: string): Promise<Goal[]> {
  return apiFetch(`${BASE}/companies/${companyId}/goals`);
}

export async function getGoal(goalId: string): Promise<Goal> {
  return apiFetch(`${BASE}/goals/${goalId}`);
}

export async function createGoal(companyId: string, body: CreateGoalInput): Promise<Goal> {
  return apiFetch(`${BASE}/companies/${companyId}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Projects ──────────────────────────────────────────────────────

export async function getProjects(companyId: string): Promise<Project[]> {
  return apiFetch(`${BASE}/companies/${companyId}/projects`);
}

export async function getProject(projectId: string): Promise<Project> {
  return apiFetch(`${BASE}/projects/${projectId}`);
}

export async function createProject(companyId: string, body: CreateProjectInput): Promise<Project> {
  return apiFetch(`${BASE}/companies/${companyId}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Chat ──────────────────────────────────────────────────────────

export async function getChatThreads(companyId: string): Promise<ChatThread[]> {
  return apiFetch(`${BASE}/companies/${companyId}/chat/threads`);
}

export async function createChatThread(
  companyId: string,
  body: { agentId: string; title?: string },
): Promise<ChatThread> {
  return apiFetch(`${BASE}/companies/${companyId}/chat/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getChatMessages(
  threadId: string,
  params?: { after?: string; limit?: number },
): Promise<{ messages: ChatMessage[]; nextCursor?: string }> {
  const query = new URLSearchParams();
  if (params?.after) query.set('after', params.after);
  if (params?.limit != null) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch(`${BASE}/chat/threads/${threadId}/messages${qs ? `?${qs}` : ''}`);
}

export async function sendChatMessage(
  threadId: string,
  body: { body: string; senderType?: string },
): Promise<ChatMessage> {
  return apiFetch(`${BASE}/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Costs (SANCTUM) ───────────────────────────────────────────────

export async function getCostsSummary(companyId: string): Promise<CostSummary> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/summary`);
}

export async function getCostsByAgent(companyId: string): Promise<CostByAgent[]> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/by-agent`);
}

export async function getBudgetOverview(companyId: string): Promise<BudgetOverview> {
  return apiFetch(`${BASE}/companies/${companyId}/budgets/overview`);
}

export async function updateBudget(companyId: string, input: BudgetUpdateInput): Promise<BudgetOverview> {
  return apiFetch(`${BASE}/companies/${companyId}/budgets`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
