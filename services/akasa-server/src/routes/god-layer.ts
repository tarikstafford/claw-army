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
import { db, councilVerdicts, bots } from '@claw/db';
import { executeGodLayer } from '../god-layer/god-layer-handler.js';
import { publishLiveEvent } from '../../../../paperclip/server/src/services/live-events.js';

interface FleetEventPayload {
  verdictId: string;
  botId: string;
  executionId: string;
  taskCategory: string;
  verdictType: string;
  compositeScore?: string;
  description: string;
}

async function emitFleetEvents(
  paperclipDb: Awaited<ReturnType<typeof import('@paperclipai/db')['createDb']>>,
  companyId: string,
  payload: FleetEventPayload,
): Promise<void> {
  const { verdictId, botId, executionId, taskCategory, verdictType, compositeScore, description } = payload;

  publishLiveEvent({
    companyId,
    type: 'fleet.verdict.confirmed',
    payload: {
      verdictId,
      botId,
      executionId,
      verdictType,
      description: `Verdict ${verdictType} confirmed for agent`,
      timestamp: new Date().toISOString(),
    },
  });

  if (verdictType === 'Promote' || verdictType === 'Maintain') {
    publishLiveEvent({
      companyId,
      type: 'fleet.class.transition',
      payload: {
        verdictId,
        botId,
        executionId,
        taskCategory,
        verdictType,
        description: `Agent transitioned: ${description}`,
        timestamp: new Date().toISOString(),
      },
    });
  }

  if (compositeScore && parseFloat(compositeScore) >= 0.7 && (verdictType === 'Promote' || verdictType === 'Maintain')) {
    publishLiveEvent({
      companyId,
      type: 'fleet.dna.captured',
      payload: {
        verdictId,
        botId,
        executionId,
        taskCategory,
        description: `Behavioral DNA captured for agent in ${taskCategory} tasks`,
        timestamp: new Date().toISOString(),
      },
    });
  }

  if (verdictType === 'Promote') {
    publishLiveEvent({
      companyId,
      type: 'fleet.pioneer.detected',
      payload: {
        verdictId,
        botId,
        executionId,
        taskCategory,
        description: `Agent is a pioneer — first confirmed run in ${taskCategory} tasks`,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

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

      // Load bot to get paperclipAgentId
      const botRows = await db
        .select()
        .from(bots)
        .where(eq(bots.id, verdict.botId))
        .limit(1);

      const bot = botRows[0];

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

      // Emit fleet events if we have companyId
      if (bot?.paperclipAgentId) {
        const DATABASE_URL = process.env['DATABASE_URL'];
        if (DATABASE_URL) {
          try {
            const { createDb } = await import('@paperclipai/db');
            const { agents } = await import('@paperclipai/db');
            const paperclipDb = createDb(DATABASE_URL);

            const agentRows = await paperclipDb
              .select({ companyId: agents.companyId })
              .from(agents)
              .where(eq(agents.id, bot.paperclipAgentId!))
              .limit(1);

            if (agentRows.length > 0 && agentRows[0]) {
              const companyId = agentRows[0].companyId;

              await emitFleetEvents(paperclipDb, companyId, {
                verdictId: verdict.id,
                botId: verdict.botId,
                executionId: verdict.executionId,
                taskCategory: 'general',
                verdictType: verdict.verdictType,
                compositeScore: bot.compositeScore ?? undefined,
                description: verdict.verdictSummary,
              });
            }
          } catch (err) {
            console.error('[god-layer-router] Failed to emit fleet events:', err);
          }
        }
      }

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
