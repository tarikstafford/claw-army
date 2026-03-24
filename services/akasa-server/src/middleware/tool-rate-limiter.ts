import type { Request, Response, NextFunction } from 'express';
import { db, toolConnections } from '@claw/db';
import { eq, and } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolRateLimiterOpts {
  windowMs?: number;
  maxRequests?: number;
}

interface BucketEntry {
  count: number;
  resetAt: number; // Unix timestamp in ms
}

// ─── In-memory store ──────────────────────────────────────────────────────────
// Acceptable for single-process akasa-server. For multi-process, migrate to Redis.
const buckets = new Map<string, BucketEntry>();

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Express middleware for per-user per-tool rate limiting.
 * Defaults: 100 requests per 60-second window per (userId, toolId) pair.
 *
 * On limit exceeded:
 * - Updates connection status to 'rate_limited' in DB (fire-and-forget)
 * - Returns 429 with retryAfter seconds
 */
export function toolRateLimiter(opts?: ToolRateLimiterOpts) {
  const windowMs = opts?.windowMs ?? 60 * 1000; // 60 seconds
  const maxRequests = opts?.maxRequests ?? 100;

  return function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Extract userId and toolId from various locations
    const userId =
      (req.query['userId'] as string | undefined) ??
      (req.body as Record<string, unknown> | undefined)?.['userId'] as string | undefined;

    const toolId =
      (req.params['toolId'] as string | undefined) ??
      (req.body as Record<string, unknown> | undefined)?.['toolId'] as string | undefined;

    // If we can't identify the user/tool, skip rate limiting (fail-open per CLAUDE.md)
    if (!userId || !toolId) {
      next();
      return;
    }

    const key = `${userId}:${toolId}`;
    const now = Date.now();

    let bucket = buckets.get(key);

    // Initialize or reset expired bucket
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= maxRequests) {
      const secondsRemaining = Math.ceil((bucket.resetAt - now) / 1000);

      // Fire-and-forget: update connection status to 'rate_limited'
      db.update(toolConnections)
        .set({
          status: 'rate_limited',
          rateLimitResetAt: new Date(bucket.resetAt),
          updatedAt: new Date(),
        })
        .where(and(eq(toolConnections.userId, userId), eq(toolConnections.toolId, toolId)))
        .catch((err: unknown) => {
          console.warn('[tool-rate-limiter] Failed to update rate_limited status:', {
            userId,
            toolId,
            error: (err as Error).message,
          });
        });

      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: secondsRemaining,
      });
      return;
    }

    bucket.count++;
    next();
  };
}
