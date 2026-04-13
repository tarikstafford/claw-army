import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, toolInvocationLogs, webhookRoutingRules } from '@claw/db';
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

  // ── POST /logs/:id/retry — re-evaluate routing for a failed webhook log entry ─
  router.post('/logs/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Log ID is required' });
        return;
      }

      const rows = await db
        .select()
        .from(toolInvocationLogs)
        .where(eq(toolInvocationLogs.id, id))
        .limit(1);

      const logEntry = rows[0];
      if (!logEntry) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
      }

      if (!logEntry.userId || !logEntry.toolId) {
        res.status(400).json({ error: 'Log entry is missing userId or toolId' });
        return;
      }

      // Fetch active routing rules for this user and tool
      const rules = await db
        .select()
        .from(webhookRoutingRules)
        .where(
          and(
            eq(webhookRoutingRules.userId, logEntry.userId),
            eq(webhookRoutingRules.toolId, logEntry.toolId),
            eq(webhookRoutingRules.isActive, true),
          ),
        );

      // Extract event type from action (e.g., "webhook:contact.created" -> "contact.created")
      const eventType = logEntry.action.startsWith('webhook:')
        ? logEntry.action.slice('webhook:'.length)
        : logEntry.action;

      // Find matching rule
      const matchedRule = rules.find((rule) => rule.eventType === eventType || rule.eventType === '*');

      if (!matchedRule) {
        res.json({
          success: false,
          reason: 'no_matching_rule',
          message: `No active routing rule matches event type "${eventType}"`,
        });
        return;
      }

      // Log the retry attempt
      await db.insert(toolInvocationLogs).values({
        toolId: logEntry.toolId,
        action: `webhook:${logEntry.toolId}:retry`,
        agentId: matchedRule.assignToAgentId,
        userId: logEntry.userId,
        connectionId: logEntry.connectionId,
        success: true,
        requestSummary: `retry for original log ${id}, event_type=${eventType}`,
      });

      // Best-effort agent notification
      if (matchedRule.assignToAgentId) {
        const port = Number(process.env['PORT'] ?? '3100');
        try {
          const wakeupRes = await fetch(
            `http://localhost:${port}/api/agents/${matchedRule.assignToAgentId}/wakeup`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'webhook',
                triggerDetail: `webhook:${logEntry.toolId}:retry event_type=${eventType}`,
                payload: { originalLogId: id },
              }),
            },
          );
          if (!wakeupRes.ok) {
            res.json({
              success: false,
              reason: 'agent_notification_failed',
              message: `Rule matched but agent notification failed with status ${wakeupRes.status}`,
              matchedRule: {
                id: matchedRule.id,
                eventType: matchedRule.eventType,
                assignToAgentId: matchedRule.assignToAgentId,
              },
            });
            return;
          }
        } catch (fetchErr) {
          res.json({
            success: false,
            reason: 'agent_notification_failed',
            message: `Rule matched but agent notification failed: ${(fetchErr as Error).message}`,
            matchedRule: {
              id: matchedRule.id,
              eventType: matchedRule.eventType,
              assignToAgentId: matchedRule.assignToAgentId,
            },
          });
          return;
        }
      }

      res.json({
        success: true,
        message: `Retry dispatched to agent ${matchedRule.assignToAgentId}`,
        matchedRule: {
          id: matchedRule.id,
          eventType: matchedRule.eventType,
          assignToAgentId: matchedRule.assignToAgentId,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
