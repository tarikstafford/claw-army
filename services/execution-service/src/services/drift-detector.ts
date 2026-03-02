import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db, tasks } from '@claw/db';
import { eq, and, isNotNull } from 'drizzle-orm';
import { DRIFT_REANCHORING_THRESHOLD } from '@claw/shared-types';
import type { ReanchoringEvent } from '@claw/event-schemas';
import type { CoordinationContext, CoordinationModule } from './coordination-loop';
import { logCoordinationEvent } from './coordination-events';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');

/** Debounce interval for reanchoring signals — no more than one per 2 minutes */
const REANCHORING_DEBOUNCE_MS = 120_000;

/** Max chars per completed output when concatenating (keep embedding input manageable) */
const MAX_OUTPUT_CHARS_EACH = 500;

/** Max chars for the full concatenated output text sent to embedding */
const MAX_COMBINED_CHARS = 8_000;

// ─── Cosine Similarity Helper ──────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Per-run State ─────────────────────────────────────────────────────────────

interface DriftRunState {
  /** Cached embedding of the original objective (computed once on first poll) */
  objectiveEmbedding: number[] | null;
  /** Timestamp of last reanchoring signal sent (for debounce) */
  lastReanchoringAt: number;
  /** Total reanchoring signals sent this run */
  reanchoringCount: number;
  /** Last known drift score (used as fallback if embedding fails) */
  lastDriftScore: number;
}

const runStates = new Map<string, DriftRunState>();

function getRunState(runId: string): DriftRunState {
  if (!runStates.has(runId)) {
    runStates.set(runId, {
      objectiveEmbedding: null,
      lastReanchoringAt: 0,
      reanchoringCount: 0,
      lastDriftScore: 0,
    });
  }
  return runStates.get(runId)!;
}

// ─── Internal Types ─────────────────────────────────────────────────────────────

interface CompletedTaskRow extends Record<string, unknown> {
  result: string;
}

// ─── Public Factory ─────────────────────────────────────────────────────────────

/**
 * Create an objective drift detection coordination module (COORD-06, COORD-07).
 *
 * On each poll cycle:
 *  - Computes embedding of original objective (once, then cached)
 *  - Queries completed task results and concatenates them
 *  - Computes cosine similarity between objective and output embeddings
 *  - Sets ctx.runState.objectiveDriftScore = 1 - cosineSimilarity
 *  - Broadcasts a ReanchoringEvent when drift > 0.35 (debounced at 2-minute intervals)
 *
 * Embedding API failures are non-fatal — previous drift score is retained and a WARN is logged.
 */
export function createDriftDetector(): CoordinationModule {
  return {
    name: 'drift-detector',

    async execute(ctx: CoordinationContext): Promise<void> {
      const { runId, executionId, missionBrief, runState } = ctx;
      const state = getRunState(runId);

      // ── A. Compute objective embedding (once) ───────────────────────────────
      if (state.objectiveEmbedding === null) {
        try {
          const { embedding } = await embed({
            model: EMBEDDING_MODEL,
            value: missionBrief.objective,
          });
          state.objectiveEmbedding = embedding;
          console.info(
            `[drift-detector] Objective embedding computed for runId=${runId} (${embedding.length} dims)`,
          );
        } catch (err) {
          console.warn(
            `[drift-detector] Failed to embed objective for runId=${runId}:`,
            (err as Error).message,
          );
          // Cannot proceed without objective embedding on first call — skip this cycle
          return;
        }
      }

      // ── B. Collect completed outputs ────────────────────────────────────────
      let completedRows: CompletedTaskRow[] = [];
      try {
        const result = await db
          .select({ result: tasks.result })
          .from(tasks)
          .where(
            and(
              eq(tasks.executionId, executionId),
              eq(tasks.status, 'completed'),
              isNotNull(tasks.result),
            ),
          );
        completedRows = result as CompletedTaskRow[];
      } catch (err) {
        console.warn(
          `[drift-detector] Failed to query completed tasks for runId=${runId}:`,
          (err as Error).message,
        );
        // Retain previous drift score — do not crash loop
        runState.objectiveDriftScore = state.lastDriftScore;
        return;
      }

      if (completedRows.length === 0) {
        // No completed results yet — drift is not measurable
        runState.objectiveDriftScore = 0;
        state.lastDriftScore = 0;
        console.info(
          `[drift-detector] No completed outputs yet for runId=${runId} — drift score = 0`,
        );
        return;
      }

      // ── C. Compute drift score ──────────────────────────────────────────────
      // Concatenate all result texts (truncated to 500 chars each)
      const combinedText = completedRows
        .map((row) => (row.result ?? '').slice(0, MAX_OUTPUT_CHARS_EACH))
        .join('\n')
        .slice(0, MAX_COMBINED_CHARS);

      let driftScore = state.lastDriftScore;
      try {
        const { embedding: outputEmbedding } = await embed({
          model: EMBEDDING_MODEL,
          value: combinedText,
        });

        const similarity = cosineSimilarity(state.objectiveEmbedding, outputEmbedding);
        driftScore = 1 - similarity;

        console.info(
          `[drift-detector] runId=${runId} driftScore=${driftScore.toFixed(4)} ` +
          `(similarity=${similarity.toFixed(4)}, completedTasks=${completedRows.length})`,
        );
      } catch (err) {
        console.warn(
          `[drift-detector] Failed to embed combined output for runId=${runId}:`,
          (err as Error).message,
        );
        // Retain previous drift score — embedding failure is non-fatal
      }

      // Update run state and cache
      runState.objectiveDriftScore = driftScore;
      state.lastDriftScore = driftScore;

      // ── D. Reanchoring signal (COORD-07) ────────────────────────────────────
      const now = Date.now();
      const debounceElapsed = now - state.lastReanchoringAt;

      if (driftScore > DRIFT_REANCHORING_THRESHOLD && debounceElapsed >= REANCHORING_DEBOUNCE_MS) {
        const completedCount = completedRows.length;
        const totalTasks = missionBrief.taskGraph.tasks.length;
        const nextReanchoringNumber = state.reanchoringCount + 1;

        const objectiveRestatement = missionBrief.objective;
        const driftSummary =
          `Collective output drift score ${driftScore.toFixed(3)} exceeds threshold 0.35. ` +
          `${completedCount}/${totalTasks} tasks have completed outputs. ` +
          `Reanchoring signal #${nextReanchoringNumber}.`;
        const reorientationDirective =
          `Refocus on the original objective. Completed outputs are diverging from the stated goal. ` +
          `Prioritize alignment with: ${missionBrief.objective.slice(0, 200)}`;

        const event: ReanchoringEvent = {
          type: 'reanchoring',
          runId,
          executionId,
          driftScore,
          objectiveRestatement,
          driftSummary,
          reorientationDirective,
          timestamp: new Date().toISOString(),
        };

        await logCoordinationEvent(runId, executionId, event);

        // Append anomaly to runState
        runState.anomalies.push(`Drift threshold exceeded: ${driftScore.toFixed(4)}`);

        // Update debounce state
        state.lastReanchoringAt = now;
        state.reanchoringCount = nextReanchoringNumber;

        console.warn(
          `[drift-detector] Reanchoring signal #${nextReanchoringNumber} fired for runId=${runId} ` +
          `driftScore=${driftScore.toFixed(4)}`,
        );
      }
    },
  };
}
