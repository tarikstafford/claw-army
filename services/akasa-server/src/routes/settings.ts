import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, userPreferences, apiKeys, authUsers } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';

interface UpdatePreferencesBody {
  emailEvolutionEvents?: boolean;
  emailBudgetAlerts?: boolean;
  emailSkillEvents?: boolean;
  inAppEvolutionEvents?: boolean;
  inAppBudgetAlerts?: boolean;
  inAppSkillEvents?: boolean;
  budgetAlertThreshold50?: boolean;
  budgetAlertThreshold75?: boolean;
  budgetAlertThreshold90?: boolean;
}

interface CreateApiKeyBody {
  name: string;
}

function getUserId(req: Request): string | null {
  return (req as Request & { userId?: string }).userId ?? null;
}

export function settingsRouter(): Router {
  const router = Router();

  router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rows = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: 'Preferences not found' });
        return;
      }

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const body = req.body as UpdatePreferencesBody;
      const now = new Date();

      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userPreferences).values({
          userId,
          emailEvolutionEvents: body.emailEvolutionEvents ?? true,
          emailBudgetAlerts: body.emailBudgetAlerts ?? true,
          emailSkillEvents: body.emailSkillEvents ?? true,
          inAppEvolutionEvents: body.inAppEvolutionEvents ?? true,
          inAppBudgetAlerts: body.inAppBudgetAlerts ?? true,
          inAppSkillEvents: body.inAppSkillEvents ?? true,
          budgetAlertThreshold50: body.budgetAlertThreshold50 ?? true,
          budgetAlertThreshold75: body.budgetAlertThreshold75 ?? true,
          budgetAlertThreshold90: body.budgetAlertThreshold90 ?? true,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await db
          .update(userPreferences)
          .set({
            ...(body.emailEvolutionEvents !== undefined && { emailEvolutionEvents: body.emailEvolutionEvents }),
            ...(body.emailBudgetAlerts !== undefined && { emailBudgetAlerts: body.emailBudgetAlerts }),
            ...(body.emailSkillEvents !== undefined && { emailSkillEvents: body.emailSkillEvents }),
            ...(body.inAppEvolutionEvents !== undefined && { inAppEvolutionEvents: body.inAppEvolutionEvents }),
            ...(body.inAppBudgetAlerts !== undefined && { inAppBudgetAlerts: body.inAppBudgetAlerts }),
            ...(body.inAppSkillEvents !== undefined && { inAppSkillEvents: body.inAppSkillEvents }),
            ...(body.budgetAlertThreshold50 !== undefined && { budgetAlertThreshold50: body.budgetAlertThreshold50 }),
            ...(body.budgetAlertThreshold75 !== undefined && { budgetAlertThreshold75: body.budgetAlertThreshold75 }),
            ...(body.budgetAlertThreshold90 !== undefined && { budgetAlertThreshold90: body.budgetAlertThreshold90 }),
            updatedAt: now,
          })
          .where(eq(userPreferences.userId, userId));
      }

      const updated = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const keys = await db
        .select({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          name: apiKeys.name,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, userId), eq(apiKeys.revokedAt, null)))
        .orderBy(apiKeys.createdAt);

      res.json(keys);
    } catch (err) {
      next(err);
    }
  });

  router.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const body = req.body as CreateApiKeyBody;
      if (!body.name || typeof body.name !== 'string') {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const rawKey = `aka_${randomBytes(24).toString('hex')}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.slice(0, 8);
      const id = randomBytes(12).toString('hex');
      const now = new Date();

      await db.insert(apiKeys).values({
        id,
        userId,
        keyHash,
        keyPrefix,
        name: body.name,
        createdAt: now,
      });

      res.status(201).json({ id, key: rawKey, keyPrefix, name: body.name, createdAt: now });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/api-keys/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), eq(apiKeys.revokedAt, null)));

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rows = await db
        .select({ id: authUsers.id, name: authUsers.name, email: authUsers.email, image: authUsers.image })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/account', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await db.delete(authUsers).where(eq(authUsers.id, userId));

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
