import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, toolInvocationLogs } from '@claw/db';
import { eq, desc, like, and } from 'drizzle-orm';

// ─── Router Factory ───────────────────────────────────────────────────────────

/**
 * Express router factory for aggregated webhook logs.
 * Mount at /akasa/webhooks.
 * Provides GET /logs — all webhook-prefixed invocation logs for a user.
 */
export function webhookLogsRouter(): Router {
  const router = Router();

  // ── GET /logs — aggregated webhook event log for a user ──────────────────────
  router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const logs = await db
        .select()
        .from(toolInvocationLogs)
        .where(and(
          eq(toolInvocationLogs.userId, userId),
          like(toolInvocationLogs.action, 'webhook:%'),
        ))
        .orderBy(desc(toolInvocationLogs.createdAt))
        .limit(100);

      res.json(logs);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
