import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeNegativeSignal } from '../../god-layer/negative-register';

vi.mock('@claw/db', () => ({
  db: {
    transaction: vi.fn(),
  },
  negativeSignalRegister: {},
}));

const mockTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
};

describe('writeNegativeSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    soulId: '550e8400-e29b-41d4-a716-446655440000',
    botId: '660e8400-e29b-41d4-a716-446655440001',
    executionId: '770e8400-e29b-41d4-a716-446655440002',
    failureType: 'retirement' as const,
    soulAnalystSummary: 'Agent consistently underperformed on complex refactoring tasks',
    failedDirectives: ['refactor-complex-function', 'improve-naming-conventions'],
    parentSoulId: 'parent-soul-123',
    mutationOpsApplied: ['lineage-swap', 'personality-shift'],
  };

  it('inserts negative signal with retirement failure type', async () => {
    await writeNegativeSignal(mockTx as never, baseParams);

    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockTx.values).toHaveBeenCalled();
  });

  it('inserts negative signal with demotion failure type', async () => {
    const demotionParams = {
      ...baseParams,
      failureType: 'demotion' as const,
    };

    await writeNegativeSignal(mockTx as never, demotionParams);

    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('builds correct mutationBlacklist structure', async () => {
    await writeNegativeSignal(mockTx as never, baseParams);

    const valuesCall = mockTx.values.mock.calls[0][0];
    expect(valuesCall.mutationBlacklist).toEqual({
      failedDirectives: baseParams.failedDirectives,
      avoidMutationOps: baseParams.mutationOpsApplied,
      parentSoulId: baseParams.parentSoulId,
      reason: baseParams.soulAnalystSummary,
    });
  });

  it('includes all required fields in insert values', async () => {
    await writeNegativeSignal(mockTx as never, baseParams);

    const valuesCall = mockTx.values.mock.calls[0][0];
    expect(valuesCall.soulId).toBe(baseParams.soulId);
    expect(valuesCall.botId).toBe(baseParams.botId);
    expect(valuesCall.executionId).toBe(baseParams.executionId);
    expect(valuesCall.failureType).toBe(baseParams.failureType);
    expect(valuesCall.directiveFailureSummary).toBe(baseParams.soulAnalystSummary);
  });

  it('handles null parentSoulId', async () => {
    const nullParentParams = {
      ...baseParams,
      parentSoulId: null,
    };

    await writeNegativeSignal(mockTx as never, nullParentParams);

    const valuesCall = mockTx.values.mock.calls[0][0];
    expect(valuesCall.mutationBlacklist.parentSoulId).toBe(null);
  });

  it('handles empty failedDirectives array', async () => {
    const emptyDirectivesParams = {
      ...baseParams,
      failedDirectives: [],
    };

    await writeNegativeSignal(mockTx as never, emptyDirectivesParams);

    const valuesCall = mockTx.values.mock.calls[0][0];
    expect(valuesCall.mutationBlacklist.failedDirectives).toEqual([]);
  });

  it('handles empty mutationOpsApplied array', async () => {
    const emptyOpsParams = {
      ...baseParams,
      mutationOpsApplied: [],
    };

    await writeNegativeSignal(mockTx as never, emptyOpsParams);

    const valuesCall = mockTx.values.mock.calls[0][0];
    expect(valuesCall.mutationBlacklist.avoidMutationOps).toEqual([]);
  });

  it('returns void', async () => {
    const result = await writeNegativeSignal(mockTx as never, baseParams);
    expect(result).toBeUndefined();
  });
});
