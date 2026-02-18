import { db, executions, bots, tasks, toolInvocations, dnaStore } from '@claw/db';
import type { DnaPayload } from '@claw/db';
import { eq, and, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration constants (env-var configurable)
// ──────────────────────────────────────────────────────────────────────────────

/** Minimum composite score for elite status */
const DNA_ELITE_THRESHOLD = Number(process.env.DNA_ELITE_THRESHOLD ?? 75);

/** Elite bot must score this many % above the execution average */
const DNA_ABOVE_AVERAGE_PCT = Number(process.env.DNA_ABOVE_AVERAGE_PCT ?? 20);

/** Elite bot's error rate must be below this ceiling */
const DNA_ERROR_RATE_CEILING = Number(process.env.DNA_ERROR_RATE_CEILING ?? 0.10);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Derive a short, slug-style category from the execution objective.
 *
 * 1. Lowercase and replace non-alphanumeric chars with hyphens
 * 2. Collapse consecutive hyphens into one
 * 3. Trim leading/trailing hyphens
 * 4. Take the first 5 "words" (hyphen-separated tokens), rejoin with hyphens
 * 5. Truncate to 255 chars (varchar limit on dna_store.objective_category)
 *
 * Example: "Summarize these research documents about climate change"
 *          → "summarize-these-research-documents-about"
 */
function deriveObjectiveCategory(objective: string): string {
  const slug = objective
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const words = slug.split('-').filter((w) => w.length > 0);
  const category = words.slice(0, 5).join('-');
  return category.slice(0, 255);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main exported function
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Identify elite bots in the given execution and capture their structural DNA.
 *
 * Pipeline:
 * 1. Fetch execution objective
 * 2. Load all scored bots for this execution
 * 3. Compute execution average composite score
 * 4. For each bot, compute error_rate from tasks table
 * 5. Identify elite bots (all three conditions must be true)
 * 6. For each elite bot, extract PII-safe DNA from tool_invocations + tasks
 * 7. Insert versioned DNA record (MAX(version) + 1 per bot+category)
 *
 * @param executionId - UUID of the completed execution
 */
export async function identifyAndCaptureDna(executionId: string): Promise<void> {
  // ── 1. Fetch execution objective ───────────────────────────────────────────
  const [executionRow] = await db
    .select({ objective: executions.objective })
    .from(executions)
    .where(eq(executions.id, executionId));

  if (!executionRow) {
    console.warn('[dna-capture] Execution not found:', executionId);
    return;
  }

  const objectiveCategory = deriveObjectiveCategory(executionRow.objective);

  // ── 2. Load all scored bots for this execution ─────────────────────────────
  const allBots = await db
    .select({
      id: bots.id,
      compositeScore: bots.compositeScore,
    })
    .from(bots)
    .where(
      and(
        eq(bots.executionId, executionId),
        sql`${bots.compositeScore} IS NOT NULL`,
      ),
    );

  if (allBots.length === 0) {
    console.log('[dna-capture] No scored bots found for execution, skipping:', executionId);
    return;
  }

  // ── 3. Compute execution average composite score ───────────────────────────
  const scores = allBots.map((b) => Number(b.compositeScore));
  const executionAvgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

  // ── 4 & 5. Identify elite bots ─────────────────────────────────────────────
  const eliteBots: Array<{ id: string; compositeScore: number }> = [];

  for (const bot of allBots) {
    const compositeScore = Number(bot.compositeScore);

    // Condition 1: score above absolute threshold
    if (compositeScore <= DNA_ELITE_THRESHOLD) continue;

    // Condition 2: score above execution average by configured percentage
    const aboveAverageMin = executionAvgScore * (1 + DNA_ABOVE_AVERAGE_PCT / 100);
    if (compositeScore <= aboveAverageMin) continue;

    // Condition 3: error rate below ceiling
    // Compute error_rate from tasks table: failed / (completed + failed)
    const [completedResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(tasks)
      .where(and(eq(tasks.claimedByBotId, bot.id), eq(tasks.status, 'completed')));

    const [failedResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(tasks)
      .where(and(eq(tasks.claimedByBotId, bot.id), eq(tasks.status, 'failed')));

    const completedCount = completedResult?.count ?? 0;
    const failedCount = failedResult?.count ?? 0;
    const totalTaskCount = completedCount + failedCount;
    const errorRate = totalTaskCount === 0 ? 0 : failedCount / totalTaskCount;

    if (errorRate >= DNA_ERROR_RATE_CEILING) continue;

    eliteBots.push({ id: bot.id, compositeScore });
  }

  console.log(
    `[dna-capture] Found ${eliteBots.length} elite bots out of ${allBots.length}`,
  );

  // ── 6 & 7. Extract DNA and store versioned records ─────────────────────────
  for (const eliteBot of eliteBots) {
    await captureOneBotDna(eliteBot.id, executionId, eliteBot.compositeScore, objectiveCategory);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-bot DNA extraction and storage
// ──────────────────────────────────────────────────────────────────────────────

async function captureOneBotDna(
  botId: string,
  executionId: string,
  compositeScore: number,
  objectiveCategory: string,
): Promise<void> {
  // ── Query tool invocations (accepted only, ordered by time) ─────────────────
  const invocations = await db
    .select({
      toolName: toolInvocations.toolName,
      durationMs: toolInvocations.durationMs,
      totalTokens: toolInvocations.totalTokens,
      promptTokens: toolInvocations.promptTokens,
      completionTokens: toolInvocations.completionTokens,
      requestSummary: toolInvocations.requestSummary,
    })
    .from(toolInvocations)
    .where(and(
      eq(toolInvocations.botId, botId),
      eq(toolInvocations.rejected, false),
    ))
    .orderBy(toolInvocations.invokedAt);

  // ── Build DNA payload ───────────────────────────────────────────────────────

  // 1. systemPromptTemplate: structural identifier, NOT actual prompt content
  const systemPromptTemplate = 'reasoning-loop-v1';

  // 2. toolCallSequence: ordered list of tool names (PII-safe — only predefined names)
  const toolCallSequence = invocations.map((inv) => inv.toolName);

  // 3. argumentPatterns: keys only from requestSummary — NEVER values
  const argPatterns: Record<string, string[]> = {};
  for (const inv of invocations) {
    const summary = inv.requestSummary as Record<string, unknown> | null;
    if (summary && typeof summary === 'object') {
      const toolKey = inv.toolName;
      if (!argPatterns[toolKey]) argPatterns[toolKey] = [];
      const keys = Object.keys(summary);
      // Add only unique keys — never touch the values
      for (const key of keys) {
        if (!argPatterns[toolKey]!.includes(key)) {
          argPatterns[toolKey]!.push(key);
        }
      }
    }
  }

  // 4. retryStrategy: aggregate retry counts from tasks table
  const taskRetries = await db
    .select({
      attemptCount: tasks.attemptCount,
      status: tasks.status,
    })
    .from(tasks)
    .where(eq(tasks.claimedByBotId, botId));

  const retryStrategy = {
    totalTasks: taskRetries.length,
    retriedTasks: taskRetries.filter((t) => t.attemptCount > 1).length,
    maxAttempts: taskRetries.length > 0 ? Math.max(...taskRetries.map((t) => t.attemptCount)) : 0,
    avgAttempts:
      taskRetries.length > 0
        ? taskRetries.reduce((sum, t) => sum + t.attemptCount, 0) / taskRetries.length
        : 0,
  };

  // 5. timingProfile: aggregate duration_ms from tool invocations
  const durations = invocations.filter((i) => i.durationMs != null).map((i) => i.durationMs!);
  const timingProfile = {
    totalDurationMs: durations.reduce((s, d) => s + d, 0),
    avgDurationMs: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0,
    minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
    maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
    callCount: durations.length,
  };

  // 6. tokenDistribution: aggregate token counts by tool name
  const tokenDist: Record<string, { total: number; prompt: number; completion: number; count: number }> = {};
  for (const inv of invocations) {
    const key = inv.toolName;
    if (!tokenDist[key]) tokenDist[key] = { total: 0, prompt: 0, completion: 0, count: 0 };
    tokenDist[key]!.total += inv.totalTokens ?? 0;
    tokenDist[key]!.prompt += inv.promptTokens ?? 0;
    tokenDist[key]!.completion += inv.completionTokens ?? 0;
    tokenDist[key]!.count += 1;
  }

  const dnaPayload: DnaPayload = {
    systemPromptTemplate,
    toolCallSequence,
    argumentPatterns: argPatterns,
    retryStrategy,
    timingProfile,
    tokenDistribution: tokenDist,
  };

  // ── Get next version: MAX(version) + 1 for this bot + category ─────────────
  const [versionResult] = await db
    .select({ maxVersion: sql<number>`cast(coalesce(max(${dnaStore.version}), 0) as int)` })
    .from(dnaStore)
    .where(
      and(
        eq(dnaStore.botId, botId),
        eq(dnaStore.objectiveCategory, objectiveCategory),
      ),
    );

  const nextVersion = (versionResult?.maxVersion ?? 0) + 1;

  // ── INSERT new versioned record — NEVER UPDATE existing records ─────────────
  await db.insert(dnaStore).values({
    botId,
    executionId,
    objectiveCategory,
    version: nextVersion,
    compositeScore: compositeScore.toFixed(2),
    dnaPayload,
  });

  console.log(
    `[dna-capture] Captured DNA for bot ${botId} (v${nextVersion}, category: ${objectiveCategory})`,
  );
}
