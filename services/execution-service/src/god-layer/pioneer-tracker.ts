/**
 * Pioneer Tracker
 *
 * Detects the first confirmed run in a task category (pioneer event) and
 * instantiates a category_benchmarks row. On subsequent runs, increments
 * confirmedRunCount and updates maturity flags.
 *
 * GODL-06: Pioneer detection + benchmark instantiation.
 *
 * Baseline score is NEVER updated after initial insert — the pioneer's
 * baseline is permanent, per research anti-pattern guidance.
 *
 * Accepts a Drizzle transaction context so it executes within the God Layer
 * worker's DB transaction boundary.
 */

import { eq } from 'drizzle-orm';
import { db } from '@claw/db';
import { categoryBenchmarks } from '@claw/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PioneerResult {
  isPioneer: boolean;
  benchmarkMature: boolean;
  baselineCompositeScore: string; // numeric string
}

// ---------------------------------------------------------------------------
// Transaction type alias
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Maturity thresholds
// ---------------------------------------------------------------------------

/** benchmarkMature and standardPromotion flip at 3 confirmed runs. */
const MATURE_THRESHOLD = 3;

/** thinDataFlag is cleared at 5 confirmed runs. */
const THIN_DATA_CLEAR_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Detect and track a pioneer event for the given taskCategory.
 *
 * - If no category_benchmarks row exists: inserts one (pioneer event).
 * - If a row exists: increments confirmedRunCount and updates maturity flags.
 *
 * CRITICAL: baselineCompositeScore is written on pioneer insert and never
 * changed — subsequent runs only update counters and maturity flags.
 */
export async function detectAndTrackPioneer(
  tx: Tx,
  params: {
    taskCategory: string;
    botId: string;
    soulId: string | null;
    executionId: string;
    compositeScore: string;
  },
): Promise<PioneerResult> {
  // Query for existing benchmark row
  const existing = await tx
    .select()
    .from(categoryBenchmarks)
    .where(eq(categoryBenchmarks.taskCategory, params.taskCategory));

  const existingRow = existing[0];

  if (existingRow === undefined) {
    // Pioneer event: first confirmed run in this task category
    await tx.insert(categoryBenchmarks).values({
      taskCategory: params.taskCategory,
      pioneerBotId: params.botId,
      pioneerSoulId: params.soulId ?? undefined,
      pioneerExecutionId: params.executionId,
      baselineCompositeScore: params.compositeScore,
      confirmedRunCount: 1,
      thinDataFlag: true,
      benchmarkMature: false,
      standardPromotion: false,
    });

    return {
      isPioneer: true,
      benchmarkMature: false,
      baselineCompositeScore: params.compositeScore,
    };
  }

  // Subsequent run: increment counter and update maturity flags
  const updatedRunCount = existingRow.confirmedRunCount + 1;
  const benchmarkMature = updatedRunCount >= MATURE_THRESHOLD;
  const standardPromotion = updatedRunCount >= MATURE_THRESHOLD;
  const thinDataFlag = updatedRunCount < THIN_DATA_CLEAR_THRESHOLD;

  await tx
    .update(categoryBenchmarks)
    .set({
      confirmedRunCount: updatedRunCount,
      benchmarkMature,
      standardPromotion,
      thinDataFlag,
      updatedAt: new Date(),
    })
    .where(eq(categoryBenchmarks.taskCategory, params.taskCategory));

  return {
    isPioneer: false,
    benchmarkMature,
    baselineCompositeScore: existingRow.baselineCompositeScore,
  };
}
