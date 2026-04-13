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

export interface FleetEvent {
  id: string;
  type: string;
  botId?: string;
  executionId?: string;
  soulId?: string;
  taskCategory?: string;
  verdictType?: string;
  fromClass?: string;
  toClass?: string;
  transitionType?: string;
  compositeScore?: string;
  isPioneer?: boolean;
  description: string;
  timestamp: string;
}

export async function getFleetEvents(
  companyId: string,
  params?: { limit?: number; types?: string },
): Promise<FleetEvent[]> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.types) query.set('types', params.types);
  const qs = query.toString();
  return apiFetch(`${BASE}/akasa/evolution/fleet/events${qs ? `?${qs}` : ''}`);
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
  karma?: number;
}

export interface BudgetUpdateInput {
  dailyBudgetCents?: number;
  monthlyBudgetCents?: number;
}

export interface SpendTrendPoint {
  date: string;
  totalCents: number;
}

export interface SpendByAgentPoint {
  date: string;
  agentId: string;
  agentName?: string;
  cents: number;
}

export interface SpendByOperationPoint {
  date: string;
  llmCallsCents: number;
  botHoursCents: number;
  toolInvocationsCents: number;
}

export interface EvolutionCostSummary {
  totalEvolutionCostCents: number;
  evolutionRunsCount: number;
  avgCostPerRunCents: number;
}

// ── Cost Projections ─────────────────────────────────────────────

export type BurnTrend = 'increasing' | 'decreasing' | 'stable';

export interface CostProjectionBreakdown {
  llmInputTokensCents: number;
  llmOutputTokensCents: number;
  botHoursCents: number;
  toolInvocationsCents: number;
}

export interface CostProjection {
  dailyBurnRateCents: number;
  projectedMonthlyCostCents: number;
  daysUntilBudgetExhaustion: number | null;
  trend: BurnTrend;
  breakdown: CostProjectionBreakdown;
  windowDays: number;
  dataPoints: number;
}

export async function getCostProjections(companyId: string): Promise<CostProjection> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/projections`);
}

// ── Delegations ──────────────────────────────────────────────────

export interface DelegationEntry {
  taskId: string;
  description: string;
  status: string;
  assignedBotId: string | null;
  botTier: string | null;
  botCompositeScore: string | null;
  ringLeaderTaskId: string | null;
  createdAt: string;
}

export interface DelegationChain {
  executionId: string;
  objective: string;
  delegations: DelegationEntry[];
}

export interface DelegationStats {
  totalDelegations: number;
  successRate: number;
  avgDepth: number;
  executionCount: number;
}

export interface DelegationResponse {
  chains: DelegationChain[];
  stats: DelegationStats;
}

export async function getDelegations(
  params?: { executionId?: string; from?: string; to?: string },
): Promise<DelegationResponse> {
  const query = new URLSearchParams();
  if (params?.executionId) query.set('executionId', params.executionId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  return apiFetch(`${BASE}/akasa/evolution/delegations${qs ? `?${qs}` : ''}`)
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

// ── Commands ──────────────────────────────────────────────────────

export interface CommandResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export async function executeCommand(
  companyId: string,
  command: string,
  args: string[] = [],
): Promise<CommandResult> {
  return apiFetch(`${BASE}/akasa/commands/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args, companyId }),
  });
}

export async function updateBudget(
  companyId: string,
  input: BudgetUpdateInput,
): Promise<BudgetOverview> {
  return apiFetch(`${BASE}/companies/${companyId}/budgets`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getSpendTrends(companyId: string): Promise<SpendTrendPoint[]> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/trends`);
}

export async function getSpendByAgentTrends(
  companyId: string,
): Promise<SpendByAgentPoint[]> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/trends/by-agent`);
}

export async function getSpendByOperationTrends(
  companyId: string,
): Promise<SpendByOperationPoint[]> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/trends/by-operation`);
}

export async function getEvolutionCostSummary(
  companyId: string,
): Promise<EvolutionCostSummary> {
  return apiFetch(`${BASE}/companies/${companyId}/costs/evolution`);
}

// ── Skills Library ───────────────────────────────────────────────

export interface Skill {
  id: string;
  userId: string;
  name: string;
  description: string;
  version: string;
  category: string;
  triggers: string[];
  requiresTools: string[];
  requiresSkills: string[];
  minAgentClass: string;
  content: string;
  contentHash: string;
  source: string;
  isPublic: string;
  effectivenessStats: SkillEffectivenessStats | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillEffectivenessStats {
  totalActivations?: number;
  successRate?: number;
  avgDuration?: number;
  lastActivatedAt?: string;
}

export interface CreateSkillInput {
  userId: string;
  content: string;
  source?: 'user_created' | 'imported' | 'curated';
  isPublic?: boolean;
}

export async function getSkills(
  userId: string,
  params?: { category?: string; source?: string },
): Promise<Skill[]> {
  const query = new URLSearchParams({ userId });
  if (params?.category) query.set('category', params.category);
  if (params?.source) query.set('source', params.source);
  return apiFetch(`${BASE}/akasa/skills?${query.toString()}`);
}

export async function getSkill(skillId: string): Promise<Skill> {
  return apiFetch(`${BASE}/akasa/skills/${skillId}`);
}

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  return apiFetch(`${BASE}/akasa/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateSkill(
  skillId: string,
  body: { content?: string; name?: string; description?: string },
): Promise<Skill> {
  return apiFetch(`${BASE}/akasa/skills/${skillId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteSkill(skillId: string): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/akasa/skills/${skillId}`, {
    method: 'DELETE',
  });
}

// ── Agent Skills (Loadout) ───────────────────────────────────────

export interface EquippedSkill {
  skillId: string;
  equippedAt: string;
  equippedBy: string;
  skillName: string;
  skillDescription: string;
  skillCategory: string;
  skillVersion: string;
}

export async function getAgentSkills(agentId: string): Promise<EquippedSkill[]> {
  return apiFetch(`${BASE}/akasa/agents/${agentId}/skills`);
}

export async function equipSkill(
  agentId: string,
  skillId: string,
  equippedBy: string,
): Promise<unknown> {
  return apiFetch(`${BASE}/akasa/agents/${agentId}/skills/${skillId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equippedBy }),
  });
}

export async function unequipSkill(
  agentId: string,
  skillId: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/akasa/agents/${agentId}/skills/${skillId}`, {
    method: 'DELETE',
  });
}

// ── Marketplace Reviews ─────────────────────────────────────────

export interface MarketplaceReview {
  id: string;
  userId: string;
  targetId: string;
  targetType: 'soul' | 'skill';
  rating: number;
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  targetId: string;
  avgRating: number;
  count: number;
}

export interface SubmitReviewInput {
  userId: string;
  targetId: string;
  targetType: 'soul' | 'skill';
  rating: number;
  reviewText?: string;
}

export async function submitReview(input: SubmitReviewInput): Promise<MarketplaceReview> {
  return apiFetch(`${BASE}/akasa/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getReviews(
  targetId: string,
  targetType?: 'soul' | 'skill',
): Promise<MarketplaceReview[]> {
  const query = new URLSearchParams({ targetId });
  if (targetType) query.set('targetType', targetType);
  return apiFetch(`${BASE}/akasa/reviews?${query.toString()}`);
}

export async function getReviewSummary(targetId: string): Promise<ReviewSummary> {
  return apiFetch(`${BASE}/akasa/reviews/summary?targetId=${targetId}`);
}

export async function deleteReview(
  reviewId: string,
  userId: string,
): Promise<{ deleted: boolean }> {
  return apiFetch(`${BASE}/akasa/reviews/${reviewId}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

// ── Executions ─────────────────────────────────────────────────────

export type ExecutionStatus =
  | 'pre_flight'
  | 'queued'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'failed';

export interface Execution {
  id: string;
  status: ExecutionStatus;
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
  llmProvider: string | null;
  allowedDomains: string[] | null;
  campaignType: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  activeBotCount?: number;
}

export interface ExecutionListItem extends Execution {
  activeBotCount: number;
}

export interface Bot {
  id: string;
  executionId: string;
  status: 'spawning' | 'idle' | 'working' | 'stopping' | 'stopped' | 'failed';
  containerId: string | null;
  imageTag: string;
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  executionId: string;
  status: 'pending' | 'claimed' | 'completed' | 'failed';
  description: string;
  result: string | null;
  claimedByBotId: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RingLeaderState {
  runId: string;
  executionId: string;
  status: string;
  runState: {
    elapsedTimeSeconds: number;
    budgetConsumedCents: number;
    taskStates: Record<string, {
      status: string;
      activeAgents: string[];
      completedAgents: string[];
      failedAgents: string[];
      outputQualitySignal: number | null;
    }>;
    objectiveDriftScore: number;
    anomalies: string[];
  } | null;
}

export interface RingLeaderSynthesis {
  runId: string;
  executionId: string;
  synthesis: string | null;
  fitnessScores: {
    coordination: number;
    quality: number;
    efficiency: number;
    overall: number;
  } | null;
}

export interface ExecutionEvent {
  type: string;
  executionId?: string;
  botId?: string;
  taskId?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export async function getExecutions(params?: {
  projectId?: string;
  status?: ExecutionStatus;
}): Promise<ExecutionListItem[]> {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  const qs = query.toString();
  return apiFetch(`${BASE}/executions/all${qs ? `?${qs}` : ''}`);
}

export async function getExecution(executionId: string): Promise<Execution> {
  return apiFetch(`${BASE}/executions/${executionId}`);
}

export async function getExecutionBots(executionId: string): Promise<Bot[]> {
  return apiFetch(`${BASE}/executions/${executionId}/bots`);
}

export async function getExecutionTasks(executionId: string): Promise<Task[]> {
  return apiFetch(`${BASE}/executions/${executionId}/tasks`);
}

export async function stopExecution(executionId: string): Promise<{ success: boolean }> {
  return apiFetch(`${BASE}/executions/${executionId}/stop`, { method: 'POST' });
}

export async function getRingLeaderState(executionId: string): Promise<RingLeaderState> {
  return apiFetch(`${BASE}/ring-leader/runs/by-execution/${executionId}/state`);
}

export async function getRingLeaderSynthesis(executionId: string): Promise<RingLeaderSynthesis> {
  return apiFetch(`${BASE}/ring-leader/runs/by-execution/${executionId}/synthesis`);
}

export function createExecutionProgressStream(
  executionId: string,
  onEvent: (event: ExecutionEvent) => void,
  onError: (err: Error) => void,
): () => void {
  const eventSource = new EventSource(`/api/executions/${executionId}/events`);
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ExecutionEvent;
      onEvent(data);
    } catch {
      onError(new Error('Failed to parse SSE event'));
    }
  };
  eventSource.onerror = () => {
    onError(new Error('SSE connection error'));
  };
  return () => {
    eventSource.close();
  };
}
