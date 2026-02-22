import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { db, agentClasses } from '@claw/db';
import { inArray, sql } from 'drizzle-orm';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const AGENTS_PER_CATEGORY_MINIMUM = 3;

export const armyBuilderRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /army-builder/analysis — pre-execution composition analysis
  fastify.get('/analysis', {
    schema: {
      querystring: Type.Object({
        objective: Type.String({ minLength: 1 }),
        maxBots: Type.Integer({ minimum: 1 }),
      }),
      response: {
        200: Type.Object({
          categories: Type.Array(Type.String()),
          libraryDepth: Type.Array(
            Type.Object({
              taskCategory: Type.String(),
              noviceCount: Type.Integer(),
              understudyCount: Type.Integer(),
              artisanCount: Type.Integer(),
              totalAgents: Type.Integer(),
            }),
          ),
          budgetTiers: Type.Object({
            full: Type.Object({
              label: Type.String(),
              agentCount: Type.Integer(),
              perCategory: Type.Integer(),
            }),
            reduced: Type.Object({
              label: Type.String(),
              agentCount: Type.Integer(),
              perCategory: Type.Integer(),
            }),
            minimumViable: Type.Object({
              label: Type.String(),
              agentCount: Type.Integer(),
              perCategory: Type.Integer(),
            }),
          }),
          blocked: Type.Boolean(),
          blockReason: Type.Union([Type.String(), Type.Null()]),
        }),
      },
    },
  }, async (request, reply) => {
    const { objective, maxBots } = request.query;

    // Step 1: Extract task categories from objective using LLM
    let categories: string[] = [];
    try {
      const result = await generateText({
        model: anthropic('claude-sonnet-4-6'),
        system: `You are a task category classifier. Given a mission objective, identify the distinct task categories required. Return ONLY a JSON array of category strings. Each category should be a short, lowercase, hyphenated label (e.g., "lead-generation", "data-analysis", "content-writing"). Return at minimum 1 category and at most 5 categories.`,
        prompt: objective,
        temperature: 0.2,
      });

      const parsed = JSON.parse(result.text.trim()) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        categories = (parsed as unknown[]).map((c: unknown) => String(c).toLowerCase().trim()).slice(0, 5);
      }
    } catch (err) {
      fastify.log.warn({ err }, '[army-builder] Category extraction failed, using fallback');
    }

    // Fallback: if LLM failed, use "general" as the single category
    if (categories.length === 0) {
      categories = ['general'];
    }

    // Step 2: Query library depth — count agents by category and class
    const libraryDepth = await getLibraryDepth(categories);

    // Step 3: Budget tier math
    const categoryCount = categories.length;
    const fullAgents = maxBots;
    const fullPerCategory = Math.floor(fullAgents / categoryCount);
    const reducedAgents = Math.max(categoryCount, Math.floor(maxBots * 0.75));
    const reducedPerCategory = Math.floor(reducedAgents / categoryCount);
    const minimumViableAgents = AGENTS_PER_CATEGORY_MINIMUM * categoryCount;
    const minimumViablePerCategory = AGENTS_PER_CATEGORY_MINIMUM;

    // Step 4: Block check
    const blocked = maxBots < minimumViableAgents;
    const blockReason = blocked
      ? `Your crew size of ${maxBots} bots cannot cover ${categoryCount} task ${categoryCount === 1 ? 'category' : 'categories'} at the minimum of ${AGENTS_PER_CATEGORY_MINIMUM} agents each (${minimumViableAgents} required). Increase crew size to at least ${minimumViableAgents} to proceed.`
      : null;

    return reply.code(200).send({
      categories,
      libraryDepth,
      budgetTiers: {
        full: {
          label: `Full crew — ${fullPerCategory} agents per category`,
          agentCount: fullAgents,
          perCategory: fullPerCategory,
        },
        reduced: {
          label: `75% crew — ${reducedPerCategory} agents per category`,
          agentCount: reducedAgents,
          perCategory: reducedPerCategory,
        },
        minimumViable: {
          label: `Minimum viable — ${minimumViablePerCategory} Novices per category`,
          agentCount: minimumViableAgents,
          perCategory: minimumViablePerCategory,
        },
      },
      blocked,
      blockReason,
    });
  });
};

async function getLibraryDepth(categories: string[]) {
  if (categories.length === 0) return [];

  const rows = await db
    .select({
      taskCategory: agentClasses.taskCategory,
      currentClass: agentClasses.currentClass,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(agentClasses)
    .where(inArray(agentClasses.taskCategory, categories))
    .groupBy(agentClasses.taskCategory, agentClasses.currentClass);

  // Build per-category depth map
  const depthMap = new Map<string, { novice: number; understudy: number; artisan: number }>();

  for (const cat of categories) {
    depthMap.set(cat, { novice: 0, understudy: 0, artisan: 0 });
  }

  for (const row of rows) {
    const entry = depthMap.get(row.taskCategory);
    if (!entry) continue;
    switch (row.currentClass) {
      case 'Novice': entry.novice = row.count; break;
      case 'Understudy': entry.understudy = row.count; break;
      case 'Artisan': entry.artisan = row.count; break;
      // Retired agents are not counted in available pool
    }
  }

  return categories.map((cat) => {
    const d = depthMap.get(cat)!;
    return {
      taskCategory: cat,
      noviceCount: d.novice,
      understudyCount: d.understudy,
      artisanCount: d.artisan,
      totalAgents: d.novice + d.understudy + d.artisan,
    };
  });
}
