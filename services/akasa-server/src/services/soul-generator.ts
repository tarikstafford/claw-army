import { generateText, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db, botSouls } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { SoulDimension } from '@claw/shared-types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ParentSoul {
  id: string;
  soulContent: string;
  generation: number;
  constitutionDirectives: string[];
  dimensions: SoulDimension;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

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

async function lookupArchetype(archetypeName: string): Promise<ParentSoul | null> {
  const rows = await db
    .select()
    .from(botSouls)
    .where(and(eq(botSouls.isArchetype, true), eq(botSouls.archetypeName, archetypeName)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    soulContent: row.soulContent,
    generation: row.generation,
    constitutionDirectives: row.constitutionDirectives as string[],
    dimensions: row.dimensions as SoulDimension,
  };
}

async function mutateSoul(parent: ParentSoul, temperature: number): Promise<string> {
  const constitutionLine =
    'The following Constitution lines are INVIOLABLE. They must appear VERBATIM in your output. Do not modify, remove, or rephrase them:\n' +
    parent.constitutionDirectives.join('\n');

  const systemPrompt =
    `You are a soul generation agent. Create a unique SOUL.md document for an AI agent.\n\n` +
    `Use the provided parent soul as a seed. Generate a distinct behavioral constitution with these 7 dimensions:\n` +
    `## Identity and Role\n## Decision Priorities\n## Tool Usage Doctrine\n## Risk Tolerance\n## Communication Style\n## Recovery Behavior\n## Ethical Hard Stops\n\n` +
    `${constitutionLine}\n\n` +
    `Return the complete SOUL.md document. Do not add commentary or explanation — output ONLY the SOUL.md content.`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: `Generate a soul derived from this parent archetype:\n\n${parent.soulContent}`,
    temperature,
  });

  return text.trim();
}

// ─── Public Exports ─────────────────────────────────────────────────────────────

/**
 * Generate a new soul from an archetype template.
 *
 * @param archetypeName - Name of the source archetype (must exist in botSouls with isArchetype=true)
 * @param taskCategory  - Task category label for this soul
 * @param botId         - Optional bot UUID to associate
 * @param executionId   - Optional execution UUID to associate
 * @returns Inserted BotSoul row
 */
export async function generateSoul(
  archetypeName: string,
  taskCategory: string,
  botId?: string,
  executionId?: string,
) {
  const archetype = await lookupArchetype(archetypeName);
  if (!archetype) {
    throw new Error(`[soul-generator] Archetype "${archetypeName}" not found`);
  }

  const soulContent = await mutateSoul(archetype, 0.3);
  const contentHash = computeContentHash(soulContent);
  const dimensions = parseDimensions(soulContent);

  // Try to generate embedding (non-blocking — pgvector optional in dev)
  let embedding: number[] | undefined;
  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: [soulContent],
    });
    const first = embeddings[0];
    if (first) embedding = Array.from(first);
  } catch (err) {
    console.warn('[soul-generator] Embedding generation failed (continuing without):', (err as Error).message);
  }

  const inserted = await db
    .insert(botSouls)
    .values({
      archetypeName,
      taskCategory,
      botId,
      executionId,
      soulContent,
      contentHash,
      generation: 1,
      parentSoulId: archetype.id,
      dimensions,
      constitutionDirectives: archetype.constitutionDirectives,
      embedding,
      isArchetype: false,
      humanReviewFlag: false,
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    throw new Error('[soul-generator] DB insert returned no rows');
  }

  console.log(`[soul-generator] Soul generated: id=${row.id}, category=${taskCategory}`);
  return row;
}

/**
 * Generate a mutated child soul from a parent soul.
 *
 * @param parentSoulId   - UUID of the parent soul in botSouls
 * @param mutationStrength - 0.1–0.5, controls LLM temperature (default 0.2)
 * @returns Inserted child BotSoul row
 */
export async function generateMutatedSoul(
  parentSoulId: string,
  mutationStrength = 0.2,
) {
  const rows = await db
    .select()
    .from(botSouls)
    .where(eq(botSouls.id, parentSoulId))
    .limit(1);

  const parentRow = rows[0];
  if (!parentRow) {
    throw new Error(`[soul-generator] Parent soul "${parentSoulId}" not found`);
  }

  const parent: ParentSoul = {
    id: parentRow.id,
    soulContent: parentRow.soulContent,
    generation: parentRow.generation,
    constitutionDirectives: parentRow.constitutionDirectives as string[],
    dimensions: parentRow.dimensions as SoulDimension,
  };

  // Clamp temperature between 0.1 and 0.7 based on mutation strength
  const temperature = Math.min(0.7, Math.max(0.1, mutationStrength * 2));
  const soulContent = await mutateSoul(parent, temperature);
  const contentHash = computeContentHash(soulContent);
  const dimensions = parseDimensions(soulContent);

  // Try to generate embedding (non-blocking)
  let embedding: number[] | undefined;
  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: [soulContent],
    });
    const first = embeddings[0];
    if (first) embedding = Array.from(first);
  } catch (err) {
    console.warn('[soul-generator] Embedding generation failed (continuing without):', (err as Error).message);
  }

  const inserted = await db
    .insert(botSouls)
    .values({
      archetypeName: parentRow.archetypeName,
      taskCategory: parentRow.taskCategory,
      botId: parentRow.botId,
      executionId: parentRow.executionId,
      soulContent,
      contentHash,
      generation: parent.generation + 1,
      parentSoulId: parent.id,
      dimensions,
      constitutionDirectives: parent.constitutionDirectives,
      embedding,
      isArchetype: false,
      humanReviewFlag: false,
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    throw new Error('[soul-generator] DB insert returned no rows for mutated soul');
  }

  console.log(`[soul-generator] Mutated soul generated: id=${row.id}, parentId=${parentSoulId}, generation=${row.generation}`);
  return row;
}
