import { db, tasks, executions } from '@claw/db';
import { eq, and, notInArray, count } from 'drizzle-orm';
import { transitionExecution } from '../services/execution.service';
import { publishExecutionStatusChanged, publishBillingEvent } from '../events/publisher';
import { runPerformancePipeline } from '../performance/performance-engine';

/**
 * Check if all tasks for an execution are in a terminal state (completed or failed).
 * If so, transition the execution to 'completed' and emit an event.
 *
 * @param executionId - UUID of the execution to check
 * @returns true if the execution was transitioned to 'completed', false otherwise
 */
export async function checkExecutionCompletion(executionId: string): Promise<boolean> {
  // Count tasks that are not yet in a terminal state
  const result = await db
    .select({ remaining: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.executionId, executionId),
        notInArray(tasks.status, ['completed', 'failed']),
      ),
    );

  const remaining = result[0]?.remaining ?? 0;

  if (remaining === 0) {
    // All tasks are done — transition execution to 'completed'
    const transitioned = await transitionExecution(executionId, 'running', 'completed');

    if (transitioned) {
      // Publish execution_status_changed event (execution-lifecycle topic)
      await publishExecutionStatusChanged({
        type: 'execution_status_changed',
        executionId,
        fromStatus: 'running',
        toStatus: 'completed',
        timestamp: new Date().toISOString(),
      });

      // Publish execution_completed billing event (billing-events topic)
      // The Billing Engine's handleBillingMessage handler listens on billing-events for this.
      // publishExecutionStatusChanged goes to execution-lifecycle (different topic + type),
      // so this explicit call is required for METR-01 billing event completeness.
      await publishBillingEvent({
        type: 'billing_event',
        eventType: 'execution_completed',
        executionId,
        timestamp: new Date().toISOString(),
      });

      console.log('[completion-checker] Execution completed:', { executionId });

      // Phase 5: Fire-and-forget performance scoring pipeline
      // Must NOT block or roll back the completed status
      runPerformancePipeline(executionId).catch((err) => {
        console.error('[performance-engine] Pipeline error (non-fatal):', err);
      });
    }

    return transitioned;
  }

  return false;
}

/**
 * Start a polling timer that periodically checks if an execution is complete.
 * Clears itself when the execution transitions to 'completed'.
 *
 * @param executionId - UUID of the execution to poll
 * @param intervalMs - Polling interval in milliseconds (default: 5 seconds)
 * @returns The interval timer handle (pass to stopCompletionPoller to clear manually)
 */
export function startCompletionPoller(
  executionId: string,
  intervalMs = 5000,
): NodeJS.Timeout {
  const timer: NodeJS.Timeout = setInterval(async () => {
    try {
      const completed = await checkExecutionCompletion(executionId);
      if (completed) {
        clearInterval(timer);
      }
    } catch (err) {
      console.error('[completion-checker] Error checking execution completion:', {
        executionId,
        error: (err as Error).message,
      });
    }
  }, intervalMs);

  return timer;
}

/**
 * Stop a completion poller manually.
 * Call this when terminating an execution for reasons other than completion (e.g., failed, stopped).
 *
 * @param timer - The timer handle returned by startCompletionPoller
 */
export function stopCompletionPoller(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}
