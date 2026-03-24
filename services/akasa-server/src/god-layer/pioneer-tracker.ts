/**
 * Pioneer Tracker
 *
 * Tracks first-in-category achievements.
 * Detects the first confirmed run in a task category (pioneer event)
 * and instantiates a category_benchmarks row.
 * On subsequent runs, increments confirmedRunCount and updates maturity flags.
 */

import { eq } from 'drizzle-orm';
import { db, categoryBenchmarks } from '@claw/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** benchmarkMature flips at 3 confirmed runs. */
const MATURE_THRESHOLD = 3;

/** thinDataFlag is cleared at 5 confirmed runs. */
const THIN_DATA_CLEAR_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Check if a bot is a pioneer in a task category and record it.
 *
 * - If no category_benchmarks row exists: inserts one (pioneer event). Returns true.
 * - If a row exists: increments confirmedRunCount and updates maturity flags. Returns false.
 *
 * Returns true if pioneer was established, false otherwise.
 */
export async function checkAndRecordPioneer(
  botId: string,
  soulId: string | null | undefined,
  taskCategory: string,
  compositeScore: string,
): Promise<boolean> {
  // Query for existing benchmark row
  const existing = await db
    .select()
    .from(categoryBenchmarks)
    .where(eq(categoryBenchmarks.taskCategory, taskCategory));

  const existingRow = existing[0];

  if (existingRow === undefined) {
    // Pioneer event: first confirmed run in this task category
    await db.insert(categoryBenchmarks).values({
      taskCategory,
      pioneerBotId: botId,
      pioneerSoulId: soulId ?? undefined,
      pioneerExecutionId: botId, // use botId as placeholder; real executionId passed if available
      baselineCompositeScore: compositeScore,
      confirmedRunCount: 1,
      thinDataFlag: true,
      benchmarkMature: false,
      standardPromotion: false,
    } as any);

    return true;
  }

  // Subsequent run: increment counter and update maturity flags
  const updatedRunCount = existingRow.confirmedRunCount + 1;
  const benchmarkMature = updatedRunCount >= MATURE_THRESHOLD;
  const standardPromotion = updatedRunCount >= MATURE_THRESHOLD;
  const thinDataFlag = updatedRunCount < THIN_DATA_CLEAR_THRESHOLD;

  await db
    .update(categoryBenchmarks)
    .set({
      confirmedRunCount: updatedRunCount,
      benchmarkMature,
      standardPromotion,
      thinDataFlag,
      updatedAt: new Date(),
    })
    .where(eq(categoryBenchmarks.taskCategory, taskCategory));

  return false;
}
