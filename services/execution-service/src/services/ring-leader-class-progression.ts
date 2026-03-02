import { db, ringLeaderRuns, ringLeaderFitness, agentClasses } from '@claw/db';
import { RING_LEADER_PROMOTION_THRESHOLDS } from '@claw/shared-types';
import { eq, and, sql } from 'drizzle-orm';

// ─── Return Type ───────────────────────────────────────────────────────────────

export interface RingLeaderPromotionResult {
  promoted: boolean;
  previousClass: 'Novice' | 'Understudy' | 'Artisan';
  newClass: 'Novice' | 'Understudy' | 'Artisan';
  reason: string;
  runCount: number;
  qualifyingRunCount?: number; // only for Understudy->Artisan
}

// ─── Params Interface ──────────────────────────────────────────────────────────

export interface RingLeaderPromotionParams {
  soulId: string;
  ringLeaderRunId: string;
  compositeScore: number;
}

// ─── Helper: Count qualifying runs for Understudy->Artisan gate ───────────────

/**
 * Count how many completed runs for this soul have an average soul selection
 * score >= minSoulSelectionScore (0.75).
 *
 * Soul selection score is the average of the 5 JSONB dimensions:
 *   librarySearchQuality, differentiationEffectiveness, mutationDecisionQuality,
 *   pioneerHandling, selectionRetrospectiveQuality
 */
async function countQualifyingRuns(
  soulId: string,
  minSoulSelectionScore: number,
): Promise<number> {
  // Join ring_leader_fitness with ring_leader_runs to filter by soulId
  // Compute avg of 5 dimensions from the JSONB soulSelectionScore column
  const result = await db.execute<{ qualifying_count: string }>(sql`
    SELECT COUNT(*) AS qualifying_count
    FROM ring_leader_fitness rlf
    INNER JOIN ring_leader_runs rlr ON rlr.id = rlf.ring_leader_run_id
    WHERE rlr.soul_id = ${soulId}
      AND rlr.status = 'completed'
      AND (
        (
          COALESCE((rlf.soul_selection_score->>'librarySearchQuality')::numeric, 0) +
          COALESCE((rlf.soul_selection_score->>'differentiationEffectiveness')::numeric, 0) +
          COALESCE((rlf.soul_selection_score->>'mutationDecisionQuality')::numeric, 0) +
          COALESCE((rlf.soul_selection_score->>'pioneerHandling')::numeric, 0) +
          COALESCE((rlf.soul_selection_score->>'selectionRetrospectiveQuality')::numeric, 0)
        ) / 5.0
      ) >= ${minSoulSelectionScore}
  `);

  const row = result.rows[0];
  return row ? parseInt(row.qualifying_count, 10) : 0;
}

// ─── Public Export ─────────────────────────────────────────────────────────────

/**
 * Evaluate Ring Leader class promotion thresholds after a fitness score has been
 * computed and persisted (FIT-05, PRD Section 10).
 *
 * Promotion paths:
 *   Novice -> Understudy: 4 completed runs + composite score >= 0.68
 *   Understudy -> Artisan: 9 completed runs + composite score >= 0.85
 *                          + >= 6 runs where avg soul selection score >= 0.75
 *
 * Ring Leader class progression is INDEPENDENT from bot agent class-machine.ts.
 * Bot agents are promoted via council verdicts. Ring Leaders are promoted based
 * on accumulated fitness scores. The soulId links to agent_classes (botId column).
 *
 * Non-fatal: if something goes wrong, the caller should catch and log as WARN.
 *
 * @param params - soulId, ringLeaderRunId, compositeScore from the just-completed run
 * @returns RingLeaderPromotionResult describing whether promotion occurred
 */
export async function evaluateRingLeaderPromotion(
  params: RingLeaderPromotionParams,
): Promise<RingLeaderPromotionResult> {
  const { soulId, compositeScore } = params;

  // ── Early exit: no soul assigned ────────────────────────────────────────────
  if (!soulId) {
    return {
      promoted: false,
      previousClass: 'Novice',
      newClass: 'Novice',
      reason: 'No soul assigned',
      runCount: 0,
    };
  }

  // ── Step 1: Fetch (or create) the agent_classes row for this Ring Leader ────
  // Ring Leaders store their soulId in the botId column (task category = 'ring_leader')
  let [classRow] = await db
    .select()
    .from(agentClasses)
    .where(
      and(
        eq(agentClasses.botId, soulId),
        eq(agentClasses.taskCategory, 'ring_leader'),
      ),
    )
    .limit(1);

  if (!classRow) {
    // Insert a new Novice entry for this Ring Leader soul
    const [inserted] = await db
      .insert(agentClasses)
      .values({
        botId: soulId,
        taskCategory: 'ring_leader',
        currentClass: 'Novice',
      })
      .returning();
    classRow = inserted!;
  }

  const currentClass = classRow.currentClass as 'Novice' | 'Understudy' | 'Artisan';

  // Artisan is the terminal class — no further promotion possible
  if (currentClass === 'Artisan') {
    console.info(
      `[ring-leader-class] No promotion for soulId=${soulId} class=Artisan (already at terminal class)`,
    );
    return {
      promoted: false,
      previousClass: 'Artisan',
      newClass: 'Artisan',
      reason: 'Already at terminal class Artisan',
      runCount: 0,
    };
  }

  // ── Step 2: Count total completed runs for this soul ────────────────────────
  const countResult = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(ringLeaderRuns)
    .where(
      and(
        eq(ringLeaderRuns.soulId, soulId),
        eq(ringLeaderRuns.status, 'completed'),
      ),
    );
  const runCount = parseInt(countResult[0]?.count ?? '0', 10);

  // ── Step 3: Evaluate Novice -> Understudy ───────────────────────────────────
  if (currentClass === 'Novice') {
    const { minRuns, minConfidence } = RING_LEADER_PROMOTION_THRESHOLDS.noviceToUnderstudy;

    if (runCount >= minRuns && compositeScore >= minConfidence) {
      // Promote to Understudy
      await db
        .update(agentClasses)
        .set({
          currentClass: 'Understudy',
          lastTransitionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agentClasses.botId, soulId),
            eq(agentClasses.taskCategory, 'ring_leader'),
          ),
        );

      console.info(
        `[ring-leader-class] Promoted soulId=${soulId} from Novice to Understudy after ${runCount} runs`,
      );

      return {
        promoted: true,
        previousClass: 'Novice',
        newClass: 'Understudy',
        reason: `Passed Novice->Understudy gate: runCount=${runCount} >= ${minRuns}, compositeScore=${compositeScore} >= ${minConfidence}`,
        runCount,
      };
    }

    // Log which threshold was not met
    const reasons: string[] = [];
    if (runCount < minRuns) reasons.push(`runCount=${runCount} < ${minRuns} required`);
    if (compositeScore < minConfidence)
      reasons.push(`compositeScore=${compositeScore} < ${minConfidence} required`);

    const reason = reasons.join('; ');
    console.info(
      `[ring-leader-class] No promotion for soulId=${soulId} class=${currentClass} runCount=${runCount} composite=${compositeScore} — ${reason}`,
    );

    return {
      promoted: false,
      previousClass: 'Novice',
      newClass: 'Novice',
      reason,
      runCount,
    };
  }

  // ── Step 4: Evaluate Understudy -> Artisan ──────────────────────────────────
  if (currentClass === 'Understudy') {
    const { minRuns, minConfidence, minSoulSelectionScore, qualifyingRunsRequired } =
      RING_LEADER_PROMOTION_THRESHOLDS.understudyToArtisan;

    const runsOk = runCount >= minRuns;
    const confidenceOk = compositeScore >= minConfidence;

    // Only count qualifying runs if the basic gates pass (avoids DB query on obvious failure)
    let qualifyingRunCount = 0;
    if (runsOk && confidenceOk) {
      qualifyingRunCount = await countQualifyingRuns(soulId, minSoulSelectionScore);
    }

    const qualifyingOk = qualifyingRunCount >= qualifyingRunsRequired;

    if (runsOk && confidenceOk && qualifyingOk) {
      // Promote to Artisan
      await db
        .update(agentClasses)
        .set({
          currentClass: 'Artisan',
          lastTransitionAt: new Date(),
          artisanGraduationAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agentClasses.botId, soulId),
            eq(agentClasses.taskCategory, 'ring_leader'),
          ),
        );

      console.info(
        `[ring-leader-class] Promoted soulId=${soulId} from Understudy to Artisan after ${runCount} runs`,
      );

      return {
        promoted: true,
        previousClass: 'Understudy',
        newClass: 'Artisan',
        reason: `Passed Understudy->Artisan gate: runCount=${runCount} >= ${minRuns}, compositeScore=${compositeScore} >= ${minConfidence}, qualifyingRuns=${qualifyingRunCount} >= ${qualifyingRunsRequired}`,
        runCount,
        qualifyingRunCount,
      };
    }

    // Log which thresholds were not met
    const reasons: string[] = [];
    if (!runsOk) reasons.push(`runCount=${runCount} < ${minRuns} required`);
    if (!confidenceOk)
      reasons.push(`compositeScore=${compositeScore} < ${minConfidence} required`);
    if (runsOk && confidenceOk && !qualifyingOk)
      reasons.push(
        `qualifyingRuns=${qualifyingRunCount} < ${qualifyingRunsRequired} required (soul selection avg >= ${minSoulSelectionScore})`,
      );

    const reason = reasons.join('; ');
    console.info(
      `[ring-leader-class] No promotion for soulId=${soulId} class=${currentClass} runCount=${runCount} composite=${compositeScore} — ${reason}`,
    );

    return {
      promoted: false,
      previousClass: 'Understudy',
      newClass: 'Understudy',
      reason,
      runCount,
      qualifyingRunCount: runsOk && confidenceOk ? qualifyingRunCount : undefined,
    };
  }

  // Unreachable — TypeScript exhaustion guard
  return {
    promoted: false,
    previousClass: currentClass,
    newClass: currentClass,
    reason: 'Unknown class state',
    runCount,
  };
}
