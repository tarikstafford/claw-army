import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnRingLeader } from '../../services/ring-leader-spawner';
import type { TaskGraph } from '@claw/shared-types';

const mockTaskGraph: TaskGraph = {
  tasks: [
    {
      taskId: 'task-1',
      description: 'Design the system',
      complexity: 'medium',
      requiredTools: [],
      dependencies: [],
      parallelizable: true,
      minPopulation: 3,
      recommendedPopulation: 4,
    },
  ],
  dag: {},
};

vi.mock('@claw/db', () => ({
  db: {
    insert: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
  },
  ringLeaderRuns: { id: 'ring_leader_runs.id' },
  executions: { id: 'executions.id' },
}));

vi.mock('../../services/assemble-population', () => ({
  assemblePopulation: vi.fn().mockResolvedValue(undefined),
  BudgetShortfallError: class BudgetShortfallError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BudgetShortfallError';
    }
  },
}));

describe('spawnRingLeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if ring_leader_runs insert returns nothing', async () => {
    const { db } = await import('@claw/db');
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as typeof db.insert);

    await expect(spawnRingLeader({
      executionId: 'exec-123',
      objective: 'Build a website',
      taskGraph: mockTaskGraph,
      toolGrants: ['fetch_url'],
      budgetCapCents: 5000,
      runtimeLimitSeconds: 3600,
      campaignType: 'ad_hoc',
      projectId: 'proj-456',
    })).rejects.toThrow(
      '[ring-leader-spawner] Failed to insert ring_leader_runs row',
    );
  });
});
