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
  agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
  isPioneer: boolean;
  verdictSummary: string | null;
  verdictType: string | null;
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
  errorMessage: string | null;
  agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
  currentTaskDescription: string | null;
  toolCallCount: number;
  tokenBurnRate: number | null;
}

export interface PendingVerdict {
  id: string;
  botId: string;
  executionId: string;
  verdictType: 'Promote' | 'Retire';
  weightedConfidenceScore: number;
  verdictSummary: string;
  hasUnresolvedDevilsAdvocate: boolean;
  createdAt: string;
}

export interface VerdictDetail {
  id: string;
  botId: string;
  executionId: string;
  verdictType: 'Promote' | 'Retire';
  status: 'pending' | 'confirmed' | 'rejected';
  weightedConfidenceScore: number;
  verdictSummary: string;
  hasUnresolvedDevilsAdvocate: boolean;
  requiresHumanConfirmation: boolean;
  devilsAdvocateOutput: {
    verdict: string;
    challenges: Array<{ claim: string; counterArgument: string; severity: 'strong' | 'moderate' | 'weak' }>;
    strongUnresolvedArgument: boolean;
  } | null;
  performanceJudgeOutput: {
    verdict: string;
    summary: string;
    metrics: Record<string, unknown>;
  } | null;
  soulAnalystOutput: {
    verdict: string;
    summary: string;
    attributionAnalysis: Record<string, unknown>;
  } | null;
  createdAt: string;
}

export interface CalibrationData {
  total: number;
  confirmed: number;
  rate: number;
  warningTriggered: boolean;
}

export interface ArmyBuilderAnalysis {
  categories: string[];
  libraryDepth: Array<{
    taskCategory: string;
    noviceCount: number;
    understudyCount: number;
    artisanCount: number;
    totalAgents: number;
  }>;
  budgetTiers: {
    full: { label: string; agentCount: number; perCategory: number };
    reduced: { label: string; agentCount: number; perCategory: number };
    minimumViable: { label: string; agentCount: number; perCategory: number };
  };
  blocked: boolean;
  blockReason: string | null;
}

// Phase 18 — Soul Inspector types

export interface BotSoul {
  soulId: string | null;
  soulContent: string | null;
  generation: number | null;
  parentSoulId: string | null;
  isArchetype: boolean | null;
  taskCategory: string | null;
  constitutionDirectives: string[] | null;
  dimensions: {
    identityRole: string;
    decisionPriorities: string;
    toolUsageDoctrine: string;
    riskTolerance: string;
    communicationStyle: string;
    recoveryBehavior: string;
    ethicalHardStops: string;
  } | null;
  agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
  verdict: {
    verdictType: string;
    weightedConfidenceScore: number;
    verdictSummary: string;
    soulAnalystOutput: unknown;
    performanceJudgeOutput: unknown;
  } | null;
}

export interface LifecycleNotification {
  type: 'soul_promoted' | 'soul_demoted' | 'soul_retired' | 'pioneer_detected';
  botId: string;
  executionId: string;
  taskCategory: string;
  description: string;
  timestamp: string;
  // Promotion-specific
  fromClass?: string;
  toClass?: string;
}

// Phase 17 — Objective Hub types

export interface Objective {
  id: string;
  name: string;
  description: string | null;
  defaultMaxBots: number;
  defaultBudgetCapCents: number | null;
  defaultRuntimeLimitSeconds: number | null;
  defaultAllowedTools: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveListItem extends Objective {
  lastRunStatus: string | null;
  runCount: number;
  totalSpendCents: number;
  bestBotClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null;
}

export interface ObjectiveRun {
  id: string;
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  objective: string;
  createdAt: string;
  totalCostCents: number;
  botCount: number;
  avgCompositeScore: number | null;
}

export interface ObjectiveStats {
  totalSpendCents: number;
  totalTasksCompleted: number;
  totalBotHours: number;
  runCount: number;
  classBreakdown: {
    novice: number;
    understudy: number;
    artisan: number;
    retired: number;
  };
  classTrendSummary: string;
}
