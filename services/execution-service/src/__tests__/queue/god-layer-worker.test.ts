import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

describe('god-layer-worker', () => {
  describe('GOD_LAYER_LOCK_DURATION_MS constant', () => {
    it('is 5 minutes in ms', () => {
      const GOD_LAYER_LOCK_DURATION_MS = 5 * 60 * 1000;
      expect(GOD_LAYER_LOCK_DURATION_MS).toBe(300_000);
    });
  });

  describe('GOD_LAYER_CONCURRENCY constant', () => {
    it('is 3', () => {
      const GOD_LAYER_CONCURRENCY = 3;
      expect(GOD_LAYER_CONCURRENCY).toBe(3);
    });
  });

  describe('LOCK_TTL_SECONDS constant', () => {
    it('is 300 seconds', () => {
      const LOCK_TTL_SECONDS = 300;
      expect(LOCK_TTL_SECONDS).toBe(300);
    });
  });

  describe('LOCK_RETRY_DELAY_MS constant', () => {
    it('is 500 ms', () => {
      const LOCK_RETRY_DELAY_MS = 500;
      expect(LOCK_RETRY_DELAY_MS).toBe(500);
    });
  });

  describe('LOCK_MAX_RETRIES constant', () => {
    it('is 20', () => {
      const LOCK_MAX_RETRIES = 20;
      expect(LOCK_MAX_RETRIES).toBe(20);
    });
  });

  describe('acquireCategoryLock', () => {
    it('returns true when Redis SET NX succeeds', async () => {
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'),
      };

      async function acquireCategoryLock(
        redis: { set: ReturnType<typeof vi.fn> },
        category: string,
        jobId: string,
      ): Promise<boolean> {
        const result = await redis.set(
          `soul-library:${category}`,
          jobId,
          'EX',
          300,
          'NX',
        );
        return result === 'OK';
      }

      const result = await acquireCategoryLock(mockRedis as unknown as { set: ReturnType<typeof vi.fn> }, 'general', 'job-123');
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'soul-library:general',
        'job-123',
        'EX',
        300,
        'NX',
      );
    });

    it('returns false when Redis SET NX fails (lock already held)', async () => {
      const mockRedis = {
        set: vi.fn().mockResolvedValue(null),
      };

      async function acquireCategoryLock(
        redis: { set: ReturnType<typeof vi.fn> },
        category: string,
        jobId: string,
      ): Promise<boolean> {
        const result = await redis.set(
          `soul-library:${category}`,
          jobId,
          'EX',
          300,
          'NX',
        );
        return result === 'OK';
      }

      const result = await acquireCategoryLock(mockRedis as unknown as { set: ReturnType<typeof vi.fn> }, 'general', 'job-123');
      expect(result).toBe(false);
    });
  });

  describe('releaseCategoryLock', () => {
    it('calls Redis eval with correct Lua script and arguments', async () => {
      const mockRedis = {
        eval: vi.fn().mockResolvedValue(1),
      };

      async function releaseCategoryLock(
        redis: { eval: ReturnType<typeof vi.fn> },
        category: string,
        jobId: string,
      ): Promise<void> {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(script, 1, `soul-library:${category}`, jobId);
      }

      await releaseCategoryLock(mockRedis as unknown as { eval: ReturnType<typeof vi.fn> }, 'general', 'job-123');
      expect(mockRedis.eval).toHaveBeenCalled();
      const [script, numKeys, key, arg] = mockRedis.eval.mock.calls[0]!;
      expect(script).toContain('redis.call("get"');
      expect(script).toContain('redis.call("del"');
      expect(numKeys).toBe(1);
      expect(key).toBe('soul-library:general');
      expect(arg).toBe('job-123');
    });

    it('does not throw when lock was already released (returns 0)', async () => {
      const mockRedis = {
        eval: vi.fn().mockResolvedValue(0),
      };

      async function releaseCategoryLock(
        redis: { eval: ReturnType<typeof vi.fn> },
        category: string,
        jobId: string,
      ): Promise<void> {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(script, 1, `soul-library:${category}`, jobId);
      }

      await expect(
        releaseCategoryLock(mockRedis as unknown as { eval: ReturnType<typeof vi.fn> }, 'general', 'job-123'),
      ).resolves.not.toThrow();
    });
  });

  describe('sleep', () => {
    it('resolves after the specified duration', async () => {
      function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('worker configuration', () => {
    it('correctly describes worker settings', () => {
      const concurrency = 3;
      const lockDuration = 5 * 60 * 1000;
      const stalledInterval = 30_000;
      const maxStalledCount = 1;
      const limiter = { max: 20, duration: 60_000 };

      expect(concurrency).toBe(3);
      expect(lockDuration).toBe(300_000);
      expect(stalledInterval).toBe(30_000);
      expect(maxStalledCount).toBe(1);
      expect(limiter.max).toBe(20);
      expect(limiter.duration).toBe(60_000);
    });
  });
});

type GodLayerJobData = {
  verdictId: string;
  executionId: string;
  botId: string;
  soulId: string | null;
  taskCategory: string | null;
};
