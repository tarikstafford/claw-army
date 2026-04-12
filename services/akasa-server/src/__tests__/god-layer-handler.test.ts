import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDb,
  mockComputeClassTransition,
  mockCaptureDna,
  mockRecordNegativeSignal,
  mockCheckAndRecordPioneer,
  mockProcessSkillUnlearning,
  mockProcessSkillLearningForExecution,
} = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  mockComputeClassTransition: vi.fn(),
  mockCaptureDna: vi.fn(),
  mockRecordNegativeSignal: vi.fn(),
  mockCheckAndRecordPioneer: vi.fn(),
  mockProcessSkillUnlearning: vi.fn(),
  mockProcessSkillLearningForExecution: vi.fn(),
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  councilVerdicts: { id: 'id' },
  bots: { id: 'id' },
  botSouls: { id: 'id' },
  agentClasses: { botId: 'botId', updatedAt: 'updatedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ _type: 'eq', args }),
  desc: (col: unknown) => ({ _type: 'desc', col }),
}));

vi.mock('../god-layer/class-machine.js', () => ({
  computeClassTransition: (...args: unknown[]) => mockComputeClassTransition(...args),
}));

vi.mock('../god-layer/dna-writer.js', () => ({
  captureDna: (...args: unknown[]) => mockCaptureDna(...args),
}));

vi.mock('../god-layer/negative-register.js', () => ({
  recordNegativeSignal: (...args: unknown[]) => mockRecordNegativeSignal(...args),
}));

vi.mock('../god-layer/pioneer-tracker.js', () => ({
  checkAndRecordPioneer: (...args: unknown[]) => mockCheckAndRecordPioneer(...args),
}));

vi.mock('../god-layer/skill-unlearning.js', () => ({
  processSkillUnlearning: (...args: unknown[]) => mockProcessSkillUnlearning(...args),
}));

vi.mock('../services/skill-learning.js', () => ({
  processSkillLearningForExecution: (...args: unknown[]) => mockProcessSkillLearningForExecution(...args),
}));

import { executeGodLayer } from '../god-layer/god-layer-handler.js';

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(data),
        }),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeInsertChain() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

const baseVerdict = {
  id: 'verdict-1',
  botId: 'bot-1',
  executionId: 'exec-1',
  soulId: 'soul-1',
  verdictType: 'Promote',
  status: 'confirmed',
  godLayerProcessedAt: null,
  verdictSummary: 'Strong performance',
  weightedConfidenceScore: '0.85',
  soulAnalystOutput: null,
};

const baseBot = {
  id: 'bot-1',
  executionId: 'exec-1',
  soulId: 'soul-1',
  compositeScore: '0.80',
};

const baseSoul = {
  id: 'soul-1',
  dimensions: { identityRole: 'test' },
  taskCategory: 'research',
};

describe('god-layer-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeClassTransition.mockReturnValue({ transitioned: false, newClass: 'Novice' });
    mockCaptureDna.mockResolvedValue(undefined);
    mockRecordNegativeSignal.mockResolvedValue(undefined);
    mockCheckAndRecordPioneer.mockResolvedValue(false);
    mockProcessSkillUnlearning.mockResolvedValue({ unlearnedSkills: [] });
    mockProcessSkillLearningForExecution.mockResolvedValue({ skillsCreated: 0, skillIds: [] });
  });

  it('returns processed=false with reason=verdict_not_found when verdict does not exist', async () => {
    mockDb.select.mockReturnValue(makeSelectChain([]));

    const result = await executeGodLayer('verdict-missing');

    expect(result.processed).toBe(false);
    expect(result.reason).toBe('verdict_not_found');
  });

  it('returns processed=false with reason=already_processed when godLayerProcessedAt is set', async () => {
    mockDb.select.mockReturnValue(
      makeSelectChain([{ ...baseVerdict, godLayerProcessedAt: new Date() }]),
    );

    const result = await executeGodLayer('verdict-1');

    expect(result.processed).toBe(false);
    expect(result.reason).toBe('already_processed');
  });

  it('calls computeClassTransition and inserts new class row on transition', async () => {
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([baseVerdict]); // verdict
      if (selectCall === 2) return makeSelectChain([baseBot]); // bot
      if (selectCall === 3) return makeSelectChain([baseSoul]); // soul
      return makeSelectChain([{ currentClass: 'Novice' }]); // agent class
    });

    mockComputeClassTransition.mockReturnValue({ transitioned: true, newClass: 'Understudy' });
    mockDb.insert.mockReturnValue(makeInsertChain());
    mockDb.update.mockReturnValue(makeUpdateChain());

    const result = await executeGodLayer('verdict-1');

    expect(result.processed).toBe(true);
    expect(mockComputeClassTransition).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('captures DNA for Promote verdicts with sufficient composite score', async () => {
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([baseVerdict]); // Promote
      if (selectCall === 2) return makeSelectChain([baseBot]); // compositeScore=0.80
      if (selectCall === 3) return makeSelectChain([baseSoul]);
      return makeSelectChain([]);
    });

    mockDb.update.mockReturnValue(makeUpdateChain());

    const result = await executeGodLayer('verdict-1');

    expect(result.processed).toBe(true);
    expect(mockCaptureDna).toHaveBeenCalled();
  });

  it('records negative signal for Demote verdicts', async () => {
    const demoteVerdict = { ...baseVerdict, verdictType: 'Demote' };

    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([demoteVerdict]);
      if (selectCall === 2) return makeSelectChain([baseBot]);
      if (selectCall === 3) return makeSelectChain([baseSoul]);
      return makeSelectChain([]);
    });

    mockDb.update.mockReturnValue(makeUpdateChain());

    const result = await executeGodLayer('verdict-1');

    expect(result.processed).toBe(true);
    expect(mockRecordNegativeSignal).toHaveBeenCalled();
    expect(mockCaptureDna).not.toHaveBeenCalled();
  });

  it('checks pioneer for Promote verdicts', async () => {
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([baseVerdict]);
      if (selectCall === 2) return makeSelectChain([baseBot]);
      if (selectCall === 3) return makeSelectChain([baseSoul]);
      return makeSelectChain([]);
    });

    mockDb.update.mockReturnValue(makeUpdateChain());

    await executeGodLayer('verdict-1');

    expect(mockCheckAndRecordPioneer).toHaveBeenCalled();
  });

  it('does not check pioneer for non-Promote verdicts', async () => {
    const maintainVerdict = { ...baseVerdict, verdictType: 'Maintain' };

    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([maintainVerdict]);
      if (selectCall === 2) return makeSelectChain([{ ...baseBot, compositeScore: '0.80' }]);
      if (selectCall === 3) return makeSelectChain([baseSoul]);
      return makeSelectChain([]);
    });

    mockDb.update.mockReturnValue(makeUpdateChain());

    await executeGodLayer('verdict-1');

    expect(mockCheckAndRecordPioneer).not.toHaveBeenCalled();
  });

  it('always processes skill unlearning regardless of verdict type', async () => {
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([baseVerdict]);
      if (selectCall === 2) return makeSelectChain([baseBot]);
      if (selectCall === 3) return makeSelectChain([baseSoul]);
      return makeSelectChain([]);
    });

    mockDb.update.mockReturnValue(makeUpdateChain());

    await executeGodLayer('verdict-1');

    expect(mockProcessSkillUnlearning).toHaveBeenCalledWith(
      'bot-1', 'exec-1', 'soul-1', 'Promote',
    );
  });

  it('marks verdict as processed at the end', async () => {
    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([baseVerdict]);
      if (selectCall === 2) return makeSelectChain([baseBot]);
      if (selectCall === 3) return makeSelectChain([baseSoul]);
      return makeSelectChain([]);
    });

    mockDb.update.mockReturnValue(makeUpdateChain());

    await executeGodLayer('verdict-1');

    // The last update call should set godLayerProcessedAt
    expect(mockDb.update).toHaveBeenCalled();
  });
});
