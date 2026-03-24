import { Router } from 'express';
import { db, councilVerdicts } from '@claw/db';
import { eq, desc } from 'drizzle-orm';

/**
 * Council verdict CRUD routes.
 * Mounts at /api/akasa/verdicts
 *
 * GET /         — List verdicts for a given executionId (required query param)
 * GET /:id      — Get single verdict by UUID, returns 404 if not found
 */
export function councilRouter(): Router {
  const router = Router();

  // GET /api/akasa/verdicts?executionId=<uuid>
  router.get('/', async (req, res, next) => {
    try {
      const { executionId } = req.query;

      if (!executionId || typeof executionId !== 'string') {
        res.status(400).json({ error: 'executionId query param is required' });
        return;
      }

      const verdicts = await db
        .select()
        .from(councilVerdicts)
        .where(eq(councilVerdicts.executionId, executionId))
        .orderBy(desc(councilVerdicts.createdAt));

      res.json(verdicts);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/akasa/verdicts/:id
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;

      const rows = await db
        .select()
        .from(councilVerdicts)
        .where(eq(councilVerdicts.id, id))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: `Verdict ${id} not found` });
        return;
      }

      res.json(rows[0]!);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
