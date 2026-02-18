import { computeScoresForExecution } from './score-engine';

/**
 * Orchestrate the full performance scoring pipeline for a completed execution.
 *
 * Current pipeline:
 * 1. computeScoresForExecution — metrics computation, score normalization, telemetry/bots updates
 *
 * Future extensions (Plans 05-02 and 05-03 will add):
 * 2. buildPerformanceReport (05-02)
 * 3. captureBotDna (05-03)
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

  console.log('[performance-engine] Pipeline complete for execution', executionId);
}
