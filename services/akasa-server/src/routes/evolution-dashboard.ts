import { Router } from 'express';
import { db, agentClasses, councilVerdicts, bots, botSouls, categoryBenchmarks, dnaStore } from '@claw/db';
import { eq, and, desc, asc, count, isNotNull, sql, avg } from 'drizzle-orm';

/**
 * Evolution Dashboard API routes.
 * Mounts at /api/akasa/evolution
 *
 * GET /fleet         — Fleet overview with classCounts, scoreHistory, averageCompositeScore, pendingVerdictCount
 * GET /agents        — Agent list with currentClass, compositeScore, isPioneer, lastVerdictAt
 * GET /bots/:botId/timeline — Merged timeline of verdict, class_transition, dna_capture events
 * GET /bots/:botId/lineage  — Soul ancestry chain (root-first, max depth 10)
 * GET /bots/:botId/ledger   — Run-by-run experiment ledger with scoreDelta and keepDiscard
 * GET /benchmarks    — All category benchmarks with thinDataFlag and benchmarkMature
 * GET /pending       — Only verdicts where requiresHumanConfirmation=true AND status=pending
 */
export function evolutionDashboardRouter(): Router {
  const router = Router();

  // ── GET /fleet ──────────────────────────────────────────────────────────────

  router.get('/fleet', async (_req, res, next) => {
    try {
      // 1. Class counts
      const classCountRows = await db
        .select({
          currentClass: agentClasses.currentClass,
          rowCount: count(),
        })
        .from(agentClasses)
        .groupBy(agentClasses.currentClass);

      const classCounts: Record<string, number> = {
        Novice: 0,
        Understudy: 0,
        Artisan: 0,
        Retired: 0,
      };

      let totalBots = 0;
      for (const row of classCountRows) {
        const n = Number(row.rowCount);
        classCounts[row.currentClass] = n;
        totalBots += n;
      }

      // 2. Score history — daily avg from council_verdicts (last 30 days)
      const scoreHistoryRows = await db
        .select({
          date: sql<string>`DATE(${councilVerdicts.createdAt})::text`,
          score: sql<string>`AVG(${councilVerdicts.weightedConfidenceScore})::text`,
        })
        .from(councilVerdicts)
        .where(isNotNull(councilVerdicts.weightedConfidenceScore))
        .groupBy(sql`DATE(${councilVerdicts.createdAt})`)
        .orderBy(asc(sql`DATE(${councilVerdicts.createdAt})`))
        .limit(30);

      const scoreHistory = scoreHistoryRows.map((r) => ({ date: r.date, score: r.score }));

      // 3. Average composite score from bots with non-null scores
      const avgRows = await db
        .select({ avgScore: sql<string>`AVG(${bots.compositeScore})::text` })
        .from(bots)
        .where(isNotNull(bots.compositeScore));

      const averageCompositeScore = avgRows[0]?.avgScore ?? null;

      // 4. Pending verdict count (requiresHumanConfirmation AND status=pending)
      const pendingRows = await db
        .select({ pendingCount: sql<string>`COUNT(*)::text` })
        .from(councilVerdicts)
        .where(
          and(
            eq(councilVerdicts.requiresHumanConfirmation, true),
            eq(councilVerdicts.status, 'pending'),
          ),
        );

      const pendingVerdictCount = Number(pendingRows[0]?.pendingCount ?? 0);

      res.json({
        classCounts,
        totalBots,
        averageCompositeScore,
        pendingVerdictCount,
        scoreHistory,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /agents ─────────────────────────────────────────────────────────────

  router.get('/agents', async (_req, res, next) => {
    try {
      // Query agent_classes with a JOIN to bots for compositeScore and the latest verdict date
      const agentRows = await db
        .select({
          botId: agentClasses.botId,
          currentClass: agentClasses.currentClass,
          isPioneer: agentClasses.isPioneer,
          taskCategory: agentClasses.taskCategory,
          compositeScore: bots.compositeScore,
          lastVerdictAt: sql<string | null>`MAX(${councilVerdicts.createdAt})`,
        })
        .from(agentClasses)
        .orderBy(desc(agentClasses.updatedAt));

      res.json(agentRows);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /bots/:botId/timeline ────────────────────────────────────────────────

  router.get('/bots/:botId/timeline', async (req, res, next) => {
    try {
      const { botId } = req.params;

      // 1. Verdict events
      const verdictRows = await db
        .select({
          id: councilVerdicts.id,
          verdictType: councilVerdicts.verdictType,
          status: councilVerdicts.status,
          weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
          verdictSummary: councilVerdicts.verdictSummary,
          createdAt: councilVerdicts.createdAt,
        })
        .from(councilVerdicts)
        .where(eq(councilVerdicts.botId, botId));

      const verdictEvents = verdictRows.map((r) => ({
        id: r.id,
        type: 'verdict' as const,
        timestamp: r.createdAt,
        summary: r.verdictSummary,
        verdictType: r.verdictType,
        status: r.status,
        compositeScore: r.weightedConfidenceScore,
      }));

      // 2. Class transition events
      const transitionRows = await db
        .select({
          id: agentClasses.id,
          currentClass: agentClasses.currentClass,
          lastTransitionAt: agentClasses.lastTransitionAt,
          taskCategory: agentClasses.taskCategory,
        })
        .from(agentClasses)
        .where(
          and(
            eq(agentClasses.botId, botId),
            isNotNull(agentClasses.lastTransitionAt),
          ),
        );

      const transitionEvents = transitionRows.map((r) => ({
        id: r.id,
        type: 'class_transition' as const,
        timestamp: r.lastTransitionAt!,
        summary: `Transitioned to ${r.currentClass} in ${r.taskCategory}`,
        newClass: r.currentClass,
      }));

      // 3. DNA capture events
      const dnaRows = await db
        .select({
          id: dnaStore.id,
          objectiveCategory: dnaStore.objectiveCategory,
          compositeScore: dnaStore.compositeScore,
          capturedAt: dnaStore.capturedAt,
        })
        .from(dnaStore)
        .where(eq(dnaStore.botId, botId));

      const dnaEvents = dnaRows.map((r) => ({
        id: r.id,
        type: 'dna_capture' as const,
        timestamp: r.capturedAt,
        summary: `DNA captured for ${r.objectiveCategory}`,
        compositeScore: r.compositeScore,
      }));

      // Merge and sort by timestamp DESC
      const allEvents = [...verdictEvents, ...transitionEvents, ...dnaEvents];
      allEvents.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      });

      res.json(allEvents);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /bots/:botId/lineage ─────────────────────────────────────────────────

  router.get('/bots/:botId/lineage', async (req, res, next) => {
    try {
      const { botId } = req.params;

      // Get the bot's current soulId
      const botRows = await db
        .select({ soulId: bots.soulId })
        .from(bots)
        .where(eq(bots.id, botId))
        .limit(1);

      const startingSoulId = botRows[0]?.soulId;

      if (!startingSoulId) {
        res.json([]);
        return;
      }

      // Walk the parentSoulId chain (max depth 10)
      const MAX_DEPTH = 10;
      const chain: Array<{
        id: string;
        label: string;
        generation: number;
        isArchetype: boolean;
        isPioneer: boolean;
      }> = [];

      let currentSoulId: string | null = startingSoulId;
      let depth = 0;

      while (currentSoulId && depth < MAX_DEPTH) {
        const soulRows = await db
          .select({
            id: botSouls.id,
            parentSoulId: botSouls.parentSoulId,
            isArchetype: botSouls.isArchetype,
            archetypeName: botSouls.archetypeName,
            generation: botSouls.generation,
            contentHash: botSouls.contentHash,
          })
          .from(botSouls)
          .where(eq(botSouls.id, currentSoulId))
          .limit(1);

        const soul = soulRows[0];
        if (!soul) break;

        chain.push({
          id: soul.id,
          label: soul.archetypeName ?? soul.contentHash.slice(0, 8),
          generation: soul.generation,
          isArchetype: soul.isArchetype,
          isPioneer: false, // Pioneer status is per bot-category, not per soul
        });

        currentSoulId = soul.parentSoulId;
        depth++;
      }

      // Reverse to root-first order
      chain.reverse();

      res.json(chain);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /bots/:botId/ledger ──────────────────────────────────────────────────

  router.get('/bots/:botId/ledger', async (req, res, next) => {
    try {
      const { botId } = req.params;

      const verdictRows = await db
        .select({
          id: councilVerdicts.id,
          executionId: councilVerdicts.executionId,
          verdictType: councilVerdicts.verdictType,
          status: councilVerdicts.status,
          weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
          createdAt: councilVerdicts.createdAt,
          soulId: councilVerdicts.soulId,
        })
        .from(councilVerdicts)
        .where(eq(councilVerdicts.botId, botId))
        .orderBy(asc(councilVerdicts.createdAt));

      let previousScore: number | null = null;

      const ledger = verdictRows.map((row) => {
        const currentScore = parseFloat(row.weightedConfidenceScore);
        const scoreDelta = previousScore === null ? null : currentScore - previousScore;
        previousScore = currentScore;

        // Determine keepDiscard
        let keepDiscard: 'keep' | 'discard' | 'pending';
        if (row.status === 'confirmed') {
          if (['Promote', 'Maintain'].includes(row.verdictType)) {
            keepDiscard = 'keep';
          } else {
            keepDiscard = 'discard';
          }
        } else {
          keepDiscard = 'pending';
        }

        return {
          executionId: row.executionId,
          executionDate: row.createdAt,
          compositeScore: row.weightedConfidenceScore,
          scoreDelta: scoreDelta !== null ? scoreDelta.toFixed(2) : null,
          verdictType: row.verdictType,
          status: row.status,
          keepDiscard,
          mutationApplied: row.soulId !== null,
        };
      });

      res.json(ledger);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /benchmarks ──────────────────────────────────────────────────────────

  router.get('/benchmarks', async (_req, res, next) => {
    try {
      const benchmarkRows = await db.select().from(categoryBenchmarks);
      res.json(benchmarkRows);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /pending ─────────────────────────────────────────────────────────────

  router.get('/pending', async (_req, res, next) => {
    try {
      const pendingRows = await db
        .select({
          id: councilVerdicts.id,
          botId: councilVerdicts.botId,
          verdictType: councilVerdicts.verdictType,
          verdictSummary: councilVerdicts.verdictSummary,
          weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
          performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
          soulAnalystOutput: councilVerdicts.soulAnalystOutput,
          devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
          createdAt: councilVerdicts.createdAt,
        })
        .from(councilVerdicts)
        .where(
          and(
            eq(councilVerdicts.requiresHumanConfirmation, true),
            eq(councilVerdicts.status, 'pending'),
          ),
        )
        .orderBy(desc(councilVerdicts.createdAt));

      res.json(pendingRows);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
