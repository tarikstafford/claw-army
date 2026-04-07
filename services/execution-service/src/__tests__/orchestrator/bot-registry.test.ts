import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  botRegistry,
  registerBot,
  unregisterBot,
  getBot,
  getBotsForExecution,
  getActiveBotCount,
  acquireIdleBot,
  releaseBot,
  type BotEntry,
} from '../../orchestrator/bot-registry.js';

const mockOpenClawClient = (connected: boolean) => ({
  isConnected: connected,
  disconnect: vi.fn(),
});

const createBotEntry = (overrides: Partial<BotEntry> = {}): BotEntry => ({
  botId: 'bot-001',
  executionId: 'exec-001',
  instanceName: 'bot-abc12345-1700000000000',
  internalIp: '10.0.0.5',
  gatewayToken: 'token-abc',
  openclawClient: mockOpenClawClient(true),
  currentJobId: null,
  soulId: 'soul-001',
  startedAt: Date.now(),
  lastTaskClaimedAt: Date.now(),
  ...overrides,
});

describe('bot-registry', () => {
  beforeEach(() => {
    botRegistry.clear();
  });

  describe('registerBot', () => {
    it('adds a bot entry to the registry', () => {
      const entry = createBotEntry();
      registerBot(entry);
      expect(getBot('bot-001')).toBe(entry);
    });

    it('overwrites existing entry with same botId', () => {
      const entry1 = createBotEntry({ botId: 'bot-001', instanceName: 'first' });
      const entry2 = createBotEntry({ botId: 'bot-001', instanceName: 'second' });
      registerBot(entry1);
      registerBot(entry2);
      expect(getBot('bot-001')?.instanceName).toBe('second');
    });
  });

  describe('unregisterBot', () => {
    it('removes the bot from the registry', () => {
      registerBot(createBotEntry({ botId: 'bot-001' }));
      unregisterBot('bot-001');
      expect(getBot('bot-001')).toBeUndefined();
    });

    it('does not throw for unknown botId', () => {
      expect(() => unregisterBot('unknown')).not.toThrow();
    });
  });

  describe('getBot', () => {
    it('returns the bot entry for a known botId', () => {
      const entry = createBotEntry({ botId: 'bot-001' });
      registerBot(entry);
      expect(getBot('bot-001')).toBe(entry);
    });

    it('returns undefined for unknown botId', () => {
      expect(getBot('unknown')).toBeUndefined();
    });
  });

  describe('getBotsForExecution', () => {
    it('returns all bots for a given execution', () => {
      registerBot(createBotEntry({ botId: 'bot-001', executionId: 'exec-001' }));
      registerBot(createBotEntry({ botId: 'bot-002', executionId: 'exec-001' }));
      registerBot(createBotEntry({ botId: 'bot-003', executionId: 'exec-002' }));
      const bots = getBotsForExecution('exec-001');
      expect(bots).toHaveLength(2);
      expect(bots.map((b) => b.botId)).toContain('bot-001');
      expect(bots.map((b) => b.botId)).toContain('bot-002');
    });

    it('returns empty array when no bots exist for execution', () => {
      expect(getBotsForExecution('unknown')).toEqual([]);
    });
  });

  describe('getActiveBotCount', () => {
    it('returns the count of active bots for an execution', () => {
      registerBot(createBotEntry({ botId: 'bot-001', executionId: 'exec-001' }));
      registerBot(createBotEntry({ botId: 'bot-002', executionId: 'exec-001' }));
      expect(getActiveBotCount('exec-001')).toBe(2);
    });

    it('returns 0 for unknown execution', () => {
      expect(getActiveBotCount('unknown')).toBe(0);
    });
  });

  describe('acquireIdleBot', () => {
    it('returns an idle bot with connected OpenClaw client', () => {
      const entry = createBotEntry({
        botId: 'bot-001',
        executionId: 'exec-001',
        currentJobId: null,
        openclawClient: mockOpenClawClient(true),
      });
      registerBot(entry);
      const bot = acquireIdleBot('exec-001', 'job-001');
      expect(bot).not.toBeNull();
      expect(bot?.currentJobId).toBe('job-001');
    });

    it('returns null when no idle bots available', () => {
      const entry = createBotEntry({
        botId: 'bot-001',
        executionId: 'exec-001',
        currentJobId: 'other-job',
        openclawClient: mockOpenClawClient(true),
      });
      registerBot(entry);
      expect(acquireIdleBot('exec-001', 'job-001')).toBeNull();
    });

    it('returns null when bot OpenClaw client is disconnected', () => {
      const entry = createBotEntry({
        botId: 'bot-001',
        executionId: 'exec-001',
        currentJobId: null,
        openclawClient: mockOpenClawClient(false),
      });
      registerBot(entry);
      expect(acquireIdleBot('exec-001', 'job-001')).toBeNull();
    });

    it('returns null for unknown execution', () => {
      expect(acquireIdleBot('unknown', 'job-001')).toBeNull();
    });

    it('marks bot as claimed atomically', () => {
      const entry = createBotEntry({
        botId: 'bot-001',
        executionId: 'exec-001',
        currentJobId: null,
        openclawClient: mockOpenClawClient(true),
      });
      registerBot(entry);
      const bot = acquireIdleBot('exec-001', 'job-001');
      expect(bot?.currentJobId).toBe('job-001');
      const secondAcquire = acquireIdleBot('exec-001', 'job-002');
      expect(secondAcquire).toBeNull();
    });
  });

  describe('releaseBot', () => {
    it('resets currentJobId to null', () => {
      const entry = createBotEntry({
        botId: 'bot-001',
        executionId: 'exec-001',
        currentJobId: 'job-001',
      });
      registerBot(entry);
      releaseBot('bot-001');
      expect(getBot('bot-001')?.currentJobId).toBeNull();
    });

    it('does not throw for unknown botId', () => {
      expect(() => releaseBot('unknown')).not.toThrow();
    });
  });
});