import { describe, it, expect, vi } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

describe('god-layer-queue', () => {
  describe('GOD_LAYER_QUEUE_NAME constant', () => {
    it('is soul-verdicts', () => {
      const GOD_LAYER_QUEUE_NAME = 'soul-verdicts';
      expect(GOD_LAYER_QUEUE_NAME).toBe('soul-verdicts');
    });
  });

  describe('GodLayerJobData interface', () => {
    it('has required fields', () => {
      const jobData = {
        verdictId: 'verdict-123',
        executionId: 'exec-456',
        botId: 'bot-789',
        soulId: 'soul-abc',
        taskCategory: 'general',
      };
      expect(jobData.verdictId).toBe('verdict-123');
      expect(jobData.executionId).toBe('exec-456');
      expect(jobData.botId).toBe('bot-789');
      expect(jobData.soulId).toBe('soul-abc');
      expect(jobData.taskCategory).toBe('general');
    });

    it('allows null soulId', () => {
      const jobData = {
        verdictId: 'verdict-123',
        executionId: 'exec-456',
        botId: 'bot-789',
        soulId: null,
        taskCategory: 'general',
      };
      expect(jobData.soulId).toBeNull();
    });

    it('allows null taskCategory', () => {
      const jobData = {
        verdictId: 'verdict-123',
        executionId: 'exec-456',
        botId: 'bot-789',
        soulId: 'soul-abc',
        taskCategory: null,
      };
      expect(jobData.taskCategory).toBeNull();
    });
  });

  describe('constants', () => {
    it('GOD_LAYER_LOCK_DURATION_MS is 5 minutes', () => {
      const GOD_LAYER_LOCK_DURATION_MS = 5 * 60 * 1000;
      expect(GOD_LAYER_LOCK_DURATION_MS).toBe(300_000);
    });

    it('GOD_LAYER_CONCURRENCY is 3', () => {
      const GOD_LAYER_CONCURRENCY = 3;
      expect(GOD_LAYER_CONCURRENCY).toBe(3);
    });

    it('LOCK_TTL_SECONDS is 300', () => {
      const LOCK_TTL_SECONDS = 300;
      expect(LOCK_TTL_SECONDS).toBe(300);
    });

    it('LOCK_RETRY_DELAY_MS is 500', () => {
      const LOCK_RETRY_DELAY_MS = 500;
      expect(LOCK_RETRY_DELAY_MS).toBe(500);
    });

    it('LOCK_MAX_RETRIES is 20', () => {
      const LOCK_MAX_RETRIES = 20;
      expect(LOCK_MAX_RETRIES).toBe(20);
    });
  });
});
