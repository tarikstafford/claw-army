import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePioneerPopulation } from '../../services/pioneer-generator';
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
  },
  botSouls: {},
}));

const mockGenerateText = vi.mocked(ai.generateText);
const mockEmbedMany = vi.mocked(ai.embedMany);
const mockCosineSimilarity = vi.mocked(ai.cosineSimilarity);

function createMockArchetype(overrides: Partial<{
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
}> = {}): {
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
} {
  return {
    id: overrides.id ?? 'archetype-1',
    soulContent: overrides.soulContent ?? `## Identity and Role\nBase archetype\n## Decision Priorities\nPriority 1\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMedium\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm humans`,
    generation: overrides.generation ?? 0,
    constitutionDirectives: overrides.constitutionDirectives ?? ['INVIOLABLE: Never harm humans'],
  };
}

describe('generatePioneerPopulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when archetypes query returns empty and no behavioral archetypes available', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    vi.mocked(dbModule.db).select = mockSelect;

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    await expect(
      generatePioneerPopulation('Build a novel thing', 'novel-category', ['python']),
    ).rejects.toThrow();
  });

  it('generates 5 pioneer souls when archetypes exist', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([createMockArchetype()]),
        }),
      }),
    });
    vi.mocked(dbModule.db).select = mockSelect;

    mockGenerateText.mockResolvedValue({ text: `## Identity and Role\nPioneer agent\n## Decision Priorities\nPioneer priority\n## Tool Usage Doctrine\nUse tools\n## Risk Tolerance\nHigh\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm humans`, finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [
        new Float32Array([0.1, 0.2, 0.3]),
        new Float32Array([0.4, 0.5, 0.6]),
        new Float32Array([0.7, 0.8, 0.9]),
        new Float32Array([0.2, 0.3, 0.4]),
        new Float32Array([0.5, 0.6, 0.7]),
      ],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    mockCosineSimilarity.mockReturnValue(0.3);

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation((selector) => {
          if (selector && typeof selector === 'function') {
            return Promise.resolve([{ id: `pioneer-soul-${Date.now()}` }]);
          }
          return Promise.resolve([{ id: 'pioneer-soul-1' }]);
        }),
      }),
    });
    vi.mocked(dbModule.db).insert = mockInsert;

    const results = await generatePioneerPopulation('Analyze data', 'data-analysis', ['python']);

    expect(results).toHaveLength(5);
    expect(results[0]?.source).toBe('generated');
    expect(results[0]?.agentClass).toBe('Novice');
  });

  it('uses archetype-derived path when archetypes exist', async () => {
    const archetypes = [
      createMockArchetype({ id: 'archetype-a' }),
      createMockArchetype({ id: 'archetype-b' }),
    ];

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(archetypes),
        }),
      }),
    });
    vi.mocked(dbModule.db).select = mockSelect;

    mockGenerateText.mockResolvedValue({ text: `## Identity and Role\nVariant\n## Decision Priorities\nVar\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMed\n## Communication Style\nDir\n## Recovery Behavior\nRet\n## Ethical Hard Stops\nINVIOLABLE: Never harm`, finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [
        new Float32Array([0.1, 0.2, 0.3]),
        new Float32Array([0.4, 0.5, 0.6]),
        new Float32Array([0.7, 0.8, 0.9]),
        new Float32Array([0.2, 0.3, 0.4]),
        new Float32Array([0.5, 0.6, 0.7]),
      ],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    mockCosineSimilarity.mockReturnValue(0.3);

    vi.mocked(dbModule.db).insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'soul-new' }]),
      }),
    });

    await generatePioneerPopulation('Build API', 'api-development', ['python']);

    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('assigns correct differentiation scores based on pairwise similarity', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([createMockArchetype()]),
        }),
      }),
    });
    vi.mocked(dbModule.db).select = mockSelect;

    mockGenerateText.mockResolvedValue({ text: `## Identity and Role\nPioneer\n## Decision Priorities\nP\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMed\n## Communication Style\nDir\n## Recovery Behavior\nRet\n## Ethical Hard Stops\nINVIOLABLE: No harm`, finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [
        new Float32Array([0.1, 0.2, 0.3]),
        new Float32Array([0.4, 0.5, 0.6]),
        new Float32Array([0.7, 0.8, 0.9]),
        new Float32Array([0.2, 0.3, 0.4]),
        new Float32Array([0.5, 0.6, 0.7]),
      ],
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.EmbedManyResult);

    mockCosineSimilarity.mockImplementation((a: Float32Array | number[], b: Float32Array | number[]) => {
      const arrA = Array.from(a);
      const arrB = Array.from(b);
      const dot = arrA.reduce((acc, val, i) => acc + val * (arrB[i] ?? 0), 0);
      const normA = Math.sqrt(arrA.reduce((acc, val) => acc + val * val, 0));
      const normB = Math.sqrt(arrB.reduce((acc, val) => acc + val * val, 0));
      return normA && normB ? dot / (normA * normB) : 0;
    });

    vi.mocked(dbModule.db).insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'soul-diff' }]),
      }),
    });

    const results = await generatePioneerPopulation('Novel task', 'novel-task', []);

    for (const soul of results) {
      expect(soul.differentiationScore).toBeGreaterThanOrEqual(0);
      expect(soul.differentiationScore).toBeLessThanOrEqual(1);
    }
  });
});
