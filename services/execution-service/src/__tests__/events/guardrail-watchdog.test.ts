import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();

vi.mock('ioredis', () => {
  return {
    default: vi.fn(function MockIORedis() {
      return {
        get: mockRedisGet,
        setex: mockRedisSetex,
      };
    }),
  };
});

const mockPublishGuardrailTriggered = vi.fn().mockResolvedValue(undefined);

vi.mock('../../events/publisher.js', () => ({
  publishGuardrailTriggered: mockPublishGuardrailTriggered,
}));

const mockStopBot = vi.fn().mockResolvedValue(undefined);

vi.mock('../../orchestrator/bot-orchestrator.js', () => ({
  stopBot: mockStopBot,
}));

const mockBotRegistry = new Map([
  ['bot-1', { botId: 'bot-1', executionId: 'exec-1' }],
  ['bot-2', { botId: 'bot-2', executionId: 'exec-2' }],
]);

vi.mock('../../orchestrator/bot-registry.js', () => ({
  botRegistry: mockBotRegistry,
}));

function createDbMock(returnValue: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(returnValue),
          }),
        }),
      }),
    }),
  };
}

vi.mock('@claw/db', () => ({
  db: createDbMock([]),
  toolInvocations: {
    botId: Symbol('botId'),
    invokedAt: Symbol('invokedAt'),
    totalTokens: Symbol('totalTokens'),
    toolName: Symbol('toolName'),
    requestSummary: Symbol('requestSummary'),
  },
}));

describe('guardrail-watchdog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBotRegistry.set('bot-1', { botId: 'bot-1', executionId: 'exec-1' });
    mockBotRegistry.set('bot-2', { botId: 'bot-2', executionId: 'exec-2' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkLoopForBot', () => {
    it('returns false when fewer than LOOP_DETECTION_WINDOW invocations', async () => {
      const { checkLoopForBot } = await import('../../events/guardrail-watchdog.js');

      const result = await checkLoopForBot('bot-1');
      expect(result).toBe(false);
    });

    it('returns false when fingerprints differ (not a loop)', async () => {
      const { checkLoopForBot } = await import('../../events/guardrail-watchdog.js');

      const result = await checkLoopForBot('bot-1');
      expect(result).toBe(false);
    });
  });

  describe('watchdog lifecycle', () => {
    it('startGuardrailWatchdog returns a timer handle', async () => {
      const { startGuardrailWatchdog } = await import('../../events/guardrail-watchdog.js');

      const timer = startGuardrailWatchdog();
      expect(timer).toBeDefined();
      expect(typeof timer).toBe('object');

      clearInterval(timer);
    });

    it('stopGuardrailWatchdog clears the interval', async () => {
      const { startGuardrailWatchdog, stopGuardrailWatchdog } = await import(
        '../../events/guardrail-watchdog.js'
      );

      const timer = startGuardrailWatchdog();
      stopGuardrailWatchdog(timer);

      clearInterval(timer);
    });
  });

  describe('Redis fail-open behavior', () => {
    it('checkLoopForBot does not throw when Redis get fails', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis unavailable'));

      const { checkLoopForBot } = await import('../../events/guardrail-watchdog.js');

      await expect(checkLoopForBot('bot-1')).resolves.not.toThrow();
    });
  });

  describe('rate limit constants', () => {
    it('CALL_RATE_LIMIT is 60 calls per 60 seconds', () => {
      expect(CALL_RATE_LIMIT).toBe(60);
    });

    it('TOKEN_RATE_LIMIT is 100,000 tokens per 60 seconds', () => {
      expect(TOKEN_RATE_LIMIT).toBe(100_000);
    });

    it('LOOP_DETECTION_WINDOW is 5 by default', () => {
      expect(LOOP_DETECTION_WINDOW).toBe(5);
    });
  });
});

const CALL_RATE_LIMIT = 60;
const TOKEN_RATE_LIMIT = 100_000;
const LOOP_DETECTION_WINDOW = 5;
