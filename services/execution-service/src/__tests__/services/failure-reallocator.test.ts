import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFailureReallocator } from '../../services/failure-reallocator';
import type { ActiveSessionRegistry, ActiveSession } from '../../services/agent-spawner';
import type { CoordinationContext } from '../../services/coordination-loop';
import type { RingLeaderMissionBrief, RingLeaderRunState, TaskState } from '@claw/shared-types';

function makeMissionBrief(): RingLeaderMissionBrief {
  return {
    objective: 'Build a website',
    taskGraph: {
      tasks: [
        { taskId: 'task-1', description: 'Design', complexity: 'medium', requiredTools: [], dependencies: [], parallelizable: true, minPopulation: 3, recommendedPopulation: 4 },
        { taskId: 'task-2', description: 'Build', complexity: 'high', requiredTools: [], dependencies: ['task-1'], parallelizable: false, minPopulation: 3, recommendedPopulation: 5 },
      ],
      dag: { 'task-1': ['task-2'] },
    },
    toolGrants: ['fetch_url'],
    budgetCapCents: 5000,
    runtimeLimitSeconds: 3600,
    campaignType: 'ad_hoc',
    runId: 'run-fail-test',
    projectId: null,
  };
}

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    sessionId: 'sess-1',
    botId: 'bot-1',
    soulId: 'soul-1',
    taskId: 'task-1',
    agentClass: 'Artisan',
    sessionJwt: 'jwt',
    spawnedAt: new Date(),
    status: 'active',
    ...overrides,
  };
}

function makeContext(overrides: Partial<CoordinationContext> = {}): CoordinationContext {
  return {
    runId: 'run-fail-test',
    executionId: 'exec-fail-test',
    missionBrief: makeMissionBrief(),
    registry: { sessions: new Map() } as unknown as ActiveSessionRegistry,
    runState: {
      runId: 'run-fail-test',
      elapsedTimeSeconds: 100,
      budgetConsumedCents: 500,
      taskStates: {
        'task-1': { status: 'active', activeAgents: ['sess-1'], completedAgents: [], failedAgents: [], outputQualitySignal: null },
        'task-2': { status: 'queued', activeAgents: [], completedAgents: [], failedAgents: [], outputQualitySignal: null },
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
  db: { select: vi.fn().mockResolvedValue([]), insert: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue(undefined) },
  bots: { id: 'bots.id', errorMessage: 'bots.error_message' },
  botSouls: { id: 'bot_souls.id', soulContent: 'bot_souls.soul_content' },
  tasks: { executionId: 'tasks.execution_id', status: 'tasks.status', result: 'tasks.result', claimedByBotId: 'tasks.claimed_by_bot_id', ringLeaderTaskId: 'tasks.ring_leader_task_id' },
}));

vi.mock('../../services/coordination-events', () => ({
  logCoordinationEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../orchestrator/bot-orchestrator', () => ({
  spawnBot: vi.fn().mockResolvedValue({ botId: 'new-bot-123' }),
}));

describe('createFailureReallocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a CoordinationModule with name failure-reallocator', () => {
    const reallocator = createFailureReallocator();
    expect(reallocator.name).toBe('failure-reallocator');
  });

  it('does not process a failed session that was already handled', async () => {
    const reallocator = createFailureReallocator();

    const sessions = new Map<string, ActiveSession>();
    sessions.set('sess-failed', makeSession({ sessionId: 'sess-failed', status: 'failed' }));

    const ctx = makeContext({
      registry: { sessions } as unknown as ActiveSessionRegistry,
    });

    await reallocator.execute(ctx);
    await reallocator.execute(ctx);

    const logCoordinationEvent = await import('../../services/coordination-events');
    const callsForFailed = vi.mocked(logCoordinationEvent.logCoordinationEvent).mock.calls.filter(
      (call) => (call[2] as { affectedAgentSessionId?: string }).affectedAgentSessionId === 'sess-failed',
    );
    expect(callsForFailed.length).toBeLessThanOrEqual(1);
  });
});
