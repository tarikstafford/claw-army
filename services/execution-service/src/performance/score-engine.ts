import { db, bots, telemetry } from '@claw/db';
import { eq, and, count } from 'drizzle-orm';
import { computeBotMetrics, type BotMetrics } from './metrics-computer';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration constants (env-var configurable)
// ──────────────────────────────────────────────────────────────────────────────

/** Score weights (must sum to 100; normalized before use) */
const WEIGHT_SUCCESS = Number(process.env.SCORE_WEIGHT_SUCCESS ?? 40);
const WEIGHT_EFFICIENCY = Number(process.env.SCORE_WEIGHT_EFFICIENCY ?? 30);
const WEIGHT_COST = Number(process.env.SCORE_WEIGHT_COST ?? 20);
const WEIGHT_STABILITY = Number(process.env.SCORE_WEIGHT_STABILITY ?? 10);

/** Tier assignment thresholds */
const TIER_HIGH_THRESHOLD = Number(process.env.TIER_HIGH_THRESHOLD ?? 75);
const TIER_MEDIUM_THRESHOLD = Number(process.env.TIER_MEDIUM_THRESHOLD ?? 40);

// ──────────────────────────────────────────────────────────────────────────────
// Normalization helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a value in [min, max] to [0, 100] scale.
 * Returns 100 if max === min (all bots equal — give everyone full credit).
 * Higher normalized value = better (min is worst, max is best).
 */
function normalizeHigherIsBetter(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return ((value - min) / (max - min)) * 100;
}

/**
 * Normalize a value in [min, max] to [0, 100] scale where LOWER is better.
 * Returns 100 if max === min (all bots equal — give everyone full credit).
 */
function normalizeLowerIsBetter(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return ((max - value) / (max - min)) * 100;
}

// ──────────────────────────────────────────────────────────────────────────────
// Score computation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the efficiency score for a single bot, normalized against all bots
 * in the execution using min/max normalization.
 *
 * Efficiency components (lower is better for most):
 * - tasks/min: HIGHER is better (more throughput)
 * - tokens/task: LOWER is better (more efficient)
 * - tool_calls/task: LOWER is better (fewer calls needed)
 * - idle_ratio: LOWER is better (more active time)
 *
 * @param metric - Bot's raw metrics
 * @param allMetrics - All bots' metrics for cross-bot normalization
 */
function computeEfficiencyScore(metric: BotMetrics, allMetrics: BotMetrics[]): number {
  const tasksPerMinValues = allMetrics.map((m) => m.tasksPerMinute);
  const tokensPerTaskValues = allMetrics.map((m) => m.tokensPerTask);
  const toolCallsPerTaskValues = allMetrics.map((m) => m.toolCallsPerTask);
  const idleRatioValues = allMetrics.map((m) => m.idleRatio);

  const minTasksPerMin = Math.min(...tasksPerMinValues);
  const maxTasksPerMin = Math.max(...tasksPerMinValues);
  const minTokensPerTask = Math.min(...tokensPerTaskValues);
  const maxTokensPerTask = Math.max(...tokensPerTaskValues);
  const minToolCallsPerTask = Math.min(...toolCallsPerTaskValues);
  const maxToolCallsPerTask = Math.max(...toolCallsPerTaskValues);
  const minIdleRatio = Math.min(...idleRatioValues);
  const maxIdleRatio = Math.max(...idleRatioValues);

  const throughputScore = normalizeHigherIsBetter(metric.tasksPerMinute, minTasksPerMin, maxTasksPerMin);
  const tokenEfficiencyScore = normalizeLowerIsBetter(metric.tokensPerTask, minTokensPerTask, maxTokensPerTask);
  const toolEfficiencyScore = normalizeLowerIsBetter(metric.toolCallsPerTask, minToolCallsPerTask, maxToolCallsPerTask);
  const idleScore = normalizeLowerIsBetter(metric.idleRatio, minIdleRatio, maxIdleRatio);

  // Average all four sub-metrics equally
  return (throughputScore + tokenEfficiencyScore + toolEfficiencyScore + idleScore) / 4;
}

/**
 * Compute the cost efficiency score for a single bot, normalized against all bots.
 *
 * Uses inversion: lower cost_per_task is better.
 * Guard: if all bots have the same cost, return 100.
 * Guard: if bot completed 0 tasks, score is 0 (no useful work done at any cost).
 */
function computeCostEfficiencyScore(metric: BotMetrics, allMetrics: BotMetrics[]): number {
  if (metric.tasksCompleted === 0) return 0;

  const costValues = allMetrics
    .filter((m) => m.tasksCompleted > 0)
    .map((m) => m.costPerTaskCents);

  if (costValues.length === 0) return 0;

  const minCost = Math.min(...costValues);
  const maxCost = Math.max(...costValues);

  return normalizeLowerIsBetter(metric.costPerTaskCents, minCost, maxCost);
}

/**
 * Assign a tier label based on composite score and configurable thresholds.
 */
function assignTier(compositeScore: number): 'high' | 'medium' | 'low' {
  if (compositeScore >= TIER_HIGH_THRESHOLD) return 'high';
  if (compositeScore >= TIER_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

// ──────────────────────────────────────────────────────────────────────────────
// Main exported function
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute, store, and update performance scores for all bots in an execution.
 *
 * Pipeline:
 * 1. Idempotency check — skip if scores already exist in telemetry
 * 2. Load all bot IDs for the execution
 * 3. Compute raw metrics for each bot (from tasks/billing_events/tool_invocations/telemetry)
 * 4. Normalize component scores across all bots
 * 5. Compute weighted composite score and assign tier
 * 6. Store four telemetry rows per bot (success_rate_score, efficiency_score,
 *    cost_efficiency_score, stability_score)
 * 7. Update bots.composite_score and bots.tier
 *
 * @param executionId - UUID of the execution to score
 */
export async function computeScoresForExecution(executionId: string): Promise<void> {
  // ── Idempotency guard: skip if already computed ──────────────────────────────
  const [existingResult] = await db
    .select({ count: count() })
    .from(telemetry)
    .where(and(
      eq(telemetry.executionId, executionId),
      eq(telemetry.metricName, 'success_rate_score'),
    ));

  const existingCount = existingResult?.count ?? 0;
  if (existingCount > 0) {
    console.log('[score-engine] Scores already computed for execution, skipping:', { executionId, existingCount });
    return;
  }

  // ── Load all bots for this execution ─────────────────────────────────────────
  const botRows = await db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.executionId, executionId));

  if (botRows.length === 0) {
    console.log('[score-engine] No bots found for execution, skipping:', { executionId });
    return;
  }

  // ── Compute raw metrics for all bots ─────────────────────────────────────────
  const allMetrics: BotMetrics[] = await Promise.all(
    botRows.map((bot) => computeBotMetrics(executionId, bot.id)),
  );

  // ── Normalize weights ─────────────────────────────────────────────────────────
  const totalWeight = WEIGHT_SUCCESS + WEIGHT_EFFICIENCY + WEIGHT_COST + WEIGHT_STABILITY;
  const wSuccess = WEIGHT_SUCCESS / totalWeight;
  const wEfficiency = WEIGHT_EFFICIENCY / totalWeight;
  const wCost = WEIGHT_COST / totalWeight;
  const wStability = WEIGHT_STABILITY / totalWeight;

  // ── Compute and store scores for each bot ─────────────────────────────────────
  for (const metric of allMetrics) {
    const { botId } = metric;

    // Component scores (all 0-100)
    const successRateScore = metric.successRate * 100;
    const efficiencyScore = computeEfficiencyScore(metric, allMetrics);
    const costEfficiencyScore = computeCostEfficiencyScore(metric, allMetrics);
    const stabilityScore = (1 - metric.errorRate) * 100;

    // Weighted composite
    const composite =
      successRateScore * wSuccess +
      efficiencyScore * wEfficiency +
      costEfficiencyScore * wCost +
      stabilityScore * wStability;

    // Clamp to [0, 100]
    const compositeClamped = Math.max(0, Math.min(100, composite));
    const tier = assignTier(compositeClamped);

    // ── Store four telemetry rows ───────────────────────────────────────────────
    await db.insert(telemetry).values([
      {
        executionId,
        botId,
        metricName: 'success_rate_score',
        metricValue: successRateScore.toFixed(6),
      },
      {
        executionId,
        botId,
        metricName: 'efficiency_score',
        metricValue: efficiencyScore.toFixed(6),
      },
      {
        executionId,
        botId,
        metricName: 'cost_efficiency_score',
        metricValue: costEfficiencyScore.toFixed(6),
      },
      {
        executionId,
        botId,
        metricName: 'stability_score',
        metricValue: stabilityScore.toFixed(6),
      },
    ]);

    // ── Update bots table ───────────────────────────────────────────────────────
    await db
      .update(bots)
      .set({
        compositeScore: compositeClamped.toFixed(2),
        tier,
      })
      .where(eq(bots.id, botId));

    console.log('[score-engine] Scored bot:', {
      botId,
      executionId,
      successRateScore: successRateScore.toFixed(2),
      efficiencyScore: efficiencyScore.toFixed(2),
      costEfficiencyScore: costEfficiencyScore.toFixed(2),
      stabilityScore: stabilityScore.toFixed(2),
      composite: compositeClamped.toFixed(2),
      tier,
    });
  }

  console.log('[score-engine] All bots scored for execution:', {
    executionId,
    botCount: allMetrics.length,
  });
}
