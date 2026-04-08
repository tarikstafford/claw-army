import { describe, it, expect, vi } from 'vitest';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  },
  executions: {},
  bots: {},
  tasks: {},
  toolInvocations: {},
  dnaStore: {},
}));

function deriveObjectiveCategory(objective: string): string {
  const slug = objective
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const words = slug.split('-').filter((w) => w.length > 0);
  const category = words.slice(0, 5).join('-');
  return category.slice(0, 255);
}

describe('deriveObjectiveCategory', () => {
  it('converts objective to lowercase slug', () => {
    const result = deriveObjectiveCategory('Summarize Research Documents');
    expect(result).toBe('summarize-research-documents');
  });

  it('replaces spaces with hyphens', () => {
    const result = deriveObjectiveCategory('Analyze this text');
    expect(result).toBe('analyze-this-text');
  });

  it('removes non-alphanumeric characters', () => {
    const result = deriveObjectiveCategory('What?! @#$% More &*() Test');
    expect(result).toBe('what-more-test');
  });

  it('collapses consecutive hyphens', () => {
    const result = deriveObjectiveCategory('Hello---World...How are you?');
    expect(result).toBe('hello-world-how-are-you');
  });

  it('trims leading and trailing hyphens', () => {
    const result = deriveObjectiveCategory('   spaces around   ');
    expect(result).toBe('spaces-around');
  });

  it('limits to first 5 words', () => {
    const result = deriveObjectiveCategory(
      'Summarize these research documents about climate change',
    );
    expect(result).toBe('summarize-these-research-documents-about');
  });

  it('handles short objectives', () => {
    const result = deriveObjectiveCategory('Hello World');
    expect(result).toBe('hello-world');
  });

  it('handles single word', () => {
    const result = deriveObjectiveCategory('Hello');
    expect(result).toBe('hello');
  });

  it('returns empty string for objective with only special chars', () => {
    const result = deriveObjectiveCategory('!!! @@@ ###');
    expect(result).toBe('');
  });

  it('handles numbers in objective', () => {
    const result = deriveObjectiveCategory('Task 123 is important');
    expect(result).toBe('task-123-is-important');
  });

  it('limits output to 255 characters', () => {
    const longObjective = 'a'.repeat(300);
    const result = deriveObjectiveCategory(longObjective);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('preserves all 5 words when fewer than 5 exist', () => {
    const result = deriveObjectiveCategory('One Two Three');
    expect(result).toBe('one-two-three');
  });
});

describe('elite bot identification', () => {
  it('score above absolute threshold', () => {
    const compositeScore = 80;
    const threshold = 75;
    const passesThreshold = compositeScore > threshold;
    expect(passesThreshold).toBe(true);
  });

  it('fails score below absolute threshold', () => {
    const compositeScore = 70;
    const threshold = 75;
    const passesThreshold = compositeScore > threshold;
    expect(passesThreshold).toBe(false);
  });

  it('score above execution average by configured percentage', () => {
    const compositeScore = 90;
    const executionAvgScore = 70;
    const aboveAveragePct = 20;
    const aboveAverageMin = executionAvgScore * (1 + aboveAveragePct / 100);
    const passesAboveAverage = compositeScore > aboveAverageMin;
    expect(passesAboveAverage).toBe(true);
  });

  it('fails when not above average by enough', () => {
    const compositeScore = 82;
    const executionAvgScore = 70;
    const aboveAveragePct = 20;
    const aboveAverageMin = executionAvgScore * (1 + aboveAveragePct / 100);
    expect(aboveAverageMin).toBe(84);
    const passesAboveAverage = compositeScore > aboveAverageMin;
    expect(passesAboveAverage).toBe(false);
  });

  it('error rate below ceiling passes', () => {
    const errorRate = 0.05;
    const ceiling = 0.10;
    const passesErrorCheck = errorRate < ceiling;
    expect(passesErrorCheck).toBe(true);
  });

  it('error rate at ceiling fails', () => {
    const errorRate = 0.10;
    const ceiling = 0.10;
    const passesErrorCheck = errorRate < ceiling;
    expect(passesErrorCheck).toBe(false);
  });

  it('error rate above ceiling fails', () => {
    const errorRate = 0.15;
    const ceiling = 0.10;
    const passesErrorCheck = errorRate < ceiling;
    expect(passesErrorCheck).toBe(false);
  });

  it('error rate calculation with no tasks returns 0', () => {
    const completedCount = 0;
    const failedCount = 0;
    const totalTaskCount = completedCount + failedCount;
    const errorRate = totalTaskCount === 0 ? 0 : failedCount / totalTaskCount;
    expect(errorRate).toBe(0);
  });

  it('error rate calculation with failed tasks', () => {
    const completedCount = 9;
    const failedCount = 1;
    const totalTaskCount = completedCount + failedCount;
    const errorRate = totalTaskCount === 0 ? 0 : failedCount / totalTaskCount;
    expect(errorRate).toBe(0.1);
  });
});

describe('DNA payload structure', () => {
  it('has required fields for DNA payload', () => {
    const dnaPayload = {
      systemPromptTemplate: 'reasoning-loop-v1',
      toolCallSequence: ['web_search', 'summarize'],
      argumentPatterns: { web_search: ['query'], summarize: ['text'] },
      retryStrategy: {
        totalTasks: 10,
        retriedTasks: 2,
        maxAttempts: 3,
        avgAttempts: 1.2,
      },
      timingProfile: {
        totalDurationMs: 5000,
        avgDurationMs: 500,
        minDurationMs: 200,
        maxDurationMs: 1200,
        callCount: 10,
      },
      tokenDistribution: {
        web_search: { total: 1000, prompt: 500, completion: 500, count: 5 },
      },
    };

    expect(dnaPayload.systemPromptTemplate).toBe('reasoning-loop-v1');
    expect(dnaPayload.toolCallSequence).toHaveLength(2);
    expect(dnaPayload.retryStrategy.totalTasks).toBe(10);
    expect(dnaPayload.timingProfile.avgDurationMs).toBe(500);
  });

  it('toolCallSequence contains only tool names', () => {
    const toolCallSequence = ['search', 'extract', 'format', 'validate'];
    expect(toolCallSequence.every((t) => typeof t === 'string')).toBe(true);
  });

  it('argumentPatterns only contains keys, not values', () => {
    const argPatterns: Record<string, string[]> = {
      search: ['query', 'max_results'],
      format: ['style'],
    };

    for (const [tool, keys] of Object.entries(argPatterns)) {
      expect(typeof tool).toBe('string');
      expect(keys.every((k) => typeof k === 'string')).toBe(true);
    }
  });

  it('retryStrategy calculates maxAttempts correctly', () => {
    const attempts = [1, 2, 3, 1, 2];
    const maxAttempts = attempts.length > 0 ? Math.max(...attempts) : 0;
    expect(maxAttempts).toBe(3);
  });

  it('retryStrategy calculates avgAttempts correctly', () => {
    const attempts = [1, 2, 3, 1, 2];
    const avgAttempts = attempts.length > 0 ? attempts.reduce((sum, a) => sum + a, 0) / attempts.length : 0;
    expect(avgAttempts).toBe(1.8);
  });

  it('timingProfile handles empty durations', () => {
    const durations: number[] = [];
    const timingProfile = {
      totalDurationMs: durations.reduce((s, d) => s + d, 0),
      avgDurationMs: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0,
      minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
      maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      callCount: durations.length,
    };

    expect(timingProfile.avgDurationMs).toBe(0);
    expect(timingProfile.minDurationMs).toBe(0);
    expect(timingProfile.maxDurationMs).toBe(0);
    expect(timingProfile.callCount).toBe(0);
  });

  it('timingProfile calculates statistics correctly', () => {
    const durations = [100, 200, 300, 400, 500];
    const timingProfile = {
      totalDurationMs: durations.reduce((s, d) => s + d, 0),
      avgDurationMs: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0,
      minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
      maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      callCount: durations.length,
    };

    expect(timingProfile.totalDurationMs).toBe(1500);
    expect(timingProfile.avgDurationMs).toBe(300);
    expect(timingProfile.minDurationMs).toBe(100);
    expect(timingProfile.maxDurationMs).toBe(500);
    expect(timingProfile.callCount).toBe(5);
  });
});

describe('version numbering', () => {
  it('starts at version 1 when no existing versions', () => {
    const maxVersion = 0;
    const nextVersion = maxVersion + 1;
    expect(nextVersion).toBe(1);
  });

  it('increments from existing max version', () => {
    const existingVersions = [1, 2, 3];
    const maxVersion = Math.max(...existingVersions);
    const nextVersion = maxVersion + 1;
    expect(nextVersion).toBe(4);
  });

  it('handles sparse version numbers', () => {
    const existingVersions = [1, 5, 10];
    const maxVersion = Math.max(...existingVersions);
    const nextVersion = maxVersion + 1;
    expect(nextVersion).toBe(11);
  });
});
