import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  skillActivations: {
    id: 'id',
    botId: 'botId',
    skillId: 'skillId',
    classification: 'classification',
    consecutiveNegativeCount: 'consecutiveNegativeCount',
  },
  skillLoadouts: {
    botId: 'botId',
    skillId: 'skillId',
    isActive: 'isActive',
    removedAt: 'removedAt',
  },
  negativeSignalRegister: {},
  agentSkills: {
    id: 'id',
    skillName: 'skillName',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ _type: 'eq', args }),
  and: (...args: unknown[]) => ({ _type: 'and', args }),
}));

vi.mock('@claw/event-schemas/skill-events', () => ({
  skillUnlearnedEventSchema: {
    parse: vi.fn(),
  },
}));

import { processSkillUnlearning } from '../god-layer/skill-unlearning.js';

describe('skill-unlearning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty unlearnedSkills when no activations exist', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await processSkillUnlearning('bot-1', 'exec-1', null, 'Maintain');

    expect(result.unlearnedSkills).toEqual([]);
  });

  it('resets consecutiveNegativeCount when classification is positive', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              activation: {
                id: 'act-1',
                skillId: 'skill-1',
                classification: 'positive',
                consecutiveNegativeCount: 1,
              },
              skillName: 'test-skill',
            },
          ]),
        }),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await processSkillUnlearning('bot-1', 'exec-1', null, 'Maintain');

    expect(result.unlearnedSkills).toEqual([]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('increments consecutiveNegativeCount but does not unlearn when below threshold', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              activation: {
                id: 'act-1',
                skillId: 'skill-1',
                classification: 'negative',
                consecutiveNegativeCount: 0, // will become 1, threshold is 2
              },
              skillName: 'test-skill',
            },
          ]),
        }),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await processSkillUnlearning('bot-1', 'exec-1', null, 'Monitor');

    expect(result.unlearnedSkills).toEqual([]);
  });

  it('unlearns skill when consecutiveNegativeCount reaches threshold', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              activation: {
                id: 'act-1',
                skillId: 'skill-1',
                classification: 'negative',
                consecutiveNegativeCount: 1, // will become 2, equals threshold
              },
              skillName: 'underperforming-skill',
            },
          ]),
        }),
      }),
    });

    // Transaction mock
    mockDb.transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      await cb(tx);
    });

    const result = await processSkillUnlearning('bot-1', 'exec-1', 'soul-1', 'Demote');

    expect(result.unlearnedSkills).toHaveLength(1);
    expect(result.unlearnedSkills[0]!.skillId).toBe('skill-1');
    expect(result.unlearnedSkills[0]!.skillName).toBe('underperforming-skill');
    expect(result.unlearnedSkills[0]!.reason).toContain('consecutive negative');
  });

  it('triggers unlearning when verdict is Demote even with non-negative classification', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              activation: {
                id: 'act-1',
                skillId: 'skill-1',
                classification: 'neutral',
                consecutiveNegativeCount: 1, // Demote triggers increment: 1+1=2 >= threshold
              },
              skillName: 'mediocre-skill',
            },
          ]),
        }),
      }),
    });

    mockDb.transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      await cb(tx);
    });

    const result = await processSkillUnlearning('bot-1', 'exec-1', null, 'Demote');

    expect(result.unlearnedSkills).toHaveLength(1);
  });
});
