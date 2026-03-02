import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db, botSouls, negativeSignalRegister, agentClasses } from '@claw/db';
import { sql } from 'drizzle-orm';
import {
  SOUL_SEARCH_SIMILARITY_THRESHOLD,
  type TaskComplexity,
  type CampaignType,
} from '@claw/shared-types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');
const CAMPAIGN_BOOST = 0.05;
const CAMPAIGN_LINEAGE_THRESHOLD = 1; // must appear in > 1 execution to qualify for boost

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface SoulSearchParams {
  taskDescription: string;       // used to generate embedding for similarity search
  taskCategory: string;          // from task graph node classification
  requiredTools: string[];       // tools the task requires
  taskComplexity: TaskComplexity; // 'low' | 'medium' | 'high'
  campaignType: CampaignType;    // 'ad_hoc' | 'campaign'
  requiredPopulation: number;    // how many souls needed (search returns 2x this)
}

export interface SoulSearchResult {
  soulId: string;
  soulContent: string;
  embedding: number[];
  agentClass: 'Artisan' | 'Understudy' | 'Novice';
  generation: number;
  parentSoulId: string | null;
  taskCategory: string;
  compositeScore: number | null;  // from bots table if available
  similarityScore: number;        // cosine similarity to task description
  campaignBoost: number;          // 0 or positive boost for campaign souls
  finalRank: number;              // similarity + campaignBoost
}

// ─── Internal Types ────────────────────────────────────────────────────────────

interface RawSoulRow extends Record<string, unknown> {
  id: string;
  soul_content: string;
  embedding: number[];
  generation: number;
  parent_soul_id: string | null;
  task_category: string | null;
  dimensions: unknown;
  current_class: string | null;
  similarity_score: number;
}

// ─── Public Export: Search the Akashic Library ────────────────────────────────

/**
 * Search the Akashic Library for souls matching a task description.
 *
 * Applies multi-dimensional filtering:
 *  - Embedding cosine similarity >= SOUL_SEARCH_SIMILARITY_THRESHOLD (0.78)
 *  - Negative signal exclusion (SOUL-02)
 *  - Agent class filter from agent_classes table
 *  - Required tools filter (application-layer)
 *  - Task complexity filter (application-layer)
 *  - Campaign type weighting (application-layer)
 *
 * Returns a 2x pool of the required population size sorted by finalRank DESC.
 *
 * @param params - Search parameters including task description, filters, and population size
 * @returns Ranked array of SoulSearchResult (up to 2x requiredPopulation)
 */
export async function searchSoulLibrary(params: SoulSearchParams): Promise<SoulSearchResult[]> {
  const {
    taskDescription,
    taskCategory,
    requiredTools,
    taskComplexity,
    campaignType,
    requiredPopulation,
  } = params;

  // ── Step 1: Generate task embedding ────────────────────────────────────────
  console.log('[soul-library-search] Generating task embedding...');
  const { embedding: taskEmbedding } = await embed({
    model: EMBEDDING_MODEL,
    value: taskDescription,
  });
  console.log(`[soul-library-search] Task embedding generated (${taskEmbedding.length} dims)`);

  // ── Step 2: Query bot_souls with pgvector cosine similarity ────────────────
  // LEFT JOIN negative_signal_register on soul_id → filter WHERE nsr.id IS NULL (SOUL-02)
  // LEFT JOIN agent_classes on (bot_id, task_category) → extract current_class
  // Filter: is_archetype = false, task_category matches, similarity >= threshold
  console.log(
    `[soul-library-search] Querying library: category="${taskCategory}", threshold=${SOUL_SEARCH_SIMILARITY_THRESHOLD}`,
  );

  const embeddingVector = `[${taskEmbedding.join(',')}]`;

  const queryResult = await db.execute<RawSoulRow>(sql`
    SELECT
      bs.id,
      bs.soul_content,
      bs.embedding,
      bs.generation,
      bs.parent_soul_id,
      bs.task_category,
      bs.dimensions,
      ac.current_class,
      (1 - (bs.embedding <=> ${sql.raw(`'${embeddingVector}'::vector`)})) AS similarity_score
    FROM ${botSouls} bs
    LEFT JOIN ${negativeSignalRegister} nsr
      ON nsr.soul_id = bs.id
    LEFT JOIN ${agentClasses} ac
      ON ac.bot_id = bs.bot_id
      AND ac.task_category = ${taskCategory}
    WHERE
      bs.embedding IS NOT NULL
      AND bs.is_archetype = FALSE
      AND bs.task_category = ${taskCategory}
      AND (1 - (bs.embedding <=> ${sql.raw(`'${embeddingVector}'::vector`)})) >= ${SOUL_SEARCH_SIMILARITY_THRESHOLD}
      AND nsr.id IS NULL
    ORDER BY similarity_score DESC
  `);

  const rows: RawSoulRow[] = queryResult.rows;

  console.log(`[soul-library-search] Raw query returned ${rows.length} souls before app-layer filters`);

  // ── Step 3: Map raw rows to typed structs ──────────────────────────────────
  const mapped: Array<{
    soulId: string;
    soulContent: string;
    embedding: number[];
    generation: number;
    parentSoulId: string | null;
    taskCategory: string;
    dimensions: unknown;
    currentClass: 'Artisan' | 'Understudy' | 'Novice';
    similarityScore: number;
  }> = rows.map((row) => {
    const rawClass = row.current_class ?? 'Novice';
    const currentClass: 'Artisan' | 'Understudy' | 'Novice' =
      rawClass === 'Artisan' || rawClass === 'Understudy' ? rawClass : 'Novice';

    return {
      soulId: row.id,
      soulContent: row.soul_content,
      embedding: Array.isArray(row.embedding) ? row.embedding : [],
      generation: row.generation,
      parentSoulId: row.parent_soul_id,
      taskCategory: row.task_category ?? taskCategory,
      dimensions: row.dimensions,
      currentClass,
      similarityScore: typeof row.similarity_score === 'number' ? row.similarity_score : 0,
    };
  });

  // ── Step 4: Required tools filter (application-layer) ─────────────────────
  let filtered = mapped;

  if (requiredTools.length > 0) {
    console.log(`[soul-library-search] Filtering by required tools: [${requiredTools.join(', ')}]`);

    filtered = mapped.filter((soul) => {
      const dims = soul.dimensions as Record<string, unknown> | null;
      if (!dims) return false;

      const toolDoctrine =
        typeof dims['toolUsageDoctrine'] === 'string' ? dims['toolUsageDoctrine'] : '';
      const lowerDoctrine = toolDoctrine.toLowerCase();

      return requiredTools.every((tool) => lowerDoctrine.includes(tool.toLowerCase()));
    });

    console.log(`[soul-library-search] After tools filter: ${filtered.length} souls`);
  }

  // ── Step 5: Task complexity filter (application-layer) ────────────────────
  if (taskComplexity === 'high') {
    console.log(`[soul-library-search] High complexity: excluding Novice class souls`);

    filtered = filtered.filter((soul) => soul.currentClass !== 'Novice');

    console.log(`[soul-library-search] After complexity filter: ${filtered.length} souls`);
  }

  // ── Step 6: Campaign type weighting ───────────────────────────────────────
  // For 'campaign' type: souls with parentSoulId lineage used in > 1 execution
  // get a +0.05 boost. Determine this by counting siblings (other bot_souls rows
  // sharing the same parentSoulId) — a rough proxy for lineage reuse.
  console.log(`[soul-library-search] Applying campaign weighting (type="${campaignType}")`);

  // Gather parentSoulIds from the filtered set to count lineage reuse
  const parentIdCounts: Map<string, number> = new Map();
  if (campaignType === 'campaign') {
    const parentIds = filtered
      .map((s) => s.parentSoulId)
      .filter((id): id is string => id !== null);

    if (parentIds.length > 0) {
      const uniqueParentIds = [...new Set(parentIds)];

      // Count siblings per parentSoulId — more siblings = more lineage reuse
      interface LineageRow extends Record<string, unknown> { parent_soul_id: string; sibling_count: number; }
      const lineageResult = await db.execute<LineageRow>(sql`
        SELECT parent_soul_id, COUNT(*)::int AS sibling_count
        FROM ${botSouls}
        WHERE parent_soul_id = ANY(${sql.raw(`ARRAY[${uniqueParentIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})
          AND is_archetype = FALSE
        GROUP BY parent_soul_id
      `);

      for (const row of lineageResult.rows) {
        parentIdCounts.set(row.parent_soul_id, row.sibling_count);
      }
    }
  }

  // ── Step 7: Compute finalRank and build results ────────────────────────────
  const results: SoulSearchResult[] = filtered.map((soul) => {
    let campaignBoost = 0;

    if (campaignType === 'campaign' && soul.parentSoulId !== null) {
      const siblingCount = parentIdCounts.get(soul.parentSoulId) ?? 0;
      if (siblingCount > CAMPAIGN_LINEAGE_THRESHOLD) {
        campaignBoost = CAMPAIGN_BOOST;
      }
    }

    const finalRank = soul.similarityScore + campaignBoost;

    return {
      soulId: soul.soulId,
      soulContent: soul.soulContent,
      embedding: soul.embedding,
      agentClass: soul.currentClass,
      generation: soul.generation,
      parentSoulId: soul.parentSoulId,
      taskCategory: soul.taskCategory,
      compositeScore: null,  // composite score from bots table not needed at search time
      similarityScore: soul.similarityScore,
      campaignBoost,
      finalRank,
    };
  });

  // ── Step 8: Sort by finalRank DESC ────────────────────────────────────────
  results.sort((a, b) => b.finalRank - a.finalRank);

  // ── Step 9: Return 2x pool (SOUL-03) ─────────────────────────────────────
  const poolSize = requiredPopulation * 2;
  const pool = results.slice(0, poolSize);

  console.log(
    `[soul-library-search] Search complete: ${pool.length} souls in 2x pool (required=${requiredPopulation}, available=${results.length})`,
  );

  return pool;
}
