import { describe, it, expect, vi } from 'vitest';
import { computeAndPersistFitness } from '../../services/ring-leader-fitness';

vi.mock('@claw/db', () => ({
  db: {
    insert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue([]),
  },
  ringLeaderRuns: { id: 'ring_leader_runs.id', soulId: 'ring_leader_runs.soulId' },
  ringLeaderFitness: { ringLeaderRunId: 'ring_leader_fitness.ring_leader_run_id' },
}));

vi.mock('../../services/coordination-scorer', () => ({
  scoreCoordinationQuality: vi.fn().mockRejectedValue(new Error('LLM failure')),
}));

vi.mock('../../services/soul-selection-scorer', () => ({
  scoreSoulSelectionQuality: vi.fn().mockRejectedValue(new Error('LLM failure')),
}));

vi.mock('../../services/ring-leader-class-progression', () => ({
  evaluateRingLeaderPromotion: vi.fn().mockResolvedValue({
    promoted: false,
    previousClass: 'Novice',
    newClass: 'Novice',
    reason: 'Not enough runs',
    runCount: 2,
  }),
}));

describe('computeAndPersistFitness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null on failure and logs warning', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await computeAndPersistFitness({
      runId: 'run-123',
      executionId: 'exec-456',
      synthesis: {
        runId: 'run-123',
        objective: 'Build a website',
        objectiveAchieved: true,
        achievementRationale: 'All tasks completed',
        taskSummary: [],
        intelligenceRoutingEvents: 0,
        reallocationEvents: 0,
        reanchoringEvents: 0,
        soulSelectionRetrospective: '',
        budgetVarianceCents: 0,
        recommendedLibraryWrites: [],
        pioneerEvents: [],
        ringLeaderSelfAssessment: '',
      },
      manifests: [],
      missionBrief: {
        objective: 'Build a website',
        taskGraph: { tasks: [], dag: {} },
        toolGrants: [],
        budgetCapCents: 5000,
        runtimeLimitSeconds: 3600,
        campaignType: 'ad_hoc',
        runId: 'run-123',
        projectId: null,
      },
      runState: {
        runId: 'run-123',
        elapsedTimeSeconds: 1800,
        budgetConsumedCents: 4500,
        taskStates: {},
        objectiveDriftScore: 0.1,
        anomalies: [],
      },
      coordinationLog: [],
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    const firstCallArgs = consoleSpy.mock.calls[0];
    expect(firstCallArgs[0]).toContain('Fitness scoring failed for runId=run-123');

    consoleSpy.mockRestore();
  });
});
