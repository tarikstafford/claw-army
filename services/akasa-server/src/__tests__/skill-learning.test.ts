import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockGenerateText } = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), insert: vi.fn() },
  mockGenerateText: vi.fn(),
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  decisionTraces: {
    executionId: 'executionId',
    botId: 'botId',
    decisionId: 'decisionId',
    decisionType: 'decisionType',
    directiveReferenced: 'directiveReferenced',
    attributionConfidence: 'attributionConfidence',
    outcome: 'outcome',
    metadata: 'metadata',
  },
  learnedSkills: {
    soulId: 'soulId',
    skillContent: 'skillContent',
  },
  botSouls: {
    id: 'id',
    taskCategory: 'taskCategory',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ _type: 'eq', args }),
  and: (...args: unknown[]) => ({ _type: 'and', args }),
}));

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: {
    object: (opts: unknown) => ({ _type: 'output_object', opts }),
  },
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mock-model'),
}));

vi.mock('zod', () => {
  const mockSchema: any = {};
  mockSchema.min = vi.fn().mockReturnValue(mockSchema);
  mockSchema.max = vi.fn().mockReturnValue(mockSchema);
  mockSchema.array = vi.fn().mockReturnValue(mockSchema);

  return {
    z: {
      object: vi.fn().mockReturnValue(mockSchema),
      string: vi.fn().mockReturnValue(mockSchema),
      number: vi.fn().mockReturnValue(mockSchema),
      array: vi.fn().mockReturnValue(mockSchema),
      infer: vi.fn(),
    },
  };
});

import { processSkillLearningForExecution } from '../services/skill-learning.js';

function makeSelectChain(data: unknown[]) {
  const whereResult = Object.assign(Promise.resolve(data), {
    limit: vi.fn().mockResolvedValue(data),
  });
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

describe('skill-learning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero skills when no decision traces exist', async () => {
    mockDb.select.mockReturnValue(makeSelectChain([]));

    const result = await processSkillLearningForExecution('exec-1', 'bot-1', null);

    expect(result.skillsCreated).toBe(0);
    expect(result.skillIds).toEqual([]);
  });

  it('returns zero skills when no successful traces exist', async () => {
    const traces = [
      {
        decisionId: 'd1',
        decisionType: 'tool_call',
        directiveReferenced: null,
        attributionConfidence: '0.3', // below 0.5 threshold
        outcome: 'success',
        metadata: {},
      },
      {
        decisionId: 'd2',
        decisionType: 'tool_call',
        directiveReferenced: null,
        attributionConfidence: '0.9',
        outcome: 'failure', // not success
        metadata: {},
      },
    ];

    mockDb.select.mockReturnValue(makeSelectChain(traces));

    const result = await processSkillLearningForExecution('exec-1', 'bot-1', null);

    expect(result.skillsCreated).toBe(0);
  });

  it('returns zero skills when LLM detects no novel patterns', async () => {
    const traces = [
      {
        decisionId: 'd1',
        decisionType: 'tool_call',
        directiveReferenced: 'Be safe',
        attributionConfidence: '0.9',
        outcome: 'success',
        metadata: {},
      },
    ];

    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain(traces);
      if (selectCall === 2) return makeSelectChain([{ taskCategory: 'research' }]); // botSouls lookup
      return makeSelectChain([]); // existing skills
    });

    mockGenerateText.mockResolvedValue({ output: [] });

    const result = await processSkillLearningForExecution('exec-1', 'bot-1', 'soul-1');

    expect(result.skillsCreated).toBe(0);
  });

  it('creates skills when LLM identifies novel patterns above confidence threshold', async () => {
    const traces = [
      {
        decisionId: 'd1',
        decisionType: 'reasoning',
        directiveReferenced: null,
        attributionConfidence: '0.9',
        outcome: 'success',
        metadata: {},
      },
    ];

    let selectCall = 0;
    mockDb.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain(traces);
      if (selectCall === 2) return makeSelectChain([{ taskCategory: 'coding' }]);
      if (selectCall === 3) return makeSelectChain([]); // existing skills
      // computeAverageConfidence lookup
      return makeSelectChain([{ attributionConfidence: '0.9' }]);
    });

    mockGenerateText.mockResolvedValue({
      output: [
        {
          name: 'error-recovery-pattern',
          category: 'recovery',
          triggerPatterns: ['When encountering a 500 error'],
          proceduralBody: '1. Retry\n2. Log\n3. Fallback',
          requiredTools: [],
          confidenceScore: 0.85,
          reasoning: 'Consistent error recovery pattern across traces',
        },
      ],
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'skill-new-1',
            name: 'error-recovery-pattern',
            confidenceScore: '0.875',
            approvalStatus: 'auto_approved',
            sourceTraceIds: ['d1'],
          },
        ]),
      }),
    });

    const result = await processSkillLearningForExecution('exec-1', 'bot-1', 'soul-1');

    expect(result.skillsCreated).toBe(1);
    expect(result.skillIds).toEqual(['skill-new-1']);
  });
});
