import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSoulLibrary, type SoulSearchParams } from '../../services/soul-library-search';
import * as ai from 'ai';
import * as dbModule from '@claw/db';

vi.mock('ai', () => ({
  embed: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: Object.assign(
    vi.fn((modelId: string) => ({ modelId })),
    {
      embeddingModel: vi.fn(() => 'embedding-model-mock'),
    },
  ),
}));

vi.mock('@claw/db', () => ({
  db: {
    execute: vi.fn(),
  },
  botSouls: {},
  negativeSignalRegister: {},
  agentClasses: {},
}));

const mockEmbed = vi.mocked(ai.embed);

function createMockSearchParams(overrides: Partial<SoulSearchParams> = {}): SoulSearchParams {
  return {
    taskDescription: 'Analyze sales data and generate reports',
    taskCategory: 'data-analysis',
    requiredTools: [],
    taskComplexity: 'medium',
    campaignType: 'ad_hoc',
    requiredPopulation: 3,
    ...overrides,
  };
}

function createMockRawRow(overrides: Partial<{
  id: string;
  soul_content: string;
  embedding: number[];
  generation: number;
  parent_soul_id: string | null;
  task_category: string | null;
  dimensions: unknown;
  current_class: string | null;
  similarity_score: number;
}> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 'soul-1',
    soul_content: overrides.soul_content ?? '## Identity and Role\nAnalyst agent\n## Decision Priorities\nData first\n## Tool Usage Doctrine\nUse SQL and Python\n## Risk Tolerance\nLow risk\n## Communication Style\nFormal\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never expose data',
    embedding: overrides.embedding ?? [0.1, 0.2, 0.3],
    generation: overrides.generation ?? 2,
    parent_soul_id: overrides.parent_soul_id ?? 'parent-1',
    task_category: overrides.task_category ?? 'data-analysis',
    dimensions: overrides.dimensions ?? { toolUsageDoctrine: 'Use SQL and Python' },
    current_class: overrides.current_class ?? 'Understudy',
    similarity_score: overrides.similarity_score ?? 0.85,
  };
}

describe('searchSoulLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no souls match similarity threshold', async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.5, 0.5, 0.5]), toFactory: () => new Float32Array([0.5, 0.5, 0.5]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    vi.mocked(dbModule.db).execute.mockResolvedValueOnce({
      rows: [],
    } as dbModule.QueryResult);

    const results = await searchSoulLibrary(createMockSearchParams());

    expect(results).toHaveLength(0);
  });

  it('filters by required tools when specified', async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.5, 0.5, 0.5]), toFactory: () => new Float32Array([0.5, 0.5, 0.5]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    vi.mocked(dbModule.db).execute.mockResolvedValueOnce({
      rows: [
        createMockRawRow({ id: 'soul-python', soul_content: '## Tool Usage Doctrine\nUse Python SQL tools', dimensions: { toolUsageDoctrine: 'Use Python SQL tools' } }),
        createMockRawRow({ id: 'soul-java', soul_content: '## Tool Usage Doctrine\nUse Java only', dimensions: { toolUsageDoctrine: 'Use Java only' } }),
      ],
    } as dbModule.QueryResult);

    const results = await searchSoulLibrary(createMockSearchParams({
      requiredTools: ['python'],
    }));

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes Novice class souls when complexity is high', async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.5, 0.5, 0.5]), toFactory: () => new Float32Array([0.5, 0.5, 0.5]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    vi.mocked(dbModule.db).execute.mockResolvedValueOnce({
      rows: [
        createMockRawRow({ id: 'soul-artisan', current_class: 'Artisan' }),
        createMockRawRow({ id: 'soul-novice', current_class: 'Novice' }),
      ],
    } as dbModule.QueryResult);

    const results = await searchSoulLibrary(createMockSearchParams({
      taskComplexity: 'high',
    }));

    const hasNovice = results.some((r) => r.agentClass === 'Novice');
    expect(hasNovice).toBe(false);
  });

  it('returns 2x pool of required population', async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.5, 0.5, 0.5]), toFactory: () => new Float32Array([0.5, 0.5, 0.5]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    const rows = Array.from({ length: 10 }, (_, i) =>
      createMockRawRow({ id: `soul-${i}`, similarity_score: 0.9 - i * 0.05 }),
    );

    vi.mocked(dbModule.db).execute.mockResolvedValueOnce({
      rows,
    } as dbModule.QueryResult);

    const results = await searchSoulLibrary(createMockSearchParams({
      requiredPopulation: 3,
    }));

    expect(results.length).toBeLessThanOrEqual(6);
  });

  it('applies campaign boost to souls with lineage reuse', async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.5, 0.5, 0.5]), toFactory: () => new Float32Array([0.5, 0.5, 0.5]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    const parentId = 'parent-campaign-soul';

    vi.mocked(dbModule.db).execute
      .mockResolvedValueOnce({
        rows: [
          createMockRawRow({ id: 'soul-c1', parent_soul_id: parentId, similarity_score: 0.80 }),
          createMockRawRow({ id: 'soul-c2', parent_soul_id: parentId, similarity_score: 0.78 }),
        ],
      } as dbModule.QueryResult)
      .mockResolvedValueOnce({
        rows: [
          { parent_soul_id: parentId, sibling_count: 3 },
        ],
      } as dbModule.QueryResult);

    const results = await searchSoulLibrary(createMockSearchParams({
      campaignType: 'campaign',
    }));

    const campaignSouls = results.filter((r) => r.campaignBoost > 0);
    expect(campaignSouls.length).toBeGreaterThan(0);
  });

  it('sorts results by finalRank descending', async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.5, 0.5, 0.5]), toFactory: () => new Float32Array([0.5, 0.5, 0.5]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    vi.mocked(dbModule.db).execute.mockResolvedValueOnce({
      rows: [
        createMockRawRow({ id: 'soul-lower', similarity_score: 0.70 }),
        createMockRawRow({ id: 'soul-higher', similarity_score: 0.90 }),
        createMockRawRow({ id: 'soul-mid', similarity_score: 0.80 }),
      ],
    } as dbModule.QueryResult);

    const results = await searchSoulLibrary(createMockSearchParams());

    expect(results[0]?.soulId).toBe('soul-higher');
    expect(results[1]?.soulId).toBe('soul-mid');
    expect(results[2]?.soulId).toBe('soul-lower');
  });
});
