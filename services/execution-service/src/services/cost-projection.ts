import { db, billingEvents, telemetry } from '@claw/db';
import { sql, gte, and } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type BurnTrend = 'increasing' | 'decreasing' | 'stable';

export interface DimensionBreakdown {
  llmInputTokensCents: number;
  llmOutputTokensCents: number;
  botHoursCents: number;
  toolInvocationsCents: number;
}

export interface CostProjection {
  dailyBurnRateCents: number;
  projectedMonthlyCostCents: number;
  daysUntilBudgetExhaustion: number | null;
  trend: BurnTrend;
  breakdown: DimensionBreakdown;
  windowDays: number;
  dataPoints: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 7;
const TREND_THRESHOLD = 0.10; // 10% change between halves = trend shift

// ──────────────────────────────────────────────────────────────────────────────
// Core projection logic
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Calculate cost projections based on billing events from the last 7 days.
 *
 * Approach:
 * 1. Query billing_events for tool_invoked events in the last 7 days
 * 2. Query telemetry for bot_hours in the same window
 * 3. Calculate daily burn rate as total spend / number of active days
 * 4. Project monthly cost = daily burn rate * days in current month
 * 5. Budget exhaustion = remaining budget / daily burn rate
 * 6. Trend = compare first half vs second half of window
 */
export async function calculateCostProjection(
  dailyBudgetCents: number | null,
  monthlyBudgetCents: number | null,
  monthlySpentCents: number,
): Promise<CostProjection> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const midpoint = new Date(now.getTime() - (WINDOW_DAYS / 2) * 24 * 60 * 60 * 1000);

  // Query billing events in the window, grouped by day
  const dailySpend = await db
    .select({
      day: sql<string>`date_trunc('day', ${billingEvents.occurredAt})::date::text`,
      totalCents: sql<number>`cast(coalesce(sum(${billingEvents.amountCents}), 0) as int)`,
      tokenCount: sql<number>`cast(coalesce(sum(${billingEvents.tokenCount}), 0) as int)`,
      eventCount: sql<number>`cast(count(*) as int)`,
    })
    .from(billingEvents)
    .where(
      and(
        gte(billingEvents.occurredAt, windowStart),
        sql`${billingEvents.eventType} = 'tool_invoked'`,
      ),
    )
    .groupBy(sql`date_trunc('day', ${billingEvents.occurredAt})::date`);

  // Query bot hours in the window
  const botHoursResult = await db
    .select({
      totalHours: sql<number>`cast(coalesce(sum(${telemetry.metricValue}), 0) as float)`,
    })
    .from(telemetry)
    .where(
      and(
        gte(telemetry.computedAt, windowStart),
        sql`${telemetry.metricName} = 'bot_hours'`,
      ),
    );

  const totalBotHours = botHoursResult[0]?.totalHours ?? 0;

  // Calculate per-dimension breakdown from billing event metadata
  const dimensionBreakdown = await db
    .select({
      totalInputCents: sql<number>`cast(coalesce(sum(
        case when ${billingEvents.metadata}->>'dimension' = 'llm_input_tokens'
        then ${billingEvents.amountCents} else 0 end
      ), 0) as int)`,
      totalOutputCents: sql<number>`cast(coalesce(sum(
        case when ${billingEvents.metadata}->>'dimension' = 'llm_output_tokens'
        then ${billingEvents.amountCents} else 0 end
      ), 0) as int)`,
      totalToolCents: sql<number>`cast(coalesce(sum(
        case when ${billingEvents.metadata}->>'dimension' = 'tool_invocations'
          or ${billingEvents.metadata}->>'dimension' is null
        then ${billingEvents.amountCents} else 0 end
      ), 0) as int)`,
    })
    .from(billingEvents)
    .where(
      and(
        gte(billingEvents.occurredAt, windowStart),
        sql`${billingEvents.eventType} = 'tool_invoked'`,
      ),
    );

  // Bot hours cost (using default rate from billing-engine)
  const BOT_HOURLY_RATE_CENTS = Number(process.env.BOT_HOURLY_RATE_CENTS ?? 100);
  const botHoursCostCents = Math.round(totalBotHours * BOT_HOURLY_RATE_CENTS);

  // Total spend in window
  const totalSpendCents = dailySpend.reduce((sum, d) => sum + d.totalCents, 0) + botHoursCostCents;
  const dataPoints = dailySpend.length;

  // Daily burn rate: total spend / window days (use actual window, not just days with data)
  const activeDays = Math.max(dataPoints, 1);
  const dailyBurnRateCents = Math.round(totalSpendCents / activeDays);

  // Project monthly cost: daily rate * days in current month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const remainingDaysInMonth = daysInMonth - dayOfMonth;
  const projectedMonthlyCostCents = monthlySpentCents + (dailyBurnRateCents * remainingDaysInMonth);

  // Days until budget exhaustion
  let daysUntilBudgetExhaustion: number | null = null;
  if (monthlyBudgetCents && monthlyBudgetCents > 0 && dailyBurnRateCents > 0) {
    const remainingBudgetCents = monthlyBudgetCents - monthlySpentCents;
    if (remainingBudgetCents > 0) {
      daysUntilBudgetExhaustion = Math.floor(remainingBudgetCents / dailyBurnRateCents);
    } else {
      daysUntilBudgetExhaustion = 0;
    }
  } else if (dailyBudgetCents && dailyBudgetCents > 0 && dailyBurnRateCents > 0) {
    // Fall back to daily budget if no monthly budget set
    // Rough estimate: remaining daily budget * 30
    daysUntilBudgetExhaustion = dailyBurnRateCents <= dailyBudgetCents
      ? null // Under daily budget, not exhausting
      : 0;
  }

  // Trend detection: compare first half vs second half of window
  const firstHalfCents = dailySpend
    .filter((d) => new Date(d.day) < midpoint)
    .reduce((sum, d) => sum + d.totalCents, 0);
  const secondHalfCents = dailySpend
    .filter((d) => new Date(d.day) >= midpoint)
    .reduce((sum, d) => sum + d.totalCents, 0);

  let trend: BurnTrend = 'stable';
  if (firstHalfCents > 0) {
    const changeRatio = (secondHalfCents - firstHalfCents) / firstHalfCents;
    if (changeRatio > TREND_THRESHOLD) {
      trend = 'increasing';
    } else if (changeRatio < -TREND_THRESHOLD) {
      trend = 'decreasing';
    }
  } else if (secondHalfCents > 0) {
    trend = 'increasing';
  }

  const dim = dimensionBreakdown[0];
  const breakdown: DimensionBreakdown = {
    llmInputTokensCents: dim?.totalInputCents ?? 0,
    llmOutputTokensCents: dim?.totalOutputCents ?? 0,
    botHoursCents: botHoursCostCents,
    toolInvocationsCents: dim?.totalToolCents ?? 0,
  };

  return {
    dailyBurnRateCents,
    projectedMonthlyCostCents,
    daysUntilBudgetExhaustion,
    trend,
    breakdown,
    windowDays: WINDOW_DAYS,
    dataPoints,
  };
}
