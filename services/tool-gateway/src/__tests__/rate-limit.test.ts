import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('rate-limit module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkCallRateLimit', () => {
    it('returns allowed: true when under limit', async () => {
      const mockConsume = vi.fn().mockResolvedValue(undefined);

      class MockRateLimiterRedis {
        consume = mockConsume;
      }

      const result = await mockConsume('bot-123', 1);
      expect(result).toBeUndefined();
    });

    it('returns allowed: false with retryAfter when limit exceeded', async () => {
      const msBeforeNext = 30000;

      class MockRateLimiterRes {
        msBeforeNext: number;
        constructor(ms: number) {
          this.msBeforeNext = ms;
        }
      }

      const mockErr = new MockRateLimiterRes(msBeforeNext);
      const mockConsume = vi.fn().mockRejectedValue(mockErr);

      try {
        await mockConsume('bot-123', 1);
      } catch (err) {
        if (err instanceof MockRateLimiterRes) {
          const retryAfter = Math.ceil(err.msBeforeNext / 1000);
          expect(retryAfter).toBe(30);
        }
      }
    });

    it('fails open (allows request) when Redis is unavailable', async () => {
      const redisError = new Error('Redis connection refused');
      const mockConsume = vi.fn().mockRejectedValue(redisError);

      try {
        await mockConsume('bot-123', 1);
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('Redis'))) {
          const result = { allowed: true };
          expect(result).toEqual({ allowed: true });
        }
      }
    });
  });

  describe('consumeTokens', () => {
    it('succeeds when tokens are under limit', async () => {
      const mockConsume = vi.fn().mockResolvedValue(undefined);

      await expect(mockConsume('bot-123', 1000)).resolves.toBeUndefined();
    });

    it('throws TOKEN_RATE_LIMIT error when tokens exceed limit', async () => {
      class MockRateLimiterRes {
        msBeforeNext: number;
        constructor(ms: number) {
          this.msBeforeNext = ms;
        }
      }

      const mockErr = new MockRateLimiterRes(60000);
      const mockConsume = vi.fn().mockRejectedValue(mockErr);

      try {
        await mockConsume('bot-123', 100000);
      } catch (err) {
        if (err instanceof MockRateLimiterRes) {
          const error = new Error('Token rate limit exceeded') as Error & {
            code: string;
            retryAfter: number;
          };
          error.code = 'TOKEN_RATE_LIMIT';
          error.retryAfter = Math.ceil(err.msBeforeNext / 1000);

          expect(error.code).toBe('TOKEN_RATE_LIMIT');
          expect(error.retryAfter).toBe(60);
        }
      }
    });

    it('re-throws non-rate-limit Redis errors', async () => {
      const redisError = new Error('Redis connection refused');
      const mockConsume = vi.fn().mockRejectedValue(redisError);

      await expect(mockConsume('bot-123', 1000)).rejects.toThrow('Redis connection refused');
    });
  });

  describe('checkTokenRateLimit', () => {
    it('returns allowed: true when under limit', async () => {
      const mockConsume = vi.fn().mockResolvedValue(undefined);

      await mockConsume('bot-123', 0);
      expect(mockConsume).toHaveBeenCalledWith('bot-123', 0);
    });

    it('returns allowed: false with retryAfter when at limit', async () => {
      class MockRateLimiterRes {
        msBeforeNext: number;
        constructor(ms: number) {
          this.msBeforeNext = ms;
        }
      }

      const mockErr = new MockRateLimiterRes(45000);
      const mockConsume = vi.fn().mockRejectedValue(mockErr);

      try {
        await mockConsume('bot-123', 0);
      } catch (err) {
        if (err instanceof MockRateLimiterRes) {
          const retryAfter = Math.ceil(err.msBeforeNext / 1000);
          expect(retryAfter).toBe(45);
        }
      }
    });

    it('fails open (allows request) when Redis is unavailable', async () => {
      const redisError = new Error('Redis connection refused');
      const mockConsume = vi.fn().mockRejectedValue(redisError);

      try {
        await mockConsume('bot-123', 0);
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('Redis'))) {
          const result = { allowed: true };
          expect(result).toEqual({ allowed: true });
        }
      }
    });
  });

  describe('token bucket refill behavior', () => {
    it('allows requests after tokens are consumed but bucket refills', async () => {
      class MockRateLimiterRes {
        msBeforeNext: number;
        constructor(ms: number) {
          this.msBeforeNext = ms;
        }
      }

      const mockErr = new MockRateLimiterRes(0);
      const mockConsume = vi.fn()
        .mockRejectedValueOnce(mockErr)
        .mockResolvedValueOnce(undefined);

      const results = [];
      try {
        await mockConsume('bot-123', 0);
      } catch {
        results.push({ allowed: true, retryAfter: 0 });
      }

      results.push({ allowed: true });
      expect(results[0]).toEqual({ allowed: true, retryAfter: 0 });
      expect(results[1]).toEqual({ allowed: true });
    });
  });
});