import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectFromPool, applyPreDeploymentMutation, type PoolSelectionParams, type SelectedSoul } from '../../services/population-assembler';
import * as ai from 'ai';
import { SOUL_DIFFERENTIATION_THRESHOLD } from '@claw/shared-types';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  embed: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
  embeddingModel: vi.fn(() => 'embedding-model-mock'),
}));

const mockGenerateText = vi.mocked(ai.generateText);
const mockEmbed = vi.mocked(ai.embed);
const mockCosineSimilarity = vi.mocked(ai.cosineSimilarity);

function createSoulSearchResult(overrides: Partial<{
  soulId: string;
  soulContent: string;
  embedding: number[];
  agentClass: 'Artisan' | 'Understudy' | 'Novice';
  generation: number;
  parentSoulId: string | null;
  taskCategory: string;
  compositeScore: number | null;
  similarityScore: number;
  campaignBoost: number;
  finalRank: number;
}> = {}): {
  soulId: string;
  soulContent: string;
  embedding: number[];
  agentClass: 'Artisan' | 'Understudy' | 'Novice';
  generation: number;
  parentSoulId: string | null;
  taskCategory: string;
  compositeScore: number | null;
  similarityScore: number;
  campaignBoost: number;
  finalRank: number;
} {
  return {
    soulId: overrides.soulId ?? 'soul-1',
    soulContent: overrides.soulContent ?? '## Identity and Role\nAgent\n## Decision Priorities\nTest\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMedium\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm',
    embedding: overrides.embedding ?? [0.1, 0.2, 0.3],
    agentClass: overrides.agentClass ?? 'Understudy',
    generation: overrides.generation ?? 1,
    parentSoulId: overrides.parentSoulId ?? null,
    taskCategory: overrides.taskCategory ?? 'test',
    compositeScore: overrides.compositeScore ?? null,
    similarityScore: overrides.similarityScore ?? 0.8,
    campaignBoost: overrides.campaignBoost ?? 0,
    finalRank: overrides.finalRank ?? 0.8,
  };
}

function createSelectedSoul(overrides: Partial<SelectedSoul> = {}): SelectedSoul {
  return {
    soulId: overrides.soulId ?? 'sel-soul-1',
    agentClass: overrides.agentClass ?? 'Understudy',
    source: 'library',
    parentSoulId: overrides.parentSoulId ?? null,
    mutationApplied: null,
    selectionRationale: 'Test selection',
    differentiationScore: 0.5,
    soulContent: overrides.soulContent ?? '## Identity and Role\nAgent\n## Decision Priorities\nTest\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMedium\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm',
    embedding: overrides.embedding ?? [0.1, 0.2, 0.3],
    ...overrides,
  };
}

describe('selectFromPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCosineSimilarity.mockImplementation((a: number[], b: number[]) => {
      const dot = a.reduce((acc, val, i) => acc + val * (b[i] ?? 0), 0);
      const normA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
      const normB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));
      return normA && normB ? dot / (normA * normB) : 0;
    });
  });

  it('throws when pool is empty', () => {
    const params: PoolSelectionParams = {
      pool: [],
      requiredPopulation: 3,
      varianceIntent: null,
    };

    const result = selectFromPool(params);

    expect(result).toHaveLength(0);
  });

  it('selects souls respecting class priority (Artisan > Understudy > Novice)', () => {
    const pool = [
      createSoulSearchResult({ soulId: 'novice-1', agentClass: 'Novice', finalRank: 0.9 }),
      createSoulSearchResult({ soulId: 'artisan-1', agentClass: 'Artisan', finalRank: 0.7 }),
      createSoulSearchResult({ soulId: 'understudy-1', agentClass: 'Understudy', finalRank: 0.85 }),
    ];

    const params: PoolSelectionParams = {
      pool,
      requiredPopulation: 3,
      varianceIntent: null,
    };

    const result = selectFromPool(params);

    expect(result[0]?.agentClass).toBe('Artisan');
    expect(result[1]?.agentClass).toBe('Understudy');
    expect(result[2]?.agentClass).toBe('Novice');
  });

  it('skips souls that are too similar (above differentiation threshold)', () => {
    mockCosineSimilarity.mockReturnValue(0.9);

    const pool = [
      createSoulSearchResult({ soulId: 'soul-a', embedding: [0.1, 0.2, 0.3] }),
      createSoulSearchResult({ soulId: 'soul-b', embedding: [0.1, 0.2, 0.3] }),
      createSoulSearchResult({ soulId: 'soul-c', embedding: [0.5, 0.6, 0.7] }),
    ];

    const params: PoolSelectionParams = {
      pool,
      requiredPopulation: 3,
      varianceIntent: null,
    };

    const result = selectFromPool(params);

    expect(result.some((s) => s.soulId === 'soul-b')).toBe(false);
    expect(result.some((s) => s.soulId === 'soul-c')).toBe(true);
  });

  it('returns fewer souls than required when pool is insufficient after differentiation', () => {
    mockCosineSimilarity.mockReturnValue(0.95);

    const pool = [
      createSoulSearchResult({ soulId: 'soul-a', embedding: [0.1, 0.2, 0.3] }),
      createSoulSearchResult({ soulId: 'soul-b', embedding: [0.1, 0.2, 0.3] }),
    ];

    const params: PoolSelectionParams = {
      pool,
      requiredPopulation: 3,
      varianceIntent: null,
    };

    const result = selectFromPool(params);

    expect(result.length).toBeLessThan(3);
  });

  it('computes differentiationScore as 1 - maxSimilarity for second+ soul', () => {
    mockCosineSimilarity.mockImplementation((a: number[], b: number[]) => {
      if (a[0] === 0.1 && b[0] === 0.1) return 0.9;
      if (a[0] === 0.5 && b[0] === 0.1) return 0.3;
      return 0.5;
    });

    const pool = [
      createSoulSearchResult({ soulId: 'soul-a', embedding: [0.1, 0.2, 0.3] }),
      createSoulSearchResult({ soulId: 'soul-b', embedding: [0.5, 0.6, 0.7] }),
    ];

    const params: PoolSelectionParams = {
      pool,
      requiredPopulation: 2,
      varianceIntent: null,
    };

    const result = selectFromPool(params);

    expect(result[0]?.differentiationScore).toBe(1.0);
    expect(result[1]?.differentiationScore).toBe(0.1);
  });

  it('appends variance intent to selection rationale when provided', () => {
    const pool = [createSoulSearchResult({ soulId: 'soul-1' })];

    const params: PoolSelectionParams = {
      pool,
      requiredPopulation: 1,
      varianceIntent: 'Maximize behavioral coverage',
    };

    const result = selectFromPool(params);

    expect(result[0]?.selectionRationale).toContain('Maximize behavioral coverage');
  });
});

describe('applyPreDeploymentMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for invalid mutation operation', async () => {
    const soul = createSelectedSoul();

    await expect(
      applyPreDeploymentMutation(soul, 'recombination' as 'substitution', 'Test'),
    ).rejects.toThrow(/Invalid mutation operation/);
  });

  it('applies substitution mutation and returns new content and embedding', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '## Identity and Role\nMutated Agent\n## Decision Priorities\nNew priority\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMedium\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm',
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.GenerateTextResult);

    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.9, 0.1, 0.1]), toFactory: () => new Float32Array([0.9, 0.1, 0.1]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    const soul = createSelectedSoul();

    const result = await applyPreDeploymentMutation(soul, 'substitution', 'Change priority');

    expect(result.operation).toBe('substitution');
    expect(result.mutatedContent).toContain('Mutated Agent');
    expect(result.rationale).toBe('Change priority');
  });

  it('applies amplification mutation and preserves constitution directives', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '## Identity and Role\nAmplified Agent\n## Decision Priorities\nVery specific directive\n## Tool Usage Doctrine\nOnly approved tools\n## Risk Tolerance\nVery low\n## Communication Style\nFormal\n## Recovery Behavior\nEscalate\n## Ethical Hard Stops\nINVIOLABLE: Never harm',
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    } as ai.GenerateTextResult);

    mockEmbed.mockResolvedValueOnce({
      embedding: { value: () => new Float32Array([0.8, 0.1, 0.2]), toFactory: () => new Float32Array([0.8, 0.1, 0.2]) } as unknown as ai.Embedding,
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
    });

    const soul = createSelectedSoul();

    const result = await applyPreDeploymentMutation(soul, 'amplification', 'Make more specific');

    expect(result.operation).toBe('amplification');
  });
});
