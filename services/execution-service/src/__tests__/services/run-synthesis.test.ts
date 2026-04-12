import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockGenerateText, mockResolveModel } = vi.hoisted(() => ({
  mockDb: { update: vi.fn() },
  mockGenerateText: vi.fn(),
  mockResolveModel: vi.fn().mockReturnValue('mock-model'),
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  ringLeaderRuns: {
    id: 'id',
    synthesis: 'synthesis',
    status: 'status',
    completedAt: 'completedAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ _type: 'eq', args }),
}));

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: {
    object: (opts: unknown) => ({ _type: 'output_object', opts }),
  },
}));

vi.mock('zod', () => ({
  z: {
    object: vi.fn().mockReturnValue({
      parse: vi.fn(),
    }),
    string: vi.fn().mockReturnValue({}),
    boolean: vi.fn().mockReturnValue({}),
  },
}));

vi.mock('../../lib/resolve-model.js', () => ({
  resolveModel: (...args: unknown[]) => mockResolveModel(...args),
}));

import { generateRunSynthesis, type RunSynthesisParams } from '../../services/run-synthesis.js';

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeParams(overrides: Partial<RunSynthesisParams> = {}): RunSynthesisParams {
  return {
    runId: 'run-1',
    executionId: 'exec-1',
    missionBrief: {
      objective: 'Test objective',
      taskGraph: {
        tasks: [
          {
            taskId: 'task-1',
            description: 'Do the thing',
            complexity: 'medium' as const,
            requiredTools: ['browser'],
          },
        ],
        dag: {},
      },
      toolGrants: [],
      budgetCapCents: 1000,
      runtimeLimitSeconds: 3600,
      campaignType: 'ad_hoc',
      runId: 'run-1',
      projectId: null,
    },
    runState: {
      runId: 'run-1',
      elapsedTimeSeconds: 300,
      budgetConsumedCents: 500,
      taskStates: {
        'task-1': {
          status: 'complete',
          outputQualitySignal: 0.85,
        },
      },
      objectiveDriftScore: 0.1,
      anomalies: [],
    },
    manifests: [
      {
        taskId: 'task-1',
        taskDescription: 'Do the thing',
        assignedSouls: [
          {
            soulId: 'soul-1',
            agentClass: 'Understudy' as const,
            source: 'archetype' as const,
            differentiationScore: 0.5,
            selectionRationale: 'Best fit',
          },
        ],
        pioneerFlag: false,
      },
    ],
    coordinationLog: [],
    ...overrides,
  };
}

describe('run-synthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.update.mockImplementation(() => makeUpdateChain());
  });

  it('generates synthesis and persists it on successful LLM call', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        objectiveAchieved: true,
        achievementRationale: 'All tasks completed.',
        soulSelectionRetrospective: 'Good soul picks.',
        ringLeaderSelfAssessment: 'Coordination was efficient.',
      },
    });

    const result = await generateRunSynthesis(makeParams());

    expect(result.objectiveAchieved).toBe(true);
    expect(result.runId).toBe('run-1');
    expect(result.objective).toBe('Test objective');
    expect(result.taskSummary).toHaveLength(1);
    expect(result.budgetVarianceCents).toBe(-500); // 500 - 1000
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('falls back to degraded synthesis when LLM fails', async () => {
    mockGenerateText.mockRejectedValue(new Error('API rate limited'));

    const result = await generateRunSynthesis(makeParams());

    expect(result.objectiveAchieved).toBe(false);
    expect(result.achievementRationale).toContain('API rate limited');
    expect(result.soulSelectionRetrospective).toBe('');
    expect(result.ringLeaderSelfAssessment).toBe('');
    // Should still persist
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('falls back when LLM returns null output', async () => {
    mockGenerateText.mockResolvedValue({ output: null });

    const result = await generateRunSynthesis(makeParams());

    expect(result.objectiveAchieved).toBe(false);
    expect(result.achievementRationale).toContain('failed');
  });

  it('counts coordination events by type', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        objectiveAchieved: true,
        achievementRationale: 'Done.',
        soulSelectionRetrospective: 'OK.',
        ringLeaderSelfAssessment: 'Fine.',
      },
    });

    const params = makeParams({
      coordinationLog: [
        { type: 'intelligence_routing', timestamp: '2025-01-01T00:00:00Z', payload: {} as any },
        { type: 'intelligence_routing', timestamp: '2025-01-01T00:01:00Z', payload: {} as any },
        { type: 'reallocation', timestamp: '2025-01-01T00:02:00Z', payload: {} as any },
        { type: 'reanchoring', timestamp: '2025-01-01T00:03:00Z', payload: {} as any },
      ],
    });

    const result = await generateRunSynthesis(params);

    expect(result.intelligenceRoutingEvents).toBe(2);
    expect(result.reallocationEvents).toBe(1);
    expect(result.reanchoringEvents).toBe(1);
  });

  it('identifies pioneer events from manifests with pioneerFlag', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        objectiveAchieved: true,
        achievementRationale: 'Done.',
        soulSelectionRetrospective: 'OK.',
        ringLeaderSelfAssessment: 'Fine.',
      },
    });

    const params = makeParams({
      manifests: [
        {
          taskId: 'task-1',
          taskDescription: 'Pioneer task',
          assignedSouls: [
            { soulId: 'soul-1', agentClass: 'Understudy', source: 'archetype', differentiationScore: 0.5, selectionRationale: '' },
          ],
          pioneerFlag: true,
        },
        {
          taskId: 'task-2',
          taskDescription: 'Regular task',
          assignedSouls: [
            { soulId: 'soul-2', agentClass: 'Novice', source: 'archetype', differentiationScore: 0.3, selectionRationale: '' },
          ],
          pioneerFlag: false,
        },
      ],
    });

    const result = await generateRunSynthesis(params);

    expect(result.pioneerEvents).toEqual(['task-1']);
  });

  it('derives recommended library writes from completed tasks with Artisan/Understudy souls', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        objectiveAchieved: true,
        achievementRationale: 'Done.',
        soulSelectionRetrospective: 'OK.',
        ringLeaderSelfAssessment: 'Fine.',
      },
    });

    const params = makeParams({
      runState: {
        runId: 'run-1',
        elapsedTimeSeconds: 300,
        budgetConsumedCents: 500,
        taskStates: {
          'task-1': { status: 'complete', outputQualitySignal: 0.9 },
        },
        objectiveDriftScore: 0,
        anomalies: [],
      },
      manifests: [
        {
          taskId: 'task-1',
          taskDescription: 'Test',
          assignedSouls: [
            { soulId: 'soul-art', agentClass: 'Artisan', source: 'library', differentiationScore: 0.8, selectionRationale: '' },
            { soulId: 'soul-nov', agentClass: 'Novice', source: 'archetype', differentiationScore: 0.3, selectionRationale: '' },
          ],
          pioneerFlag: false,
        },
      ],
    });

    const result = await generateRunSynthesis(params);

    expect(result.recommendedLibraryWrites).toContain('soul-art');
    expect(result.recommendedLibraryWrites).not.toContain('soul-nov');
  });
});
