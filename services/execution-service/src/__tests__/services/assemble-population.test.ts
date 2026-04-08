import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assemblePopulation, BudgetShortfallError } from '../../services/assemble-population.js';
import type { RingLeaderMissionBrief, PopulationManifest } from '@claw/shared-types';
import * as ai from 'ai';
import * as dbModule from '@claw/db';
import { searchSoulLibrary } from '../../services/soul-library-search.js';
import { selectFromPool, applyPreDeploymentMutation } from '../../services/population-assembler.js';
import { generatePioneerPopulation } from '../../services/pioneer-generator.js';
import { validateBudget } from '../../services/budget-validator.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
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
    update: vi.fn(),
  },
  ringLeaderRuns: {},
}));

vi.mock('../../services/soul-library-search.js', () => ({
  searchSoulLibrary: vi.fn(),
}));

vi.mock('../../services/population-assembler.js', () => ({
  selectFromPool: vi.fn(),
  applyPreDeploymentMutation: vi.fn(),
}));

vi.mock('../../services/pioneer-generator.js', () => ({
  generatePioneerPopulation: vi.fn(),
}));

vi.mock('../../services/budget-validator.js', () => ({
  validateBudget: vi.fn(),
}));

const mockGenerateText = vi.mocked(ai.generateText);
const mockSearchSoulLibrary = vi.mocked(searchSoulLibrary);
const mockSelectFromPool = vi.mocked(selectFromPool);
const mockGeneratePioneerPopulation = vi.mocked(generatePioneerPopulation);
const mockValidateBudget = vi.mocked(validateBudget);
const mockApplyPreDeploymentMutation = vi.mocked(applyPreDeploymentMutation);

function createMockMissionBrief(overrides: Partial<RingLeaderMissionBrief> = {}): RingLeaderMissionBrief {
  return {
    runId: 'run-1',
    executionId: 'exec-1',
    objective: 'Test objective',
    taskGraph: {
      tasks: [
        {
          taskId: 'task-1',
          description: 'Analyze data and generate report',
          complexity: 'medium',
          requiredTools: ['python'],
          recommendedPopulation: 3,
          minPopulation: 2,
        },
      ],
    },
    campaignType: 'ad_hoc',
    budgetCapCents: 300,
    ...overrides,
  };
}

function createMockSelectedSoul(soulId: string, agentClass: 'Artisan' | 'Understudy' | 'Novice' = 'Understudy') {
  return {
    soulId,
    agentClass,
    source: 'library' as const,
    parentSoulId: 'parent-1',
    mutationApplied: null,
    selectionRationale: 'Selected',
    differentiationScore: 0.5,
    soulContent: '## Identity and Role\nAgent\n## Decision Priorities\nTest\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMedium\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm',
    embedding: [0.1, 0.2, 0.3],
  };
}

describe('assemblePopulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles population for single task with library path', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'data-analysis', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockSearchSoulLibrary.mockResolvedValueOnce([
      { soulId: 'lib-soul-1', soulContent: 'Content 1', embedding: [0.1], agentClass: 'Artisan', generation: 1, parentSoulId: null, taskCategory: 'data-analysis', compositeScore: 0.8, similarityScore: 0.8, campaignBoost: 0, finalRank: 0.8 },
      { soulId: 'lib-soul-2', soulContent: 'Content 2', embedding: [0.2], agentClass: 'Understudy', generation: 1, parentSoulId: null, taskCategory: 'data-analysis', compositeScore: 0.7, similarityScore: 0.7, campaignBoost: 0, finalRank: 0.7 },
    ]);

    mockSelectFromPool.mockReturnValueOnce([
      createMockSelectedSoul('lib-soul-1', 'Artisan'),
      createMockSelectedSoul('lib-soul-2', 'Understudy'),
    ]);

    mockValidateBudget.mockReturnValueOnce({
      funded: true,
      manifests: [],
      warnings: [],
      estimatedCostCents: 150,
    });

    vi.mocked(dbModule.db).update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as ReturnType<typeof dbModule.db.update>);

    const manifests = await assemblePopulation('run-id-1', createMockMissionBrief());

    expect(manifests).toHaveLength(1);
    expect(manifests[0]?.assignedSouls).toHaveLength(2);
  });

  it('uses pioneer path when library returns insufficient results', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'novel-task', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockSearchSoulLibrary.mockResolvedValueOnce([]);

    mockGeneratePioneerPopulation.mockResolvedValueOnce([
      createMockSelectedSoul('pioneer-1', 'Novice'),
      createMockSelectedSoul('pioneer-2', 'Novice'),
    ]);

    mockValidateBudget.mockReturnValueOnce({
      funded: true,
      manifests: [],
      warnings: [],
      estimatedCostCents: 60,
    });

    vi.mocked(dbModule.db).update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as ReturnType<typeof dbModule.db.update>);

    const manifests = await assemblePopulation('run-id-2', createMockMissionBrief());

    expect(manifests[0]?.pioneerFlag).toBe(true);
    expect(mockGeneratePioneerPopulation).toHaveBeenCalled();
  });

  it('throws BudgetShortfallError when budget is insufficient', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'data-analysis', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockSearchSoulLibrary.mockResolvedValueOnce([
      { soulId: 'soul-1', soulContent: 'Content', embedding: [0.1], agentClass: 'Artisan', generation: 1, parentSoulId: null, taskCategory: 'data-analysis', compositeScore: 0.8, similarityScore: 0.8, campaignBoost: 0, finalRank: 0.8 },
    ]);

    mockSelectFromPool.mockReturnValueOnce([createMockSelectedSoul('soul-1', 'Artisan')]);

    mockValidateBudget.mockReturnValueOnce({
      funded: false,
      manifests: [],
      warnings: [],
      estimatedCostCents: 200,
      shortfallCents: 50,
      minimumRequiredCents: 200,
    });

    vi.mocked(dbModule.db).update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as ReturnType<typeof dbModule.db.update>);

    await expect(
      assemblePopulation('run-id-3', createMockMissionBrief({ budgetCapCents: 100 })),
    ).rejects.toThrow(BudgetShortfallError);
  });

  it('applies mutation to lowest-ranked soul for high-complexity tasks', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'code-generation', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockSearchSoulLibrary.mockResolvedValueOnce([
      { soulId: 'soul-hc-1', soulContent: 'Content 1', embedding: [0.1], agentClass: 'Artisan', generation: 1, parentSoulId: null, taskCategory: 'code-generation', compositeScore: 0.9, similarityScore: 0.9, campaignBoost: 0, finalRank: 0.9 },
      { soulId: 'soul-hc-2', soulContent: 'Content 2', embedding: [0.2], agentClass: 'Understudy', generation: 1, parentSoulId: null, taskCategory: 'code-generation', compositeScore: 0.8, similarityScore: 0.8, campaignBoost: 0, finalRank: 0.8 },
    ]);

    mockSelectFromPool.mockReturnValueOnce([
      createMockSelectedSoul('soul-hc-1', 'Artisan'),
      createMockSelectedSoul('soul-hc-2', 'Understudy'),
    ]);

    mockApplyPreDeploymentMutation.mockResolvedValueOnce({
      mutatedContent: '## Identity and Role\nMutated\n## Decision Priorities\nSpecific\n## Tool Usage Doctrine\nTools\n## Risk Tolerance\nMedium\n## Communication Style\nDirect\n## Recovery Behavior\nRetry\n## Ethical Hard Stops\nINVIOLABLE: Never harm',
      mutatedEmbedding: [0.9, 0.1, 0.1],
      operation: 'amplification',
      rationale: 'High-complexity',
    });

    mockValidateBudget.mockReturnValueOnce({
      funded: true,
      manifests: [],
      warnings: [],
      estimatedCostCents: 150,
    });

    vi.mocked(dbModule.db).update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as ReturnType<typeof dbModule.db.update>);

    const manifests = await assemblePopulation('run-id-4', createMockMissionBrief({
      taskGraph: {
        tasks: [{
          taskId: 'task-hc',
          description: 'Generate complex code',
          complexity: 'high',
          requiredTools: ['python'],
          recommendedPopulation: 2,
          minPopulation: 2,
        }],
      },
    }));

    expect(mockApplyPreDeploymentMutation).toHaveBeenCalled();
  });

  it('handles zero budget (no-cap mode) without throwing', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'data-analysis', finishReason: 'stop', usage: { completionTokens: 0, promptTokens: 0 } } as ai.GenerateTextResult);

    mockSearchSoulLibrary.mockResolvedValueOnce([
      { soulId: 'soul-z1', soulContent: 'Content', embedding: [0.1], agentClass: 'Artisan', generation: 1, parentSoulId: null, taskCategory: 'data-analysis', compositeScore: 0.8, similarityScore: 0.8, campaignBoost: 0, finalRank: 0.8 },
    ]);

    mockSelectFromPool.mockReturnValueOnce([createMockSelectedSoul('soul-z1', 'Artisan')]);

    mockValidateBudget.mockReturnValueOnce({
      funded: true,
      manifests: [],
      warnings: [],
      estimatedCostCents: 100,
    });

    vi.mocked(dbModule.db).update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as ReturnType<typeof dbModule.db.update>);

    const manifests = await assemblePopulation('run-id-5', createMockMissionBrief({
      budgetCapCents: 0,
    }));

    expect(manifests).toHaveLength(1);
  });
});
