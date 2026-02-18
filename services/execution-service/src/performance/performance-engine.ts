import { computeScoresForExecution } from './score-engine';
import { identifyAndCaptureDna } from './dna-capture';

/**
 * Orchestrate the full performance scoring pipeline for a completed execution.
 *
 * Pipeline:
 * 1. computeScoresForExecution — metrics computation, score normalization, telemetry/bots updates
 * 2. identifyAndCaptureDna — elite bot identification, PII-safe DNA extraction, versioned storage
 *
 * Called fire-and-forget from completion-checker.ts after execution transitions to 'completed'.
 * Errors are intentionally NOT thrown — the caller's .catch() handler logs them without
 * affecting the completed execution status.
 *
 * @param executionId - UUID of the completed execution to score
 */
export async function runPerformancePipeline(executionId: string): Promise<void> {
  console.log('[performance-engine] Starting pipeline for execution', executionId);

  await computeScoresForExecution(executionId);
  await identifyAndCaptureDna(executionId);

  console.log('[performance-engine] Pipeline complete for execution', executionId);
}
