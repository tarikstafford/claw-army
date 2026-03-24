/**
 * Negative Register Writer
 *
 * Records negative signals from poor-performing bots.
 * Maps verdict type to severity and failure type, then inserts
 * into negative_signal_register.
 */

import { db, negativeSignalRegister } from '@claw/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NegativeVerdictType = 'Demote' | 'Monitor' | 'Retire';

interface SeverityMapping {
  severity: 'high' | 'medium' | 'critical';
  failureType: 'demotion' | 'monitoring' | 'retirement';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERDICT_SEVERITY_MAP: Record<NegativeVerdictType, SeverityMapping> = {
  Demote: { severity: 'high', failureType: 'demotion' },
  Monitor: { severity: 'medium', failureType: 'monitoring' },
  Retire: { severity: 'critical', failureType: 'retirement' },
};

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Record a negative signal for a poorly-performing bot.
 *
 * Maps verdict type to severity:
 * - Demote -> high severity, failureType: 'demotion'
 * - Monitor -> medium severity, failureType: 'monitoring'
 * - Retire -> critical severity, failureType: 'retirement'
 */
export async function recordNegativeSignal(
  botId: string,
  executionId: string,
  soulId: string | null | undefined,
  verdictType: string,
  verdictSummary: string,
  _verdictId: string,
): Promise<void> {
  const mapping = VERDICT_SEVERITY_MAP[verdictType as NegativeVerdictType] ?? {
    severity: 'medium' as const,
    failureType: 'monitoring' as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(negativeSignalRegister).values({
    soulId: soulId ?? undefined,
    botId,
    executionId: executionId ?? undefined,
    failureType: mapping.failureType,
    directiveFailureSummary: verdictSummary,
    mutationBlacklist: {
      verdictType,
      severity: mapping.severity,
      reason: verdictSummary,
    },
  } as any);
}
