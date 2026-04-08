import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreSoulSelectionQuality } from '../../services/soul-selection-scorer';
import type { SoulSelectionScoringParams } from '../../services/soul-selection-scorer';
import type { RingLeaderSynthesis, PopulationManifest, RingLeaderMissionBrief, SoulSelectionScore } from '@claw/shared-types';
import * as ai from 'ai';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn() },
}));

vi.mock('../../lib/resolve-model', () => ({
  resolveModel: vi.fn(() => 'mock-model'),
}));

const mockGenerateText = vi.mocked(ai.generateText);

function createMockMissionBrief(overrides: Partial<RingLeaderMissionBrief> = {}): RingLeaderMissionBrief {
  return {
    runId: 'run-1',
    executionId: 'exec-1',
    objective: 'Test objective',
    taskGraph: {
      tasks: [
        {
          taskId: 'task-1',
          description: 'Analyze data',
          complexity: 'medium',
          requiredTools: [],
          recommendedPopulation: 3,
          minPopulation: 2,
        },
      ],
    },
    campaignType: 'ad_hoc',
    budgetCapCents: 500,
    ...overrides,
  };
}

function createMockSynthesis(overrides: Partial<RingLeaderSynthesis> = {}): RingLeaderSynthesis {
  return {
    runId: 'run-1',
    taskSummary: [
      {
        taskId: 'task-1',
        completed: true,
        outputQualitySignal: 0.75,
        topPerformingSoulId: 'soul-1',
      },
    ],
    pioneerEvents: [],
    soulSelectionRetrospective: 'Selected diverse library souls for task 1.',
    ...overrides,
  };
}

function createMockManifest(overrides: Partial<PopulationManifest> = {}): PopulationManifest {
  return {
    taskId: 'task-1',
    taskDescription: 'Analyze data',
    assignedSouls: [
      {
        soulId: 'soul-1',
        agentClass: 'Artisan',
        source: 'library',
        parentSoulId: 'parent-1',
        mutationApplied: null,
        selectionRationale: 'High rank, differentiated',
        differentiationScore: 0.6,
      },
      {
        soulId: 'soul-2',
        agentClass: 'Understudy',
        source: 'library',
        parentSoulId: 'parent-2',
        mutationApplied: null,
        selectionRationale: 'Class priority',
        differentiationScore: 0.5,
      },
    ],
    pioneerFlag: false,
    varianceIntent: null,
    ...overrides,
  };
}

describe('scoreSoulSelectionQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fallback scores when LLM call fails', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('LLM unavailable'));

    const params: SoulSelectionScoringParams = {
      synthesis: createMockSynthesis(),
      manifests: [createMockManifest()],
      missionBrief: createMockMissionBrief(),
    };

    const result = await scoreSoulSelectionQuality(params);

    expect(result).toHaveProperty('librarySearchQuality');
    expect(result).toHaveProperty('differentiationEffectiveness');
    expect(result).toHaveProperty('mutationDecisionQuality');
    expect(result).toHaveProperty('pioneerHandling');
    expect(result).toHaveProperty('selectionRetrospectiveQuality');
    expect(result.librarySearchQuality).toBeGreaterThanOrEqual(0);
    expect(result.librarySearchQuality).toBeLessThanOrEqual(1);
  });

  it('returns valid scores from LLM when call succeeds', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      finishReason: 'stop',
      usage: { completionTokens: 0, promptTokens: 0 },
      output: {
        librarySearchQuality: 0.8,
        differentiationEffectiveness: 0.7,
        mutationDecisionQuality: 0.6,
        pioneerHandling: 0.5,
        selectionRetrospectiveQuality: 0.9,
      },
    } as ai.GenerateTextResult);

    const params: SoulSelectionScoringParams = {
      synthesis: createMockSynthesis(),
      manifests: [createMockManifest()],
      missionBrief: createMockMissionBrief(),
    };

    const result = await scoreSoulSelectionQuality(params);

    expect(result.librarySearchQuality).toBe(0.8);
    expect(result.differentiationEffectiveness).toBe(0.7);
    expect(result.mutationDecisionQuality).toBe(0.6);
  });

  it('handles empty manifests with fallback scoring', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('Network error'));

    const params: SoulSelectionScoringParams = {
      synthesis: createMockSynthesis(),
      manifests: [],
      missionBrief: createMockMissionBrief(),
    };

    const result = await scoreSoulSelectionQuality(params);

    expect(result.librarySearchQuality).toBe(0.5);
    expect(result.differentiationEffectiveness).toBe(0.5);
  });

  it('aggregates soul stats correctly across manifests', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('fail'));

    const params: SoulSelectionScoringParams = {
      synthesis: createMockSynthesis(),
      manifests: [
        createMockManifest({
          taskId: 'task-1',
          assignedSouls: [
            { soulId: 's1', agentClass: 'Artisan', source: 'library', parentSoulId: null, mutationApplied: null, selectionRationale: 'a', differentiationScore: 0.5 },
            { soulId: 's2', agentClass: 'Novice', source: 'generated', parentSoulId: null, mutationApplied: null, selectionRationale: 'b', differentiationScore: 0.3 },
          ],
        }),
        createMockManifest({
          taskId: 'task-2',
          assignedSouls: [
            { soulId: 's3', agentClass: 'Understudy', source: 'mutated', parentSoulId: 'p1', mutationApplied: 'substitution', selectionRationale: 'c', differentiationScore: 0.7 },
          ],
        }),
      ],
      missionBrief: createMockMissionBrief({
        taskGraph: {
          tasks: [
            { taskId: 'task-1', description: 't1', complexity: 'medium', requiredTools: [], recommendedPopulation: 2, minPopulation: 1 },
            { taskId: 'task-2', description: 't2', complexity: 'high', requiredTools: [], recommendedPopulation: 3, minPopulation: 2 },
          ],
        },
      }),
    };

    const result = await scoreSoulSelectionQuality(params);

    expect(result.differentiationEffectiveness).toBeGreaterThan(0);
  });
});
