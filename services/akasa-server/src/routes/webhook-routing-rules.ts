import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, webhookRoutingRules } from '@claw/db';
import { eq, and, desc } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateRuleBody {
  userId: string;
  connectionId: string;
  toolId: string;
  eventType: string;
  condition?: string;
  assignToAgentId?: string;
}

// ─── Router Factory ───────────────────────────────────────────────────────────

/**
 * Express router factory for webhook routing rule CRUD.
 * Mount at /akasa/webhook-routing-rules.
 */
export function webhookRoutingRulesRouter(): Router {
  const router = Router();

  // ── GET / — list all routing rules for a user ────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const rules = await db
        .select()
        .from(webhookRoutingRules)
        .where(eq(webhookRoutingRules.userId, userId))
        .orderBy(desc(webhookRoutingRules.createdAt));

      res.json(rules);
    } catch (err) {
      next(err);
    }
  });

  // ── POST / — create a new routing rule ───────────────────────────────────────
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateRuleBody;
      const { userId, connectionId, toolId, eventType, condition, assignToAgentId } = body;

      if (!userId || !connectionId || !toolId || !eventType) {
        res.status(400).json({ error: 'userId, connectionId, toolId, and eventType are required' });
        return;
      }

      const [created] = await db
        .insert(webhookRoutingRules)
        .values({
          userId,
          connectionId,
          toolId,
          eventType,
          condition: condition ?? null,
          assignToAgentId: assignToAgentId ?? null,
        })
        .returning();

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /:id — delete a routing rule ──────────────────────────────────────
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      const deleted = await db
        .delete(webhookRoutingRules)
        .where(eq(webhookRoutingRules.id, id))
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({ error: 'Routing rule not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
