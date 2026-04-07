import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIntelligenceRouter, clearIntelligenceRouterState } from '../../services/intelligence-router';
import type { CoordinationContext } from '../../services/coordination-loop';
import type { RingLeaderMissionBrief, RingLeaderRunState, TaskState } from '@claw/shared-types';
import type { ActiveSessionRegistry, ActiveSession } from '../../services/agent-spawner';

function makeMissionBrief(): RingLeaderMissionBrief {
  return {
    objective: 'Build a website',
    taskGraph: {
      tasks: [
        { taskId: 'design', description: 'Design the homepage layout', complexity: 'medium', requiredTools: [], dependencies: [], parallelizable: true, minPopulation: 3, recommendedPopulation: 4 },
        { taskId: 'frontend', description: 'Implement frontend components', complexity: 'high', requiredTools: [], dependencies: ['design'], parallelizable: false, minPopulation: 3, recommendedPopulation: 4 },
        { taskId: 'backend', description: 'Build backend API services', complexity: 'high', requiredTools: [], dependencies: ['design'], parallelizable: false, minPopulation: 3, recommendedPopulation: 4 },
      ],
      dag: { 'design': ['frontend', 'backend'] },
    },
    toolGrants: ['fetch_url'],
    budgetCapCents: 5000,
    runtimeLimitSeconds: 3600,
    campaignType: 'ad_hoc',
    runId: 'run-intel-test',
    projectId: null,
  };
}

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    sessionId: 'sess-1',
    botId: 'bot-1',
    soulId: 'soul-1',
    taskId: 'design',
    agentClass: 'Artisan',
    sessionJwt: 'jwt',
    spawnedAt: new Date(),
    status: 'active',
    ...overrides,
  };
}

function makeContext(overrides: Partial<CoordinationContext> = {}): CoordinationContext {
  return {
    runId: 'run-intel-test',
    executionId: 'exec-intel-test',
    missionBrief: makeMissionBrief(),
    registry: { sessions: new Map() } as unknown as ActiveSessionRegistry,
    runState: {
      runId: 'run-intel-test',
      elapsedTimeSeconds: 100,
      budgetConsumedCents: 500,
      taskStates: {
        'design': { status: 'active', activeAgents: ['sess-1'], completedAgents: [], failedAgents: [], outputQualitySignal: null },
        'frontend': { status: 'active', activeAgents: ['sess-2'], completedAgents: [], failedAgents: [], outputQualitySignal: null },
        'backend': { status: 'active', activeAgents: ['sess-3'], completedAgents: [], failedAgents: [], outputQualitySignal: null },
      } as Record<string, TaskState>,
      objectiveDriftScore: 0,
      anomalies: [],
    } as unknown as RingLeaderRunState,
    pollIntervalMs: 30_000,
    startedAt: new Date(),
    ...overrides,
  };
}

vi.mock('@claw/db', () => ({
  db: { select: vi.fn().mockResolvedValue([]), insert: vi.fn().mockResolvedValue(undefined) },
  tasks: { claimedByBotId: 'tasks.claimed_by_bot_id', ringLeaderTaskId: 'tasks.ring_leader_task_id', result: 'tasks.result', status: 'tasks.status', executionId: 'tasks.execution_id' },
}));

vi.mock('../../services/coordination-events', () => ({
  logCoordinationEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('createIntelligenceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearIntelligenceRouterState('run-intel-test');
  });

  it('returns a CoordinationModule with name intelligence-router', () => {
    const router = createIntelligenceRouter();
    expect(router.name).toBe('intelligence-router');
  });

  it('does nothing when no completed sessions exist', async () => {
    const router = createIntelligenceRouter();

    const sessions = new Map<string, ActiveSession>();
    sessions.set('sess-active', makeSession({ sessionId: 'sess-active', status: 'active' }));

    const ctx = makeContext({
      registry: { sessions } as unknown as ActiveSessionRegistry,
    });

    await router.execute(ctx);

    const { db } = await import('@claw/db');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('skips already-processed sessions', async () => {
    const { db } = await import('@claw/db');
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
    });

    const router = createIntelligenceRouter();

    const sessions = new Map<string, ActiveSession>();
    sessions.set('sess-done', makeSession({ sessionId: 'sess-done', status: 'completed', botId: 'bot-done' }));

    const ctx = makeContext({
      registry: { sessions } as unknown as ActiveSessionRegistry,
    });

    await router.execute(ctx);
    await router.execute(ctx);

    expect(selectCallCount).toBe(1);
  });
});

describe('clearIntelligenceRouterState', () => {
  it('clears processed sessions for a run', () => {
    clearIntelligenceRouterState('run-intel-test');
  });
});
