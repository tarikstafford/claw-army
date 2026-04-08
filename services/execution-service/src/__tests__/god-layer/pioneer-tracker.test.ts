import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectAndTrackPioneer } from '../../god-layer/pioneer-tracker';

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@claw/db', () => ({
  db: {
    transaction: vi.fn(),
  },
  categoryBenchmarks: {
    taskCategory: 'taskCategory',
  },
}));

const mockTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

describe('detectAndTrackPioneer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    taskCategory: 'code-review',
    botId: '550e8400-e29b-41d4-a716-446655440000',
    soulId: '660e8400-e29b-41d4-a716-446655440001',
    executionId: '770e8400-e29b-41d4-a716-446655440002',
    compositeScore: '0.85',
  };

  describe('pioneer event (first run)', () => {
    it('detects pioneer when no existing benchmark row exists', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      const result = await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(result.isPioneer).toBe(true);
      expect(result.benchmarkMature).toBe(false);
      expect(result.baselineCompositeScore).toBe(baseParams.compositeScore);
    });

    it('inserts new benchmark row on pioneer event', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockTx.values).toHaveBeenCalled();
    });

    it('sets confirmedRunCount to 1 on pioneer insert', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      const valuesCall = mockTx.values.mock.calls[0][0];
      expect(valuesCall.confirmedRunCount).toBe(1);
    });

    it('sets thinDataFlag to true on pioneer insert', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      const valuesCall = mockTx.values.mock.calls[0][0];
      expect(valuesCall.thinDataFlag).toBe(true);
    });

    it('sets benchmarkMature to false on pioneer insert', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      const valuesCall = mockTx.values.mock.calls[0][0];
      expect(valuesCall.benchmarkMature).toBe(false);
    });

    it('sets standardPromotion to false on pioneer insert', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      const valuesCall = mockTx.values.mock.calls[0][0];
      expect(valuesCall.standardPromotion).toBe(false);
    });

    it('handles null soulId without error', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      const paramsWithNullSoul = { ...baseParams, soulId: null };

      const result = await detectAndTrackPioneer(mockTx as never, paramsWithNullSoul);

      expect(result.isPioneer).toBe(true);
    });
  });

  describe('subsequent run (existing benchmark)', () => {
    const existingBenchmark = {
      id: 'existing-id',
      taskCategory: 'code-review',
      pioneerBotId: '550e8400-e29b-41d4-a716-446655440000',
      pioneerSoulId: '660e8400-e29b-41d4-a716-446655440001',
      pioneerExecutionId: '770e8400-e29b-41d4-a716-446655440002',
      baselineCompositeScore: '0.75',
      confirmedRunCount: 1,
      thinDataFlag: true,
      benchmarkMature: false,
      standardPromotion: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([existingBenchmark]);
    });

    it('returns isPioneer false on subsequent runs', async () => {
      const result = await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(result.isPioneer).toBe(false);
    });

    it('updates existing benchmark row', async () => {
      await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.set).toHaveBeenCalled();
    });

    it('increments confirmedRunCount', async () => {
      await detectAndTrackPioneer(mockTx as never, baseParams);

      const setCall = mockTx.set.mock.calls[0][0];
      expect(setCall.confirmedRunCount).toBe(2);
    });

    it('sets benchmarkMature true when run count reaches threshold (3)', async () => {
      const benchmarkAt2Runs = { ...existingBenchmark, confirmedRunCount: 2 };
      mockTx.where.mockResolvedValue([benchmarkAt2Runs]);

      const result = await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(result.benchmarkMature).toBe(true);
    });

    it('returns existing baselineCompositeScore', async () => {
      const result = await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(result.baselineCompositeScore).toBe(existingBenchmark.baselineCompositeScore);
    });

    it('keeps thinDataFlag true when run count < 5', async () => {
      const benchmarkAt4Runs = { ...existingBenchmark, confirmedRunCount: 4 };
      mockTx.where.mockResolvedValue([benchmarkAt4Runs]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      const setCall = mockTx.set.mock.calls[0][0];
      expect(setCall.thinDataFlag).toBe(true);
    });

    it('sets thinDataFlag to false when run count >= 5', async () => {
      const benchmarkAt5Runs = { ...existingBenchmark, confirmedRunCount: 5 };
      mockTx.where.mockResolvedValue([benchmarkAt5Runs]);

      await detectAndTrackPioneer(mockTx as never, baseParams);

      const setCall = mockTx.set.mock.calls[0][0];
      expect(setCall.thinDataFlag).toBe(false);
    });

    it('updates updatedAt timestamp', async () => {
      await detectAndTrackPioneer(mockTx as never, baseParams);

      const setCall = mockTx.set.mock.calls[0][0];
      expect(setCall.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('edge cases', () => {
    it('handles empty array result from select', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([]);

      const result = await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(result.isPioneer).toBe(true);
    });

    it('treats undefined first element as no existing row', async () => {
      mockTx.select.mockReturnValue(mockTx);
      mockTx.from.mockReturnValue(mockTx);
      mockTx.where.mockResolvedValue([undefined] as never);

      const result = await detectAndTrackPioneer(mockTx as never, baseParams);

      expect(result.isPioneer).toBe(true);
    });
  });
});
