import { db, tasks } from '@claw/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { CoordinationContext, CoordinationModule } from './coordination-loop';
import { logCoordinationEvent } from './coordination-events';
import type { IntelligenceRoutingEvent } from '@claw/event-schemas';

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Jaccard similarity threshold above which intelligence is considered relevant.
 * Low threshold — err on the side of routing.
 */
const JACCARD_RELEVANCE_THRESHOLD = 0.15;

/**
 * Maximum characters to include in a routed intelligence signal.
 */
const MAX_SIGNAL_LENGTH = 2000;

/**
 * Maximum source result length before truncation.
 */
const MAX_SOURCE_RESULT_LENGTH = 5000;

/**
 * Maximum characters for signalSummary in routing events.
 */
const SIGNAL_SUMMARY_LENGTH = 200;

// ─── Module-level processed session tracking ───────────────────────────────────

/**
 * Tracks which sessions have already been scanned for intelligence per run.
 * Prevents re-processing already-routed intelligence on subsequent poll cycles.
 *
 * Keyed by runId → Set of processed sessionIds.
 */
const processedSessionsByRun = new Map<string, Set<string>>();

// ─── Heuristic relevance check ────────────────────────────────────────────────

/**
 * Tokenize a string into a lowercase word set, stripping punctuation.
 *
 * @param text - Input string to tokenize
 * @returns Set of lowercase word tokens
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),  // skip very short words (articles, etc.)
  );
}

/**
 * Compute Jaccard similarity between two word sets.
 *
 * Jaccard = |A ∩ B| / |A ∪ B|
 *
 * Returns 0 if both sets are empty, 1 if identical.
 *
 * @param a - First word set
 * @param b - Second word set
 * @returns Jaccard similarity score in [0, 1]
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  const intersection = new Set([...a].filter((w) => b.has(w)));
  const unionSize = a.size + b.size - intersection.size;

  if (unionSize === 0) return 0;
  return intersection.size / unionSize;
}

/**
 * Describe keyword overlap for routing rationale.
 *
 * @param a      - Source word set
 * @param b      - Target word set
 * @param score  - Jaccard similarity score
 * @returns Human-readable rationale string
 */
function buildRoutingRationale(a: Set<string>, b: Set<string>, score: number): string {
  const overlap = [...a].filter((w) => b.has(w));
  const topKeywords = overlap.slice(0, 10).join(', ');
  return `Jaccard similarity=${score.toFixed(3)} (threshold=${JACCARD_RELEVANCE_THRESHOLD}). Shared keywords: [${topKeywords || 'none'}]`;
}

// ─── Intelligence router CoordinationModule ────────────────────────────────────

/**
 * Create the intelligence routing coordination module (COORD-02).
 *
 * On each poll cycle, scans completed sessions for intelligence (task results)
 * that may be relevant to tasks with active agents. Routes relevant intelligence
 * by inserting a special intel-prefixed task row and logging a coordination event.
 *
 * Intelligence routing is non-fatal — errors are logged as WARN and the module
 * continues normally. Routing failures never crash the coordination loop.
 *
 * @returns CoordinationModule with name='intelligence-router'
 */
export function createIntelligenceRouter(): CoordinationModule {
  return {
    name: 'intelligence-router',

    async execute(ctx: CoordinationContext): Promise<void> {
      const { runId, executionId, missionBrief, registry, runState } = ctx;

      try {
        // Ensure per-run processed-session tracking is initialised
        if (!processedSessionsByRun.has(runId)) {
          processedSessionsByRun.set(runId, new Set());
        }
        const processedSessions = processedSessionsByRun.get(runId)!;

        // ── Collect completed sessions not yet processed ────────────────────
        const completedUnprocessedSessions = [...registry.sessions.values()].filter(
          (s) => s.status === 'completed' && !processedSessions.has(s.sessionId),
        );

        if (completedUnprocessedSessions.length === 0) {
          return;
        }

        // ── Build target task list: tasks with active agents ────────────────
        const activeTaskIds = missionBrief.taskGraph.tasks
          .filter((task) => {
            const state = runState.taskStates[task.taskId];
            return state !== undefined && state.activeAgents.length > 0;
          })
          .map((task) => task.taskId);

        if (activeTaskIds.length === 0) {
          // No active tasks to route intelligence to; mark sessions as processed
          for (const session of completedUnprocessedSessions) {
            processedSessions.add(session.sessionId);
          }
          return;
        }

        // ── Fetch task results for completed sessions ───────────────────────
        const completedBotIds = completedUnprocessedSessions.map((s) => s.botId);

        let taskRows: Array<{
          claimedByBotId: string | null;
          ringLeaderTaskId: string | null;
          result: string | null;
        }> = [];

        try {
          taskRows = await db
            .select({
              claimedByBotId: tasks.claimedByBotId,
              ringLeaderTaskId: tasks.ringLeaderTaskId,
              result: tasks.result,
            })
            .from(tasks)
            .where(
              and(
                inArray(tasks.claimedByBotId, completedBotIds),
                eq(tasks.status, 'completed'),
              ),
            );
        } catch (dbErr) {
          console.warn(
            `[intelligence-router] DB query for completed task results failed for runId=${runId}:`,
            (dbErr as Error).message,
          );
          return;
        }

        // Build lookup: botId → { ringLeaderTaskId, result }
        const resultByBotId = new Map<string, { ringLeaderTaskId: string; result: string }>();
        for (const row of taskRows) {
          if (
            row.claimedByBotId !== null &&
            row.ringLeaderTaskId !== null &&
            row.result !== null &&
            row.result.trim().length > 0
          ) {
            resultByBotId.set(row.claimedByBotId, {
              ringLeaderTaskId: row.ringLeaderTaskId,
              result: row.result,
            });
          }
        }

        // ── Pre-build target task descriptions for relevance checks ─────────
        const targetTaskDescriptions = new Map<string, Set<string>>();
        for (const task of missionBrief.taskGraph.tasks) {
          if (activeTaskIds.includes(task.taskId)) {
            targetTaskDescriptions.set(task.taskId, tokenize(task.description));
          }
        }

        // ── Relevance check and routing ─────────────────────────────────────
        for (const session of completedUnprocessedSessions) {
          const taskResult = resultByBotId.get(session.botId);

          if (!taskResult) {
            // No completed task result for this session — skip but mark processed
            processedSessions.add(session.sessionId);
            continue;
          }

          const { ringLeaderTaskId: sourceTaskId, result: sourceResult } = taskResult;

          // Truncate extremely long results before processing
          const truncatedResult =
            sourceResult.length > MAX_SOURCE_RESULT_LENGTH
              ? sourceResult.slice(0, MAX_SOURCE_RESULT_LENGTH)
              : sourceResult;

          const sourceTokens = tokenize(truncatedResult);

          for (const targetTaskId of activeTaskIds) {
            // Skip routing to the same task
            if (targetTaskId === sourceTaskId) continue;

            const targetTokens = targetTaskDescriptions.get(targetTaskId);
            if (!targetTokens) continue;

            const score = jaccardSimilarity(sourceTokens, targetTokens);

            if (score <= JACCARD_RELEVANCE_THRESHOLD) continue;

            // ── Relevant: route intelligence ─────────────────────────────────

            // Find target task's first active agent session ID
            const targetState = runState.taskStates[targetTaskId];
            const toAgentSessionId = targetState?.activeAgents[0] ?? null;

            if (!toAgentSessionId) {
              // Active status but no agent session ID found — skip
              continue;
            }

            // Truncate signal for routing
            const signal = truncatedResult.slice(0, MAX_SIGNAL_LENGTH);
            const signalSummary = signal.slice(0, SIGNAL_SUMMARY_LENGTH);
            const rationale = buildRoutingRationale(sourceTokens, targetTokens, score);

            // Insert intel-prefixed task row so the downstream upstream intelligence
            // pipeline (Phase 28-04 collectUpstreamOutputs) can pick it up
            const intelTaskId = `intel:${sourceTaskId}:${targetTaskId}`;

            try {
              await db.insert(tasks).values({
                executionId,
                description: `Intelligence routed from ${sourceTaskId}`,
                status: 'completed',
                result: signal,
                ringLeaderTaskId: intelTaskId,
                attemptCount: 0,
              });
            } catch (insertErr) {
              console.warn(
                `[intelligence-router] Failed to insert intel task row ` +
                `(source=${sourceTaskId} target=${targetTaskId} runId=${runId}):`,
                (insertErr as Error).message,
              );
              // Continue — routing event log is still valuable even if DB insert fails
            }

            // Log routing event via coordination-events
            const routingEvent: IntelligenceRoutingEvent = {
              type: 'intelligence_routing',
              runId,
              executionId,
              fromAgentSessionId: session.sessionId,
              toAgentSessionId,
              fromTaskId: sourceTaskId,
              toTaskId: targetTaskId,
              signalSummary,
              routingRationale: rationale,
              timestamp: new Date().toISOString(),
            };

            try {
              await logCoordinationEvent(runId, executionId, routingEvent);
            } catch (logErr) {
              console.warn(
                `[intelligence-router] logCoordinationEvent failed ` +
                `(source=${sourceTaskId} target=${targetTaskId} runId=${runId}):`,
                (logErr as Error).message,
              );
            }

            console.info(
              `[intelligence-router] Routed intelligence: ` +
              `runId=${runId} from=${sourceTaskId} to=${targetTaskId} ` +
              `jaccard=${score.toFixed(3)}`,
            );
          }

          // Mark session as processed regardless of routing outcome
          processedSessions.add(session.sessionId);
        }
      } catch (err) {
        console.warn(
          `[intelligence-router] Non-fatal error during execute for runId=${runId}:`,
          (err as Error).message,
        );
      }
    },
  };
}

/**
 * Clear the processed-session tracking for a completed run.
 * Should be called when the coordination loop is stopped.
 *
 * @param runId - ringLeaderRunId
 */
export function clearIntelligenceRouterState(runId: string): void {
  processedSessionsByRun.delete(runId);
}
