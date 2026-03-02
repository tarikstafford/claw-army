import { db, ringLeaderFitness, ringLeaderRuns } from '@claw/db';
import type {
  RingLeaderMissionBrief,
  RingLeaderRunState,
  RingLeaderSynthesis,
  PopulationManifest,
  RingLeaderFitnessScore,
} from '@claw/shared-types';
import { FITNESS_CATEGORY_WEIGHTS } from '@claw/shared-types';
import { eq } from 'drizzle-orm';
import { scoreCoordinationQuality } from './coordination-scorer';
import { scoreSoulSelectionQuality } from './soul-selection-scorer';
import { evaluateRingLeaderPromotion } from './ring-leader-class-progression';
import type { CoordinationLogEntry } from './coordination-events';

// ─── Params Interface ──────────────────────────────────────────────────────────

export interface FitnessParams {
  runId: string;
  executionId: string;
  synthesis: RingLeaderSynthesis;
  manifests: PopulationManifest[];
  missionBrief: RingLeaderMissionBrief;
  runState: RingLeaderRunState;
  coordinationLog: CoordinationLogEntry[];
}

// ─── Helper: Resolve soul ID for a ring leader run ────────────────────────────

/**
 * Fetch the soulId for a Ring Leader run.
 * Returns null if the run has no assigned soul (early phases, test runs).
 */
async function getSoulIdForRun(runId: string): Promise<string | null> {
  const [row] = await db
    .select({ soulId: ringLeaderRuns.soulId })
    .from(ringLeaderRuns)
    .where(eq(ringLeaderRuns.id, runId))
    .limit(1);
  return row?.soulId ?? null;
}

// ─── Library Search Query Derivation ──────────────────────────────────────────

/**
 * Derive library search query summaries from population manifests.
 * Provides per-task context: which souls were assigned, their sources,
 * and whether the task was a pioneer deployment.
 */
function deriveLibrarySearchQueries(manifests: PopulationManifest[]): unknown[] {
  return manifests.map((manifest) => {
    const sources = [...new Set(manifest.assignedSouls.map((s) => s.source))];
    return {
      taskId: manifest.taskId,
      taskDescription: manifest.taskDescription,
      soulCount: manifest.assignedSouls.length,
      sources,
      pioneerFlag: manifest.pioneerFlag,
    };
  });
}

// ─── Mutation Success Rate Computation ────────────────────────────────────────

/**
 * Compute mutation success rate for FIT-04 Akashic Library metadata.
 *
 * Numerator: mutated souls assigned to completed tasks (per synthesis.taskSummary).
 * Denominator: total mutated souls across all manifests.
 * Returns null if no mutations were applied.
 * Returns formatted string "0.000"-"1.000" for numeric(4,3) column.
 */
function computeMutationSuccessRate(
  manifests: PopulationManifest[],
  synthesis: RingLeaderSynthesis,
): string | null {
  // Collect completed task IDs from synthesis
  const completedTaskIds = new Set(
    synthesis.taskSummary.filter((t) => t.completed).map((t) => t.taskId),
  );

  let totalMutated = 0;
  let mutatedOnCompletedTasks = 0;

  for (const manifest of manifests) {
    const isCompletedTask = completedTaskIds.has(manifest.taskId);
    for (const soul of manifest.assignedSouls) {
      if (soul.mutationApplied !== null) {
        totalMutated++;
        if (isCompletedTask) {
          mutatedOnCompletedTasks++;
        }
      }
    }
  }

  if (totalMutated === 0) return null;

  const rate = mutatedOnCompletedTasks / totalMutated;
  return rate.toFixed(3);
}

// ─── Public Export ─────────────────────────────────────────────────────────────

/**
 * Compute composite Ring Leader fitness score and persist to the Akashic Library
 * (ring_leader_fitness table) with all FIT-03 and FIT-04 metadata fields.
 *
 * Steps:
 * 1. Call both scorers in parallel (coordination + soul selection)
 * 2. Compute composite score: coordination 60% + soul selection 40%
 * 3. Derive Akashic Library metadata from manifests and synthesis
 * 4. Persist to ring_leader_fitness table
 *
 * Non-fatal: errors are caught and logged as WARN. Run completion is never blocked.
 *
 * @param params - FitnessParams with all run context
 * @returns RingLeaderFitnessScore on success, null on failure
 */
export async function computeAndPersistFitness(
  params: FitnessParams,
): Promise<RingLeaderFitnessScore | null> {
  const { runId, executionId, synthesis, manifests, missionBrief, runState, coordinationLog } =
    params;

  try {
    // ── Step 1: Score both dimensions in parallel ─────────────────────────────
    const [coordScore, selScore] = await Promise.all([
      scoreCoordinationQuality({ synthesis, coordinationLog, missionBrief, runState }),
      scoreSoulSelectionQuality({ synthesis, manifests, missionBrief }),
    ]);

    // ── Step 2: Compute composite score (FIT-03) ──────────────────────────────
    // Coordination weighted sub-score (4 dimensions × their individual weights)
    const coordWeighted =
      coordScore.collectiveOutcome * 0.40 +
      coordScore.driftPrevention * 0.25 +
      coordScore.reallocationEffectiveness * 0.20 +
      coordScore.budgetManagement * 0.15;

    // Soul selection weighted sub-score (5 dimensions, equal weight)
    const selectionWeighted =
      (selScore.librarySearchQuality +
        selScore.differentiationEffectiveness +
        selScore.mutationDecisionQuality +
        selScore.pioneerHandling +
        selScore.selectionRetrospectiveQuality) /
      5;

    // Final composite: coordination 60% + soul selection 40%
    const compositeScore = parseFloat(
      (
        coordWeighted * FITNESS_CATEGORY_WEIGHTS.coordination +
        selectionWeighted * FITNESS_CATEGORY_WEIGHTS.soulSelection
      ).toFixed(2),
    );

    // ── Step 3: Derive FIT-04 Akashic Library metadata ────────────────────────
    const soulSelectionLog = manifests;
    const searchQuerySummary = deriveLibrarySearchQueries(manifests);
    const selectionRetrospective = synthesis.soulSelectionRetrospective;

    // Pioneer tasks: count of manifests with pioneerFlag === true
    const pioneerCount = manifests.filter((m) => m.pioneerFlag).length;

    // Mutation operations: count of souls with mutationApplied !== null
    const mutationCount = manifests.reduce(
      (sum, m) => sum + m.assignedSouls.filter((s) => s.mutationApplied !== null).length,
      0,
    );

    // Mutation success rate (null if no mutations)
    const mutationRate = computeMutationSuccessRate(manifests, synthesis);

    // ── Step 4: Persist to ring_leader_fitness table ──────────────────────────
    await db.insert(ringLeaderFitness).values({
      ringLeaderRunId: runId,
      coordinationScore: coordScore,
      soulSelectionScore: selScore,
      compositeScore: compositeScore.toFixed(2),
      soulSelectionLog: soulSelectionLog,
      librarySearchQueries: searchQuerySummary,
      selectionRetrospective,
      pioneerTasksHandled: pioneerCount,
      mutationOperationsApplied: mutationCount,
      mutationSuccessRate: mutationRate,
    });

    // ── Step 5: Evaluate Ring Leader class progression (non-fatal) ───────────
    try {
      const soulId = await getSoulIdForRun(runId);
      if (soulId) {
        const promotionResult = await evaluateRingLeaderPromotion({
          soulId,
          ringLeaderRunId: runId,
          compositeScore,
        });
        if (promotionResult.promoted) {
          console.info(
            `[ring-leader-fitness] Ring Leader promoted: ${promotionResult.previousClass} -> ${promotionResult.newClass} after ${promotionResult.runCount} runs`,
          );
        }
      }
    } catch (promotionErr) {
      console.warn(
        `[ring-leader-fitness] Class progression evaluation failed for runId=${runId} — non-fatal:`,
        (promotionErr as Error).message,
      );
    }

    // ── Step 6: Log success ───────────────────────────────────────────────────
    console.info(
      `[ring-leader-fitness] Persisted fitness for runId=${runId} ` +
        `composite=${compositeScore} ` +
        `coordination=${coordWeighted.toFixed(3)} ` +
        `soulSelection=${selectionWeighted.toFixed(3)}`,
    );

    // Suppress unused variable warning for executionId (available if needed for future use)
    void executionId;

    const fitnessScore: RingLeaderFitnessScore = {
      coordinationScore: coordScore,
      soulSelectionScore: selScore,
      compositeScore,
    };

    return fitnessScore;
  } catch (err) {
    const message = (err as Error).message;
    console.warn(
      `[ring-leader-fitness] Fitness scoring failed for runId=${runId} — non-fatal, run already complete:`,
      message,
    );
    return null;
  }
}
