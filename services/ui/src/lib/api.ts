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

// ── Skill types ───────────────────────────────────────────────────

export type SkillSource = 'authored' | 'learned' | 'acquired';
export type SkillEffectiveness = 'high' | 'medium' | 'low' | 'unknown';
export type SkillConflictType = 'soul' | 'cooldown' | 'redundant';

export interface Skill {
  id: string;
  companyId: string;
  name: string;
  category: string;
  source: SkillSource;
  triggerPatterns: string[];
  effectivenessScore: number | null;
  effectivenessClassification: SkillEffectiveness;
  confidence: number;
  content: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillEffectivenessMap {
  botId: string;
  skillId: string;
  score: number | null;
  classification: SkillEffectiveness;
}

export interface SkillConflict {
  skillA: string;
  skillB: string;
  conflictType: SkillConflictType;
  description: string;
}

export interface CreateSkillInput {
  name: string;
  category: string;
  triggerPatterns: string[];
  content: string;
}

export interface UpdateSkillInput {
  name?: string;
  category?: string;
  triggerPatterns?: string[];
  content?: string;
  isApproved?: boolean;
}

export interface BotSkillLoadout {
  botId: string;
  equippedSkillIds: string[];
  capacity: number;
}

export interface PendingSkillReview {
  id: string;
  botId: string;
  skillName: string;
  confidence: number;
  learnedAt: string;
}

export interface SkillHeatmapCell {
  botId: string;
  botName: string;
  skillId: string;
  skillName: string;
  classification: SkillEffectiveness;
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

// ── Skills ────────────────────────────────────────────────────────

export async function getSkills(companyId: string, params?: {
  category?: string;
  source?: SkillSource;
  effectiveness?: SkillEffectiveness;
}): Promise<Skill[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.source) query.set('source', params.source);
  if (params?.effectiveness) query.set('effectiveness', params.effectiveness);
  const qs = query.toString();
  return apiFetch(`${BASE}/companies/${companyId}/skills${qs ? `?${qs}` : ''}`);
}

export async function getSkill(skillId: string): Promise<Skill> {
  return apiFetch(`${BASE}/skills/${skillId}`);
}

export async function createSkill(companyId: string, body: CreateSkillInput): Promise<Skill> {
  return apiFetch(`${BASE}/companies/${companyId}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateSkill(skillId: string, body: UpdateSkillInput): Promise<Skill> {
  return apiFetch(`${BASE}/skills/${skillId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteSkill(skillId: string): Promise<void> {
  await apiFetch(`${BASE}/skills/${skillId}`, { method: 'DELETE' });
}

export async function getPendingSkillReviews(companyId: string): Promise<PendingSkillReview[]> {
  return apiFetch(`${BASE}/companies/${companyId}/skills/pending`);
}

export async function approveSkill(skillId: string): Promise<Skill> {
  return apiFetch(`${BASE}/skills/${skillId}/approve`, { method: 'POST' });
}

export async function getBotSkillLoadout(botId: string): Promise<BotSkillLoadout> {
  return apiFetch(`${BASE}/evolution/bots/${botId}/skills/loadout`);
}

export async function equipSkill(botId: string, skillId: string): Promise<BotSkillLoadout> {
  return apiFetch(`${BASE}/evolution/bots/${botId}/skills/equip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId }),
  });
}

export async function unequipSkill(botId: string, skillId: string): Promise<BotSkillLoadout> {
  return apiFetch(`${BASE}/evolution/bots/${botId}/skills/unequip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId }),
  });
}

export async function reorderSkills(botId: string, skillIds: string[]): Promise<BotSkillLoadout> {
  return apiFetch(`${BASE}/evolution/bots/${botId}/skills/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillIds }),
  });
}

export async function getSkillConflicts(botId: string): Promise<SkillConflict[]> {
  return apiFetch(`${BASE}/evolution/bots/${botId}/skills/conflicts`);
}

export async function getFleetSkillHeatmap(companyId: string): Promise<SkillHeatmapCell[]> {
  return apiFetch(`${BASE}/companies/${companyId}/skills/heatmap`);
}
