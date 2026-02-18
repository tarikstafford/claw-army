import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import IORedis from 'ioredis';

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// Dedicated Redis connection for rate limiting (NOT shared with BullMQ)
const redis = new IORedis(redisUrl, {
  enableOfflineQueue: false,
  lazyConnect: true,
});

// 60 calls per bot per 60 seconds
const callsLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:calls',
  points: 60,
  duration: 60,
});

// 100,000 tokens per bot per 60 seconds
const tokensLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:tokens',
  points: 100000,
  duration: 60,
});

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

/**
 * Check and consume one call credit for the given bot.
 * Returns { allowed: false, retryAfter } if limit is exceeded.
 */
export async function checkCallRateLimit(botId: string): Promise<RateLimitResult> {
  try {
    await callsLimiter.consume(botId, 1);
    return { allowed: true };
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return { allowed: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    throw err;
  }
}

/**
 * Consume token credits for the given bot.
 * THROWS a structured error with code 'TOKEN_RATE_LIMIT' if limit exceeded.
 * Should be called AFTER llm_call returns (consume-after-return pattern).
 */
export async function consumeTokens(botId: string, tokens: number): Promise<void> {
  try {
    await tokensLimiter.consume(botId, tokens);
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      const error = new Error('Token rate limit exceeded') as Error & {
        code: string;
        retryAfter: number;
      };
      error.code = 'TOKEN_RATE_LIMIT';
      error.retryAfter = Math.ceil(err.msBeforeNext / 1000);
      throw error;
    }
    throw err;
  }
}

/**
 * Zero-cost check to see if the bot is already over the token limit.
 * Call BEFORE dispatching the tool to avoid wasting a call.
 * Returns { allowed: false, retryAfter } if already at limit.
 */
export async function checkTokenRateLimit(botId: string): Promise<RateLimitResult> {
  try {
    await tokensLimiter.consume(botId, 0);
    return { allowed: true };
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return { allowed: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    throw err;
  }
}
