import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeVersionedDnaEntry, GODL_CONFIDENCE_THRESHOLD } from '../../god-layer/dna-writer';

vi.mock('drizzle-orm', () => ({
  max: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock('@claw/db', () => ({
  db: {
    transaction: vi.fn(),
  },
  dnaStore: {
    version: 'version',
    objectiveCategory: 'objectiveCategory',
    soulId: 'soulId',
  },
}));

const mockTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
};

describe('writeVersionedDnaEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    botId: '550e8400-e29b-41d4-a716-446655440000',
    executionId: '660e8400-e29b-41d4-a716-446655440001',
    soulId: '770e8400-e29b-41d4-a716-446655440002',
    taskCategory: 'code-review',
    compositeScore: '0.85',
    agentClass: 'Understudy',
    soulContent: '# Soul\nContent',
    parentSoulIds: ['parent-1', 'parent-2'],
    mutationLineage: ['op1', 'op2'],
    dnaPayload: {
      systemPromptTemplate: 'You are a code reviewer.',
      toolCallSequence: ['analyze', 'comment'],
      argumentPatterns: { pattern: 'test' },
      retryStrategy: { maxRetries: 3 },
      timingProfile: { avgLatency: 100 },
      tokenDistribution: { input: 100, output: 200 },
    },
    weightedConfidenceScore: 0.80,
  };

  it('inserts DNA entry with version 1 when no prior entries exist', async () => {
    const mockMaxResult = [{ maxVersion: null }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const result = await writeVersionedDnaEntry(mockTx as never, baseParams);

    expect(result.version).toBe(1);
    expect(result.isProvisional).toBe(false);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('increments version correctly when prior entries exist', async () => {
    const mockMaxResult = [{ maxVersion: 3 }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const result = await writeVersionedDnaEntry(mockTx as never, baseParams);

    expect(result.version).toBe(4);
  });

  it('marks entry as provisional when confidence is below threshold', async () => {
    const mockMaxResult = [{ maxVersion: 1 }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const lowConfidenceParams = {
      ...baseParams,
      weightedConfidenceScore: 0.30,
    };

    const result = await writeVersionedDnaEntry(mockTx as never, lowConfidenceParams);

    expect(result.isProvisional).toBe(true);
    expect(result.version).toBe(2);
  });

  it('does not mark entry as provisional when confidence is at threshold', async () => {
    const mockMaxResult = [{ maxVersion: 0 }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const atThresholdParams = {
      ...baseParams,
      weightedConfidenceScore: GODL_CONFIDENCE_THRESHOLD,
    };

    const result = await writeVersionedDnaEntry(mockTx as never, atThresholdParams);

    expect(result.isProvisional).toBe(false);
  });

  it('handles null parentSoulIds correctly', async () => {
    const mockMaxResult = [{ maxVersion: null }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const nullParentsParams = {
      ...baseParams,
      parentSoulIds: null,
    };

    const result = await writeVersionedDnaEntry(mockTx as never, nullParentsParams);

    expect(result.version).toBe(1);
  });

  it('handles null mutationLineage correctly', async () => {
    const mockMaxResult = [{ maxVersion: null }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const nullLineageParams = {
      ...baseParams,
      mutationLineage: null,
    };

    const result = await writeVersionedDnaEntry(mockTx as never, nullLineageParams);

    expect(result.version).toBe(1);
  });

  it('inserts with correct values structure', async () => {
    const mockMaxResult = [{ maxVersion: 1 }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    await writeVersionedDnaEntry(mockTx as never, baseParams);

    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockTx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: baseParams.botId,
        executionId: baseParams.executionId,
        objectiveCategory: baseParams.taskCategory,
        soulId: baseParams.soulId,
        compositeScore: baseParams.compositeScore,
      }),
    );
  });

  it('returns correct version and provisional flag', async () => {
    const mockMaxResult = [{ maxVersion: 5 }];
    mockTx.select.mockReturnValue(mockTx);
    mockTx.from.mockReturnValue(mockTx);
    mockTx.where.mockReturnValue(mockTx);
    mockTx.where.mockResolvedValue(mockMaxResult);

    const result = await writeVersionedDnaEntry(mockTx as never, baseParams);

    expect(result).toEqual({
      version: 6,
      isProvisional: false,
    });
  });
});

describe('GODL_CONFIDENCE_THRESHOLD', () => {
  it('is set to 0.50', () => {
    expect(GODL_CONFIDENCE_THRESHOLD).toBe(0.50);
  });
});
