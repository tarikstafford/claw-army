import { db, decisionTraces, telemetry, billingEvents } from '@claw/db';
import { lt, sql } from 'drizzle-orm';

/**
 * Default retention periods in days.
 * Decision traces: 90 days (per schema TTL policy comment)
 * Telemetry: 30 days (high-volume, short-lived metrics)
 * Billing events: 365 days (financial records, longer retention)
 */
export const RETENTION_DEFAULTS = {
  decisionTracesDays: 90,
  telemetryDays: 30,
  billingEventsDays: 365,
} as const;

export interface RetentionConfig {
  decisionTracesDays: number;
  telemetryDays: number;
  billingEventsDays: number;
}

export interface RetentionResult {
  decisionTracesDeleted: number;
  telemetryDeleted: number;
  billingEventsDeleted: number;
  executedAt: string;
}

/**
 * Returns the active retention configuration.
 * Currently reads from env vars with fallback to defaults.
 * Future: could be stored in a settings table.
 */
export function getRetentionConfig(): RetentionConfig {
  return {
    decisionTracesDays: parseInt(
      process.env.RETENTION_DECISION_TRACES_DAYS ?? String(RETENTION_DEFAULTS.decisionTracesDays),
      10,
    ),
    telemetryDays: parseInt(
      process.env.RETENTION_TELEMETRY_DAYS ?? String(RETENTION_DEFAULTS.telemetryDays),
      10,
    ),
    billingEventsDays: parseInt(
      process.env.RETENTION_BILLING_EVENTS_DAYS ?? String(RETENTION_DEFAULTS.billingEventsDays),
      10,
    ),
  };
}

/**
 * Computes a UTC cutoff date by subtracting `days` from now.
 */
function cutoffDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Purges decision_traces older than the configured retention period.
 * Uses the `decided_at` timestamp column (indexed) for the cutoff.
 */
async function purgeDecisionTraces(config: RetentionConfig): Promise<number> {
  const cutoff = cutoffDate(config.decisionTracesDays);

  const result = await db
    .delete(decisionTraces)
    .where(lt(decisionTraces.decidedAt, cutoff))
    .returning({ id: decisionTraces.id });

  console.log(
    `[data-retention] decision_traces: deleted ${result.length} rows older than ${cutoff.toISOString()}`,
  );

  return result.length;
}

/**
 * Purges telemetry older than the configured retention period.
 * Uses the `computed_at` timestamp column for the cutoff.
 */
async function purgeTelemetry(config: RetentionConfig): Promise<number> {
  const cutoff = cutoffDate(config.telemetryDays);

  const result = await db
    .delete(telemetry)
    .where(lt(telemetry.computedAt, cutoff))
    .returning({ id: telemetry.id });

  console.log(
    `[data-retention] telemetry: deleted ${result.length} rows older than ${cutoff.toISOString()}`,
  );

  return result.length;
}

/**
 * Purges billing_events older than the configured retention period.
 * Uses the `occurred_at` timestamp column (indexed) for the cutoff.
 */
async function purgeBillingEvents(config: RetentionConfig): Promise<number> {
  const cutoff = cutoffDate(config.billingEventsDays);

  const result = await db
    .delete(billingEvents)
    .where(lt(billingEvents.occurredAt, cutoff))
    .returning({ id: billingEvents.id });

  console.log(
    `[data-retention] billing_events: deleted ${result.length} rows older than ${cutoff.toISOString()}`,
  );

  return result.length;
}

/**
 * Runs the full retention sweep across all three tables.
 * Each table is purged independently — a failure in one does not block the others.
 */
export async function runRetention(
  config?: Partial<RetentionConfig>,
): Promise<RetentionResult> {
  const effectiveConfig = { ...getRetentionConfig(), ...config };

  console.log('[data-retention] Starting retention sweep', {
    decisionTracesDays: effectiveConfig.decisionTracesDays,
    telemetryDays: effectiveConfig.telemetryDays,
    billingEventsDays: effectiveConfig.billingEventsDays,
  });

  const results = await Promise.allSettled([
    purgeDecisionTraces(effectiveConfig),
    purgeTelemetry(effectiveConfig),
    purgeBillingEvents(effectiveConfig),
  ]);

  const extract = (r: PromiseSettledResult<number>, label: string): number => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    console.error(`[data-retention] ${label} purge failed:`, (r.reason as Error).message);
    return 0;
  };

  const result: RetentionResult = {
    decisionTracesDeleted: extract(results[0]!, 'decision_traces'),
    telemetryDeleted: extract(results[1]!, 'telemetry'),
    billingEventsDeleted: extract(results[2]!, 'billing_events'),
    executedAt: new Date().toISOString(),
  };

  console.log('[data-retention] Retention sweep complete', result);

  return result;
}
