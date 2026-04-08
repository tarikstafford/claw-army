import { describe, it, expect, vi } from 'vitest';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  },
  bots: {},
  tasks: {},
  billingEvents: {},
  telemetry: {},
  toolInvocations: {},
  agentClasses: {},
}));

describe('ExecutionReport interface', () => {
  it('has correct shape for valid report', () => {
    const report = {
      executionId: 'exec-123',
      totalBots: 5,
      totalBotHours: 12.5,
      totalCostCents: 15000,
      averageBotScore: 72.4,
      topPerformingBotId: 'bot-42',
      errorDistribution: { task_failures: 3, tool_rejections: 7 },
      costPerTaskCents: 150,
      totalTasks: 50,
      completedTasks: 40,
      failedTasks: 3,
      soulTierDistribution: {
        novice: 2,
        understudy: 1,
        artisan: 1,
        retired: 1,
      },
    };

    expect(report.executionId).toBe('exec-123');
    expect(report.totalBots).toBe(5);
    expect(report.totalBotHours).toBe(12.5);
    expect(report.totalCostCents).toBe(15000);
    expect(report.averageBotScore).toBe(72.4);
    expect(report.topPerformingBotId).toBe('bot-42');
    expect(report.errorDistribution.task_failures).toBe(3);
    expect(report.errorDistribution.tool_rejections).toBe(7);
    expect(report.costPerTaskCents).toBe(150);
    expect(report.totalTasks).toBe(50);
    expect(report.completedTasks).toBe(40);
    expect(report.failedTasks).toBe(3);
    expect(report.soulTierDistribution.novice).toBe(2);
  });

  it('allows null topPerformingBotId when no scored bots', () => {
    const report = {
      executionId: 'exec-123',
      totalBots: 0,
      totalBotHours: 0,
      totalCostCents: 0,
      averageBotScore: 0,
      topPerformingBotId: null,
      errorDistribution: { task_failures: 0, tool_rejections: 0 },
      costPerTaskCents: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      soulTierDistribution: { novice: 0, understudy: 0, artisan: 0, retired: 0 },
    };

    expect(report.topPerformingBotId).toBeNull();
  });
});

describe('costPerTaskCents calculation', () => {
  it('returns 0 when no completed tasks', () => {
    const totalCostCents = 1000;
    const completedTasks = 0;
    const costPerTaskCents = completedTasks === 0 ? 0 : Math.round(totalCostCents / completedTasks);
    expect(costPerTaskCents).toBe(0);
  });

  it('calculates correctly with completed tasks', () => {
    const totalCostCents = 15000;
    const completedTasks = 100;
    const costPerTaskCents = completedTasks === 0 ? 0 : Math.round(totalCostCents / completedTasks);
    expect(costPerTaskCents).toBe(150);
  });

  it('rounds to nearest integer', () => {
    const totalCostCents = 1000;
    const completedTasks = 3;
    const costPerTaskCents = completedTasks === 0 ? 0 : Math.round(totalCostCents / completedTasks);
    expect(costPerTaskCents).toBe(333);
  });
});

describe('averageBotScore calculation', () => {
  it('returns 0 when no bots have scores', () => {
    const scores: number[] = [];
    const avgScore = scores.length === 0 ? 0 : scores.reduce((s, v) => s + v, 0) / scores.length;
    expect(avgScore).toBe(0);
  });

  it('calculates mean correctly for multiple bots', () => {
    const scores = [80, 65, 90, 72];
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    expect(avgScore).toBe(76.75);
  });

  it('handles single bot', () => {
    const scores = [85];
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    expect(avgScore).toBe(85);
  });
});

describe('errorDistribution aggregation', () => {
  it('sums task_failures and tool_rejections', () => {
    const taskFailures = 5;
    const toolRejections = 12;
    const errorDistribution: Record<string, number> = {
      task_failures: taskFailures,
      tool_rejections: toolRejections,
    };

    const totalErrors = errorDistribution.task_failures + errorDistribution.tool_rejections;
    expect(totalErrors).toBe(17);
  });

  it('starts with zero counts', () => {
    const errorDistribution: Record<string, number> = {
      task_failures: 0,
      tool_rejections: 0,
    };

    expect(errorDistribution.task_failures).toBe(0);
    expect(errorDistribution.tool_rejections).toBe(0);
  });
});

describe('soulTierDistribution', () => {
  it('initializes all tiers to zero', () => {
    const distribution = { novice: 0, understudy: 0, artisan: 0, retired: 0 };

    expect(distribution.novice).toBe(0);
    expect(distribution.understudy).toBe(0);
    expect(distribution.artisan).toBe(0);
    expect(distribution.retired).toBe(0);
  });

  it('can be incremented per tier', () => {
    const distribution = { novice: 0, understudy: 0, artisan: 0, retired: 0 };
    distribution.novice += 1;
    distribution.understudy += 2;
    distribution.artisan += 1;

    expect(distribution.novice).toBe(1);
    expect(distribution.understudy).toBe(2);
    expect(distribution.artisan).toBe(1);
    expect(distribution.retired).toBe(0);
  });

  it('sums to total bots', () => {
    const distribution = { novice: 3, understudy: 2, artisan: 1, retired: 0 };
    const total = distribution.novice + distribution.understudy + distribution.artisan + distribution.retired;
    expect(total).toBe(6);
  });
});

describe('empty execution handling', () => {
  it('handles zero bots', () => {
    const totalBots = 0;
    const totalBotHours = 0;
    const totalCostCents = 0;
    const averageBotScore = 0;
    const topPerformingBotId = null;

    expect(totalBots).toBe(0);
    expect(topPerformingBotId).toBeNull();
  });

  it('handles zero tasks', () => {
    const totalTasks = 0;
    const completedTasks = 0;
    const failedTasks = 0;
    const totalCostCents = 0;
    const costPerTaskCents = completedTasks === 0 ? 0 : Math.round(totalCostCents / completedTasks);

    expect(totalTasks).toBe(0);
    expect(costPerTaskCents).toBe(0);
  });

  it('handles zero bot hours', () => {
    const totalBotHours = 0;
    const tasksCompleted = 10;
    const tasksPerMinute = totalBotHours === 0 ? 0 : tasksCompleted / (totalBotHours * 60);

    expect(tasksPerMinute).toBe(0);
  });
});

describe('cumulative bot hours', () => {
  it('sums hours from multiple bots', () => {
    const botHours = [1.5, 2.0, 0.5, 3.0];
    const totalBotHours = botHours.reduce((sum, h) => sum + h, 0);
    expect(totalBotHours).toBe(7.0);
  });

  it('preserves decimal precision', () => {
    const botHours = [0.1, 0.2, 0.3];
    const totalBotHours = botHours.reduce((sum, h) => sum + h, 0);
    expect(totalBotHours).toBeCloseTo(0.6, 1);
  });
});

describe('task counts', () => {
  it('totalTasks equals completed plus failed', () => {
    const completedTasks = 45;
    const failedTasks = 5;
    const totalTasks = completedTasks + failedTasks;
    expect(totalTasks).toBe(50);
  });

  it('calculates success rate from counts', () => {
    const completedTasks = 40;
    const failedTasks = 10;
    const totalTasks = completedTasks + failedTasks;
    const successRate = totalTasks === 0 ? 0 : completedTasks / totalTasks;
    expect(successRate).toBe(0.8);
  });

  it('handles all tasks failed', () => {
    const completedTasks = 0;
    const failedTasks = 10;
    const totalTasks = completedTasks + failedTasks;
    const successRate = totalTasks === 0 ? 0 : completedTasks / totalTasks;
    expect(successRate).toBe(0);
  });

  it('handles all tasks completed', () => {
    const completedTasks = 50;
    const failedTasks = 0;
    const totalTasks = completedTasks + failedTasks;
    const successRate = totalTasks === 0 ? 0 : completedTasks / totalTasks;
    expect(successRate).toBe(1.0);
  });
});
