import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('@claw/db', () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
  };
  return { db: mockDb, bots: {} };
});

vi.mock('../../orchestrator/bot-registry.js', () => ({
  botRegistry: new Map(),
  registerBot: vi.fn(),
  unregisterBot: vi.fn(),
  getBot: vi.fn(),
  getActiveBotCount: vi.fn(),
  getBotsForExecution: vi.fn(),
}));

vi.mock('../../orchestrator/gce-bot-launcher.js', () => ({
  launchBotVM: vi.fn().mockResolvedValue({ instanceName: 'bot-test-123' }),
  terminateBotVM: vi.fn().mockResolvedValue(undefined),
}));

const mockPublishBotStarted = vi.fn().mockResolvedValue(undefined);
const mockPublishBotStopped = vi.fn().mockResolvedValue(undefined);
const mockPublishGuardrailTriggered = vi.fn().mockResolvedValue(undefined);

vi.mock('../../events/publisher.js', () => ({
  publishBotStarted: mockPublishBotStarted,
  publishBotStopped: mockPublishBotStopped,
  publishGuardrailTriggered: mockPublishGuardrailTriggered,
}));

vi.mock('../../queue/task-queue.js', () => ({
  queueConnection: { host: 'localhost' },
  TASK_QUEUE_NAME: 'tasks',
}));

class MockQueueEvents {
  on = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
}

class MockQueue {
  constructor() {}
}

vi.mock('bullmq', () => ({
  Queue: MockQueue,
  QueueEvents: MockQueueEvents,
}));

const {
  stopBot,
  spawnBotsForExecution,
  startIdleChecker,
  stopIdleChecker,
  startSpawnTimeoutChecker,
  stopSpawnTimeoutChecker,
} = await import('../../orchestrator/bot-orchestrator.js');

const { botRegistry, getBot, getActiveBotCount } = await import('../../orchestrator/bot-registry.js');

describe('bot-orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    botRegistry.clear();
    getBot.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stopBot', () => {
    it('skips DB update when skipDbUpdate is true', async () => {
      const mockClient = { disconnect: vi.fn(), isConnected: true };
      botRegistry.set('bot-001', {
        botId: 'bot-001',
        executionId: 'exec-001',
        instanceName: 'bot-test-123',
        internalIp: '10.0.0.5',
        gatewayToken: 'token',
        openclawClient: mockClient,
        currentJobId: null,
        soulId: 'soul-001',
        startedAt: Date.now(),
        lastTaskClaimedAt: Date.now(),
      });
      getBot.mockReturnValue({
        botId: 'bot-001',
        executionId: 'exec-001',
        instanceName: 'bot-test-123',
        internalIp: '10.0.0.5',
        gatewayToken: 'token',
        openclawClient: mockClient,
        currentJobId: null,
        soulId: 'soul-001',
        startedAt: Date.now(),
        lastTaskClaimedAt: Date.now(),
      });

      const { db } = await import('@claw/db');
      await stopBot('bot-001', 'completed', { skipDbUpdate: true });
      expect(db.update).not.toHaveBeenCalled();
    });

    it('does nothing for unknown botId', async () => {
      await expect(stopBot('unknown', 'terminated')).resolves.toBeUndefined();
    });
  });

  describe('spawnBotsForExecution', () => {
    it('does not spawn when already at target count', async () => {
      getActiveBotCount.mockReturnValue(2);
      await spawnBotsForExecution('exec-001', [
        { soulId: 'soul-001', soulContent: '# A' },
        { soulId: 'soul-002', soulContent: '# B' },
      ]);
      expect(mockPublishBotStarted).not.toHaveBeenCalled();
    });
  });

  describe('startIdleChecker / stopIdleChecker', () => {
    it('does not terminate bots that are still active', () => {
      vi.useFakeTimers();

      const mockClient = { disconnect: vi.fn(), isConnected: true };
      botRegistry.set('bot-001', {
        botId: 'bot-001',
        executionId: 'exec-001',
        instanceName: 'bot-test-123',
        internalIp: '10.0.0.5',
        gatewayToken: 'token',
        openclawClient: mockClient,
        currentJobId: null,
        soulId: 'soul-001',
        startedAt: Date.now(),
        lastTaskClaimedAt: Date.now(),
      });

      const timer = startIdleChecker();
      vi.advanceTimersByTime(31_000);
      vi.useRealTimers();
      stopIdleChecker(timer);

      expect(mockPublishGuardrailTriggered).not.toHaveBeenCalled();
    });
  });

  describe('startSpawnTimeoutChecker / stopSpawnTimeoutChecker', () => {
    it('does not check bots that already have openclawClient set', async () => {
      vi.useFakeTimers();

      const mockClient = { disconnect: vi.fn(), isConnected: true };
      botRegistry.set('bot-001', {
        botId: 'bot-001',
        executionId: 'exec-001',
        instanceName: 'bot-test-123',
        internalIp: '10.0.0.5',
        gatewayToken: 'token',
        openclawClient: mockClient,
        currentJobId: null,
        soulId: 'soul-001',
        startedAt: Date.now() - 15 * 60_000,
        lastTaskClaimedAt: Date.now() - 15 * 60_000,
      });

      const { db } = await import('@claw/db');
      const timer = startSpawnTimeoutChecker();
      vi.advanceTimersByTime(31_000);
      vi.useRealTimers();
      stopSpawnTimeoutChecker(timer);

      expect(db.update).not.toHaveBeenCalled();
    });
  });
});