import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { db, apiKeys } from '@claw/db';
import { eq, and, desc } from 'drizzle-orm';

interface CreateApiKeyBody {
  userId: string;
  name: string;
}

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `aka_${randomBytes(24).toString('hex')}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function apiKeysRouter(): Router {
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
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));

      const safe = rows.map((key) => ({
        id: key.id,
        userId: key.userId,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      }));

      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateApiKeyBody;
      if (!body.userId || !body.name) {
        res.status(400).json({ error: 'userId and name are required' });
        return;
      }

      const { raw, hash, prefix } = generateApiKey();

      const created = await db
        .insert(apiKeys)
        .values({
          userId: body.userId,
          name: body.name,
          keyHash: hash,
          keyPrefix: prefix,
        })
        .returning();

      res.status(201).json({
        id: created[0].id,
        userId: created[0].userId,
        name: created[0].name,
        keyPrefix: created[0].keyPrefix,
        raw,
        lastUsedAt: created[0].lastUsedAt,
        createdAt: created[0].createdAt,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { raw: string };
      if (!body.raw) {
        res.status(400).json({ error: 'raw API key is required' });
        return;
      }

      const hash = hashApiKey(body.raw);
      const rows = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.revokedAt, null)))
        .limit(1);

      const key = rows[0];
      if (!key) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.id, key.id));

      res.json({ valid: true, keyId: key.id });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Key ID is required' });
        return;
      }

      const revoked = await db
        .update(apiKeys)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning();

      if (revoked.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
