import {
  db,
  executions,
  evolutionCampaigns,
  evolutionCampaignIterations,
} from "@claw/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  computeExecutionFitness,
  allVerdictsProcessed,
} from "./execution-fitness";
import {
  evaluateHaltCriteria,
  type HaltDecision,
} from "./campaign-halt-criteria";
import { evolutionCampaignQueue } from "../queue/evolution-campaign-queue";

/**
 * Post-verdict hook called by god-layer-worker after it finishes processing
 * a single verdict. Closes the Karpathy Loop (issue #74).
 *
 * Flow:
 *   1. Look up the execution → campaign link. If no campaign, exit.
 *   2. Check whether every verdict for this execution has finished its
 *      god-layer pass. If not, exit — wait for the last one.
 *   3. Atomically claim the iteration row
 *      (UPDATE ... WHERE completed_at IS NULL RETURNING ...). Only one
 *      worker wins; others exit cleanly.
 *   4. Compute the Execution Fitness Score (EFS) for the iteration.
 *   5. Update the iteration row with EFS breakdown + delta_from_previous.
 *   6. Update campaign.best_efs_score + completed_iteration_count.
 *   7. Evaluate halt criteria against the fresh iteration state.
 *   8. If halt: mark campaign stopped.
 *      Else: enqueue evolution-campaign-queue for the next iteration.
 *
 * Any failure in this hook is logged but NOT rethrown — the god-layer job
 * itself already succeeded and should not be retried just because the
 * campaign loop had an issue. A campaign that hits an internal error is
 * marked 'halted_error' so it stops cleanly instead of spinning.
 */
export async function runEvolutionCampaignHook(
  executionId: string,
): Promise<void> {
  try {
    // 1. Resolve execution → campaign
    const [execRow] = await db
      .select({
        id: executions.id,
        evolutionCampaignId: executions.evolutionCampaignId,
      })
      .from(executions)
      .where(eq(executions.id, executionId));

    if (!execRow) {
      console.warn(
        "[evolution-hook] execution not found, skipping",
        executionId,
      );
      return;
    }
    if (!execRow.evolutionCampaignId) {
      // Not part of a campaign — nothing to do.
      return;
    }

    const campaignId = execRow.evolutionCampaignId;

    // 2. Gate: only proceed if all verdicts for this execution are done
    const ready = await allVerdictsProcessed(executionId);
    if (!ready) {
      return;
    }

    // 3. Atomically claim the iteration row. The unique(execution_id) index
    //    ensures there is exactly one row per execution. Whoever wins the
    //    UPDATE ... WHERE completed_at IS NULL is the sole worker that
    //    continues; everyone else exits cleanly.
    const claimedRows = await db
      .update(evolutionCampaignIterations)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(evolutionCampaignIterations.executionId, executionId),
          isNull(evolutionCampaignIterations.completedAt),
        ),
      )
      .returning({
        id: evolutionCampaignIterations.id,
        iterationNum: evolutionCampaignIterations.iterationNum,
        campaignId: evolutionCampaignIterations.campaignId,
      });

    if (claimedRows.length === 0) {
      // Another worker already processed this iteration — silent exit.
      return;
    }

    const claimed = claimedRows[0]!;
    const iterationNum = claimed.iterationNum;

    // 4. Compute EFS
    const fitness = await computeExecutionFitness(executionId);

    // 5. Look up previous iteration's EFS for delta computation
    const previousEfs = await getPreviousIterationEfs(campaignId, iterationNum);
    const deltaFromPrevious =
      previousEfs === null ? null : fitness.efs - previousEfs;

    // Persist fitness breakdown onto the iteration row. completedAt is
    // already set from the claim update; this just fills in the scores.
    await db
      .update(evolutionCampaignIterations)
      .set({
        efsScore: fitness.efs.toFixed(4),
        successRate: fitness.successRate.toFixed(4),
        costEfficiency: fitness.costEfficiency.toFixed(4),
        speed: fitness.speed.toFixed(4),
        councilHealth: fitness.councilHealth.toFixed(4),
        deltaFromPrevious:
          deltaFromPrevious === null ? null : deltaFromPrevious.toFixed(4),
      })
      .where(eq(evolutionCampaignIterations.id, claimed.id));

    // 6. Update campaign aggregates: best_efs_score (only if improved),
    //    and completed_iteration_count (always increment).
    await db
      .update(evolutionCampaigns)
      .set({
        completedIterationCount: sql`${evolutionCampaigns.completedIterationCount} + 1`,
        bestEfsScore: sql`CASE
          WHEN ${evolutionCampaigns.bestEfsScore} IS NULL
            OR ${evolutionCampaigns.bestEfsScore} < ${fitness.efs.toFixed(4)}::numeric
          THEN ${fitness.efs.toFixed(4)}::numeric
          ELSE ${evolutionCampaigns.bestEfsScore}
        END`,
        updatedAt: new Date(),
      })
      .where(eq(evolutionCampaigns.id, campaignId));

    // 7. Evaluate halt criteria
    const decision = await evaluateHaltCriteria({
      campaignId,
      currentEfs: fitness.efs,
      currentIterationNum: iterationNum,
    });

    // Record the halt reason on this iteration row (if any) so the UI
    // can surface why the loop stopped at iteration N.
    if (decision.halt && decision.reason) {
      await db
        .update(evolutionCampaignIterations)
        .set({ haltedReason: decision.reason })
        .where(eq(evolutionCampaignIterations.id, claimed.id));
    }

    // 8. Terminal or continue
    if (decision.halt) {
      await markCampaignStopped(campaignId, decision);
      console.log("[evolution-hook] campaign halted", {
        campaignId,
        iterationNum,
        reason: decision.reason,
        detail: decision.detail,
        efs: fitness.efs,
      });
      return;
    }

    // Enqueue the next iteration.
    await evolutionCampaignQueue.add(
      "next-iteration",
      {
        campaignId,
        previousIterationNum: iterationNum,
        previousExecutionId: executionId,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );

    console.log("[evolution-hook] enqueued next iteration", {
      campaignId,
      previousIterationNum: iterationNum,
      efs: fitness.efs,
      delta: deltaFromPrevious,
    });
  } catch (err) {
    console.error("[evolution-hook] hook failed (non-fatal)", {
      executionId,
      err,
    });
  }
}

async function getPreviousIterationEfs(
  campaignId: string,
  currentIterationNum: number,
): Promise<number | null> {
  if (currentIterationNum <= 1) return null;
  const [row] = await db
    .select({ efsScore: evolutionCampaignIterations.efsScore })
    .from(evolutionCampaignIterations)
    .where(
      and(
        eq(evolutionCampaignIterations.campaignId, campaignId),
        eq(evolutionCampaignIterations.iterationNum, currentIterationNum - 1),
      ),
    );
  if (!row || row.efsScore === null) return null;
  return Number(row.efsScore);
}

function decisionReasonToCampaignStatus(
  reason: HaltDecision["reason"],
):
  | "completed_success"
  | "completed_max"
  | "halted_regression"
  | "halted_plateau"
  | "halted_budget"
  | "halted_error" {
  switch (reason) {
    case "completed_success":
      return "completed_success";
    case "completed_max":
      return "completed_max";
    case "halted_regression":
      return "halted_regression";
    case "halted_plateau":
      return "halted_plateau";
    case "halted_budget":
      return "halted_budget";
    default:
      return "halted_error";
  }
}

async function markCampaignStopped(
  campaignId: string,
  decision: HaltDecision,
): Promise<void> {
  const status = decisionReasonToCampaignStatus(decision.reason);
  await db
    .update(evolutionCampaigns)
    .set({
      status,
      stoppedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(evolutionCampaigns.id, campaignId));
}
