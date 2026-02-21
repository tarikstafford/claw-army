import { generateText, embedMany, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db, botSouls, bots } from '@claw/db';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { SoulDimension } from '@claw/shared-types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');
const SIMILARITY_THRESHOLD = 0.85;
const MIN_POPULATION = 3;
const MAX_MUTATION_ITERATIONS = 5;
const MUTATION_OPERATIONS_FULL: readonly string[] = [
  'substitution',
  'amplification',
  'attenuation',
  'recombination',
  'introduction',
];
const MUTATION_OPERATIONS_LIGHT: readonly string[] = ['substitution', 'attenuation'];
const MUTATION_TEMPERATURE_KNOWN = 0.4;
const MUTATION_TEMPERATURE_NOVEL = 0.2;

// ─── Internal Types ─────────────────────────────────────────────────────────────

interface ParentSoul {
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
  dimensions: SoulDimension;
}

interface SoulCandidate {
  soulContent: string;
  parent: ParentSoul;
  humanReviewFlag: boolean;
  embedding: number[];
}

// ─── Helper: Compute SHA-256 hash ──────────────────────────────────────────────

function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// ─── Helper: Classify task category ────────────────────────────────────────────

async function classifyTaskCategory(objective: string): Promise<string> {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: `Classify the following task objective into a short, standardized category label (3-5 words, lowercase, hyphenated). Examples: "web-research-synthesis", "code-generation", "data-analysis", "content-creation". Return ONLY the category label, no other text.`,
    prompt: objective,
    temperature: 0.1,
  });
  return text.trim().toLowerCase().replace(/\s+/g, '-');
}

// ─── Helper: Query historical parent souls ────────────────────────────────────

async function queryHistoricalParents(taskCategory: string): Promise<ParentSoul[]> {
  const results = await db
    .select({
      soul: botSouls,
      score: bots.compositeScore,
    })
    .from(botSouls)
    .innerJoin(bots, eq(botSouls.botId, bots.id))
    .where(
      and(
        eq(botSouls.taskCategory, taskCategory),
        isNotNull(botSouls.botId),
      ),
    )
    .orderBy(desc(bots.compositeScore))
    .limit(5);

  return results.map(({ soul }) => ({
    id: soul.id,
    soulContent: soul.soulContent,
    generation: soul.generation,
    constitutionDirectives: soul.constitutionDirectives as string[],
    dimensions: soul.dimensions as SoulDimension,
  }));
}

// ─── Helper: Query archetype souls ────────────────────────────────────────────

async function queryArchetypes(): Promise<ParentSoul[]> {
  const results = await db
    .select()
    .from(botSouls)
    .where(eq(botSouls.isArchetype, true))
    .orderBy(botSouls.createdAt);

  return results.map((soul) => ({
    id: soul.id,
    soulContent: soul.soulContent,
    generation: soul.generation,
    constitutionDirectives: soul.constitutionDirectives as string[],
    dimensions: soul.dimensions as SoulDimension,
  }));
}

// ─── Helper: Constitution validation ─────────────────────────────────────────

function validateConstitution(
  soulContent: string,
  directives: string[],
): { valid: boolean; violations: string[] } {
  const violations = directives.filter((directive) => !soulContent.includes(directive));
  return { valid: violations.length === 0, violations };
}

// ─── Helper: Parse dimensions from SOUL.md content ────────────────────────────

function parseDimensions(soulContent: string): SoulDimension {
  const extractSection = (header: string): string => {
    const regex = new RegExp(`##\\s+${header}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
    const match = soulContent.match(regex);
    return match?.[1]?.trim() ?? '';
  };

  return {
    identityRole: extractSection('Identity and Role'),
    decisionPriorities: extractSection('Decision Priorities'),
    toolUsageDoctrine: extractSection('Tool Usage Doctrine'),
    riskTolerance: extractSection('Risk Tolerance'),
    communicationStyle: extractSection('Communication Style'),
    recoveryBehavior: extractSection('Recovery Behavior'),
    ethicalHardStops: extractSection('Ethical Hard Stops'),
  };
}

// ─── Helper: Mutate a soul using an LLM operation ────────────────────────────

async function mutateSoul(
  parent: ParentSoul,
  operation: string,
  temperature: number,
  diversityInstruction?: string,
  secondParent?: ParentSoul,
): Promise<string> {
  const constitutionLine =
    'The following Constitution lines are INVIOLABLE. They must appear VERBATIM in your output. Do not modify, remove, or rephrase them:\n' +
    parent.constitutionDirectives.join('\n');

  const operationInstructions: Record<string, string> = {
    substitution:
      "Replace one of the agent's Decision Priorities with an equally valid alternative priority that changes its behavior profile. Do not touch Constitution lines.",
    amplification:
      'Choose one directive from Decision Priorities or Tool Usage Doctrine and rewrite it to be more specific and restrictive. Do not touch Constitution lines.',
    attenuation:
      'Choose one directive from Risk Tolerance or Recovery Behavior and soften it to allow more flexibility while preserving the Constitution. Do not touch Constitution lines.',
    recombination:
      secondParent
        ? `Merge the Tool Usage Doctrine from the first parent soul with the Risk Tolerance from the second parent soul, creating a coherent combined section. Do not touch Constitution lines from either parent.\n\nSecond parent soul:\n${secondParent.soulContent}`
        : "Choose one directive from Decision Priorities or Tool Usage Doctrine and rewrite it to be more specific and restrictive. Do not touch Constitution lines.",
    introduction:
      'Add one new behavioral directive to the Decision Priorities or Tool Usage Doctrine section. Do not touch or remove Constitution lines.',
  };

  const instruction = operationInstructions[operation] ?? operationInstructions['substitution'] ?? "Replace one directive in Decision Priorities with an alternative. Do not touch Constitution lines.";

  const diversityPrefix = diversityInstruction
    ? `IMPORTANT: ${diversityInstruction}\n\n`
    : '';

  const systemPrompt =
    `${diversityPrefix}You are a soul mutation agent. Apply the following mutation operation to the SOUL.md document provided.\n\n` +
    `Operation: ${operation.toUpperCase()}\n` +
    `Instruction: ${instruction}\n\n` +
    `${constitutionLine}\n\n` +
    `Return the complete mutated SOUL.md document. Do not add commentary or explanation — output ONLY the SOUL.md content.`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: parent.soulContent,
    temperature,
  });

  return text.trim();
}

// ─── Helper: Pick pool element by index (safe with noUncheckedIndexedAccess) ──

function pickFromPool<T>(pool: readonly T[], index: number): T {
  const element = pool[index % pool.length];
  if (element === undefined) {
    throw new Error(`[soul-generator] Internal error: pool is empty (length=${pool.length})`);
  }
  return element;
}

// ─── Public Export: Generate soul population ──────────────────────────────────

/**
 * Generate a validated, differentiated population of SOUL.md documents
 * for an execution. This is the core intelligence of Phase 9.
 *
 * @param executionId  - UUID of the execution requesting souls
 * @param objective    - Human-readable execution objective (used to classify category)
 * @param populationSize - Number of souls to generate (must be >= MIN_POPULATION = 3)
 * @returns Array of { soulId, soulContent } with exactly populationSize entries
 */
export async function generateSoulPopulation(
  executionId: string,
  objective: string,
  populationSize: number,
): Promise<Array<{ soulId: string; soulContent: string }>> {
  if (populationSize < MIN_POPULATION) {
    throw new Error(
      `[soul-generator] populationSize must be >= ${MIN_POPULATION}. Received: ${populationSize}`,
    );
  }

  // ── Step 1: Classify task category ─────────────────────────────────────────
  console.log('[soul-generator] Classifying task category...');
  const taskCategory = await classifyTaskCategory(objective);
  console.log(`[soul-generator] Task category: "${taskCategory}"`);

  // ── Step 2: Determine known vs. novel path ─────────────────────────────────
  const historicalParents = await queryHistoricalParents(taskCategory);
  const isNovelPath = historicalParents.length === 0;

  const operations = isNovelPath ? MUTATION_OPERATIONS_LIGHT : MUTATION_OPERATIONS_FULL;
  const temperature = isNovelPath ? MUTATION_TEMPERATURE_NOVEL : MUTATION_TEMPERATURE_KNOWN;

  console.log(
    `[soul-generator] Using ${isNovelPath ? 'NOVEL' : 'KNOWN'} path (operations: ${operations.join(', ')}, temperature: ${temperature})`,
  );

  // ── Step 3/4: Build parent pool ────────────────────────────────────────────
  let parentPool: readonly ParentSoul[];

  if (isNovelPath) {
    // NOVEL path (SGEN-02): Use all archetypes in round-robin
    const archetypes = await queryArchetypes();
    if (archetypes.length === 0) {
      throw new Error(
        '[soul-generator] No archetype souls found. Run the archetypes seed script first.',
      );
    }
    parentPool = archetypes;
    console.log(`[soul-generator] Novel path: ${archetypes.length} archetypes as parent pool`);
  } else {
    // KNOWN path (SGEN-01): Top-5 historical + 1 mid-tier diversity parent
    const diversityResults = await db
      .select({
        soul: botSouls,
        score: bots.compositeScore,
      })
      .from(botSouls)
      .innerJoin(bots, eq(botSouls.botId, bots.id))
      .where(
        and(
          eq(botSouls.taskCategory, taskCategory),
          isNotNull(botSouls.botId),
        ),
      )
      .orderBy(desc(bots.compositeScore))
      .offset(2)
      .limit(1);

    const diversityParents: ParentSoul[] = diversityResults.map(({ soul }) => ({
      id: soul.id,
      soulContent: soul.soulContent,
      generation: soul.generation,
      constitutionDirectives: soul.constitutionDirectives as string[],
      dimensions: soul.dimensions as SoulDimension,
    }));

    parentPool = [...historicalParents, ...diversityParents];

    console.log(
      `[soul-generator] Known path: ${historicalParents.length} historical parents + ${diversityParents.length} diversity parent(s)`,
    );
  }

  // ── Step 5: Mutate souls ────────────────────────────────────────────────────
  console.log(`[soul-generator] Mutating ${populationSize} souls...`);
  const candidates: SoulCandidate[] = [];

  for (let i = 0; i < populationSize; i++) {
    const parent = pickFromPool(parentPool, i);
    const operation = pickFromPool(operations, i);

    // For recombination, pick a second parent from the pool
    let secondParent: ParentSoul | undefined;
    if (operation === 'recombination') {
      secondParent = pickFromPool(parentPool, i + 1);
    }

    console.log(
      `[soul-generator] Soul ${i + 1}/${populationSize}: operation="${operation}", parent="${parent.id.slice(0, 8)}..."`,
    );

    // ── Step 6: Constitution validation with retry ─────────────────────────
    let soulContent = '';
    let humanReviewFlag = false;
    let constitutionValid = false;
    let mutationIteration = 0;

    while (!constitutionValid && mutationIteration < MAX_MUTATION_ITERATIONS) {
      mutationIteration++;
      soulContent = await mutateSoul(parent, operation, temperature, undefined, secondParent);

      const validation = validateConstitution(soulContent, parent.constitutionDirectives);
      constitutionValid = validation.valid;

      if (!constitutionValid) {
        console.warn(
          `[soul-generator] Soul ${i + 1}: constitution violation on iteration ${mutationIteration}/${MAX_MUTATION_ITERATIONS}. Violations: ${validation.violations.join('; ')}`,
        );
      }
    }

    if (!constitutionValid) {
      console.warn(
        `[soul-generator] Soul ${i + 1}: max constitution iterations (${MAX_MUTATION_ITERATIONS}) exceeded. Setting humanReviewFlag.`,
      );
      humanReviewFlag = true;
    }

    candidates.push({
      soulContent,
      parent,
      humanReviewFlag,
      embedding: [], // populated after batch embedding
    });
  }

  // ── Step 7: Batch embedding generation ────────────────────────────────────
  console.log('[soul-generator] Generating embeddings for all souls...');
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: candidates.map((c) => c.soulContent),
  });

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const embedding = embeddings[i];
    if (candidate !== undefined && embedding !== undefined) {
      candidate.embedding = Array.from(embedding);
    }
  }

  // ── Step 8: Pairwise differentiation enforcement ──────────────────────────
  console.log('[soul-generator] Enforcing pairwise cosine similarity threshold...');

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const candidateI = candidates[i];
      const candidateJ = candidates[j];
      if (candidateI === undefined || candidateJ === undefined) continue;

      const similarity = cosineSimilarity(candidateI.embedding, candidateJ.embedding);

      if (similarity > SIMILARITY_THRESHOLD) {
        console.warn(
          `[soul-generator] Souls ${i} and ${j} are too similar (similarity=${similarity.toFixed(3)} > ${SIMILARITY_THRESHOLD}). Remutating soul ${j}...`,
        );

        const parent = candidateJ.parent;
        let differentiated = false;
        let pairIteration = 0;

        while (!differentiated && pairIteration < MAX_MUTATION_ITERATIONS) {
          pairIteration++;
          const diversityInstruction =
            'The previous mutation produced a soul too similar to another soul in the population. Apply a MORE AGGRESSIVE mutation that changes at least 2 behavioral dimensions significantly.';

          const operation = pickFromPool(operations, j);
          const newContent = await mutateSoul(
            parent,
            operation,
            temperature,
            diversityInstruction,
          );

          const validation = validateConstitution(newContent, parent.constitutionDirectives);
          if (!validation.valid) {
            console.warn(
              `[soul-generator] Remutation iteration ${pairIteration}: constitution violation. Retrying...`,
            );
            continue;
          }

          // Re-embed this single soul
          const { embeddings: newEmbeddings } = await embedMany({
            model: EMBEDDING_MODEL,
            values: [newContent],
          });

          const newEmbedding = newEmbeddings[0];
          if (newEmbedding === undefined) {
            console.warn('[soul-generator] Remutation produced no embedding. Retrying...');
            continue;
          }

          const newEmbeddingArr = Array.from(newEmbedding);

          // Check against ALL other souls
          let stillTooSimilar = false;
          for (let k = 0; k < candidates.length; k++) {
            if (k === j) continue;
            const otherCandidate = candidates[k];
            if (otherCandidate === undefined) continue;
            const newSim = cosineSimilarity(otherCandidate.embedding, newEmbeddingArr);
            if (newSim > SIMILARITY_THRESHOLD) {
              stillTooSimilar = true;
              console.warn(
                `[soul-generator] Remutation iteration ${pairIteration}: soul ${j} still too similar to soul ${k} (similarity=${newSim.toFixed(3)}). Retrying...`,
              );
              break;
            }
          }

          if (!stillTooSimilar) {
            candidateJ.soulContent = newContent;
            candidateJ.embedding = newEmbeddingArr;
            differentiated = true;
            console.log(
              `[soul-generator] Soul ${j} successfully differentiated on iteration ${pairIteration}.`,
            );
          }
        }

        if (!differentiated) {
          console.warn(
            `[soul-generator] Soul ${j}: max differentiation iterations (${MAX_MUTATION_ITERATIONS}) exceeded. Setting humanReviewFlag.`,
          );
          candidateJ.humanReviewFlag = true;
        }
      }
    }
  }

  // ── Step 9: Persist to database ────────────────────────────────────────────
  console.log('[soul-generator] Persisting souls to database...');
  const result: Array<{ soulId: string; soulContent: string }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (candidate === undefined) continue;

    const contentHash = computeContentHash(candidate.soulContent);
    const parsedDimensions = parseDimensions(candidate.soulContent);

    const inserted = await db
      .insert(botSouls)
      .values({
        executionId,
        taskCategory,
        soulContent: candidate.soulContent,
        contentHash,
        generation: candidate.parent.generation + 1,
        parentSoulId: candidate.parent.id,
        dimensions: parsedDimensions,
        constitutionDirectives: candidate.parent.constitutionDirectives,
        embedding: candidate.embedding,
        isArchetype: false,
      })
      .returning({ id: botSouls.id });

    const insertedRow = inserted[0];
    if (insertedRow === undefined) {
      throw new Error(`[soul-generator] DB insert returned no rows for soul ${i + 1}`);
    }

    if (candidate.humanReviewFlag) {
      console.warn(
        `[soul-generator] Soul ${insertedRow.id} flagged for human review (constitution or similarity issues).`,
      );
    }

    console.log(
      `[soul-generator] Soul ${i + 1}/${candidates.length} persisted: id=${insertedRow.id}`,
    );

    result.push({
      soulId: insertedRow.id,
      soulContent: candidate.soulContent,
    });
  }

  console.log(
    `[soul-generator] Population complete: ${result.length} souls generated for execution ${executionId}`,
  );

  // ── Step 10: Return ────────────────────────────────────────────────────────
  return result;
}
