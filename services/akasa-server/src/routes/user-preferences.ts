import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, userPreferences } from '@claw/db';
import { eq } from 'drizzle-orm';

interface UpdatePreferencesBody {
  userId: string;
  displayName?: string;
  evolutionEvents?: boolean;
  budgetAlerts?: boolean;
  skillEvents?: boolean;
}

export function userPreferencesRouter(): Router {
  const router = Router();

  router.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const rows = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      const prefs = rows[0];
      if (!prefs) {
        res.status(404).json({ error: 'Preferences not found' });
        return;
      }

      res.json(prefs);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdatePreferencesBody;
      if (!body.userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, body.userId))
        .limit(1);

      if (existing[0]) {
        const updated = await db
          .update(userPreferences)
          .set({
            displayName: body.displayName ?? existing[0].displayName,
            evolutionEvents: body.evolutionEvents !== undefined
              ? String(body.evolutionEvents)
              : existing[0].evolutionEvents,
            budgetAlerts: body.budgetAlerts !== undefined
              ? String(body.budgetAlerts)
              : existing[0].budgetAlerts,
            skillEvents: body.skillEvents !== undefined
              ? String(body.skillEvents)
              : existing[0].skillEvents,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, body.userId))
          .returning();

        res.json(updated[0]);
      } else {
        const created = await db
          .insert(userPreferences)
          .values({
            userId: body.userId,
            displayName: body.displayName ?? null,
            evolutionEvents: String(body.evolutionEvents ?? true),
            budgetAlerts: String(body.budgetAlerts ?? true),
            skillEvents: String(body.skillEvents ?? true),
          })
          .returning();

        res.status(201).json(created[0]);
      }
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const body = req.body as Partial<UpdatePreferencesBody>;
      const updatePayload: Record<string, unknown> = { updatedAt: new Date() };

      if (body.displayName !== undefined) updatePayload.displayName = body.displayName;
      if (body.evolutionEvents !== undefined) updatePayload.evolutionEvents = String(body.evolutionEvents);
      if (body.budgetAlerts !== undefined) updatePayload.budgetAlerts = String(body.budgetAlerts);
      if (body.skillEvents !== undefined) updatePayload.skillEvents = String(body.skillEvents);

      const updated = await db
        .update(userPreferences)
        .set(updatePayload as typeof userPreferences.$inferInsert)
        .where(eq(userPreferences.userId, userId))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: 'Preferences not found' });
        return;
      }

      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
