import { Router } from 'express';
import { heartbeatRuns } from '@paperclipai/db';
import { bots, councilVerdicts, db as akasaDefaultDb } from '@claw/db';
import { eq, inArray, gt, and } from 'drizzle-orm';
import { runCouncilForBot } from '../council/council-runner.js';
import { processSkillLearningForExecution } from '../services/skill-learning.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnyDb = {
  select: (...args: unknown[]) => {
    from: (...args: unknown[]) => {
      where: (...args: unknown[]) => {
        limit?: (...args: unknown[]) => Promise<unknown[]>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// ─── checkAndTriggerCouncilEvaluations ────────────────────────────────────────

/**
 * Poll Paperclip's heartbeat_runs table for completed runs linked to Akasa bots
 * that have no council verdict yet. Trigger async council evaluation for each.
 *
 * Runs query: heartbeat_runs WHERE status IN ('succeeded','failed')
 *   AND finishedAt > (now - 5 minutes)
 *
 * For each completed run:
 * 1. Check if Akasa has a bot with paperclipAgentId = run.agentId
 * 2. If bot found, check if council_verdicts already exists for (botId)
 * 3. If no verdict, fire-and-forget runCouncilForBot (per coding conventions)
 *
 * Returns { triggered: N } where N = number of evaluations triggered.
 */
export async function checkAndTriggerCouncilEvaluations(
  paperclipDb: AnyDb,
  akasaDb: AnyDb,
): Promise<{ triggered: number }> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

  // Query completed runs from Paperclip DB
  const completedRuns = await (paperclipDb as ReturnType<typeof import('@paperclipai/db')['createDb']>)
    .select({
      runId: heartbeatRuns.id,
      agentId: heartbeatRuns.agentId,
      companyId: heartbeatRuns.companyId,
      usageJson: heartbeatRuns.usageJson,
      resultJson: heartbeatRuns.resultJson,
    })
    .from(heartbeatRuns)
    .where(
      and(
        inArray(heartbeatRuns.status, ['succeeded', 'failed']),
        gt(heartbeatRuns.finishedAt, cutoff),
      ),
    );

  let triggered = 0;

  for (const run of completedRuns) {
    try {
      // Find Akasa bot with matching paperclipAgentId
      const akasaBots = await (akasaDb as ReturnType<typeof import('@claw/db')['db']['select']>)
        .select({
          id: bots.id,
          executionId: bots.executionId,
          soulId: bots.soulId,
        })
        .from(bots)
        .where(eq(bots.paperclipAgentId, run.agentId))
        .limit(1) as Array<{ id: string; executionId: string; soulId: string | null }>;

      if (akasaBots.length === 0) {
        // No Akasa bot for this Paperclip agent — skip
        continue;
      }

      const bot = akasaBots[0]!;

      // Check if verdict already exists for this bot
      const existingVerdicts = await (akasaDb as ReturnType<typeof import('@claw/db')['db']['select']>)
        .select({ id: councilVerdicts.id })
        .from(councilVerdicts)
        .where(eq(councilVerdicts.botId, bot.id))
        .limit(1) as Array<{ id: string }>;

      if (existingVerdicts.length > 0) {
        // Verdict already exists — skip
        continue;
      }

      // No verdict yet — trigger council evaluation and skill learning (fire-and-forget per coding conventions)
      triggered++;
      runCouncilForBot(bot.executionId, bot.id, bot.soulId)
        .then(() => {
          // Chain skill learning after council completes successfully
          processSkillLearningForExecution(bot.executionId, bot.id, bot.soulId).catch((err) => {
            console.error('[evolution-trigger] Skill learning failed:', {
              botId: bot.id,
              executionId: bot.executionId,
              error: (err as Error).message,
            });
          });
        })
        .catch((err) => {
          console.error('[evolution-trigger] Council evaluation failed:', {
            botId: bot.id,
            error: (err as Error).message,
          });
        });

      console.log('[evolution-trigger] Triggered council for bot:', {
        botId: bot.id,
        agentId: run.agentId,
        runId: run.runId,
      });
    } catch (err) {
      console.error('[evolution-trigger] Error processing run:', {
        runId: run.runId,
        error: (err as Error).message,
      });
    }
  }

  return { triggered };
}

// ─── startEvolutionPolling ────────────────────────────────────────────────────

/**
 * Start the evolution polling loop.
 * Polls heartbeat_runs every intervalMs (default: 60s).
 * Returns the interval handle so it can be cleared.
 */
export function startEvolutionPolling(
  paperclipDb: AnyDb,
  akasaDb: AnyDb,
  intervalMs = 60_000,
): NodeJS.Timeout {
  return setInterval(() => {
    checkAndTriggerCouncilEvaluations(paperclipDb, akasaDb).catch((err) => {
      console.error('[evolution-trigger] Polling cycle failed:', (err as Error).message);
    });
  }, intervalMs);
}

// ─── evolutionTriggerRouter ───────────────────────────────────────────────────

/**
 * Evolution trigger routes.
 * Mounts at /api/akasa/evolution
 *
 * POST /trigger — manually triggers a council evaluation check cycle
 */
export function evolutionTriggerRouter(): Router {
  const router = Router();

  // POST /api/akasa/evolution/trigger
  router.post('/trigger', async (_req, res, next) => {
    try {
      // Use the default akasa DB; the paperclip DB is not available here at route level
      // without being injected — for the manual trigger, we create a minimal paperclip DB
      // from the environment variable (same pattern as souls-injector lazy creation).
      const DATABASE_URL = process.env['DATABASE_URL'];
      if (!DATABASE_URL) {
        res.status(500).json({ error: 'DATABASE_URL not configured' });
        return;
      }

      const { createDb } = await import('@paperclipai/db');
      const paperclipDb = createDb(DATABASE_URL) as unknown as AnyDb;

      const result = await checkAndTriggerCouncilEvaluations(paperclipDb, akasaDefaultDb as unknown as AnyDb);

      res.json({ triggered: result.triggered });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
