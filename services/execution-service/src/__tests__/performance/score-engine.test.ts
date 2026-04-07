import { describe, it, expect } from 'vitest';
import type { BotMetrics } from '../metrics-computer';

function makeMetrics(overrides: Partial<BotMetrics> = {}): BotMetrics {
  return {
    botId: 'bot-1',
    tasksCompleted: 10,
    tasksFailed: 2,
    totalTasks: 12,
    successRate: 10 / 12,
    totalCostCents: 500,
    costPerTaskCents: 50,
    totalTokens: 10000,
    tokensPerTask: 1000,
    toolCallsPerTask: 2,
    totalToolCalls: 20,
    botHours: 1,
    tasksPerMinute: 10 / 1,
    totalRetries: 1,
    errorRate: 2 / (12 + 20),
    idleRatio: 0.3,
    ...overrides,
  };
}

function normalizeHigherIsBetter(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return ((value - min) / (max - min)) * 100;
}

function normalizeLowerIsBetter(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return ((max - value) / (max - min)) * 100;
}

function computeEfficiencyScore(metric: BotMetrics, allMetrics: BotMetrics[]): number {
  const tasksPerMinValues = allMetrics.map((m) => m.tasksPerMinute);
  const tokensPerTaskValues = allMetrics.map((m) => m.tokensPerTask);
  const toolCallsPerTaskValues = allMetrics.map((m) => m.toolCallsPerTask);
  const idleRatioValues = allMetrics.map((m) => m.idleRatio);

  const minTasksPerMin = Math.min(...tasksPerMinValues);
  const maxTasksPerMin = Math.max(...tasksPerMinValues);
  const minTokensPerTask = Math.min(...tokensPerTaskValues);
  const maxTokensPerTask = Math.max(...tokensPerTaskValues);
  const minToolCallsPerTask = Math.min(...toolCallsPerTaskValues);
  const maxToolCallsPerTask = Math.max(...toolCallsPerTaskValues);
  const minIdleRatio = Math.min(...idleRatioValues);
  const maxIdleRatio = Math.max(...idleRatioValues);

  const throughputScore = normalizeHigherIsBetter(metric.tasksPerMinute, minTasksPerMin, maxTasksPerMin);
  const tokenEfficiencyScore = normalizeLowerIsBetter(metric.tokensPerTask, minTokensPerTask, maxTokensPerTask);
  const toolEfficiencyScore = normalizeLowerIsBetter(metric.toolCallsPerTask, minToolCallsPerTask, maxToolCallsPerTask);
  const idleScore = normalizeLowerIsBetter(metric.idleRatio, minIdleRatio, maxIdleRatio);

  return (throughputScore + tokenEfficiencyScore + toolEfficiencyScore + idleScore) / 4;
}

function computeCostEfficiencyScore(metric: BotMetrics, allMetrics: BotMetrics[]): number {
  if (metric.tasksCompleted === 0) return 0;

  const costValues = allMetrics
    .filter((m) => m.tasksCompleted > 0)
    .map((m) => m.costPerTaskCents);

  if (costValues.length === 0) return 0;

  const minCost = Math.min(...costValues);
  const maxCost = Math.max(...costValues);

  return normalizeLowerIsBetter(metric.costPerTaskCents, minCost, maxCost);
}

const TIER_HIGH_THRESHOLD = 75;
const TIER_MEDIUM_THRESHOLD = 40;

function assignTier(compositeScore: number): 'high' | 'medium' | 'low' {
  if (compositeScore >= TIER_HIGH_THRESHOLD) return 'high';
  if (compositeScore >= TIER_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

describe('score-engine helpers', () => {
  describe('normalizeHigherIsBetter', () => {
    it('returns 100 when max equals min', () => {
      expect(normalizeHigherIsBetter(50, 50, 50)).toBe(100);
    });

    it('returns 0 when value equals min', () => {
      expect(normalizeHigherIsBetter(0, 0, 100)).toBe(0);
    });

    it('returns 100 when value equals max', () => {
      expect(normalizeHigherIsBetter(100, 0, 100)).toBe(100);
    });

    it('returns 50 for midpoint value', () => {
      expect(normalizeHigherIsBetter(50, 0, 100)).toBe(50);
    });
  });

  describe('normalizeLowerIsBetter', () => {
    it('returns 100 when max equals min', () => {
      expect(normalizeLowerIsBetter(50, 50, 50)).toBe(100);
    });

    it('returns 0 when value equals max', () => {
      expect(normalizeLowerIsBetter(100, 0, 100)).toBe(0);
    });

    it('returns 100 when value equals min', () => {
      expect(normalizeLowerIsBetter(0, 0, 100)).toBe(100);
    });

    it('returns 50 for midpoint value', () => {
      expect(normalizeLowerIsBetter(50, 0, 100)).toBe(50);
    });
  });

  describe('assignTier', () => {
    it('returns high when composite >= 75', () => {
      expect(assignTier(75)).toBe('high');
      expect(assignTier(90)).toBe('high');
      expect(assignTier(100)).toBe('high');
    });

    it('returns medium when composite >= 40 and < 75', () => {
      expect(assignTier(40)).toBe('medium');
      expect(assignTier(60)).toBe('medium');
      expect(assignTier(74.99)).toBe('medium');
    });

    it('returns low when composite < 40', () => {
      expect(assignTier(0)).toBe('low');
      expect(assignTier(39.99)).toBe('low');
      expect(assignTier(39)).toBe('low');
    });
  });

  describe('computeEfficiencyScore', () => {
    it('returns 100 when all bots have identical metrics', () => {
      const metric = makeMetrics({
        tasksPerMinute: 5,
        tokensPerTask: 100,
        toolCallsPerTask: 2,
        idleRatio: 0.5,
      });
      const allMetrics = [metric, metric, metric];
      const score = computeEfficiencyScore(metric, allMetrics);
      expect(score).toBe(100);
    });

    it('returns middle score for middle performer', () => {
      const bot1 = makeMetrics({ tasksPerMinute: 10, tokensPerTask: 50, toolCallsPerTask: 1, idleRatio: 0.1 });
      const bot2 = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 100, toolCallsPerTask: 2, idleRatio: 0.5 });
      const bot3 = makeMetrics({ tasksPerMinute: 2, tokensPerTask: 200, toolCallsPerTask: 4, idleRatio: 0.9 });
      const allMetrics = [bot1, bot2, bot3];

      const topScore = computeEfficiencyScore(bot1, allMetrics);
      const midScore = computeEfficiencyScore(bot2, allMetrics);
      const lowScore = computeEfficiencyScore(bot3, allMetrics);

      expect(midScore).toBeLessThan(topScore);
      expect(midScore).toBeGreaterThan(lowScore);
    });

    it('rewards high throughput (higher is better)', () => {
      const slow = makeMetrics({ tasksPerMinute: 1, tokensPerTask: 100, toolCallsPerTask: 2, idleRatio: 0.5 });
      const fast = makeMetrics({ tasksPerMinute: 10, tokensPerTask: 100, toolCallsPerTask: 2, idleRatio: 0.5 });
      const allMetrics = [slow, fast];
      expect(computeEfficiencyScore(fast, allMetrics)).toBeGreaterThan(
        computeEfficiencyScore(slow, allMetrics),
      );
    });

    it('penalizes high token usage (lower is better)', () => {
      const efficient = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 50, toolCallsPerTask: 2, idleRatio: 0.5 });
      const wasteful = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 500, toolCallsPerTask: 2, idleRatio: 0.5 });
      const allMetrics = [efficient, wasteful];
      expect(computeEfficiencyScore(efficient, allMetrics)).toBeGreaterThan(
        computeEfficiencyScore(wasteful, allMetrics),
      );
    });

    it('penalizes high tool calls per task (lower is better)', () => {
      const lean = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 100, toolCallsPerTask: 1, idleRatio: 0.5 });
      const chatty = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 100, toolCallsPerTask: 10, idleRatio: 0.5 });
      const allMetrics = [lean, chatty];
      expect(computeEfficiencyScore(lean, allMetrics)).toBeGreaterThan(
        computeEfficiencyScore(chatty, allMetrics),
      );
    });

    it('penalizes high idle ratio (lower is better)', () => {
      const active = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 100, toolCallsPerTask: 2, idleRatio: 0.1 });
      const idle = makeMetrics({ tasksPerMinute: 5, tokensPerTask: 100, toolCallsPerTask: 2, idleRatio: 0.8 });
      const allMetrics = [active, idle];
      expect(computeEfficiencyScore(active, allMetrics)).toBeGreaterThan(
        computeEfficiencyScore(idle, allMetrics),
      );
    });

    it('handles single bot gracefully', () => {
      const metric = makeMetrics();
      const score = computeEfficiencyScore(metric, [metric]);
      expect(score).toBe(100);
    });
  });

  describe('computeCostEfficiencyScore', () => {
    it('returns 0 when bot completed 0 tasks', () => {
      const metric = makeMetrics({ tasksCompleted: 0 });
      const allMetrics = [metric];
      expect(computeCostEfficiencyScore(metric, allMetrics)).toBe(0);
    });

    it('returns 100 when all bots have identical cost per task', () => {
      const bot1 = makeMetrics({ tasksCompleted: 10, costPerTaskCents: 50 });
      const bot2 = makeMetrics({ tasksCompleted: 5, costPerTaskCents: 50 });
      const allMetrics = [bot1, bot2];
      expect(computeCostEfficiencyScore(bot1, allMetrics)).toBe(100);
      expect(computeCostEfficiencyScore(bot2, allMetrics)).toBe(100);
    });

    it('rewards lower cost per task', () => {
      const cheap = makeMetrics({ tasksCompleted: 10, costPerTaskCents: 25 });
      const expensive = makeMetrics({ tasksCompleted: 10, costPerTaskCents: 100 });
      const allMetrics = [cheap, expensive];
      expect(computeCostEfficiencyScore(cheap, allMetrics)).toBeGreaterThan(
        computeCostEfficiencyScore(expensive, allMetrics),
      );
    });

    it('returns 0 when no bot has completed any tasks', () => {
      const bot1 = makeMetrics({ tasksCompleted: 0, costPerTaskCents: 0 });
      const bot2 = makeMetrics({ tasksCompleted: 0, costPerTaskCents: 0 });
      const allMetrics = [bot1, bot2];
      expect(computeCostEfficiencyScore(bot1, allMetrics)).toBe(0);
    });

    it('ignores bots with 0 completed tasks when filtering', () => {
      const cheapActive = makeMetrics({ tasksCompleted: 10, costPerTaskCents: 25 });
      const inactive = makeMetrics({ tasksCompleted: 0, costPerTaskCents: 0 });
      const allMetrics = [cheapActive, inactive];
      expect(computeCostEfficiencyScore(cheapActive, allMetrics)).toBe(100);
    });
  });
});
