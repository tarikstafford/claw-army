// Phase 10: Post-hoc Attribution Compiler
//
// Produces decision_traces rows for the Council (Phase 11) to use in causal attribution.
// Three decision types: tool_call, output_step, reasoning_branch.
//
// Phase 11 synchronization: best-effort — the Council reads whatever traces exist
// at evaluation time. Attribution completing before Council evaluation is a timing
// optimization, not a hard requirement.
//
// Real-time annotation path: OpenClaw does not currently support decision_annotation
// messages. When it does, a handler in openclaw-client.ts can write traces directly
// and this post-hoc compiler can be deprecated. See Plan 02 stub in openclaw-client.ts.

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { db, bots, botSouls, toolInvocations, tasks, decisionTraces } from '@claw/db';
import type { BotSoul, ToolInvocation, Task } from '@claw/db';
import { eq, and, inArray, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const ATTRIBUTION_MODEL = openai('gpt-4o-mini');
const ATTRIBUTION_TEMPERATURE = 0.1;
const MAX_INVOCATIONS_PER_BOT = 50;
const DECISION_TRACES_TTL_DAYS = 90;
const DECISION_TRACES_MAX_ROWS = 5_000_000;

// ──────────────────────────────────────────────────────────────────────────────
// Zod schema for LLM attribution output
// ──────────────────────────────────────────────────────────────────────────────

const AttributionSchema = z.object({
  directiveText: z.string(),
  confidence: z.number().min(0).max(1),
  outcome: z.enum(['success', 'failure', 'partial']),
  reasoning: z.string(),
});

type Attribution = z.infer<typeof AttributionSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts a 32-char hex string into UUID format (8-4-4-4-12).
 */
function toUUIDFormat(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Produces a deterministic UUID-shaped decision_id from a seed string.
 * SHA-256 → first 32 hex chars → UUID format.
 * Idempotent: same seed always produces same ID.
 */
function makeDeterministicId(seed: string): string {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex');
  return toUUIDFormat(hex.slice(0, 32));
}

// ──────────────────────────────────────────────────────────────────────────────
// LLM attribution helper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ask the LLM to identify which soul directive most likely drove a tool invocation.
 * Never throws — returns a low-confidence fallback on any LLM or parse error.
 */
async function attributeInvocation(
  invocation: ToolInvocation,
  soulContent: string,
  taskDescription: string,
): Promise<Attribution> {
  try {
    const requestSummaryStr = invocation.requestSummary
      ? JSON.stringify(invocation.requestSummary).slice(0, 500)
      : '';

    const { text } = await generateText({
      model: ATTRIBUTION_MODEL,
      temperature: ATTRIBUTION_TEMPERATURE,
      system:
        'You are a soul attribution analyst. Given a SOUL.md and a tool invocation, identify which directive VERBATIM from the soul most likely drove this tool call. Return JSON with fields: directiveText (exact quote from SOUL.md), confidence (0-1), outcome (success|failure|partial), reasoning (1 sentence).',
      prompt: [
        `SOUL.md:\n${soulContent}`,
        `Tool invoked: ${invocation.toolName}`,
        `Request summary (truncated): ${requestSummaryStr}`,
        `Duration: ${invocation.durationMs ?? 'unknown'} ms`,
        `Rejected: ${invocation.rejected}`,
        `Task description (truncated): ${taskDescription.slice(0, 200)}`,
      ].join('\n\n'),
    });

    const parsed = JSON.parse(text);
    return AttributionSchema.parse(parsed);
  } catch (err) {
    console.warn(
      `[attribution-compiler] attributeInvocation failed for tool=${invocation.toolName}: ${err}`,
    );
    return {
      directiveText: '',
      confidence: 0,
      outcome: 'partial',
      reasoning: 'Attribution failed — LLM error',
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-bot attribution pipeline
// ──────────────────────────────────────────────────────────────────────────────

async function attributeBot(
  executionId: string,
  botId: string,
  soulId: string,
  soul: BotSoul,
): Promise<void> {
  const soulContent = soul.soulContent;

  // ── 1. Fetch tool invocations (accepted + rejected, ordered by time, capped) ─
  const invocations = await db
    .select()
    .from(toolInvocations)
    .where(eq(toolInvocations.botId, botId))
    .orderBy(toolInvocations.invokedAt)
    .limit(MAX_INVOCATIONS_PER_BOT);

  // ── 2. Fetch completed tasks for this bot ───────────────────────────────────
  const botTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.claimedByBotId, botId), eq(tasks.executionId, executionId)));

  // ── 3. Skip bots with no activity ──────────────────────────────────────────
  if (invocations.length === 0 && botTasks.length === 0) {
    console.log(`[attribution-compiler] Bot ${botId} has no invocations or tasks — skipping`);
    return;
  }

  // Get a task description for context (approximate — best available)
  const firstTaskDescription = botTasks[0]?.description ?? '';

  // ── Tool call attribution (decision_type: 'tool_call') ───────────────────
  for (const invocation of invocations) {
    const attribution = await attributeInvocation(invocation, soulContent, firstTaskDescription);

    // Verbatim validation — degrade confidence if directive not found in soul
    let validationWarning: string | undefined;
    if (attribution.confidence > 0.5 && attribution.directiveText && !soulContent.includes(attribution.directiveText)) {
      attribution.confidence = Math.min(attribution.confidence, 0.3);
      validationWarning = 'directive_not_verbatim_in_soul';
    }

    await db
      .insert(decisionTraces)
      .values({
        executionId,
        botId,
        soulId,
        decisionId: makeDeterministicId(`tool_call:${invocation.invocationId}`),
        decisionType: 'tool_call',
        directiveReferenced: attribution.directiveText || null,
        attributionConfidence: attribution.confidence.toFixed(3),
        outcome: attribution.outcome,
        decidedAt: invocation.invokedAt,
        metadata: {
          toolName: invocation.toolName,
          durationMs: invocation.durationMs,
          rejected: invocation.rejected,
          attributionReasoning: attribution.reasoning,
          ...(validationWarning ? { validationWarning } : {}),
        },
      })
      .onConflictDoNothing();
  }

  // ── Output step attribution (decision_type: 'output_step') ───────────────
  const completedTasks = botTasks.filter((t: Task) => t.status === 'completed');

  for (const task of completedTasks) {
    await db
      .insert(decisionTraces)
      .values({
        executionId,
        botId,
        soulId,
        decisionId: makeDeterministicId(`output_step:${task.id}`),
        decisionType: 'output_step',
        directiveReferenced: null,
        attributionConfidence: null,
        outcome: 'success',
        decidedAt: task.updatedAt,
        metadata: {
          taskId: task.id,
          taskDescription: task.description.slice(0, 200),
        },
      })
      .onConflictDoNothing();
  }

  // ── Reasoning branch attribution (decision_type: 'reasoning_branch') ─────
  // One synthesized LLM call per bot to attribute overall approach to a directive.
  if (invocations.length > 0) {
    const toolSequenceSummary = invocations
      .map(
        (inv: ToolInvocation, i: number) =>
          `${i + 1}. ${inv.toolName} (${inv.rejected ? 'rejected' : 'accepted'}, ${inv.durationMs ?? '?'}ms)`,
      )
      .join('\n');

    const completedCount = completedTasks.length;
    const totalCount = botTasks.length;

    try {
      const { text } = await generateText({
        model: ATTRIBUTION_MODEL,
        temperature: ATTRIBUTION_TEMPERATURE,
        system:
          'You are a soul attribution analyst. Given a SOUL.md and the complete tool call sequence for an agent, identify which Decision Priorities directive most drove the agent\'s overall approach. Return JSON: { directiveText, confidence, outcome, reasoning }',
        prompt: [
          `SOUL.md:\n${soulContent}`,
          `Tool call sequence:\n${toolSequenceSummary}`,
          `Tasks completed: ${completedCount}/${totalCount}`,
        ].join('\n\n'),
      });

      const parsed = JSON.parse(text);
      let branchAttribution = AttributionSchema.parse(parsed);

      // Verbatim validation
      let branchValidationWarning: string | undefined;
      if (
        branchAttribution.confidence > 0.5 &&
        branchAttribution.directiveText &&
        !soulContent.includes(branchAttribution.directiveText)
      ) {
        branchAttribution = {
          ...branchAttribution,
          confidence: Math.min(branchAttribution.confidence, 0.3),
        };
        branchValidationWarning = 'directive_not_verbatim_in_soul';
      }

      await db
        .insert(decisionTraces)
        .values({
          executionId,
          botId,
          soulId,
          decisionId: makeDeterministicId(`reasoning_branch:${executionId}:${botId}`),
          decisionType: 'reasoning_branch',
          directiveReferenced: branchAttribution.directiveText || null,
          attributionConfidence: branchAttribution.confidence.toFixed(3),
          outcome: branchAttribution.outcome,
          decidedAt: new Date(),
          metadata: {
            toolSequenceLength: invocations.length,
            completedTasks: completedCount,
            totalTasks: totalCount,
            attributionReasoning: branchAttribution.reasoning,
            ...(branchValidationWarning ? { validationWarning: branchValidationWarning } : {}),
          },
        })
        .onConflictDoNothing();
    } catch (err) {
      console.warn(
        `[attribution-compiler] reasoning_branch attribution failed for bot ${botId}: ${err}`,
      );
      // Fallback: write a low-confidence reasoning_branch row
      await db
        .insert(decisionTraces)
        .values({
          executionId,
          botId,
          soulId,
          decisionId: makeDeterministicId(`reasoning_branch:${executionId}:${botId}`),
          decisionType: 'reasoning_branch',
          directiveReferenced: null,
          attributionConfidence: '0.000',
          outcome: 'partial',
          decidedAt: new Date(),
          metadata: {
            toolSequenceLength: invocations.length,
            completedTasks: completedCount,
            totalTasks: totalCount,
            attributionReasoning: 'Attribution failed — LLM error',
          },
        })
        .onConflictDoNothing();
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported: Main attribution compiler
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Run the post-hoc attribution compiler for a completed execution.
 *
 * Produces decision_traces rows for each bot with a soul:
 * - tool_call: one row per tool invocation (capped at MAX_INVOCATIONS_PER_BOT=50)
 * - output_step: one row per completed task
 * - reasoning_branch: one synthesized row per bot summarizing overall approach
 *
 * Idempotent: all inserts use deterministic decision_id + ON CONFLICT DO NOTHING.
 * Fire-and-forget safe: errors are caught and logged, never thrown.
 *
 * @param executionId - UUID of the completed execution
 */
export async function runAttributionCompiler(executionId: string): Promise<void> {
  try {
    console.log(`[attribution-compiler] Starting for execution ${executionId}`);

    // ── 1. Fetch all bots for the execution ───────────────────────────────────
    const executionBots = await db
      .select({ id: bots.id, soulId: bots.soulId })
      .from(bots)
      .where(eq(bots.executionId, executionId));

    if (executionBots.length === 0) {
      console.log(`[attribution-compiler] No bots found for execution ${executionId}`);
      return;
    }

    // ── 2. Bulk-fetch souls (avoid N+1 query) ─────────────────────────────────
    const soulIds = executionBots
      .map((b) => b.soulId)
      .filter((id): id is string => id !== null);

    const soulMap = new Map<string, BotSoul>();

    if (soulIds.length > 0) {
      const fetchedSouls = await db
        .select()
        .from(botSouls)
        .where(inArray(botSouls.id, soulIds));

      for (const soul of fetchedSouls) {
        soulMap.set(soul.id, soul);
      }
    }

    // ── 3. Process each bot ───────────────────────────────────────────────────
    for (const bot of executionBots) {
      if (bot.soulId === null) {
        console.log(`[attribution-compiler] Bot ${bot.id} has no soulId — skipping`);
        continue;
      }

      const soul = soulMap.get(bot.soulId);
      if (!soul) {
        console.warn(
          `[attribution-compiler] Soul ${bot.soulId} not found for bot ${bot.id} — skipping`,
        );
        continue;
      }

      await attributeBot(executionId, bot.id, bot.soulId, soul);
    }

    console.log(`[attribution-compiler] Complete for execution ${executionId}`);
  } catch (err) {
    console.error(`[attribution-compiler] Error: ${err}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported: TTL pruning function (for admin route in Plan 02)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Prune decision_traces rows older than DECISION_TRACES_TTL_DAYS (90 days).
 * Only activates when the table exceeds DECISION_TRACES_MAX_ROWS (5,000,000).
 *
 * Called by the admin route added in Phase 10 Plan 02.
 *
 * @returns { deleted: number } — count of rows pruned
 */
export async function pruneDecisionTraces(): Promise<{ deleted: number }> {
  const [countResult] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(decisionTraces);

  const total = countResult?.total ?? 0;

  if (total < DECISION_TRACES_MAX_ROWS) {
    console.log(
      `[attribution-compiler] pruneDecisionTraces: ${total} rows — below threshold (${DECISION_TRACES_MAX_ROWS}), no pruning`,
    );
    return { deleted: 0 };
  }

  const cutoff = new Date(Date.now() - DECISION_TRACES_TTL_DAYS * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(decisionTraces)
    .where(sql`${decisionTraces.decidedAt} < ${cutoff}`)
    .returning({ id: decisionTraces.id });

  console.log(
    `[attribution-compiler] pruneDecisionTraces: pruned ${result.length} rows older than ${cutoff.toISOString()}`,
  );

  return { deleted: result.length };
}
