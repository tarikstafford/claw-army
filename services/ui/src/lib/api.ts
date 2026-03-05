import type {
  Execution,
  ExecutionMetrics,
  ExecutionReport,
  LeaderboardEntry,
  BotDetail,
  BillingHistoryEntry,
  BillingSummary,
  ExecutionBot,
  PendingVerdict,
  VerdictDetail,
  ExecutionPendingVerdict,
  CalibrationData,
  ArmyBuilderAnalysis,
  Objective,
  ObjectiveListItem,
  ObjectiveRun,
  ObjectiveStats,
  ObjectiveTimeline,
  BotSoul,
  RingLeaderManifestResponse,
  RingLeaderStateResponse,
  RingLeaderEventsResponse,
  RingLeaderSynthesisResponse,
  SoulLibraryResponse,
  SoulCategoriesResponse,
  CategoryBenchmarksResponse,
  DecisionTracesResponse,
  NegativeSignalsResponse,
} from './types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body || res.statusText} — ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function createExecution(body: {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  allowedTools: string[];
  objectiveId?: string;
}): Promise<{ executionId: string; status: 'queued' | 'pre_flight' }> {
  return apiFetch(`${BASE}/executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getExecution(id: string): Promise<Execution> {
  return apiFetch(`${BASE}/executions/${id}`);
}

export async function getExecutionMetrics(id: string): Promise<ExecutionMetrics> {
  return apiFetch(`${BASE}/executions/${id}/metrics`);
}

export async function getExecutionReport(id: string): Promise<ExecutionReport> {
  return apiFetch(`${BASE}/executions/${id}/report`);
}

export async function getLeaderboard(id: string): Promise<LeaderboardEntry[]> {
  return apiFetch(`${BASE}/executions/${id}/leaderboard`);
}

export async function getBotDetail(botId: string): Promise<BotDetail> {
  return apiFetch(`${BASE}/bots/${botId}/detail`);
}

export async function getExecutionBots(executionId: string): Promise<ExecutionBot[]> {
  return apiFetch(`${BASE}/bots/by-execution/${executionId}`);
}

export async function getBillingHistory(): Promise<BillingHistoryEntry[]> {
  return apiFetch(`${BASE}/billing/history`);
}

export async function getBillingSummary(): Promise<BillingSummary> {
  return apiFetch(`${BASE}/billing/summary`);
}

// Admin

export interface AdminExecution {
  id: string;
  status: 'queued' | 'pre_flight' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  allowedTools: string[];
  createdAt: string;
  updatedAt: string;
  activeBotCount: number;
}

export async function listAllExecutions(): Promise<AdminExecution[]> {
  return apiFetch(`${BASE}/executions/all`);
}

export async function stopExecution(id: string): Promise<{ success: boolean }> {
  return apiFetch(`${BASE}/executions/${id}/stop`, { method: 'POST' });
}

export async function confirmExecution(id: string): Promise<{ success: boolean }> {
  return apiFetch(`${BASE}/executions/${id}/confirm`, { method: 'POST' });
}

export async function cancelExecution(id: string): Promise<{ success: boolean }> {
  return apiFetch(`${BASE}/executions/${id}/cancel`, { method: 'POST' });
}

// Verdicts (Phase 12 — confirmation gate)

export async function getPendingVerdicts(): Promise<PendingVerdict[]> {
  return apiFetch(`${BASE}/verdicts/pending`);
}

export async function getVerdict(verdictId: string): Promise<VerdictDetail> {
  return apiFetch(`${BASE}/verdicts/${verdictId}`);
}

export async function confirmVerdict(
  verdictId: string,
  body: { userId: string; timeOnScreenMs: number },
): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/verdicts/${verdictId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function rejectVerdict(
  verdictId: string,
  body: { userId: string; timeOnScreenMs: number },
): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/verdicts/${verdictId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getCalibration(userId: string): Promise<CalibrationData> {
  return apiFetch(`${BASE}/verdicts/calibration?userId=${encodeURIComponent(userId)}`);
}

// Army Builder (Phase 14 — UIEX-04/05)

export async function getArmyBuilderAnalysis(
  objective: string,
  maxBots: number,
): Promise<ArmyBuilderAnalysis> {
  const params = new URLSearchParams({
    objective,
    maxBots: String(maxBots),
  });
  return apiFetch(`${BASE}/army-builder/analysis?${params}`);
}

// Phase 17 — Objectives API

export async function getObjectives(): Promise<ObjectiveListItem[]> {
  return apiFetch(`${BASE}/objectives`);
}

export async function getArchivedObjectives(): Promise<ObjectiveListItem[]> {
  return apiFetch(`${BASE}/objectives?archived=true`);
}

export async function getObjective(id: string): Promise<Objective> {
  return apiFetch(`${BASE}/objectives/${id}`);
}

export async function getObjectiveExecutions(id: string): Promise<ObjectiveRun[]> {
  return apiFetch(`${BASE}/objectives/${id}/executions`);
}

export async function getObjectiveStats(id: string): Promise<ObjectiveStats> {
  return apiFetch(`${BASE}/objectives/${id}/stats`);
}

// Phase 38 — DNA Evolution Timeline

export async function getObjectiveTimeline(
  id: string,
  params: { limit?: number; offset?: number; filter?: string } = {},
): Promise<ObjectiveTimeline> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  if (params.filter && params.filter !== 'all') query.set('filter', params.filter);
  const qs = query.toString();
  return apiFetch(`${BASE}/objectives/${id}/timeline${qs ? `?${qs}` : ''}`);
}

// Phase 37 — Objective Mutations (used by server actions and client-side code)

export async function updateObjective(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    defaultMaxBots: number;
    defaultBudgetCapCents: number;
    defaultRuntimeLimitSeconds: number;
    defaultAllowedTools: string[];
    isArchived: boolean;
  }>,
): Promise<Objective> {
  return apiFetch(`${BASE}/objectives/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function archiveObjective(id: string): Promise<Objective> {
  return updateObjective(id, { isArchived: true });
}

export async function unarchiveObjective(id: string): Promise<Objective> {
  return updateObjective(id, { isArchived: false });
}

export async function createObjective(body: {
  name: string;
  description?: string;
  defaultMaxBots: number;
  defaultBudgetCapCents?: number;
  defaultRuntimeLimitSeconds?: number;
  defaultAllowedTools?: string[];
}): Promise<Objective> {
  return apiFetch(`${BASE}/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Phase 18 — Soul Inspector

export async function getBotSoul(botId: string): Promise<BotSoul> {
  return apiFetch(`${BASE}/bots/${botId}/soul`);
}

// Phase 19 — Run View Enhancements

export async function getExecutionPendingVerdicts(executionId: string): Promise<ExecutionPendingVerdict[]> {
  return apiFetch(`${BASE}/executions/${executionId}/pending-verdicts`);
}

// Phase 32 — Ring Leader Dashboard API

export async function getRingLeaderManifest(executionId: string): Promise<RingLeaderManifestResponse> {
  return apiFetch(`${BASE}/ring-leader/runs/by-execution/${executionId}`);
}

export async function getRingLeaderState(executionId: string): Promise<RingLeaderStateResponse> {
  return apiFetch(`${BASE}/ring-leader/runs/by-execution/${executionId}/state`);
}

export async function getRingLeaderEvents(executionId: string): Promise<RingLeaderEventsResponse> {
  return apiFetch(`${BASE}/ring-leader/runs/by-execution/${executionId}/events`);
}

export async function getRingLeaderSynthesis(executionId: string): Promise<RingLeaderSynthesisResponse> {
  return apiFetch(`${BASE}/ring-leader/runs/by-execution/${executionId}/synthesis`);
}

// Phase 39 — Soul Library (SOUL-01)

export async function getSoulDetail(soulId: string): Promise<import('./types').SoulDetail> {
  return apiFetch(`${BASE}/souls/${soulId}`);
}

export async function getSoulLibrary(
  params: { category?: string; agentClass?: string; limit?: number; offset?: number } = {},
): Promise<SoulLibraryResponse> {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.agentClass) query.set('agentClass', params.agentClass);
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiFetch(`${BASE}/souls${qs ? `?${qs}` : ''}`);
}

export async function getSoulCategories(): Promise<SoulCategoriesResponse> {
  return apiFetch(`${BASE}/souls/categories`);
}

// Phase 39 — Category Benchmarks (SOUL-04)

export async function getCategoryBenchmarks(): Promise<CategoryBenchmarksResponse> {
  return apiFetch(`${BASE}/category-benchmarks`);
}

// Phase 39 — Decision Traces (SOUL-02)

export async function getBotDecisionTraces(
  botId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<DecisionTracesResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiFetch(`${BASE}/decision-traces/${botId}${qs ? `?${qs}` : ''}`);
}

// Phase 39 — Negative Signals (SOUL-03)

export async function getNegativeSignals(
  params: { failureType?: string; limit?: number; offset?: number } = {},
): Promise<NegativeSignalsResponse> {
  const query = new URLSearchParams();
  if (params.failureType) query.set('failureType', params.failureType);
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiFetch(`${BASE}/negative-signals${qs ? `?${qs}` : ''}`);
}
