/**
 * DNA Writer
 *
 * Writes versioned DNA entries to dna_store.
 *
 * GODL-02: Full GODL-02 payload is written on every insert.
 * GODL-03: Insert-only — never updates existing rows. Version is computed
 *           as MAX(version) + 1 for the (objectiveCategory, soulId) pair.
 * GODL-04: isProvisional is set to true when weightedConfidenceScore < GODL_CONFIDENCE_THRESHOLD.
 *
 * Accepts a Drizzle transaction context so it executes within the God Layer
 * worker's DB transaction boundary.
 */

import { max, eq, and, isNull } from 'drizzle-orm';
import { db } from '@claw/db';
import { dnaStore, type DnaPayload } from '@claw/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** GODL-04: DNA entries below this confidence score are marked provisional. */
export const GODL_CONFIDENCE_THRESHOLD = 0.50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DnaWriteParams {
  botId: string;
  executionId: string;
  soulId: string;
  taskCategory: string;
  compositeScore: string;           // numeric string from DB
  agentClass: string;               // Novice | Understudy | Artisan
  soulContent: string;
  parentSoulIds: string[] | null;
  mutationLineage: unknown | null;
  dnaPayload: DnaPayload;           // full GODL-02 extended payload
  weightedConfidenceScore: number;
}

// ---------------------------------------------------------------------------
// Transaction type alias
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Insert a new versioned DNA entry into dna_store.
 *
 * Version is computed as MAX(version) + 1 scoped to (objectiveCategory, soulId).
 * If no prior rows exist, version defaults to 1.
 *
 * CRITICAL: This function only INSERTs — it never UPDATEs existing dna_store
 * rows. The version uniqueness constraint on (objectiveCategory, soulId, version)
 * will catch any duplicate attempts.
 */
export async function writeVersionedDnaEntry(
  tx: Tx,
  params: DnaWriteParams,
): Promise<{ version: number; isProvisional: boolean }> {
  // Compute next version: MAX(version) WHERE objectiveCategory = ? AND soulId = ?
  const [maxResult] = await tx
    .select({ maxVersion: max(dnaStore.version) })
    .from(dnaStore)
    .where(
      and(
        eq(dnaStore.objectiveCategory, params.taskCategory),
        eq(dnaStore.soulId, params.soulId),
      ),
    );

  const currentMax = maxResult?.maxVersion ?? null;
  const version = currentMax !== null ? currentMax + 1 : 1;

  // GODL-04: Mark provisional if confidence below threshold
  const isProvisional = params.weightedConfidenceScore < GODL_CONFIDENCE_THRESHOLD;

  await tx.insert(dnaStore).values({
    botId: params.botId,
    executionId: params.executionId,
    objectiveCategory: params.taskCategory,
    soulId: params.soulId,
    version,
    compositeScore: params.compositeScore,
    isProvisional,
    parentSoulIds: params.parentSoulIds ?? undefined,
    mutationLineage: params.mutationLineage ?? undefined,
    dnaPayload: params.dnaPayload,
  });

  return { version, isProvisional };
}
