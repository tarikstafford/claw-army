import { generateText, embedMany, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db, botSouls } from '@claw/db';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { SoulDimension } from '@claw/shared-types';
import type { SelectedSoul } from './population-assembler';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');
const PIONEER_POPULATION_SIZE = 5;
const PIONEER_TEMPERATURE = 0.3;
const BEHAVIORAL_ARCHETYPES = [
  { name: 'analytical', description: 'methodical, data-driven, systematic reasoning' },
  { name: 'creative', description: 'divergent thinking, novel approaches, lateral problem solving' },
  { name: 'cautious', description: 'risk-averse, thorough validation, conservative execution' },
  { name: 'aggressive', description: 'bold action, rapid iteration, high-risk-high-reward orientation' },
  { name: 'balanced', description: 'pragmatic, adaptable, integrative decision making' },
];

// ─── Internal Types ─────────────────────────────────────────────────────────────

interface ArchetypeSoul {
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
}

// ─── Helper: Compute SHA-256 hash ──────────────────────────────────────────────

function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
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

// ─── Helper: Query archetype souls ────────────────────────────────────────────

async function queryArchetypes(): Promise<ArchetypeSoul[]> {
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
  }));
}

// ─── Helper: Generate archetype-derived variant ───────────────────────────────

async function generateArchetypeVariant(
  archetype: ArchetypeSoul,
  taskDescription: string,
  requiredTools: string[],
): Promise<string> {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system:
      `You are a soul architect. Given a base archetype SOUL.md and a task description, ` +
      `create a specialized variant that retains the archetype's core behavioral personality ` +
      `but adapts its Decision Priorities and Tool Usage Doctrine to excel at the specific task.\n\n` +
      `Task: ${taskDescription}\n` +
      `Required tools: ${requiredTools.join(', ')}\n\n` +
      `Return the complete SOUL.md document. Preserve all Constitution/Ethical Hard Stops lines VERBATIM.`,
    prompt: archetype.soulContent,
    temperature: PIONEER_TEMPERATURE,
  });
  return text.trim();
}

// ─── Helper: Generate soul from scratch for a behavioral archetype ─────────────

async function generateFromScratch(
  behavioralProfile: { name: string; description: string },
  taskDescription: string,
  requiredTools: string[],
  index: number,
): Promise<string> {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system:
      `You are a soul architect. Create a SOUL.md behavioral constitution for an AI agent ` +
      `with the following profile:\n\n` +
      `Behavioral archetype: ${behavioralProfile.name} (${behavioralProfile.description})\n` +
      `Task specialization: ${taskDescription}\n` +
      `Required tools: ${requiredTools.join(', ')}\n\n` +
      `The SOUL.md must include these sections:\n` +
      `## Identity and Role\n## Decision Priorities\n## Tool Usage Doctrine\n` +
      `## Risk Tolerance\n## Communication Style\n## Recovery Behavior\n## Ethical Hard Stops\n\n` +
      `The Ethical Hard Stops section MUST contain at least one line starting with "INVIOLABLE:"\n` +
      `This agent is soul #${index + 1} of 5 pioneer souls for a novel task category. ` +
      `Make it distinctly specialized for the ${behavioralProfile.name} behavioral style.\n\n` +
      `Return ONLY the complete SOUL.md document, no preamble or commentary.`,
    prompt: `Create SOUL.md for a ${behavioralProfile.name} agent specialized for: ${taskDescription}`,
    temperature: PIONEER_TEMPERATURE,
  });
  return text.trim();
}

// ─── Public Export: Generate pioneer population for novel tasks ────────────────

/**
 * Generate 5 archetypal souls for a novel task with insufficient library results.
 *
 * SOUL-06: When library search returns insufficient results, generate 5 archetypal
 * souls across the behavioral spread. If archetypes exist in bot_souls, derive
 * specialized variants from them. Otherwise, generate from scratch with distinct
 * behavioral profiles.
 *
 * @param taskDescription - Human-readable description of the novel task
 * @param taskCategory    - Classified category label for the task
 * @param requiredTools   - Tools the task requires (used for specialization)
 * @returns Array of 5 SelectedSoul entries with source 'generated'
 */
export async function generatePioneerPopulation(
  taskDescription: string,
  taskCategory: string,
  requiredTools: string[],
): Promise<SelectedSoul[]> {
  console.log(
    `[pioneer-generator] Generating pioneer population for novel task: category="${taskCategory}"`,
  );

  // ── Step 1: Query existing archetypes ─────────────────────────────────────
  const archetypes = await queryArchetypes();
  console.log(`[pioneer-generator] Found ${archetypes.length} archetypes in bot_souls`);

  // ── Step 2: Generate 5 pioneer souls ─────────────────────────────────────
  const generatedContents: Array<{ content: string; parentId: string | null }> = [];

  if (archetypes.length > 0) {
    // Archetype path: derive specialized variants from existing archetypes
    console.log(`[pioneer-generator] Using archetype-derived path (${archetypes.length} archetypes)`);

    for (let i = 0; i < PIONEER_POPULATION_SIZE; i++) {
      const archetype = archetypes[i % archetypes.length];
      if (archetype === undefined) {
        throw new Error('[pioneer-generator] Internal error: archetype pool is empty');
      }

      console.log(
        `[pioneer-generator] Generating pioneer ${i + 1}/${PIONEER_POPULATION_SIZE} from archetype ${archetype.id.slice(0, 8)}...`,
      );

      const content = await generateArchetypeVariant(archetype, taskDescription, requiredTools);
      generatedContents.push({ content, parentId: archetype.id });
    }
  } else {
    // Scratch path: generate from scratch with distinct behavioral profiles
    console.log(
      `[pioneer-generator] No archetypes found — generating ${PIONEER_POPULATION_SIZE} souls from scratch`,
    );

    for (let i = 0; i < PIONEER_POPULATION_SIZE; i++) {
      const profile = BEHAVIORAL_ARCHETYPES[i];
      if (profile === undefined) {
        throw new Error('[pioneer-generator] Internal error: behavioral archetype profile missing');
      }

      console.log(
        `[pioneer-generator] Generating pioneer ${i + 1}/${PIONEER_POPULATION_SIZE}: ${profile.name} profile`,
      );

      const content = await generateFromScratch(profile, taskDescription, requiredTools, i);
      generatedContents.push({ content, parentId: null });
    }
  }

  // ── Step 3: Batch embed all generated souls ────────────────────────────────
  console.log(`[pioneer-generator] Batch embedding ${generatedContents.length} pioneer souls...`);
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: generatedContents.map((g) => g.content),
  });

  // ── Step 4: Persist to bot_souls table ────────────────────────────────────
  console.log(`[pioneer-generator] Persisting pioneer souls to database...`);
  const insertedSouls: Array<{
    id: string;
    content: string;
    embedding: number[];
    parentId: string | null;
  }> = [];

  for (let i = 0; i < generatedContents.length; i++) {
    const generated = generatedContents[i];
    const embedding = embeddings[i];

    if (generated === undefined || embedding === undefined) {
      throw new Error(`[pioneer-generator] Missing generated content or embedding at index ${i}`);
    }

    const embeddingArr = Array.from(embedding);
    const contentHash = computeContentHash(generated.content);
    const dimensions = parseDimensions(generated.content);

    const inserted = await db
      .insert(botSouls)
      .values({
        taskCategory,
        soulContent: generated.content,
        contentHash,
        generation: 1,
        parentSoulId: generated.parentId,
        dimensions,
        constitutionDirectives: [],
        embedding: embeddingArr,
        isArchetype: false,
        humanReviewFlag: false,
      })
      .returning({ id: botSouls.id });

    const insertedRow = inserted[0];
    if (insertedRow === undefined) {
      throw new Error(`[pioneer-generator] DB insert returned no rows for pioneer soul ${i + 1}`);
    }

    console.log(
      `[pioneer-generator] Pioneer ${i + 1}/${generatedContents.length} persisted: id=${insertedRow.id}`,
    );

    insertedSouls.push({
      id: insertedRow.id,
      content: generated.content,
      embedding: embeddingArr,
      parentId: generated.parentId,
    });
  }

  // ── Step 5: Compute pairwise differentiation scores ───────────────────────
  // Each soul's differentiationScore = 1 - cosine_similarity to nearest sibling
  const differentiationScores: number[] = insertedSouls.map((soul, i) => {
    let minDistance = 1.0; // 1 - similarity; lower means more similar

    for (let j = 0; j < insertedSouls.length; j++) {
      if (i === j) continue;
      const sibling = insertedSouls[j];
      if (sibling === undefined) continue;

      const similarity = cosineSimilarity(soul.embedding, sibling.embedding);
      const distance = 1.0 - similarity;

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // If only 1 soul (shouldn't happen), default to 1.0
    return insertedSouls.length === 1 ? 1.0 : minDistance;
  });

  // ── Step 6: Build and return SelectedSoul[] ───────────────────────────────
  const result: SelectedSoul[] = insertedSouls.map((soul, i) => {
    const differentiationScore = differentiationScores[i] ?? 1.0;

    return {
      // SoulSelectionEntry fields
      soulId: soul.id,
      agentClass: 'Novice',
      source: 'generated',
      parentSoulId: soul.parentId,
      mutationApplied: null,
      selectionRationale: `Pioneer generation: archetype-derived variant for novel task category '${taskCategory}'`,
      differentiationScore,
      // SelectedSoul extension fields
      soulContent: soul.content,
      embedding: soul.embedding,
    };
  });

  console.log(
    `[pioneer-generator] Pioneer population complete: ${result.length} souls generated for category "${taskCategory}"`,
  );

  return result;
}
