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
  CalibrationData,
} from './types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} — ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function createExecution(body: {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  allowedTools: string[];
}): Promise<{ executionId: string; status: 'queued' }> {
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
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
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
