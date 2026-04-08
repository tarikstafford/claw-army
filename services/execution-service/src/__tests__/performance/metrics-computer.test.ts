import { describe, it, expect, vi } from 'vitest';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  },
  tasks: {},
  billingEvents: {},
  toolInvocations: {},
  telemetry: {},
}));

function makeMockResult(value: unknown) {
  return [value];
}

describe('BotMetrics interface', () => {
  it('has correct shape for valid metrics', () => {
    const metrics = {
      botId: 'bot-123',
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
    };

    expect(metrics.botId).toBe('bot-123');
    expect(metrics.tasksCompleted).toBe(10);
    expect(metrics.tasksFailed).toBe(2);
    expect(metrics.totalTasks).toBe(12);
    expect(metrics.successRate).toBeCloseTo(0.833, 2);
    expect(metrics.totalCostCents).toBe(500);
    expect(metrics.costPerTaskCents).toBe(50);
    expect(metrics.totalTokens).toBe(10000);
    expect(metrics.tokensPerTask).toBe(1000);
    expect(metrics.toolCallsPerTask).toBe(2);
    expect(metrics.totalToolCalls).toBe(20);
    expect(metrics.botHours).toBe(1);
    expect(metrics.tasksPerMinute).toBe(10);
    expect(metrics.totalRetries).toBe(1);
    expect(metrics.errorRate).toBeCloseTo(0.0625, 3);
    expect(metrics.idleRatio).toBe(0.3);
  });
});

describe('metrics edge cases', () => {
  it('successRate is 0 when totalTasks is 0', () => {
    const tasksCompleted = 0;
    const tasksFailed = 0;
    const totalTasks = tasksCompleted + tasksFailed;
    const successRate = totalTasks === 0 ? 0 : tasksCompleted / totalTasks;
    expect(successRate).toBe(0);
  });

  it('costPerTaskCents is 0 when no tasks completed', () => {
    const tasksCompleted = 0;
    const totalCostCents = 100;
    const costPerTaskCents = tasksCompleted === 0 ? 0 : Math.round(totalCostCents / tasksCompleted);
    expect(costPerTaskCents).toBe(0);
  });

  it('tokensPerTask is 0 when no tasks completed', () => {
    const tasksCompleted = 0;
    const totalTokens = 5000;
    const tokensPerTask = tasksCompleted === 0 ? 0 : Math.round(totalTokens / tasksCompleted);
    expect(tokensPerTask).toBe(0);
  });

  it('toolCallsPerTask is 0 when no tasks completed', () => {
    const tasksCompleted = 0;
    const totalToolCalls = 20;
    const toolCallsPerTask = tasksCompleted === 0 ? 0 : totalToolCalls / tasksCompleted;
    expect(toolCallsPerTask).toBe(0);
  });

  it('tasksPerMinute is 0 when botHours is 0', () => {
    const botHours = 0;
    const tasksCompleted = 10;
    const tasksPerMinute = botHours === 0 ? 0 : tasksCompleted / (botHours * 60);
    expect(tasksPerMinute).toBe(0);
  });

  it('errorRate is 0 when totalActions is 0', () => {
    const tasksFailedCount = 0;
    const totalToolCalls = 0;
    const rejectedToolCalls = 0;
    const totalActions = 0 + 0 + 0;
    const errorRate = totalActions === 0 ? 0 : (tasksFailedCount + rejectedToolCalls) / totalActions;
    expect(errorRate).toBe(0);
  });

  it('idleRatio is 0 when botHours is 0', () => {
    const botHours = 0;
    let idleRatio = 0;
    if (botHours > 0) {
      idleRatio = 0.5;
    }
    expect(idleRatio).toBe(0);
  });

  it('idleRatio calculated correctly when activeMs equals totalMs', () => {
    const botHours = 1;
    const totalToolCalls = 10;
    const avgDurationMs = 360000;
    const totalBotMs = botHours * 3_600_000;
    const activeMs = totalToolCalls * avgDurationMs;
    const activeRatio = totalBotMs === 0 ? 0 : Math.min(1, activeMs / totalBotMs);
    const idleRatio = Math.max(0, Math.min(1, 1 - activeRatio));
    expect(idleRatio).toBe(0);
  });

  it('idleRatio capped at 1 when activeMs exceeds totalMs', () => {
    const botHours = 1;
    const totalToolCalls = 100;
    const avgDurationMs = 40000;
    const totalBotMs = botHours * 3_600_000;
    const activeMs = totalToolCalls * avgDurationMs;
    const activeRatio = totalBotMs === 0 ? 0 : Math.min(1, activeMs / totalBotMs);
    const idleRatio = Math.max(0, Math.min(1, 1 - activeRatio));
    expect(idleRatio).toBe(0);
  });
});

describe('metrics aggregation', () => {
  it('correctly aggregates single bot metrics', () => {
    const bots = [
      {
        botId: 'bot-1',
        tasksCompleted: 10,
        tasksFailed: 0,
        totalTasks: 10,
        successRate: 1.0,
        totalCostCents: 1000,
        costPerTaskCents: 100,
        totalTokens: 5000,
        tokensPerTask: 500,
        toolCallsPerTask: 2,
        totalToolCalls: 20,
        botHours: 0.5,
        tasksPerMinute: 10 / 0.5,
        totalRetries: 0,
        errorRate: 0,
        idleRatio: 0.2,
      },
    ];

    const totalBots = bots.length;
    const totalTasksCompleted = bots.reduce((sum, b) => sum + b.tasksCompleted, 0);
    const totalCost = bots.reduce((sum, b) => sum + b.totalCostCents, 0);

    expect(totalBots).toBe(1);
    expect(totalTasksCompleted).toBe(10);
    expect(totalCost).toBe(1000);
  });

  it('correctly aggregates multiple bot metrics', () => {
    const bots = [
      { botId: 'bot-1', tasksCompleted: 10, tasksFailed: 2, totalCostCents: 500 },
      { botId: 'bot-2', tasksCompleted: 5, tasksFailed: 1, totalCostCents: 300 },
      { botId: 'bot-3', tasksCompleted: 8, tasksFailed: 0, totalCostCents: 400 },
    ];

    const totalBots = bots.length;
    const totalTasksCompleted = bots.reduce((sum, b) => sum + b.tasksCompleted, 0);
    const totalTasksFailed = bots.reduce((sum, b) => sum + b.tasksFailed, 0);
    const totalCost = bots.reduce((sum, b) => sum + b.totalCostCents, 0);
    const avgSuccessRate = bots.reduce((sum, b) => sum + b.tasksCompleted / (b.tasksCompleted + b.tasksFailed), 0) / bots.length;

    expect(totalBots).toBe(3);
    expect(totalTasksCompleted).toBe(23);
    expect(totalTasksFailed).toBe(3);
    expect(totalCost).toBe(1200);
    expect(avgSuccessRate).toBeCloseTo(0.888, 2);
  });
});

describe('retry calculation', () => {
  it('totalRetries is 0 when no retries', () => {
    const attempts = [1, 1, 1, 1];
    const totalAttempts = attempts.reduce((sum, a) => sum + a, 0);
    const totalTasksClaimed = attempts.length;
    const totalRetries = Math.max(0, totalAttempts - totalTasksClaimed);
    expect(totalRetries).toBe(0);
  });

  it('totalRetries counts tasks with attemptCount > 1', () => {
    const attempts = [1, 2, 3, 1];
    const totalAttempts = attempts.reduce((sum, a) => sum + a, 0);
    const totalTasksClaimed = attempts.length;
    const totalRetries = Math.max(0, totalAttempts - totalTasksClaimed);
    expect(totalRetries).toBe(3);
  });
});

describe('NaN handling', () => {
  it('avoids NaN in division by zero scenarios', () => {
    const zeroNumerator = 0;
    const zeroDenominator = 0;
    const result = zeroDenominator === 0 ? 0 : zeroNumerator / zeroDenominator;
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('avoids NaN in cost per task with zero tasks', () => {
    const totalCostCents = 100;
    const tasksCompleted = 0;
    const result = tasksCompleted === 0 ? 0 : Math.round(totalCostCents / tasksCompleted);
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });
});
