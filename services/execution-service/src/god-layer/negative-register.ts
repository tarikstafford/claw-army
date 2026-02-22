/**
 * Negative Register Writer
 *
 * Writes negative signal entries to negative_signal_register.
 *
 * GODL-05: Populates mutationBlacklist JSONB with failed directives and
 *           mutation ops to prevent poisoning future mutations with patterns
 *           that led to retirement or demotion.
 *
 * Accepts a Drizzle transaction context so it executes within the God Layer
 * worker's DB transaction boundary.
 */

import { db } from '@claw/db';
import { negativeSignalRegister } from '@claw/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NegativeSignalParams {
  soulId: string;
  botId: string;
  executionId: string;
  failureType: 'retirement' | 'demotion';
  soulAnalystSummary: string;
  failedDirectives: string[];
  parentSoulId: string | null;
  mutationOpsApplied: string[];
}

// ---------------------------------------------------------------------------
// Transaction type alias
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Insert a negative signal entry into negative_signal_register.
 *
 * The mutationBlacklist JSONB captures:
 * - failedDirectives: directives with counterfactual score < 0.3
 * - avoidMutationOps: ops that led to this failure
 * - parentSoulId: parent soul lineage reference
 * - reason: plain-text soul analyst summary
 *
 * This data is consumed by the soul mutation engine to avoid repeating
 * patterns that were already proven unsuccessful.
 */
export async function writeNegativeSignal(
  tx: Tx,
  params: NegativeSignalParams,
): Promise<void> {
  const blacklist = {
    failedDirectives: params.failedDirectives,     // string[] — directives with counterfactual score < 0.3
    avoidMutationOps: params.mutationOpsApplied,   // string[] — ops that led to this failure
    parentSoulId: params.parentSoulId,              // string | null
    reason: params.soulAnalystSummary,              // plain-text reason
  };

  await tx.insert(negativeSignalRegister).values({
    soulId: params.soulId,
    botId: params.botId,
    executionId: params.executionId,
    failureType: params.failureType,
    directiveFailureSummary: params.soulAnalystSummary,
    mutationBlacklist: blacklist,
  });
}
