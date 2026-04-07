import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDriftDetector } from '../../services/drift-detector';
import type { CoordinationContext } from '../../services/coordination-loop';
import type { RingLeaderMissionBrief, RingLeaderRunState } from '@claw/shared-types';
import type { ActiveSessionRegistry } from '../../services/agent-spawner';

function makeMissionBrief(): RingLeaderMissionBrief {
  return {
    objective: 'Build a website that sells products',
    taskGraph: {
      tasks: [
        { taskId: 'task-1', description: 'Design the homepage', complexity: 'medium', requiredTools: [], dependencies: [], parallelizable: true, minPopulation: 3, recommendedPopulation: 4 },
      ],
      dag: {},
    },
    toolGrants: ['fetch_url'],
    budgetCapCents: 5000,
    runtimeLimitSeconds: 3600,
    campaignType: 'ad_hoc',
    runId: 'run-drift-test',
    projectId: null,
  };
}

function makeContext(): CoordinationContext {
  return {
    runId: 'run-drift-test',
    executionId: 'exec-drift-test',
    missionBrief: makeMissionBrief(),
    registry: { sessions: new Map() } as unknown as ActiveSessionRegistry,
    runState: {
      runId: 'run-drift-test',
      elapsedTimeSeconds: 100,
      budgetConsumedCents: 500,
      taskStates: {},
      objectiveDriftScore: 0,
      anomalies: [],
    } as RingLeaderRunState,
    pollIntervalMs: 30_000,
    startedAt: new Date(),
  };
}

const mockedEmbed = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  embed: mockedEmbed,
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: { embeddingModel: vi.fn(() => 'embedding-model-mock') },
}));

vi.mock('@claw/db', () => ({
  db: { select: vi.fn().mockResolvedValue([]) },
  tasks: { result: 'tasks.result', executionId: 'tasks.execution_id', status: 'tasks.status' },
}));

vi.mock('../../services/coordination-events', () => ({
  logCoordinationEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('createDriftDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a CoordinationModule with name drift-detector', () => {
    const detector = createDriftDetector();
    expect(detector.name).toBe('drift-detector');
  });

  it('computes objective embedding on first execution', async () => {
    mockedEmbed.mockResolvedValue({
      embedding: Array(1536).fill(0.1),
    });

    const detector = createDriftDetector();
    const ctx = makeContext();

    await detector.execute(ctx);

    expect(mockedEmbed).toHaveBeenCalledWith({
      model: expect.anything(),
      value: ctx.missionBrief.objective,
    });
  });

  it('sets objectiveDriftScore to 0 when no completed tasks exist', async () => {
    mockedEmbed.mockResolvedValue({
      embedding: Array(1536).fill(0.1),
    });

    const detector = createDriftDetector();
    const ctx = makeContext();

    await detector.execute(ctx);

    expect(ctx.runState.objectiveDriftScore).toBe(0);
  });
});
