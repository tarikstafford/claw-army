import { db, dnaStore, soulRunScores, akashicLibrary, negativeSignalRegister } from '@claw/db';
import type { ArchivalSoulSnapshot, SuccessPattern } from '@claw/db';
import { eq, and, avg, count, desc, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface RetiredSoulContext {
  soulId: string;
  parentSoulId?: string;
  botId: string;
  objectiveCategory: string;
  agentClass: 'novice' | 'understudy' | 'artisan';
  soulMd: string;
  directives: Array<{
    id: string;
    text: string;
    dimension: string;
    weight: number;
  }>;
  mutationLineage: string[];
  /** Whether the soul was retired after demotion (vs graduated promotion) */
  retiredAfterDemotion: boolean;
  /** Human-readable reason for retirement */
  retirementReason?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate soul_run_scores for a given soulId.
 */
async function getSoulRunStats(soulId: string): Promise<{
  avgScore: number;
  runCount: number;
  finalScore: number;
}> {
  const [statsRow] = await db
    .select({
      avgScore: avg(soulRunScores.compositeScore),
      runCount: count(),
    })
    .from(soulRunScores)
    .where(eq(soulRunScores.soulId, soulId));

  const [latestRow] = await db
    .select({ compositeScore: soulRunScores.compositeScore })
    .from(soulRunScores)
    .where(eq(soulRunScores.soulId, soulId))
    .orderBy(desc(soulRunScores.scoredAt))
    .limit(1);

  return {
    avgScore: Number(statsRow?.avgScore ?? 0),
    runCount: Number(statsRow?.runCount ?? 0),
    finalScore: Number(latestRow?.compositeScore ?? 0),
  };
}

/**
 * Extract success patterns from the dna_store for a given bot/category.
 * Reads the top-scoring DNA payloads and surfaces high-signal tool sequences.
 */
async function extractSuccessPatterns(
  botId: string,
  objectiveCategory: string,
): Promise<SuccessPattern[]> {
  const topDnaRows = await db
    .select({
      dnaPayload: dnaStore.dnaPayload,
      compositeScore: dnaStore.compositeScore,
    })
    .from(dnaStore)
    .where(
      and(
        eq(dnaStore.botId, botId),
        eq(dnaStore.objectiveCategory, objectiveCategory),
      ),
    )
    .orderBy(desc(dnaStore.compositeScore))
    .limit(10);

  if (topDnaRows.length === 0) return [];

  const avgScore =
    topDnaRows.reduce((sum, r) => sum + Number(r.compositeScore), 0) / topDnaRows.length;

  // Collect unique high-signal tool sequences from top-scoring DNA
  const sequences = topDnaRows.map((r) => r.dnaPayload.toolCallSequence);
  const uniqueSequences = sequences.filter(
    (seq, i) => sequences.findIndex((s) => JSON.stringify(s) === JSON.stringify(seq)) === i,
  );

  return [
    {
      category: objectiveCategory,
      highSignalToolSequences: uniqueSequences,
      activeDirectiveIds: [], // populated by soul analyst — empty for now
      avgCompositeScore: avgScore,
      runCount: topDnaRows.length,
    },
  ];
}

/**
 * Extract directive activation counts from soul_run_scores telemetry.
 * Returns a map of directiveId -> activation count (placeholder for full
 * directive tracking — real values come from soul analyst council output).
 */
async function buildDirectiveActivations(
  soulId: string,
  directives: RetiredSoulContext['directives'],
): Promise<Record<string, number>> {
  const activations: Record<string, number> = {};
  for (const d of directives) {
    // Placeholder: count runs as proxy for activation
    // Real implementation: join with council output when God Layer is built
    const [row] = await db
      .select({ runCount: count() })
      .from(soulRunScores)
      .where(eq(soulRunScores.soulId, soulId));
    activations[d.id] = Number(row?.runCount ?? 0);
  }
  return activations;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Archive a retired soul into the Akashic Library.
 *
 * Should be called inside a DB transaction after the negative signal write
 * (God Layer step 5i). The archival is designed to be idempotent — if called
 * twice for the same soulId, it simply adds another versioned entry.
 *
 * Pipeline:
 * 1. Aggregate soul_run_scores → avgCompositeScore, runCount, finalScore
 * 2. Extract success patterns from dna_store (top-scoring DNA payloads)
 * 3. Build directive activation map
 * 4. Construct self-contained soulSnapshot (immutable denormalized record)
 * 5. Write to akashic_library
 * 6. If retired after demotion: write to negative_signal_register
 *
 * @param ctx - Retired soul context with full config and retirement reason
 */
export async function archiveRetiredSoul(ctx: RetiredSoulContext): Promise<void> {
  const {
    soulId,
    parentSoulId,
    botId,
    objectiveCategory,
    agentClass,
    soulMd,
    directives,
    mutationLineage,
    retiredAfterDemotion,
    retirementReason,
  } = ctx;

  console.log('[soul-archiver] Archiving soul:', { soulId, objectiveCategory, agentClass, retiredAfterDemotion });

  // ── 1. Run stats ────────────────────────────────────────────────────────────
  const { avgScore, runCount, finalScore } = await getSoulRunStats(soulId);

  // ── 2. Success patterns from dna_store ─────────────────────────────────────
  const successPatterns = await extractSuccessPatterns(botId, objectiveCategory);

  // ── 3. Directive activations ────────────────────────────────────────────────
  const directiveActivations = await buildDirectiveActivations(soulId, directives);

  // ── 4. Failure patterns (summary strings for negative signal) ───────────────
  const failurePatterns: string[] = retiredAfterDemotion && retirementReason
    ? [retirementReason]
    : [];

  // ── 5. Soul snapshot (self-contained, immutable) ────────────────────────────
  const soulSnapshot: ArchivalSoulSnapshot = {
    soulMd,
    directives,
    mutationLineage,
    finalClass: agentClass,
    finalScore,
  };

  // ── 6. Write to akashic_library ─────────────────────────────────────────────
  await db.insert(akashicLibrary).values({
    soulId,
    parentSoulId: parentSoulId ?? null,
    objectiveCategory,
    agentClass,
    avgCompositeScore: avgScore.toFixed(2),
    runCount,
    successPatterns,
    failurePatterns,
    directiveActivations,
    soulSnapshot,
  });

  console.log('[soul-archiver] Written to akashic_library:', { soulId, avgScore, runCount });

  // ── 7. Write negative signal if retired after demotion ─────────────────────
  if (retiredAfterDemotion) {
    const failingDirectiveIds = directives
      .filter((d) => (directiveActivations[d.id] ?? 0) > 0)
      .map((d) => d.id);

    await db.insert(negativeSignalRegister).values({
      soulId,
      objectiveCategory,
      failureSummary: retirementReason ?? 'Retired after consecutive below-benchmark runs',
      failingDirectiveIds,
      mutationBlacklist: mutationLineage,
      evidencePayload: {
        agentClass,
        avgCompositeScore: avgScore,
        finalScore,
        runCount,
      },
    });

    console.log('[soul-archiver] Written to negative_signal_register:', { soulId, objectiveCategory });
  }
}
