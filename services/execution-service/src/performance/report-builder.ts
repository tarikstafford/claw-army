import { db, bots, tasks, billingEvents, telemetry, toolInvocations, agentClasses } from '@claw/db';
import { eq, and, sql, inArray } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// ExecutionReport interface
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Aggregated execution-level analytics computed on demand from DB tables.
 *
 * Data sources:
 * - totalBots: bots table COUNT WHERE execution_id
 * - totalBotHours: telemetry SUM(metric_value) WHERE metric_name = 'bot_hours'
 * - totalCostCents: billing_events SUM(amount_cents) WHERE event_type = 'tool_invoked'
 * - averageBotScore: bots AVG(composite_score) WHERE execution_id
 * - topPerformingBotId: bots ORDER BY composite_score DESC NULLS LAST LIMIT 1
 * - errorDistribution: task_failures (tasks WHERE status='failed') +
 *                      tool_rejections (tool_invocations WHERE rejected=true)
 * - costPerTaskCents: totalCostCents / completedTasks (0 if none)
 * - Task counts: tasks table WHERE execution_id
 *
 * All monetary values are integer cents (project convention).
 * totalBotHours is a float (matching bot_hours metric precision).
 */
export interface ExecutionReport {
  executionId: string;
  totalBots: number;
  totalBotHours: number;                     // sum from telemetry bot_hours rows
  totalCostCents: number;                    // sum from billing_events WHERE event_type = 'tool_invoked'
  averageBotScore: number;                   // average of bots.composite_score for this execution (0-100)
  topPerformingBotId: string | null;         // bot with highest composite_score
  errorDistribution: Record<string, number>; // { "task_failures": N, "tool_rejections": M }
  costPerTaskCents: number;                  // totalCostCents / completed tasks (0 if none)
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  soulTierDistribution: {
    novice: number;
    understudy: number;
    artisan: number;
    retired: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Core aggregation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete execution summary report from existing DB data.
 * Computed on demand — no caching or pre-computation.
 *
 * @param executionId - UUID of the execution to report on
 * @returns ExecutionReport with all aggregated metrics
 */
export async function buildExecutionReport(executionId: string): Promise<ExecutionReport> {
  // ── 1. Total bots ──
  const [totalBotsResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(bots)
    .where(eq(bots.executionId, executionId));

  const totalBots = totalBotsResult?.count ?? 0;

  // ── 2. Total bot-hours: SUM(metric_value) from telemetry WHERE metric_name = 'bot_hours' ──
  const [botHoursResult] = await db
    .select({ total: sql<number>`cast(coalesce(sum(${telemetry.metricValue}::numeric), 0) as float)` })
    .from(telemetry)
    .where(and(
      eq(telemetry.executionId, executionId),
      eq(telemetry.metricName, 'bot_hours'),
    ));

  const totalBotHours = botHoursResult?.total ?? 0;

  // ── 3. Total cost: SUM(amount_cents) from billing_events for tool_invoked events ──
  const [costResult] = await db
    .select({ total: sql<number>`cast(coalesce(sum(${billingEvents.amountCents}), 0) as int)` })
    .from(billingEvents)
    .where(and(
      eq(billingEvents.executionId, executionId),
      eq(billingEvents.eventType, 'tool_invoked'),
    ));

  const totalCostCents = costResult?.total ?? 0;

  // ── 4. Average bot score: AVG(composite_score) for bots in this execution ──
  const [avgScoreResult] = await db
    .select({ avg: sql<number>`cast(coalesce(avg(${bots.compositeScore}::numeric), 0) as float)` })
    .from(bots)
    .where(and(
      eq(bots.executionId, executionId),
      sql`${bots.compositeScore} IS NOT NULL`,
    ));

  const averageBotScore = avgScoreResult?.avg ?? 0;

  // ── 5. Top-performing bot: ORDER BY composite_score DESC NULLS LAST LIMIT 1 ──
  const [topBotResult] = await db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.executionId, executionId))
    .orderBy(sql`${bots.compositeScore} DESC NULLS LAST`)
    .limit(1);

  // Only set topPerformingBotId if the bot actually has a score (not null)
  const topPerformingBotId = topBotResult?.id ?? null;

  // ── 6. Error distribution ──
  // Task failures
  const [taskFailuresResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tasks)
    .where(and(
      eq(tasks.executionId, executionId),
      eq(tasks.status, 'failed'),
    ));

  const taskFailures = taskFailuresResult?.count ?? 0;

  // Tool rejections
  const [toolRejectionsResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(toolInvocations)
    .where(and(
      eq(toolInvocations.executionId, executionId),
      eq(toolInvocations.rejected, true),
    ));

  const toolRejections = toolRejectionsResult?.count ?? 0;

  const errorDistribution: Record<string, number> = {
    task_failures: taskFailures,
    tool_rejections: toolRejections,
  };

  // ── 7. Task counts ──
  const [totalTasksResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tasks)
    .where(eq(tasks.executionId, executionId));

  const [completedTasksResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tasks)
    .where(and(
      eq(tasks.executionId, executionId),
      eq(tasks.status, 'completed'),
    ));

  const totalTasks = totalTasksResult?.count ?? 0;
  const completedTasks = completedTasksResult?.count ?? 0;
  const failedTasks = taskFailures;

  // ── 8. Cost per task: guard against division by zero ──
  const costPerTaskCents = completedTasks === 0 ? 0 : Math.round(totalCostCents / completedTasks);

  // ── 9. Soul tier distribution ──
  const soulTierDistribution = { novice: 0, understudy: 0, artisan: 0, retired: 0 };
  const botIds = (await db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.executionId, executionId))
  ).map(b => b.id);

  if (botIds.length > 0) {
    const tierRows = await db
      .select({
        currentClass: agentClasses.currentClass,
        count: sql<number>`cast(count(distinct ${agentClasses.botId}) as int)`,
      })
      .from(agentClasses)
      .where(inArray(agentClasses.botId, botIds))
      .groupBy(agentClasses.currentClass);

    for (const row of tierRows) {
      const key = row.currentClass.toLowerCase() as keyof typeof soulTierDistribution;
      if (key in soulTierDistribution) {
        soulTierDistribution[key] = row.count;
      }
    }
  }

  return {
    executionId,
    totalBots,
    totalBotHours,
    totalCostCents,
    averageBotScore,
    topPerformingBotId,
    errorDistribution,
    costPerTaskCents,
    totalTasks,
    completedTasks,
    failedTasks,
    soulTierDistribution,
  };
}
