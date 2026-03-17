import { db, akashicLibrary, negativeSignalRegister } from '@claw/db';
import type { AkashicLibraryEntry, NegativeSignalEntry } from '@claw/db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface SoulSeed {
  soulId: string;
  parentSoulId: string | null;
  objectiveCategory: string;
  agentClass: string;
  avgCompositeScore: number;
  soulMd: string;
  directives: AkashicLibraryEntry['soulSnapshot']['directives'];
  mutationLineage: string[];
  successPatterns: AkashicLibraryEntry['successPatterns'];
}

export interface FailureConstraints {
  objectiveCategory: string;
  mutationBlacklist: string[];
  failingDirectiveIds: string[];
  failureSummaries: string[];
}

export interface LineageNode {
  soulId: string;
  parentSoulId: string | null;
  agentClass: string;
  avgCompositeScore: number;
  archivedAt: Date;
}

// ──────────────────────────────────────────────────────────────────────────────
// Query functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve the top archived Artisan souls for a given task category.
 *
 * Used by the mutation engine to seed new soul populations. Returns souls
 * ordered by avgCompositeScore descending, limited to `limit` results.
 *
 * @param objectiveCategory - Category slug (e.g. "lead-generation-campaign")
 * @param limit - Maximum number of souls to return (default 5)
 */
export async function getTopArchivedSoulsForCategory(
  objectiveCategory: string,
  limit = 5,
): Promise<SoulSeed[]> {
  const rows = await db
    .select()
    .from(akashicLibrary)
    .where(
      and(
        eq(akashicLibrary.objectiveCategory, objectiveCategory),
        eq(akashicLibrary.agentClass, 'artisan'),
      ),
    )
    .orderBy(desc(akashicLibrary.avgCompositeScore))
    .limit(limit);

  return rows.map((row) => ({
    soulId: row.soulId,
    parentSoulId: row.parentSoulId,
    objectiveCategory: row.objectiveCategory,
    agentClass: row.agentClass,
    avgCompositeScore: Number(row.avgCompositeScore),
    soulMd: row.soulSnapshot.soulMd,
    directives: row.soulSnapshot.directives,
    mutationLineage: row.soulSnapshot.mutationLineage,
    successPatterns: row.successPatterns,
  }));
}

/**
 * Retrieve aggregated failure patterns for a given category.
 *
 * Used by the mutation engine as a constraint layer — prevents regenerating
 * directive combinations or mutation paths that previously produced failure.
 *
 * @param objectiveCategory - Category slug
 */
export async function getFailurePatternsForCategory(
  objectiveCategory: string,
): Promise<FailureConstraints> {
  const rows = await db
    .select()
    .from(negativeSignalRegister)
    .where(eq(negativeSignalRegister.objectiveCategory, objectiveCategory))
    .orderBy(desc(negativeSignalRegister.createdAt));

  // Aggregate across all negative signals for this category
  const mutationBlacklist = Array.from(
    new Set(rows.flatMap((r) => r.mutationBlacklist)),
  );
  const failingDirectiveIds = Array.from(
    new Set(rows.flatMap((r) => r.failingDirectiveIds)),
  );
  const failureSummaries = rows.map((r) => r.failureSummary);

  return {
    objectiveCategory,
    mutationBlacklist,
    failingDirectiveIds,
    failureSummaries,
  };
}

/**
 * Retrieve the full soul lineage via BFS traversal through parentSoulId chain.
 *
 * Returns nodes ordered from root ancestor to the provided soulId, enabling
 * full evolutionary history visualisation. Caps at 50 hops to prevent infinite
 * loops from malformed data.
 *
 * @param soulId - The soul to trace ancestry from
 */
export async function getSoulLineage(soulId: string): Promise<LineageNode[]> {
  const MAX_HOPS = 50;
  const visited = new Set<string>();
  const lineage: LineageNode[] = [];

  // Fetch the entry for this soul
  const [startRow] = await db
    .select()
    .from(akashicLibrary)
    .where(eq(akashicLibrary.soulId, soulId))
    .orderBy(desc(akashicLibrary.archivedAt))
    .limit(1);

  if (!startRow) return [];

  // BFS queue: traverse upwards through parentSoulId
  const queue: string[] = [soulId];

  while (queue.length > 0 && lineage.length < MAX_HOPS) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const [row] = await db
      .select()
      .from(akashicLibrary)
      .where(eq(akashicLibrary.soulId, currentId))
      .orderBy(desc(akashicLibrary.archivedAt))
      .limit(1);

    if (!row) continue;

    lineage.unshift({
      soulId: row.soulId,
      parentSoulId: row.parentSoulId,
      agentClass: row.agentClass,
      avgCompositeScore: Number(row.avgCompositeScore),
      archivedAt: row.archivedAt,
    });

    if (row.parentSoulId && !visited.has(row.parentSoulId)) {
      queue.push(row.parentSoulId);
    }
  }

  return lineage;
}

/**
 * Retrieve recent high-performing souls across all categories.
 *
 * Used for diverse seeding when a category has insufficient Artisan souls.
 * Returns top performers ordered by avgCompositeScore, excluding the
 * target category to maximize diversity.
 *
 * @param excludeCategory - Category to exclude (the target category being seeded)
 * @param limit - Maximum results (default 10)
 */
export async function getRecentHighPerformers(
  excludeCategory: string,
  limit = 10,
): Promise<SoulSeed[]> {
  const rows = await db
    .select()
    .from(akashicLibrary)
    .where(
      and(
        sql`${akashicLibrary.objectiveCategory} != ${excludeCategory}`,
        eq(akashicLibrary.agentClass, 'artisan'),
      ),
    )
    .orderBy(desc(akashicLibrary.avgCompositeScore))
    .limit(limit);

  return rows.map((row) => ({
    soulId: row.soulId,
    parentSoulId: row.parentSoulId,
    objectiveCategory: row.objectiveCategory,
    agentClass: row.agentClass,
    avgCompositeScore: Number(row.avgCompositeScore),
    soulMd: row.soulSnapshot.soulMd,
    directives: row.soulSnapshot.directives,
    mutationLineage: row.soulSnapshot.mutationLineage,
    successPatterns: row.successPatterns,
  }));
}
