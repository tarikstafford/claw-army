import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockAllVerdictsProcessed, mockComputeExecutionFitness, mockEvaluateHaltCriteria, mockEvolutionCampaignQueue } = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), update: vi.fn() },
  mockAllVerdictsProcessed: vi.fn(),
  mockComputeExecutionFitness: vi.fn(),
  mockEvaluateHaltCriteria: vi.fn(),
  mockEvolutionCampaignQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  executions: { id: 'id', evolutionCampaignId: 'evolutionCampaignId' },
  evolutionCampaigns: {
    id: 'id',
    completedIterationCount: 'completedIterationCount',
    bestEfsScore: 'bestEfsScore',
    status: 'status',
    stoppedAt: 'stoppedAt',
    updatedAt: 'updatedAt',
  },
  evolutionCampaignIterations: {
    id: 'id',
    executionId: 'executionId',
    campaignId: 'campaignId',
    iterationNum: 'iterationNum',
    completedAt: 'completedAt',
    efsScore: 'efsScore',
    successRate: 'successRate',
    costEfficiency: 'costEfficiency',
    speed: 'speed',
    councilHealth: 'councilHealth',
    deltaFromPrevious: 'deltaFromPrevious',
    haltedReason: 'haltedReason',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ _type: 'eq', args }),
  and: (...args: unknown[]) => ({ _type: 'and', args }),
  isNull: (col: unknown) => ({ _type: 'isNull', col }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      _type: 'sql',
      text: strings.join('?'),
    }),
    { raw: (s: string) => ({ _type: 'sql_raw', text: s }) },
  ),
}));

vi.mock('../../services/execution-fitness.js', () => ({
  computeExecutionFitness: (...args: unknown[]) => mockComputeExecutionFitness(...args),
  allVerdictsProcessed: (...args: unknown[]) => mockAllVerdictsProcessed(...args),
}));

vi.mock('../../services/campaign-halt-criteria.js', () => ({
  evaluateHaltCriteria: (...args: unknown[]) => mockEvaluateHaltCriteria(...args),
}));

vi.mock('../../queue/evolution-campaign-queue.js', () => ({
  evolutionCampaignQueue: mockEvolutionCampaignQueue,
}));

import { runEvolutionCampaignHook } from '../../services/evolution-campaign-hook.js';

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(data),
    }),
  };
}

function makeUpdateChain(returningData?: unknown[]) {
  const chain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(
        returningData !== undefined
          ? { returning: vi.fn().mockResolvedValue(returningData) }
          : Promise.resolve(),
      ),
    }),
  };
  return chain;
}

describe('evolution-campaign-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exits silently when execution is not found', async () => {
    mockDb.select.mockReturnValue(makeSelectChain([]));

    await runEvolutionCampaignHook('exec-missing');

    expect(mockComputeExecutionFitness).not.toHaveBeenCalled();
  });

  it('exits silently when execution has no campaign', async () => {
    mockDb.select.mockReturnValue(
      makeSelectChain([{ id: 'exec-1', evolutionCampaignId: null }]),
    );

    await runEvolutionCampaignHook('exec-1');

    expect(mockAllVerdictsProcessed).not.toHaveBeenCalled();
  });

  it('exits when not all verdicts are processed', async () => {
    mockDb.select.mockReturnValue(
      makeSelectChain([{ id: 'exec-1', evolutionCampaignId: 'camp-1' }]),
    );
    mockAllVerdictsProcessed.mockResolvedValue(false);

    await runEvolutionCampaignHook('exec-1');

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('exits when iteration claim returns empty (another worker already processed)', async () => {
    mockDb.select.mockReturnValue(
      makeSelectChain([{ id: 'exec-1', evolutionCampaignId: 'camp-1' }]),
    );
    mockAllVerdictsProcessed.mockResolvedValue(true);
    // First update call = claim iteration, returns empty
    mockDb.update.mockReturnValue(makeUpdateChain([]));

    await runEvolutionCampaignHook('exec-1');

    expect(mockComputeExecutionFitness).not.toHaveBeenCalled();
  });

  it('computes EFS, updates iteration and campaign, and enqueues next when halt=false', async () => {
    // select for execution
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return makeSelectChain([{ id: 'exec-1', evolutionCampaignId: 'camp-1' }]);
      }
      // getPreviousIterationEfs — iteration 1 so null
      return makeSelectChain([]);
    });

    mockAllVerdictsProcessed.mockResolvedValue(true);

    // update calls: 1=claim iteration, 2=persist fitness, 3=update campaign
    let updateCall = 0;
    mockDb.update.mockImplementation(() => {
      updateCall++;
      if (updateCall === 1) {
        // claim iteration — returns claimed row
        return makeUpdateChain([{ id: 'iter-1', iterationNum: 1, campaignId: 'camp-1' }]);
      }
      // All other updates resolve without returning
      return makeUpdateChain();
    });

    mockComputeExecutionFitness.mockResolvedValue({
      efs: 0.75,
      successRate: 0.8,
      costEfficiency: 0.7,
      speed: 0.6,
      councilHealth: 0.9,
    });

    mockEvaluateHaltCriteria.mockResolvedValue({ halt: false, reason: null, detail: null });

    await runEvolutionCampaignHook('exec-1');

    expect(mockComputeExecutionFitness).toHaveBeenCalledWith('exec-1');
    expect(mockEvolutionCampaignQueue.add).toHaveBeenCalledWith(
      'next-iteration',
      expect.objectContaining({
        campaignId: 'camp-1',
        previousIterationNum: 1,
        previousExecutionId: 'exec-1',
      }),
      expect.any(Object),
    );
  });

  it('marks campaign stopped and does not enqueue next when halt=true', async () => {
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return makeSelectChain([{ id: 'exec-1', evolutionCampaignId: 'camp-1' }]);
      }
      return makeSelectChain([]);
    });

    mockAllVerdictsProcessed.mockResolvedValue(true);

    let updateCall = 0;
    mockDb.update.mockImplementation(() => {
      updateCall++;
      if (updateCall === 1) {
        return makeUpdateChain([{ id: 'iter-1', iterationNum: 3, campaignId: 'camp-1' }]);
      }
      return makeUpdateChain();
    });

    mockComputeExecutionFitness.mockResolvedValue({
      efs: 0.95,
      successRate: 0.95,
      costEfficiency: 0.95,
      speed: 0.95,
      councilHealth: 0.95,
    });

    mockEvaluateHaltCriteria.mockResolvedValue({
      halt: true,
      reason: 'completed_success',
      detail: 'Target EFS reached',
    });

    await runEvolutionCampaignHook('exec-1');

    expect(mockEvolutionCampaignQueue.add).not.toHaveBeenCalled();
    // Campaign update should have been called to mark stopped
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('does not rethrow on internal errors (non-fatal hook)', async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error('DB connection lost');
    });

    // Should not throw
    await expect(runEvolutionCampaignHook('exec-err')).resolves.toBeUndefined();
  });
});
