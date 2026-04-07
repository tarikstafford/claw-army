import { describe, it, expect, vi } from 'vitest';
import { scoreCoordinationQuality } from '../../services/coordination-scorer';
import type { CoordinationScoringParams } from '../../services/coordination-scorer';
import type { RingLeaderSynthesis, RingLeaderMissionBrief, RingLeaderRunState } from '@claw/shared-types';

const mockedGenerateText = vi.hoisted(() => vi.fn());
const mockedResolveModel = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: mockedGenerateText,
  Output: { object: vi.fn() },
}));

vi.mock('../../lib/resolve-model', () => ({
  resolveModel: mockedResolveModel,
}));

function makeSynthesis(overrides: Partial<RingLeaderSynthesis> = {}): RingLeaderSynthesis {
  return {
    runId: 'run-123',
    objective: 'Build a website',
    objectiveAchieved: true,
    achievementRationale: 'All tasks completed',
    taskSummary: [
      { taskId: 'task-1', completed: true, topPerformingSoulId: 'soul-1', outputQualitySignal: 0.8, anomalies: [] },
      { taskId: 'task-2', completed: true, topPerformingSoulId: 'soul-2', outputQualitySignal: 0.75, anomalies: [] },
    ],
    intelligenceRoutingEvents: 2,
    reallocationEvents: 1,
    reanchoringEvents: 1,
    soulSelectionRetrospective: 'Good selection',
    budgetVarianceCents: -200,
    recommendedLibraryWrites: [],
    pioneerEvents: [],
    ringLeaderSelfAssessment: 'Met all objectives',
    ...overrides,
  };
}

function makeMissionBrief(): RingLeaderMissionBrief {
  return {
    objective: 'Build a website',
    taskGraph: { tasks: [], dag: {} },
    toolGrants: [],
    budgetCapCents: 5000,
    runtimeLimitSeconds: 3600,
    campaignType: 'ad_hoc',
    runId: 'run-123',
    projectId: null,
  };
}

function makeRunState(overrides: Partial<RingLeaderRunState> = {}): RingLeaderRunState {
  return {
    runId: 'run-123',
    elapsedTimeSeconds: 1800,
    budgetConsumedCents: 4500,
    taskStates: {},
    objectiveDriftScore: 0.08,
    anomalies: [],
    ...overrides,
  };
}

function makeParams(overrides: Partial<CoordinationScoringParams> = {}): CoordinationScoringParams {
  return {
    synthesis: makeSynthesis(),
    coordinationLog: [],
    missionBrief: makeMissionBrief(),
    runState: makeRunState(),
    ...overrides,
  };
}

describe('scoreCoordinationQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a CoordinationScore with all four dimensions from LLM', async () => {
    mockedGenerateText.mockResolvedValue({
      output: {
        collectiveOutcome: 0.85,
        driftPrevention: 0.90,
        reallocationEffectiveness: 0.75,
        budgetManagement: 0.80,
      },
    });

    const result = await scoreCoordinationQuality(makeParams());

    expect(result.collectiveOutcome).toBe(0.85);
    expect(result.driftPrevention).toBe(0.90);
    expect(result.reallocationEffectiveness).toBe(0.75);
    expect(result.budgetManagement).toBe(0.80);
  });

  it('computes fallback collectiveOutcome from task completion rate', async () => {
    mockedGenerateText.mockRejectedValue(new Error('fail'));

    const synthesisWith2Of3 = makeSynthesis({
      taskSummary: [
        { taskId: 't1', completed: true, topPerformingSoulId: null, outputQualitySignal: null, anomalies: [] },
        { taskId: 't2', completed: true, topPerformingSoulId: null, outputQualitySignal: null, anomalies: [] },
        { taskId: 't3', completed: false, topPerformingSoulId: null, outputQualitySignal: null, anomalies: [] },
      ],
    });

    const result = await scoreCoordinationQuality(makeParams({ synthesis: synthesisWith2Of3 }));

    expect(result.collectiveOutcome).toBeCloseTo(2 / 3, 2);
  });

  it('computes fallback driftPrevention from objectiveDriftScore', async () => {
    mockedGenerateText.mockRejectedValue(new Error('fail'));

    const result = await scoreCoordinationQuality(makeParams({
      runState: makeRunState({ objectiveDriftScore: 0.20 }),
    }));

    expect(result.driftPrevention).toBeCloseTo(0.80, 2);
  });

  it('computes fallback budgetManagement as 1.0 when under budget', async () => {
    mockedGenerateText.mockRejectedValue(new Error('fail'));

    const underBudget = makeSynthesis({ budgetVarianceCents: -500 });
    const result = await scoreCoordinationQuality(makeParams({ synthesis: underBudget }));

    expect(result.budgetManagement).toBe(1.0);
  });

  it('caps budgetManagement at 0 when over budget', async () => {
    mockedGenerateText.mockRejectedValue(new Error('fail'));

    const overBudget = makeSynthesis({ budgetVarianceCents: 6000 });
    const result = await scoreCoordinationQuality(makeParams({
      synthesis: overBudget,
      missionBrief: makeMissionBrief(),
    }));

    expect(result.budgetManagement).toBeGreaterThanOrEqual(0);
  });
});
