import { generateText, embed, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { SOUL_DIFFERENTIATION_THRESHOLD, type SoulSelectionEntry } from '@claw/shared-types';
import type { SoulSearchResult } from './soul-library-search';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');
const CLASS_PRIORITY: Record<'Artisan' | 'Understudy' | 'Novice', number> = {
  Artisan: 0,
  Understudy: 1,
  Novice: 2,
};

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface PoolSelectionParams {
  pool: SoulSearchResult[];          // ranked search results from soul-library-search
  requiredPopulation: number;        // how many to select
  varianceIntent: string | null;     // rationale for multi-soul assignment (SOUL-07), null if not applicable
}

export interface SelectedSoul extends SoulSelectionEntry {
  soulContent: string;   // needed downstream for SOUL.md injection
  embedding: number[];   // needed for differentiation checks
}

export interface MutationResult {
  mutatedContent: string;
  mutatedEmbedding: number[];
  operation: string;
  rationale: string;
}

// ─── Helper: Parse inviolable constitution directives from soul content ────────

function parseConstitutionDirectives(soulContent: string): string[] {
  const lines = soulContent.split('\n');
  const directives: string[] = [];
  let inEthicalSection = false;

  for (const line of lines) {
    if (/^##\s+Ethical Hard Stops/i.test(line)) {
      inEthicalSection = true;
      continue;
    }

    if (inEthicalSection) {
      if (/^##\s/.test(line)) {
        // New section started — stop collecting
        break;
      }
      if (line.includes('INVIOLABLE:') || line.trimStart().startsWith('INVIOLABLE:')) {
        directives.push(line.trim());
      }
    }
  }

  // Also collect any top-level INVIOLABLE lines outside the section
  for (const line of lines) {
    if (line.trimStart().startsWith('INVIOLABLE:') && !directives.includes(line.trim())) {
      directives.push(line.trim());
    }
  }

  return directives;
}

// ─── Public Export: Select from pool with class-priority + differentiation ─────

/**
 * Select a differentiated set of souls from a ranked pool.
 *
 * Selection logic (SOUL-04):
 *  1. Re-sort pool by class priority (Artisan > Understudy > Novice), preserving
 *     finalRank order within each tier.
 *  2. Greedy selection: skip any candidate whose cosine similarity to ANY already-
 *     selected soul is >= SOUL_DIFFERENTIATION_THRESHOLD (0.85).
 *  3. Stop when requiredPopulation souls are selected or pool is exhausted.
 *  4. Build SoulSelectionEntry for each selected soul.
 *
 * If fewer than requiredPopulation souls can be selected (pool exhausted or all
 * too similar), returns what was selected — caller handles the shortfall via
 * pioneer path.
 *
 * @param params - Pool, required population size, and optional variance intent
 * @returns Array of SelectedSoul (may be shorter than requiredPopulation if pool insufficient)
 */
export function selectFromPool(params: PoolSelectionParams): SelectedSoul[] {
  const { pool, requiredPopulation, varianceIntent } = params;

  // ── Step 1: Sort pool by class priority (Artisan first), preserving finalRank within tier ──
  const sorted = [...pool].sort((a, b) => {
    const priorityDiff = CLASS_PRIORITY[a.agentClass] - CLASS_PRIORITY[b.agentClass];
    if (priorityDiff !== 0) return priorityDiff;
    // Same class tier — preserve descending finalRank from search
    return b.finalRank - a.finalRank;
  });

  console.log(
    `[population-assembler] Pool sorted by class priority: ${sorted.map((s) => `${s.agentClass}(rank=${s.finalRank.toFixed(3)})`).join(', ')}`,
  );

  // ── Step 2: Greedy selection with differentiation enforcement ──────────────
  const selected: SelectedSoul[] = [];

  for (const candidate of sorted) {
    if (selected.length >= requiredPopulation) break;

    // Check pairwise similarity against all already-selected souls
    let maxSimilarity = 0;
    let tooSimilar = false;

    for (const existing of selected) {
      const similarity = cosineSimilarity(candidate.embedding, existing.embedding);
      if (similarity > maxSimilarity) maxSimilarity = similarity;

      if (similarity >= SOUL_DIFFERENTIATION_THRESHOLD) {
        tooSimilar = true;
        console.log(
          `[population-assembler] SKIP candidate soulId=${candidate.soulId} (${candidate.agentClass}): ` +
          `cosine similarity ${similarity.toFixed(3)} >= ${SOUL_DIFFERENTIATION_THRESHOLD} with soulId=${existing.soulId}`,
        );
        break;
      }
    }

    if (tooSimilar) continue;

    // ── Step 3: Compute differentiationScore (1 - maxSimilarity, or 1.0 if first) ──
    const differentiationScore = selected.length === 0 ? 1.0 : 1.0 - maxSimilarity;
    const rank = selected.length + 1;

    const rationaleBase = `Rank #${rank} in pool (similarity: ${candidate.similarityScore.toFixed(3)}, class: ${candidate.agentClass})`;
    const selectionRationale = varianceIntent
      ? `${rationaleBase}. Variance intent: ${varianceIntent}`
      : rationaleBase;

    console.log(
      `[population-assembler] SELECT candidate soulId=${candidate.soulId} (${candidate.agentClass}): ` +
      `differentiationScore=${differentiationScore.toFixed(3)}, rank=${rank}`,
    );

    const entry: SelectedSoul = {
      // SoulSelectionEntry fields
      soulId: candidate.soulId,
      agentClass: candidate.agentClass,
      source: 'library',
      parentSoulId: candidate.parentSoulId,
      mutationApplied: null,
      selectionRationale,
      differentiationScore,
      // SelectedSoul extension fields
      soulContent: candidate.soulContent,
      embedding: candidate.embedding,
    };

    selected.push(entry);
  }

  console.log(
    `[population-assembler] Selection complete: ${selected.length}/${requiredPopulation} souls selected from pool of ${pool.length}`,
  );

  if (selected.length < requiredPopulation) {
    console.log(
      `[population-assembler] Pool shortfall: selected ${selected.length} of ${requiredPopulation} required souls. ` +
      `Caller must handle remaining ${requiredPopulation - selected.length} via pioneer path.`,
    );
  }

  return selected;
}

// ─── Public Export: Apply pre-deployment mutation to a selected soul ───────────

/**
 * Apply a single targeted pre-deployment mutation to a selected soul (SOUL-05).
 *
 * Allowed operations:
 *  - 'substitution': Replace one Decision Priority with an equally valid alternative
 *  - 'amplification': Rewrite one directive to be more specific and restrictive
 *
 * The mutation is applied via LLM (gpt-4o-mini) and the mutated content is re-embedded.
 * The caller is responsible for updating SelectedSoul.mutationApplied and soulContent.
 *
 * @param soul       - The selected soul to mutate
 * @param operation  - 'substitution' or 'amplification' only
 * @param rationale  - Why this mutation is being applied (logged in MutationResult)
 * @returns MutationResult with new content, embedding, operation, and rationale
 */
export async function applyPreDeploymentMutation(
  soul: SelectedSoul,
  operation: 'substitution' | 'amplification',
  rationale: string,
): Promise<MutationResult> {
  if (operation !== 'substitution' && operation !== 'amplification') {
    throw new Error(
      `[population-assembler] Invalid mutation operation: "${operation}". ` +
      `Only 'substitution' and 'amplification' are allowed as pre-deployment mutations.`,
    );
  }

  console.log(
    `[population-assembler] Applying pre-deployment mutation: operation="${operation}", ` +
    `soulId=${soul.soulId}, rationale="${rationale}"`,
  );

  // ── Parse inviolable constitution directives from soul content ──────────────
  const constitutionDirectives = parseConstitutionDirectives(soul.soulContent);

  const constitutionLine =
    constitutionDirectives.length > 0
      ? 'The following Constitution lines are INVIOLABLE. They must appear VERBATIM in your output. Do not modify, remove, or rephrase them:\n' +
        constitutionDirectives.join('\n')
      : 'Preserve all existing ethical constraints and hard stops verbatim.';

  const operationInstructions: Record<'substitution' | 'amplification', string> = {
    substitution:
      "Replace one Decision Priority with an equally valid alternative that changes the behavior profile. Do not touch Constitution lines.",
    amplification:
      "Choose one directive from Decision Priorities or Tool Usage Doctrine and rewrite it to be more specific and restrictive. Do not touch Constitution lines.",
  };

  const instruction = operationInstructions[operation];

  const systemPrompt =
    `You are a soul mutation agent. Apply the following mutation operation to the SOUL.md document provided.\n\n` +
    `Operation: ${operation.toUpperCase()}\n` +
    `Instruction: ${instruction}\n\n` +
    `${constitutionLine}\n\n` +
    `Return the complete mutated SOUL.md document. Do not add commentary or explanation — output ONLY the SOUL.md content.`;

  // ── Step 1: Apply mutation via LLM ─────────────────────────────────────────
  const { text: mutatedContent } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: soul.soulContent,
    temperature: 0.4,
  });

  const trimmedContent = mutatedContent.trim();

  console.log(
    `[population-assembler] Mutation applied (operation="${operation}"): ` +
    `${trimmedContent.length} chars (original: ${soul.soulContent.length} chars)`,
  );

  // ── Step 2: Re-embed mutated content ───────────────────────────────────────
  console.log(`[population-assembler] Re-embedding mutated soul content...`);

  const { embedding: rawEmbedding } = await embed({
    model: EMBEDDING_MODEL,
    value: trimmedContent,
  });

  const mutatedEmbedding = Array.from(rawEmbedding);

  console.log(
    `[population-assembler] Mutation complete: soulId=${soul.soulId}, ` +
    `operation="${operation}", embeddingDims=${mutatedEmbedding.length}`,
  );

  return {
    mutatedContent: trimmedContent,
    mutatedEmbedding,
    operation,
    rationale,
  };
}
