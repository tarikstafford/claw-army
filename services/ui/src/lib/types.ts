export interface Execution {
  id: string;
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionMetrics {
  activeBotCount: number;
  totalBotHours: number;
  spentCents: number;
  budgetCapCents: number;
  remainingCents: number;
  estimatedCostCents: number;
}

export interface ExecutionReport {
  executionId: string;
  totalBots: number;
  totalBotHours: number;
  totalCostCents: number;
  averageBotScore: number;
  topPerformingBotId: string | null;
  errorDistribution: Record<string, number>;
  costPerTaskCents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export interface LeaderboardEntry {
  botId: string;
  compositeScore: number | null;
  tier: string | null;
  tasksCompleted: number;
  tasksFailed: number;
  botHours: number | null;
}

export interface BotDetail {
  bot: { id: string; status: string; compositeScore: number | null; tier: string | null };
  metrics: {
    botId: string;
    tasksCompleted: number;
    tasksFailed: number;
    totalTasks: number;
    successRate: number;
    totalCostCents: number;
    costPerTaskCents: number;
    totalTokens: number;
    tokensPerTask: number;
    toolCallsPerTask: number;
    totalToolCalls: number;
    botHours: number;
    tasksPerMinute: number;
    totalRetries: number;
    errorRate: number;
    idleRatio: number;
  };
  steps: StepTrace[];
}

export interface StepTrace {
  toolName: string;
  invocationId: string;
  rejected: boolean;
  rejectionReason: string | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  requestSummary: unknown;
  responseSummary: unknown;
  invokedAt: string;
}

export interface BillingHistoryEntry {
  executionId: string;
  objective: string;
  status: string;
  createdAt: string;
  totalCostCents: number;
  totalBotHours: number;
  taskCount: number;
}

export interface BillingSummary {
  monthlyBotHours: number;
  monthlySpendCents: number;
  executionCount: number;
}

export interface ActivityEvent {
  type: string;
  executionId: string;
  timestamp: string;
  isAlert?: boolean;
  [key: string]: unknown;
}

export interface BotLogEntry {
  type: 'bot_started' | 'bot_stopped' | 'task_claimed' | 'task_completed' | 'guardrail_triggered' | 'tool_invocation';
  botId: string;
  timestamp?: string;
  // tool_invocation fields
  toolName?: string;
  invocationId?: string;
  rejected?: boolean;
  rejectionReason?: string | null;
  durationMs?: number | null;
  totalTokens?: number | null;
  invokedAt?: string;
  // bot_stopped / guardrail_triggered
  reason?: string;
  [key: string]: unknown;
}

export interface ExecutionBot {
  id: string;
  status: 'spawning' | 'idle' | 'working' | 'stopping' | 'stopped' | 'failed';
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  startedAt: string | null;
}
