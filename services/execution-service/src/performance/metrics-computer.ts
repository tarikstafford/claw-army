import { db, tasks, billingEvents, toolInvocations, telemetry } from '@claw/db';
import { eq, and, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// BotMetrics interface
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-bot performance metrics computed from tasks, billing_events,
 * tool_invocations, and telemetry tables.
 *
 * CRITICAL: Task counts are read from the tasks table (claimed_by_bot_id),
 * NOT from bots.tasksCompleted / bots.tasksFailed which are always 0.
 */
export interface BotMetrics {
  botId: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalTasks: number;
  successRate: number;           // 0-1 ratio
  totalCostCents: number;        // integer cents
  costPerTaskCents: number;      // integer cents per successful task (0 if none completed)
  totalTokens: number;
  tokensPerTask: number;         // 0 if no tasks completed
  toolCallsPerTask: number;      // 0 if no tasks completed
  totalToolCalls: number;
  botHours: number;              // from telemetry
  tasksPerMinute: number;        // tasks_completed / (bot_hours * 60), or 0
  totalRetries: number;          // SUM(attempt_count) - COUNT(*) for tasks with attempt_count > 1
  errorRate: number;             // 0-1 ratio of (failed_tasks + rejected_tool_calls) / total_actions
  idleRatio: number;             // estimated idle time / total runtime
}

// ──────────────────────────────────────────────────────────────────────────────
// Core computation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute all per-bot metrics from raw tables for a given bot in a given execution.
 *
 * Data sources:
 * - Task counts: tasks table WHERE claimed_by_bot_id = botId
 * - Cost: billing_events WHERE bot_id = botId AND event_type = 'tool_invoked'
 * - Tokens: tool_invocations WHERE bot_id = botId AND rejected = false
 * - Tool calls: tool_invocations count
 * - Bot hours: telemetry WHERE bot_id = botId AND metric_name = 'bot_hours'
 * - Retries: tasks SUM(attempt_count) - COUNT(*)
 *
 * All division-by-zero cases return 0 as documented in the interface.
 *
 * @param executionId - UUID of the execution
 * @param botId - UUID of the bot to compute metrics for
 */
export async function computeBotMetrics(
  executionId: string,
  botId: string,
): Promise<BotMetrics> {
  // ── Task counts: READ FROM tasks table, NOT from bots.tasksCompleted/tasksFailed ──
  const [completedResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tasks)
    .where(and(eq(tasks.claimedByBotId, botId), eq(tasks.status, 'completed')));

  const [failedResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tasks)
    .where(and(eq(tasks.claimedByBotId, botId), eq(tasks.status, 'failed')));

  const tasksCompletedCount = completedResult?.count ?? 0;
  const tasksFailedCount = failedResult?.count ?? 0;
  const totalTasks = tasksCompletedCount + tasksFailedCount;

  // ── Success rate ──
  const successRate = totalTasks === 0 ? 0 : tasksCompletedCount / totalTasks;

  // ── Total cost: SUM(amount_cents) from billing_events for tool_invoked events ──
  const [costResult] = await db
    .select({ total: sql<number>`cast(coalesce(sum(${billingEvents.amountCents}), 0) as int)` })
    .from(billingEvents)
    .where(and(eq(billingEvents.botId, botId), eq(billingEvents.eventType, 'tool_invoked')));

  const totalCostCents = costResult?.total ?? 0;
  const costPerTaskCents = tasksCompletedCount === 0 ? 0 : Math.round(totalCostCents / tasksCompletedCount);

  // ── Token usage: SUM(total_tokens) from non-rejected tool_invocations ──
  const [tokenResult] = await db
    .select({ total: sql<number>`cast(coalesce(sum(${toolInvocations.totalTokens}), 0) as int)` })
    .from(toolInvocations)
    .where(and(eq(toolInvocations.botId, botId), eq(toolInvocations.rejected, false)));

  const totalTokens = tokenResult?.total ?? 0;
  const tokensPerTask = tasksCompletedCount === 0 ? 0 : Math.round(totalTokens / tasksCompletedCount);

  // ── Tool call counts: accepted and rejected ──
  const [toolCallResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(toolInvocations)
    .where(and(eq(toolInvocations.botId, botId), eq(toolInvocations.rejected, false)));

  const [rejectedCallResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(toolInvocations)
    .where(and(eq(toolInvocations.botId, botId), eq(toolInvocations.rejected, true)));

  const totalToolCalls = toolCallResult?.count ?? 0;
  const rejectedToolCalls = rejectedCallResult?.count ?? 0;
  const toolCallsPerTask = tasksCompletedCount === 0 ? 0 : totalToolCalls / tasksCompletedCount;

  // ── Bot hours: from telemetry table ──
  const [botHoursResult] = await db
    .select({ metricValue: telemetry.metricValue })
    .from(telemetry)
    .where(and(
      eq(telemetry.botId, botId),
      eq(telemetry.metricName, 'bot_hours'),
    ));

  const botHours = botHoursResult?.metricValue ? Number(botHoursResult.metricValue) : 0;
  const tasksPerMinute = botHours === 0 ? 0 : tasksCompletedCount / (botHours * 60);

  // ── Retries: SUM(attempt_count) - COUNT(*) for all tasks claimed by bot ──
  const [retriesResult] = await db
    .select({ totalAttempts: sql<number>`cast(coalesce(sum(${tasks.attemptCount}), 0) as int)` })
    .from(tasks)
    .where(eq(tasks.claimedByBotId, botId));

  const [totalTasksClaimedResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tasks)
    .where(eq(tasks.claimedByBotId, botId));

  const totalAttempts = retriesResult?.totalAttempts ?? 0;
  const totalTasksClaimed = totalTasksClaimedResult?.count ?? 0;
  const totalRetries = Math.max(0, totalAttempts - totalTasksClaimed);

  // ── Error rate: (failed_tasks + rejected_tool_calls) / total_actions ──
  const totalActions = totalTasks + totalToolCalls + rejectedToolCalls;
  const errorRate = totalActions === 0 ? 0 : (tasksFailedCount + rejectedToolCalls) / totalActions;

  // ── Idle ratio: estimate active time from tool call durations ──
  let idleRatio = 0;
  if (botHours > 0) {
    const [avgDurationResult] = await db
      .select({ avg: sql<number>`cast(coalesce(avg(${toolInvocations.durationMs}), 0) as float)` })
      .from(toolInvocations)
      .where(and(eq(toolInvocations.botId, botId), eq(toolInvocations.rejected, false)));

    const avgDurationMs = avgDurationResult?.avg ?? 0;
    const totalBotMs = botHours * 3_600_000;
    const activeMs = totalToolCalls * avgDurationMs;
    const activeRatio = totalBotMs === 0 ? 0 : Math.min(1, activeMs / totalBotMs);
    idleRatio = Math.max(0, Math.min(1, 1 - activeRatio));
  }

  return {
    botId,
    tasksCompleted: tasksCompletedCount,
    tasksFailed: tasksFailedCount,
    totalTasks,
    successRate,
    totalCostCents,
    costPerTaskCents,
    totalTokens,
    tokensPerTask,
    toolCallsPerTask,
    totalToolCalls,
    botHours,
    tasksPerMinute,
    totalRetries,
    errorRate,
    idleRatio,
  };
}
