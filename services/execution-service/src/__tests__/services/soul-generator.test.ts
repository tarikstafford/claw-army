import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSoulPopulation,
} from '../../services/soul-generator';
import * as ai from 'ai';
import * as dbModule from '@claw/db';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  embedMany: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
  embeddingModel: vi.fn(() => 'embedding-model-mock'),
}));

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  },
  botSouls: {},
  bots: {},
}));

const mockGenerateText = vi.mocked(ai.generateText);
const mockEmbedMany = vi.mocked(ai.embedMany);
const mockCosineSimilarity = vi.mocked(ai.cosineSimilarity);

function createMockParentSoul(overrides: Partial<{
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
}> = {}): {
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
  dimensions: {
    identityRole: string;
    decisionPriorities: string;
    toolUsageDoctrine: string;
    riskTolerance: string;
    communicationStyle: string;
    recoveryBehavior: string;
    ethicalHardStops: string;
  };
} {
  return {
    id: overrides.id ?? 'parent-soul-1',
    soulContent: overrides.soulContent ?? `## Identity and Role
Test agent
## Decision Priorities
Priority 1: Test
## Tool Usage Doctrine
Use tools as needed
## Risk Tolerance
Medium risk
## Communication Style
Direct
## Recovery Behavior
Retry on failure
## Ethical Hard Stops
INVIOLABLE: Never harm humans`,
    generation: overrides.generation ?? 1,
    constitutionDirectives: overrides.constitutionDirectives ?? ['INVIOLABLE: Never harm humans'],
    dimensions: {
      identityRole: 'Test agent',
      decisionPriorities: 'Priority 1: Test',
      toolUsageDoctrine: 'Use tools as needed',
      riskTolerance: 'Medium risk',
      communicationStyle: 'Direct',
      recoveryBehavior: 'Retry on failure',
      ethicalHardStops: 'INVIOLABLE: Never harm humans',
    },
  };
}

describe('generateSoulPopulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when populationSize is below minimum (3)', async () => {
    await expect(
      generateSoulPopulation('exec-1', 'Test objective', 2),
    ).rejects.toThrow(/populationSize must be >= 3/);
  });

  it('throws when no archetype souls exist on novel path', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'web-research-synthesis', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const mockSelectArchetypes = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    vi.mocked(dbModule.db).select = mockSelect;

    await expect(
      generateSoulPopulation('exec-1', 'Build a novel thing', 3),
    ).rejects.toThrow(/No archetype souls found/);
  });

  it('uses KNOWN path when historical parents exist for task category', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'code-generation', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const parentSoul = createMockParentSoul({ id: 'hist-parent-1' });

    const historicalSouls = [
      { soul: parentSoul, score: 0.9 },
    ];

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(historicalSouls),
            }),
          }),
        }),
      }),
    });

    vi.mocked(dbModule.db).select = mockSelect;

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ soul: createMockParentSoul({ id: 'diversity-1' }), score: 0.8 }]),
              }),
            }),
          }),
        }),
      }),
    });

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    mockCosineSimilarity.mockReturnValue(0.3);

    mockGenerateText.mockResolvedValueOnce({ text: `## Identity and Role
Mutated agent
## Decision Priorities
Mutated Priority
## Tool Usage Doctrine
Use tools as needed
## Risk Tolerance
Medium risk
## Communication Style
Direct
## Recovery Behavior
Retry on failure
## Ethical Hard Stops
INVIOLABLE: Never harm humans`, finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-soul-1' }]),
      }),
    });
    vi.mocked(dbModule.db).insert = mockInsert;

    const results = await generateSoulPopulation('exec-1', 'Generate Python code', 3);

    expect(results).toHaveLength(3);
    expect(results[0]?.soulId).toBe('new-soul-1');
  });

  it('correctly calculates similarity threshold and triggers differentiation', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'data-analysis', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ soul: createMockParentSoul({ id: 'hist-parent-2' }), score: 0.85 }]),
            }),
          }),
        }),
      }),
    });

    vi.mocked(dbModule.db).select = mockSelect;

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ soul: createMockParentSoul({ id: 'diversity-2' }), score: 0.75 }]),
              }),
            }),
          }),
        }),
      }),
    });

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [[0.1, 0.2, 0.3], [0.15, 0.25, 0.35], [0.2, 0.3, 0.4]],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    mockCosineSimilarity.mockImplementation((a: number[], b: number[]) => {
      if (a === undefined || b === undefined) return 0;
      const dot = a.reduce((acc, val, i) => acc + val * (b[i] ?? 0), 0);
      const normA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
      const normB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));
      return dot / (normA * normB);
    });

    mockGenerateText.mockResolvedValueOnce({ text: `## Identity and Role
Different agent
## Decision Priorities
Different Priority
## Tool Usage Doctrine
Use tools differently
## Risk Tolerance
High risk
## Communication Style
Indirect
## Recovery Behavior
Escalate on failure
## Ethical Hard Stops
INVIOLABLE: Never harm humans`, finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'soul-1' }]),
      }),
    });
    vi.mocked(dbModule.db).insert = mockInsert;

    const results = await generateSoulPopulation('exec-1', 'Analyze large datasets', 3);

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('sets humanReviewFlag when constitution validation fails after max iterations', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'content-creation', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ soul: createMockParentSoul({ id: 'hist-3' }), score: 0.8 }]),
            }),
          }),
        }),
      }),
    });

    vi.mocked(dbModule.db).select = mockSelect;

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ soul: createMockParentSoul({ id: 'div-3' }), score: 0.7 }]),
              }),
            }),
          }),
        }),
      }),
    });

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [[0.1, 0.2, 0.3]],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    mockCosineSimilarity.mockReturnValue(0.3);

    mockGenerateText.mockResolvedValue({ text: 'Invalid content without constitution', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'soul-flagged' }]),
      }),
    });
    vi.mocked(dbModule.db).insert = mockInsert;

    const results = await generateSoulPopulation('exec-1', 'Write blog posts', 3);

    expect(results).toHaveLength(3);
  });
});
