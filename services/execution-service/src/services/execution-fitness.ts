import { db, councilVerdicts, executions } from "@claw/db";
import { eq, and, inArray } from "drizzle-orm";
import { buildExecutionReport } from "../performance/report-builder";

/**
 * Execution Fitness Score (EFS) — a single 0..1 composite used to rank
 * iterations within an evolution campaign (Karpathy Loop, issue #74).
 *
 * Formula:
 *   EFS = 0.50 * success_rate
 *       + 0.25 * cost_efficiency
 *       + 0.15 * speed
 *       + 0.10 * council_health
 *
 * Weights reflect the product promise: outcome > cost > speed > council opinion.
 * Council gets low weight because it's a derivative signal — it already informs
 * mutation, so double-weighting it would double-count.
 *
 * All sub-scores are clamped to [0, 1].
 */
export interface ExecutionFitness {
  efs: number;
  successRate: number;
  costEfficiency: number;
  speed: number;
  councilHealth: number;
}

const W_SUCCESS = 0.5;
const W_COST = 0.25;
const W_SPEED = 0.15;
const W_COUNCIL = 0.1;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Compute the Execution Fitness Score for a completed execution.
 *
 * @param executionId - the execution to score
 * @returns fitness breakdown with composite EFS in [0, 1]
 */
export async function computeExecutionFitness(
  executionId: string,
): Promise<ExecutionFitness> {
  // Pull execution metadata for cost/runtime caps
  const [execRow] = await db
    .select({
      budgetCapCents: executions.budgetCapCents,
      runtimeLimitSeconds: executions.runtimeLimitSeconds,
      createdAt: executions.createdAt,
      updatedAt: executions.updatedAt,
    })
    .from(executions)
    .where(eq(executions.id, executionId));

  if (!execRow) {
    throw new Error(
      `computeExecutionFitness: execution not found ${executionId}`,
    );
  }

  // Reuse the existing report builder — it already aggregates task counts,
  // cost, and bot stats exactly the way we need.
  const report = await buildExecutionReport(executionId);

  // 1. Success rate: completed tasks / total tasks (0 if no tasks)
  const successRate =
    report.totalTasks === 0
      ? 0
      : clamp01(report.completedTasks / report.totalTasks);

  // 2. Cost efficiency: budget_cap / actual_spend, capped at 1.0
  //    If actual spend == 0, treat as 1.0 (perfect efficiency — nothing wasted)
  //    If budget_cap == 0, treat as 1.0 (no cap to measure against)
  let costEfficiency: number;
  if (report.totalCostCents === 0 || execRow.budgetCapCents === 0) {
    costEfficiency = 1;
  } else {
    costEfficiency = clamp01(execRow.budgetCapCents / report.totalCostCents);
  }

  // 3. Speed: runtime_limit / actual_duration, capped at 1.0
  //    Actual duration is updatedAt - createdAt (assumes terminal state updates
  //    updatedAt, which transitionExecution does).
  const actualDurationSeconds = Math.max(
    1,
    Math.floor(
      (execRow.updatedAt.getTime() - execRow.createdAt.getTime()) / 1000,
    ),
  );
  const speed = clamp01(execRow.runtimeLimitSeconds / actualDurationSeconds);

  // 4. Council health: fraction of verdicts that are Promote or Maintain
  //    (i.e. the Council thinks the bots behaved well)
  const verdictRows = await db
    .select({ verdictType: councilVerdicts.verdictType })
    .from(councilVerdicts)
    .where(eq(councilVerdicts.executionId, executionId));

  let councilHealth: number;
  if (verdictRows.length === 0) {
    // No verdicts yet — neutral score so it doesn't dominate
    councilHealth = 0.5;
  } else {
    const healthyCount = verdictRows.filter(
      (v) => v.verdictType === "Promote" || v.verdictType === "Maintain",
    ).length;
    councilHealth = clamp01(healthyCount / verdictRows.length);
  }

  const efs =
    W_SUCCESS * successRate +
    W_COST * costEfficiency +
    W_SPEED * speed +
    W_COUNCIL * councilHealth;

  return {
    efs: clamp01(efs),
    successRate,
    costEfficiency,
    speed,
    councilHealth,
  };
}

/**
 * Check whether every council_verdict for an execution has been processed by
 * the God Layer (i.e. has a non-null godLayerProcessedAt). Used as the gate
 * before computing EFS — we only want to score a campaign iteration once
 * the last verdict for its execution has finished its God Layer run.
 */
export async function allVerdictsProcessed(
  executionId: string,
): Promise<boolean> {
  const rows = await db
    .select({
      id: councilVerdicts.id,
      godLayerProcessedAt: councilVerdicts.godLayerProcessedAt,
    })
    .from(councilVerdicts)
    .where(eq(councilVerdicts.executionId, executionId));

  if (rows.length === 0) return false; // no verdicts yet — not ready to score
  return rows.every((r) => r.godLayerProcessedAt !== null);
}

/**
 * Narrow typing helper used in tests — re-export of the verdict type literals
 * considered "healthy" by the council_health metric.
 */
export const HEALTHY_VERDICT_TYPES = ["Promote", "Maintain"] as const;
