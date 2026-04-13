import { Router } from 'express';
import { db, agentClasses, councilVerdicts, bots, botSouls, categoryBenchmarks, dnaStore, tasks, executions, agentRuntimeState, paperclipAgents } from '@claw/db';
import { eq, and, desc, asc, count, isNotNull, sql, avg, gte, lte } from 'drizzle-orm';

/**
 * Evolution Dashboard API routes.
 * Mounts at /api/akasa/evolution
 *
 * GET /fleet         — Fleet overview with classCounts, scoreHistory, averageCompositeScore, pendingVerdictCount
 * GET /fleet/events  — Chronological feed of fleet events (verdicts, class transitions, DNA captures, pioneers)
 * GET /agents        — Agent list with currentClass, compositeScore, isPioneer, lastVerdictAt
 * GET /bots/:botId/profile  — Full bot profile with soul dimensions, class, pioneer status, archetype
 * GET /bots/:botId/timeline — Merged timeline of verdict, class_transition, dna_capture events
 * GET /bots/:botId/lineage  — Soul ancestry chain (root-first, max depth 10)
 * GET /bots/:botId/ledger   — Run-by-run experiment ledger with scoreDelta and keepDiscard
 * GET /bots/:botId/runtime  — Token consumption, cost, budget utilization from Paperclip shared DB
 * GET /org           — Hierarchical fleet tree (fleet -> category -> class_tier -> agent)
 * GET /benchmarks    — All category benchmarks with thinDataFlag and benchmarkMature
 * GET /pending       — Only verdicts where requiresHumanConfirmation=true AND status=pending
 * GET /delegations   — Delegation chains from task assignments, grouped by execution (filterable by executionId, date range)
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

  // ── GET /fleet/events ────────────────────────────────────────────────────────

  router.get('/fleet/events', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 100);
      const eventTypes = (req.query['types'] as string ?? 'verdict,class_transition,dna_capture,pioneer').split(',');

      const events: Array<{
        id: string;
        type: string;
        botId?: string;
        executionId?: string;
        soulId?: string;
        taskCategory?: string;
        verdictType?: string;
        fromClass?: string;
        toClass?: string;
        transitionType?: string;
        compositeScore?: string;
        isPioneer?: boolean;
        description: string;
        timestamp: string;
      }> = [];

      if (eventTypes.includes('verdict')) {
        const verdictRows = await db
          .select({
            id: councilVerdicts.id,
            botId: councilVerdicts.botId,
            executionId: councilVerdicts.executionId,
            verdictType: councilVerdicts.verdictType,
            status: councilVerdicts.status,
            verdictSummary: councilVerdicts.verdictSummary,
            createdAt: councilVerdicts.createdAt,
          })
          .from(councilVerdicts)
          .where(eq(councilVerdicts.status, 'confirmed'))
          .orderBy(desc(councilVerdicts.createdAt))
          .limit(limit);

        for (const r of verdictRows) {
          if (r.status === 'confirmed') {
            events.push({
              id: r.id,
              type: 'fleet.verdict.confirmed',
              botId: r.botId,
              executionId: r.executionId,
              taskCategory: 'unknown',
              verdictType: r.verdictType,
              description: r.verdictSummary ?? `Verdict: ${r.verdictType}`,
              timestamp: r.createdAt.toISOString(),
            });
          }
        }
      }

      if (eventTypes.includes('class_transition')) {
        const transitionRows = await db
          .select({
            id: agentClasses.id,
            botId: agentClasses.botId,
            currentClass: agentClasses.currentClass,
            lastTransitionAt: agentClasses.lastTransitionAt,
            taskCategory: agentClasses.taskCategory,
            aboveBenchmarkCount: agentClasses.aboveBenchmarkCount,
            belowBenchmarkCount: agentClasses.belowBenchmarkCount,
          })
          .from(agentClasses)
          .where(isNotNull(agentClasses.lastTransitionAt))
          .orderBy(desc(agentClasses.lastTransitionAt))
          .limit(limit);

        for (const r of transitionRows) {
          const fromClass = 'Novice';
          const toClass = r.currentClass;
          let transitionType: string = 'maintain';

          if (r.aboveBenchmarkCount > r.belowBenchmarkCount && r.currentClass !== 'Novice') {
            transitionType = 'promote';
          } else if (r.belowBenchmarkCount > r.aboveBenchmarkCount) {
            transitionType = 'demote';
          }

          events.push({
            id: r.id,
            type: 'fleet.class.transition',
            botId: r.botId,
            taskCategory: r.taskCategory ?? 'unknown',
            fromClass,
            toClass,
            transitionType,
            description: `Agent transitioned to ${toClass} in ${r.taskCategory}`,
            timestamp: r.lastTransitionAt!.toISOString(),
          });
        }
      }

      if (eventTypes.includes('dna_capture')) {
        const dnaRows = await db
          .select({
            id: dnaStore.id,
            botId: dnaStore.botId,
            executionId: dnaStore.executionId,
            soulId: dnaStore.soulId,
            objectiveCategory: dnaStore.objectiveCategory,
            compositeScore: dnaStore.compositeScore,
            capturedAt: dnaStore.capturedAt,
          })
          .from(dnaStore)
          .orderBy(desc(dnaStore.capturedAt))
          .limit(limit);

        for (const r of dnaRows) {
          events.push({
            id: r.id,
            type: 'fleet.dna.captured',
            botId: r.botId,
            executionId: r.executionId,
            soulId: r.soulId ?? undefined,
            taskCategory: r.objectiveCategory ?? 'unknown',
            compositeScore: r.compositeScore,
            description: `New DNA pattern captured for ${r.objectiveCategory}`,
            timestamp: r.capturedAt.toISOString(),
          });
        }
      }

      if (eventTypes.includes('pioneer')) {
        const pioneerRows = await db
          .select({
            id: agentClasses.id,
            botId: agentClasses.botId,
            taskCategory: agentClasses.taskCategory,
            isPioneer: agentClasses.isPioneer,
            updatedAt: agentClasses.updatedAt,
          })
          .from(agentClasses)
          .where(eq(agentClasses.isPioneer, true))
          .orderBy(desc(agentClasses.updatedAt))
          .limit(limit);

        for (const r of pioneerRows) {
          events.push({
            id: r.id,
            type: 'fleet.pioneer.detected',
            botId: r.botId,
            taskCategory: r.taskCategory ?? 'unknown',
            isPioneer: true,
            description: `Agent is a pioneer in ${r.taskCategory} — first confirmed run`,
            timestamp: r.updatedAt.toISOString(),
          });
        }
      }

      events.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      });

      res.json(events.slice(0, limit));
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
        .leftJoin(bots, eq(agentClasses.botId, bots.id))
        .leftJoin(councilVerdicts, eq(agentClasses.botId, councilVerdicts.botId))
        .groupBy(agentClasses.botId, agentClasses.currentClass, agentClasses.isPioneer, agentClasses.taskCategory, agentClasses.updatedAt, bots.compositeScore)
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
          performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
          soulAnalystOutput: councilVerdicts.soulAnalystOutput,
          devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
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
        performanceJudgeOutput: r.performanceJudgeOutput,
        soulAnalystOutput: r.soulAnalystOutput,
        devilsAdvocateOutput: r.devilsAdvocateOutput,
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
        parentSoulId: string | null;
      }> = [];

      let currentSoulId: string | null = startingSoulId;
      let depth = 0;

      while (currentSoulId && depth < MAX_DEPTH) {
        const soulRows: Array<{
          id: string;
          parentSoulId: string | null;
          isArchetype: boolean;
          archetypeName: string | null;
          generation: number;
          contentHash: string;
        }> = await db
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

        const soul: typeof soulRows[number] | undefined = soulRows[0];
        if (!soul) break;

        chain.push({
          id: soul.id,
          label: soul.archetypeName ?? soul.contentHash.slice(0, 8),
          generation: soul.generation,
          isArchetype: soul.isArchetype,
          isPioneer: false,
          parentSoulId: soul.parentSoulId,
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
          soulId: row.soulId,
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

  // ── GET /bots/:botId/profile ─────────────────────────────────────────────────

  router.get('/bots/:botId/profile', async (req, res, next) => {
    try {
      const { botId } = req.params;

      // Query bots LEFT JOIN agentClasses LEFT JOIN botSouls
      const profileRows = await db
        .select({
          id: bots.id,
          compositeScore: bots.compositeScore,
          soulId: bots.soulId,
          status: bots.status,
          currentClass: agentClasses.currentClass,
          isPioneer: agentClasses.isPioneer,
          taskCategory: agentClasses.taskCategory,
          lastTransitionAt: agentClasses.lastTransitionAt,
          artisanGraduationAt: agentClasses.artisanGraduationAt,
          classCreatedAt: agentClasses.createdAt,
          soulContent: botSouls.soulContent,
          dimensions: botSouls.dimensions,
          constitutionDirectives: botSouls.constitutionDirectives,
          generation: botSouls.generation,
          archetypeName: botSouls.archetypeName,
          isArchetype: botSouls.isArchetype,
        })
        .from(bots)
        .leftJoin(agentClasses, eq(agentClasses.botId, bots.id))
        .leftJoin(botSouls, eq(botSouls.id, bots.soulId))
        .where(eq(bots.id, botId))
        .limit(1);

      const row = profileRows[0];
      if (!row) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }

      // Build simplified classHistory from the single agentClasses row
      const classHistory: Array<{ class: string; transitionAt: string | Date; category: string | null }> = [];
      if (row.classCreatedAt) {
        classHistory.push({
          class: 'Novice',
          transitionAt: row.classCreatedAt,
          category: row.taskCategory ?? null,
        });
      }
      if (row.lastTransitionAt && row.currentClass && row.currentClass !== 'Novice') {
        classHistory.push({
          class: row.currentClass,
          transitionAt: row.lastTransitionAt,
          category: row.taskCategory ?? null,
        });
      }

      res.json({
        botId: row.id,
        compositeScore: row.compositeScore,
        status: row.status,
        currentClass: row.currentClass ?? null,
        isPioneer: row.isPioneer ?? false,
        taskCategory: row.taskCategory ?? null,
        archetypeName: row.archetypeName ?? null,
        soulId: row.soulId ?? null,
        soulContent: row.soulContent ?? null,
        dimensions: row.dimensions ?? null,
        constitutionDirectives: row.constitutionDirectives ?? null,
        generation: row.generation ?? null,
        classHistory,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /org ─────────────────────────────────────────────────────────────────

  router.get('/org', async (_req, res, next) => {
    try {
      // Query agentClasses LEFT JOIN bots to get all agents with category, class, and bot metadata
      const orgRows = await db
        .select({
          botId: agentClasses.botId,
          currentClass: agentClasses.currentClass,
          isPioneer: agentClasses.isPioneer,
          taskCategory: agentClasses.taskCategory,
          compositeScore: bots.compositeScore,
          status: bots.status,
        })
        .from(agentClasses)
        .leftJoin(bots, eq(bots.id, agentClasses.botId));

      // Build hierarchy in application code: fleet -> category -> class_tier -> agent
      // categoryMap: taskCategory -> (currentClass -> agents[])
      const categoryMap = new Map<string, Map<string, Array<{
        id: string;
        label: string;
        type: 'agent';
        botId: string;
        currentClass: string;
        compositeScore: string | null;
        status: string | null;
      }>>>();

      for (const row of orgRows) {
        const category = row.taskCategory ?? 'uncategorized';
        const currentClass = row.currentClass;

        if (!categoryMap.has(category)) {
          categoryMap.set(category, new Map());
        }
        const classMap = categoryMap.get(category)!;

        if (!classMap.has(currentClass)) {
          classMap.set(currentClass, []);
        }

        classMap.get(currentClass)!.push({
          id: `agent:${row.botId}`,
          label: row.botId.slice(0, 8),
          type: 'agent',
          botId: row.botId,
          currentClass,
          compositeScore: row.compositeScore ?? null,
          status: row.status ?? null,
        });
      }

      // Convert nested maps to the d3-hierarchy-compatible single root object
      const children = Array.from(categoryMap.entries()).map(([category, classMap]) => ({
        id: `category:${category}`,
        label: category,
        type: 'category' as const,
        children: Array.from(classMap.entries()).map(([currentClass, agents]) => ({
          id: `class:${category}:${currentClass}`,
          label: currentClass,
          type: 'class_tier' as const,
          children: agents,
        })),
      }));

      res.json({
        id: 'fleet',
        label: 'Fleet',
        type: 'fleet',
        children,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /bots/:botId/runtime ──────────────────────────────────────────────────

  router.get('/bots/:botId/runtime', async (req, res, next) => {
    try {
      const { botId } = req.params;

      // 1. Look up bots.paperclipAgentId from Akasa DB
      const botRows = await db
        .select({ paperclipAgentId: bots.paperclipAgentId })
        .from(bots)
        .where(eq(bots.id, botId))
        .limit(1);

      const bot = botRows[0];
      if (!bot || !bot.paperclipAgentId) {
        // Graceful degradation — no Paperclip agent linked
        res.json(null);
        return;
      }

      const { paperclipAgentId } = bot;

      // 2. Query runtime state and agent budget in parallel (same DB)
      const [runtimeRows, agentRows] = await Promise.all([
        db
          .select({
            sessionId: agentRuntimeState.sessionId,
            lastRunStatus: agentRuntimeState.lastRunStatus,
            totalInputTokens: agentRuntimeState.totalInputTokens,
            totalOutputTokens: agentRuntimeState.totalOutputTokens,
            totalCachedInputTokens: agentRuntimeState.totalCachedInputTokens,
            totalCostCents: agentRuntimeState.totalCostCents,
            lastError: agentRuntimeState.lastError,
            updatedAt: agentRuntimeState.updatedAt,
          })
          .from(agentRuntimeState)
          .where(eq(agentRuntimeState.agentId, paperclipAgentId))
          .limit(1),
        db
          .select({
            budgetMonthlyCents: paperclipAgents.budgetMonthlyCents,
            spentMonthlyCents: paperclipAgents.spentMonthlyCents,
          })
          .from(paperclipAgents)
          .where(eq(paperclipAgents.id, paperclipAgentId))
          .limit(1),
      ]);

      const runtime = runtimeRows[0];
      if (!runtime) {
        res.json(null);
        return;
      }

      const agentBudget = agentRows[0];
      const budgetMonthlyCents = agentBudget?.budgetMonthlyCents ?? 0;
      const spentMonthlyCents = agentBudget?.spentMonthlyCents ?? 0;
      const budgetUtilization =
        budgetMonthlyCents > 0
          ? Math.round((spentMonthlyCents / budgetMonthlyCents) * 100)
          : null;

      res.json({
        sessionId: runtime.sessionId ?? null,
        lastRunStatus: runtime.lastRunStatus ?? null,
        totalInputTokens: runtime.totalInputTokens,
        totalOutputTokens: runtime.totalOutputTokens,
        totalCachedInputTokens: runtime.totalCachedInputTokens,
        totalCostCents: runtime.totalCostCents,
        budgetMonthlyCents,
        spentMonthlyCents,
        budgetUtilization,
        lastError: runtime.lastError ?? null,
        updatedAt: runtime.updatedAt,
      });
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


  // ── GET /delegations ──────────────────────────────────────────────────────────
  // Builds delegation chains from tasks table: which bot was assigned what task,
  // grouped by execution. Supports optional executionId and date range filters.

  router.get('/delegations', async (req, res, next) => {
    try {
      const executionId = req.query['executionId'] as string | undefined;
      const from = req.query['from'] as string | undefined;
      const to = req.query['to'] as string | undefined;

      const conditions = [];
      if (executionId) {
        conditions.push(eq(tasks.executionId, executionId));
      }
      if (from) {
        conditions.push(gte(tasks.createdAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte(tasks.createdAt, new Date(to)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const taskRows = await db
        .select({
          taskId: tasks.id,
          taskDescription: tasks.description,
          taskStatus: tasks.status,
          executionId: tasks.executionId,
          claimedByBotId: tasks.claimedByBotId,
          ringLeaderTaskId: tasks.ringLeaderTaskId,
          createdAt: tasks.createdAt,
          botStatus: bots.status,
          botCompositeScore: bots.compositeScore,
          botTier: bots.tier,
          executionObjective: executions.objective,
        })
        .from(tasks)
        .leftJoin(bots, eq(tasks.claimedByBotId, bots.id))
        .leftJoin(executions, eq(tasks.executionId, executions.id))
        .where(whereClause)
        .orderBy(desc(tasks.createdAt))
        .limit(500);

      const executionMap = new Map<string, {
        executionId: string;
        objective: string;
        delegations: Array<{
          taskId: string;
          description: string;
          status: string;
          assignedBotId: string | null;
          botTier: string | null;
          botCompositeScore: string | null;
          ringLeaderTaskId: string | null;
          createdAt: string;
        }>;
      }>();

      for (const row of taskRows) {
        if (!executionMap.has(row.executionId)) {
          executionMap.set(row.executionId, {
            executionId: row.executionId,
            objective: row.executionObjective ?? 'Unknown objective',
            delegations: [],
          });
        }

        executionMap.get(row.executionId)!.delegations.push({
          taskId: row.taskId,
          description: row.taskDescription,
          status: row.taskStatus,
          assignedBotId: row.claimedByBotId,
          botTier: row.botTier,
          botCompositeScore: row.botCompositeScore,
          ringLeaderTaskId: row.ringLeaderTaskId,
          createdAt: row.createdAt.toISOString(),
        });
      }

      const allDelegations = taskRows.filter((r) => r.claimedByBotId !== null);
      const completedDelegations = allDelegations.filter((r) => r.taskStatus === 'completed');
      const totalDelegations = allDelegations.length;
      const successRate = totalDelegations > 0
        ? Math.round((completedDelegations.length / totalDelegations) * 100)
        : 0;

      let totalDepth = 0;
      let depthCount = 0;
      for (const [, exec] of executionMap) {
        const depth = exec.delegations.length;
        totalDepth += depth;
        depthCount++;
      }
      const avgDepth = depthCount > 0 ? Math.round((totalDepth / depthCount) * 10) / 10 : 0;

      res.json({
        chains: Array.from(executionMap.values()),
        stats: {
          totalDelegations,
          successRate,
          avgDepth,
          executionCount: executionMap.size,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
