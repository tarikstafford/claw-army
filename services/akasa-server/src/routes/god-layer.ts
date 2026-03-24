/**
 * God Layer Routes
 *
 * Confirm/reject verdict routes that trigger the God Layer.
 * Mounts at /api/akasa/verdicts
 *
 * PATCH /:id/confirm — Confirms a pending verdict and triggers God Layer
 * PATCH /:id/reject  — Rejects a pending verdict (no God Layer triggered)
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, councilVerdicts } from '@claw/db';
import { executeGodLayer } from '../god-layer/god-layer-handler.js';

/**
 * God Layer verdict confirm/reject routes.
 * Mounts alongside councilRouter at /api/akasa/verdicts.
 */
export function godLayerRouter(): Router {
  const router = Router();

  // PATCH /api/akasa/verdicts/:id/confirm
  router.patch('/:id/confirm', async (req, res, next) => {
    try {
      const { id } = req.params;

      // Load the verdict
      const rows = await db
        .select()
        .from(councilVerdicts)
        .where(eq(councilVerdicts.id, id!))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: `Verdict ${id} not found` });
        return;
      }

      const verdict = rows[0]!;

      // Check status: must be pending to confirm
      if (verdict.status !== 'pending') {
        res.status(409).json({
          error: 'Verdict already processed',
          status: verdict.status,
        });
        return;
      }

      // Update verdict status to confirmed
      await db
        .update(councilVerdicts)
        .set({
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: (req.body as { confirmedBy?: string })?.confirmedBy ?? 'system',
          updatedAt: new Date(),
        } as any)
        .where(eq(councilVerdicts.id, id!));

      // Trigger God Layer
      const godLayerResult = await executeGodLayer(id!);
      console.log('[god-layer-router] God Layer result:', { verdictId: id, ...godLayerResult });

      res.json({ confirmed: true, godLayerResult });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/akasa/verdicts/:id/reject
  router.patch('/:id/reject', async (req, res, next) => {
    try {
      const { id } = req.params;

      // Load the verdict
      const rows = await db
        .select()
        .from(councilVerdicts)
        .where(eq(councilVerdicts.id, id!))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: `Verdict ${id} not found` });
        return;
      }

      const verdict = rows[0]!;

      // Check status: must be pending to reject
      if (verdict.status !== 'pending') {
        res.status(409).json({
          error: 'Verdict already processed',
          status: verdict.status,
        });
        return;
      }

      // Update verdict status to rejected (no God Layer triggered)
      await db
        .update(councilVerdicts)
        .set({
          status: 'rejected',
          confirmedAt: new Date(),
          confirmedBy: (req.body as { confirmedBy?: string })?.confirmedBy ?? 'system',
          updatedAt: new Date(),
        } as any)
        .where(eq(councilVerdicts.id, id!));

      res.json({ rejected: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
