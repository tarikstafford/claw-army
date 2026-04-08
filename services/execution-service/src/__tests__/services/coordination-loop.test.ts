import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startCoordinationLoop, stopCoordinationLoop, getCoordinationHandle } from '../../services/coordination-loop';
import type { CoordinationModule } from '../../services/coordination-loop';
import type { RingLeaderMissionBrief } from '@claw/shared-types';
import type { ActiveSessionRegistry } from '../../services/agent-spawner';

const mockTaskGraph = {
  tasks: [
    { taskId: 'task-1', description: 'Design', complexity: 'medium' as const, requiredTools: [], dependencies: [], parallelizable: true, minPopulation: 3, recommendedPopulation: 4 },
    { taskId: 'task-2', description: 'Build', complexity: 'medium' as const, requiredTools: [], dependencies: ['task-1'], parallelizable: false, minPopulation: 3, recommendedPopulation: 4 },
  ],
  dag: { 'task-1': ['task-2'] },
};

function makeMissionBrief(): RingLeaderMissionBrief {
  return {
    objective: 'Build a website',
    taskGraph: mockTaskGraph,
    toolGrants: ['fetch_url'],
    budgetCapCents: 5000,
    runtimeLimitSeconds: 3600,
    campaignType: 'ad_hoc',
    runId: 'run-loop-test',
    projectId: null,
  };
}

function makeRegistry(overrides: Partial<ActiveSessionRegistry> = {}): ActiveSessionRegistry {
  return {
    sessions: new Map(),
    ...overrides,
  } as ActiveSessionRegistry;
}

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  ringLeaderRuns: { id: 'ring_leader_runs.id' },
  toolInvocations: { executionId: 'tool_invocations.execution_id', toolName: 'tool_invocations.tool_name', totalTokens: 'tool_invocations.total_tokens' },
}));

vi.mock('../../services/agent-spawner', () => ({
  getActiveSessionRegistry: vi.fn().mockReturnValue(makeRegistry()),
}));

vi.mock('../../services/coordination-events', () => ({
  clearCoordinationLog: vi.fn(),
  getCoordinationLog: vi.fn().mockReturnValue([]),
}));

vi.mock('../../services/run-synthesis', () => ({
  generateRunSynthesis: vi.fn().mockResolvedValue({
    runId: 'run-loop-test',
    objective: 'Build a website',
    objectiveAchieved: true,
    achievementRationale: 'Done',
    taskSummary: [],
    intelligenceRoutingEvents: 0,
    reallocationEvents: 0,
    reanchoringEvents: 0,
    soulSelectionRetrospective: '',
    budgetVarianceCents: 0,
    recommendedLibraryWrites: [],
    pioneerEvents: [],
    ringLeaderSelfAssessment: '',
  }),
}));

vi.mock('../../services/ring-leader-fitness', () => ({
  computeAndPersistFitness: vi.fn().mockResolvedValue(null),
}));

describe('coordination-loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startCoordinationLoop', () => {
    it('returns a CoordinationHandle with runId and stop/addModule methods', () => {
      const handle = startCoordinationLoop({
        runId: 'run-1',
        executionId: 'exec-1',
        missionBrief: makeMissionBrief(),
        pollIntervalMs: 10_000,
      });

      expect(handle.runId).toBe('run-1');
      expect(typeof handle.stop).toBe('function');
      expect(typeof handle.addModule).toBe('function');
    });

    it('registers a coordination module via addModule', () => {
      const handle = startCoordinationLoop({
        runId: 'run-modules',
        executionId: 'exec-modules',
        missionBrief: makeMissionBrief(),
        pollIntervalMs: 10_000,
      });

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const module: CoordinationModule = {
        name: 'test-module',
        execute: vi.fn().mockResolvedValue(undefined),
      };

      handle.addModule(module);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-module'),
      );

      consoleSpy.mockRestore();
    });

    it('can retrieve the handle via getCoordinationHandle', () => {
      const handle = startCoordinationLoop({
        runId: 'run-lookup',
        executionId: 'exec-lookup',
        missionBrief: makeMissionBrief(),
        pollIntervalMs: 10_000,
      });

      const retrieved = getCoordinationHandle('run-lookup');
      expect(retrieved?.runId).toBe(handle.runId);
    });
  });

  describe('stopCoordinationLoop', () => {
    it('cleans up the interval and removes the handle', () => {
      const handle = startCoordinationLoop({
        runId: 'run-stop',
        executionId: 'exec-stop',
        missionBrief: makeMissionBrief(),
        pollIntervalMs: 10_000,
      });

      const retrievedBefore = getCoordinationHandle('run-stop');
      expect(retrievedBefore).toBeDefined();

      handle.stop();

      const retrievedAfter = getCoordinationHandle('run-stop');
      expect(retrievedAfter).toBeUndefined();
    });

    it('accepts optional runId parameter', async () => {
      const { clearCoordinationLog } = await import('../../services/coordination-events');
      const clearCoordLogSpy = vi.spyOn({ clearCoordinationLog }, 'clearCoordinationLog').mockResolvedValue(undefined);

      const handle = startCoordinationLoop({
        runId: 'run-stop2',
        executionId: 'exec-stop2',
        missionBrief: makeMissionBrief(),
        pollIntervalMs: 10_000,
      });

      stopCoordinationLoop(handle, 'run-stop2');

      expect(clearCoordLogSpy).toHaveBeenCalledWith('run-stop2');
    });
  });
});
