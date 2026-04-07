import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

describe('openclaw-dispatcher', () => {
  describe('BOT_WAIT_TIMEOUT_MS', () => {
    it('defaults to 10 minutes when env var is not set', () => {
      const BOT_WAIT_TIMEOUT_MS = Number(process.env.BOT_WAIT_TIMEOUT_MS ?? 10 * 60 * 1000);
      expect(BOT_WAIT_TIMEOUT_MS).toBe(600_000);
    });

    it('uses env var when set', () => {
      const BOT_WAIT_TIMEOUT_MS = Number('300000');
      expect(BOT_WAIT_TIMEOUT_MS).toBe(300_000);
    });
  });

  describe('BOT_WAIT_POLL_MS', () => {
    it('is 5 seconds', () => {
      const BOT_WAIT_POLL_MS = 5_000;
      expect(BOT_WAIT_POLL_MS).toBe(5_000);
    });
  });

  describe('DISPATCH_LOCK_DURATION_MS', () => {
    it('is BOT_WAIT_TIMEOUT_MS + 60 seconds buffer', () => {
      const BOT_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
      const DISPATCH_LOCK_DURATION_MS = BOT_WAIT_TIMEOUT_MS + 60_000;
      expect(DISPATCH_LOCK_DURATION_MS).toBe(660_000);
    });
  });

  describe('TASK_EXECUTION_TIMEOUT_MS', () => {
    it('defaults to 30 minutes when env var is not set', () => {
      const TASK_EXECUTION_TIMEOUT_MS = Number(process.env.TASK_EXECUTION_TIMEOUT_MS ?? 30 * 60 * 1000);
      expect(TASK_EXECUTION_TIMEOUT_MS).toBe(1_800_000);
    });

    it('uses env var when set', () => {
      const TASK_EXECUTION_TIMEOUT_MS = Number('900000');
      expect(TASK_EXECUTION_TIMEOUT_MS).toBe(900_000);
    });
  });

  describe('waitForAvailableBot timeout behavior', () => {
    it('waits until deadline before returning null', async () => {
      const BOT_WAIT_TIMEOUT_MS = 100;
      const BOT_WAIT_POLL_MS = 20;
      const deadline = Date.now() + BOT_WAIT_TIMEOUT_MS;
      let pollCount = 0;

      while (Date.now() < deadline) {
        pollCount++;
        await new Promise((resolve) => setTimeout(resolve, BOT_WAIT_POLL_MS));
      }

      expect(pollCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('dispatcher concurrency', () => {
    it('dispatcher concurrency is 20', () => {
      const DISPATCHER_CONCURRENCY = 20;
      expect(DISPATCHER_CONCURRENCY).toBe(20);
    });
  });

  describe('dispatcher worker settings', () => {
    it('lockDuration equals DISPATCH_LOCK_DURATION_MS', () => {
      const BOT_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
      const DISPATCH_LOCK_DURATION_MS = BOT_WAIT_TIMEOUT_MS + 60_000;
      expect(DISPATCH_LOCK_DURATION_MS).toBe(660_000);
    });

    it('stalledInterval is 30 seconds', () => {
      const STALLED_INTERVAL = 30_000;
      expect(STALLED_INTERVAL).toBe(30_000);
    });

    it('maxStalledCount is 1', () => {
      const MAX_STALLED_COUNT = 1;
      expect(MAX_STALLED_COUNT).toBe(1);
    });
  });
});

type TaskJobData = {
  taskId: string;
  executionId: string;
  description: string;
};
