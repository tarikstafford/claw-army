import {
  db,
  evolutionCampaigns,
  evolutionCampaignIterations,
  billingEvents,
} from "@claw/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

/**
 * Halt criteria for an evolution campaign. Evaluated after each iteration's
 * EFS has been computed. If any criterion fires, the campaign stops and the
 * Karpathy Loop does not trigger a next iteration.
 *
 * Criteria (stop on any):
 *   1. iteration_num >= max_iterations        → 'completed_max'
 *   2. cumulative cost >= campaign_budget_cap → 'halted_budget'
 *   3. EFS_N < best_EFS_so_far * 0.90         → 'halted_regression'
 *   4. |delta_N| < 0.03 for 2+ iterations, N >= 3 → 'halted_plateau'
 *   5. EFS_N >= 0.95                          → 'completed_success'
 *
 * Otherwise: HaltDecision.halt = false, the worker enqueues the next iteration.
 */
export type HaltReason =
  | "completed_success"
  | "completed_max"
  | "halted_regression"
  | "halted_plateau"
  | "halted_budget";

export interface HaltDecision {
  halt: boolean;
  reason: HaltReason | null;
  detail: string;
}

const REGRESSION_RATIO = 0.9; // iteration must stay within 90% of the best
const PLATEAU_DELTA_THRESHOLD = 0.03;
const PLATEAU_MIN_ITERATIONS = 3;
const SUCCESS_CEILING = 0.95;

export interface EvaluateHaltInput {
  campaignId: string;
  /** The EFS just computed for the iteration that triggered this evaluation. */
  currentEfs: number;
  /** The iteration_num of the iteration that just completed. */
  currentIterationNum: number;
}

/**
 * Decide whether a campaign should continue after the latest iteration.
 * Pure of side effects — the caller is responsible for persisting the decision.
 */
export async function evaluateHaltCriteria(
  input: EvaluateHaltInput,
): Promise<HaltDecision> {
  const { campaignId, currentEfs, currentIterationNum } = input;

  // Load campaign metadata
  const [campaign] = await db
    .select()
    .from(evolutionCampaigns)
    .where(eq(evolutionCampaigns.id, campaignId));

  if (!campaign) {
    return {
      halt: true,
      reason: null,
      detail: `campaign ${campaignId} not found`,
    };
  }

  // 1. Success ceiling — stop early if we're already near-perfect
  if (currentEfs >= SUCCESS_CEILING) {
    return {
      halt: true,
      reason: "completed_success",
      detail: `EFS ${currentEfs.toFixed(4)} >= ${SUCCESS_CEILING}`,
    };
  }

  // 2. Max iterations — hard cap from campaign config
  if (currentIterationNum >= campaign.maxIterations) {
    return {
      halt: true,
      reason: "completed_max",
      detail: `iteration ${currentIterationNum} reached max ${campaign.maxIterations}`,
    };
  }

  // 3. Campaign budget exhausted — cumulative cost across all iterations
  if (campaign.campaignBudgetCapCents !== null) {
    const spent = await sumCampaignSpend(campaignId);
    if (spent >= campaign.campaignBudgetCapCents) {
      return {
        halt: true,
        reason: "halted_budget",
        detail: `cumulative spend ${spent}¢ >= cap ${campaign.campaignBudgetCapCents}¢`,
      };
    }
  }

  // 4. Regression guard — current EFS dropped >10% below the best so far.
  //    best_efs_score is updated by the caller BEFORE calling this function,
  //    so it already includes currentEfs. We compare to the pre-update best.
  const bestBeforeCurrent = await getBestEfsExcluding(
    campaignId,
    currentIterationNum,
  );
  if (
    bestBeforeCurrent !== null &&
    currentEfs < bestBeforeCurrent * REGRESSION_RATIO
  ) {
    return {
      halt: true,
      reason: "halted_regression",
      detail: `EFS ${currentEfs.toFixed(4)} < ${(bestBeforeCurrent * REGRESSION_RATIO).toFixed(4)} (90% of best ${bestBeforeCurrent.toFixed(4)})`,
    };
  }

  // 5. Plateau detection — last 2 deltas are both tiny AND we have at least
  //    3 iterations under our belt. Stops wasting runs on a flatlined campaign.
  if (currentIterationNum >= PLATEAU_MIN_ITERATIONS) {
    const recentDeltas = await getRecentDeltas(campaignId, 2);
    if (
      recentDeltas.length === 2 &&
      recentDeltas.every((d) => Math.abs(d) < PLATEAU_DELTA_THRESHOLD)
    ) {
      return {
        halt: true,
        reason: "halted_plateau",
        detail: `last 2 deltas under ${PLATEAU_DELTA_THRESHOLD}: [${recentDeltas.map((d) => d.toFixed(4)).join(", ")}]`,
      };
    }
  }

  // Survived every check — keep evolving.
  return {
    halt: false,
    reason: null,
    detail: "continuing",
  };
}

/**
 * Sum billing_events.amount_cents across every execution in a campaign.
 * Uses the same 'tool_invoked' event type as report-builder.ts to stay
 * consistent with the per-execution cost metric.
 */
async function sumCampaignSpend(campaignId: string): Promise<number> {
  const iterationRows = await db
    .select({ executionId: evolutionCampaignIterations.executionId })
    .from(evolutionCampaignIterations)
    .where(eq(evolutionCampaignIterations.campaignId, campaignId));

  if (iterationRows.length === 0) return 0;

  const executionIds = iterationRows.map((r) => r.executionId);

  const [row] = await db
    .select({
      total: sql<number>`cast(coalesce(sum(${billingEvents.amountCents}), 0) as int)`,
    })
    .from(billingEvents)
    .where(
      and(
        inArray(billingEvents.executionId, executionIds),
        eq(billingEvents.eventType, "tool_invoked"),
      ),
    );

  return row?.total ?? 0;
}

/**
 * Return the highest EFS score in the campaign BEFORE the given iteration.
 * Used for the regression guard: comparing current EFS against the best
 * "known-good" iteration.
 */
async function getBestEfsExcluding(
  campaignId: string,
  excludeIterationNum: number,
): Promise<number | null> {
  const [row] = await db
    .select({
      best: sql<string | null>`max(${evolutionCampaignIterations.efsScore})`,
    })
    .from(evolutionCampaignIterations)
    .where(
      and(
        eq(evolutionCampaignIterations.campaignId, campaignId),
        sql`${evolutionCampaignIterations.iterationNum} < ${excludeIterationNum}`,
        sql`${evolutionCampaignIterations.efsScore} IS NOT NULL`,
      ),
    );

  if (!row || row.best === null) return null;
  return Number(row.best);
}

/**
 * Return the delta_from_previous values for the most recent N iterations
 * (newest first). Used for plateau detection.
 */
async function getRecentDeltas(
  campaignId: string,
  count: number,
): Promise<number[]> {
  const rows = await db
    .select({ delta: evolutionCampaignIterations.deltaFromPrevious })
    .from(evolutionCampaignIterations)
    .where(
      and(
        eq(evolutionCampaignIterations.campaignId, campaignId),
        sql`${evolutionCampaignIterations.deltaFromPrevious} IS NOT NULL`,
      ),
    )
    .orderBy(desc(evolutionCampaignIterations.iterationNum))
    .limit(count);

  return rows.map((r) => Number(r.delta));
}
