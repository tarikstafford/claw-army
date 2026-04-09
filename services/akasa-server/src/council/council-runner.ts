import { db, bots, botSouls, councilVerdicts, executions } from '@claw/db';
import { eq } from 'drizzle-orm';
import { runPerformanceJudge, type CouncilContext, type PerformanceJudgeOutput } from './performance-judge.js';
import { runSoulAnalyst, type SoulAnalystOutput } from './soul-analyst.js';
import { runDevilsAdvocate, type DevilsAdvocateOutput } from './devils-advocate.js';
import { processSkillLearning } from '../services/skill-learning.js';
import type { CouncilVerdict } from '@claw/db';

// ─── Constants ─────────────────────────────────────────────────────────────────

// Verdict type numeric values for weighted average resolution
const VERDICT_VALUES: Record<string, number> = {
  Promote: 4,
  Maintain: 3,
  Monitor: 2,
  Demote: 1,
  Retire: 0,
};
const VERDICT_FROM_VALUE = ['Retire', 'Demote', 'Monitor', 'Maintain', 'Promote'] as const;

// ─── loadCouncilContext ───────────────────────────────────────────────────────────

async function loadCouncilContext(
  executionId: string,
  botId: string,
  soulId: string | null,
): Promise<CouncilContext> {
  // Query bot record
  const botRows = await db
    .select({
      tasksClaimed: bots.tasksClaimed,
      tasksCompleted: bots.tasksCompleted,
      tasksFailed: bots.tasksFailed,
      compositeScore: bots.compositeScore,
      tier: bots.tier,
    })
    .from(bots)
    .where(eq(bots.id, botId))
    .limit(1);

  if (botRows.length === 0) {
    throw new Error(`[council-runner] Bot ${botId} not found`);
  }

  const botRow = botRows[0]!;

  // Query soul content if soulId provided
  let soulContent: string | null = null;
  let constitutionDirectives: string[] = [];
  let taskCategory: string | null = null;

  if (soulId !== null) {
    const soulRows = await db
      .select({
        soulContent: botSouls.soulContent,
        constitutionDirectives: botSouls.constitutionDirectives,
        taskCategory: botSouls.taskCategory,
      })
      .from(botSouls)
      .where(eq(botSouls.id, soulId))
      .limit(1);

    if (soulRows.length > 0) {
      const soul = soulRows[0]!;
      soulContent = soul.soulContent;
      constitutionDirectives = Array.isArray(soul.constitutionDirectives)
        ? (soul.constitutionDirectives as string[])
        : [];
      taskCategory = soul.taskCategory ?? null;
    }
  }

  return {
    executionId,
    botId,
    soulId,
    soulContent,
    constitutionDirectives,
    taskCategory,
    botMetrics: {
      tasksClaimed: botRow.tasksClaimed,
      tasksCompleted: botRow.tasksCompleted,
      tasksFailed: botRow.tasksFailed,
      compositeScore: botRow.compositeScore ?? null,
      tier: botRow.tier ?? null,
    },
    decisionTraces: [],
    telemetryMetrics: [],
  };
}

// ─── computeWeightedVerdict ───────────────────────────────────────────────────────

/**
 * Aggregate fulfilled judge outputs using weighted voting.
 * Weights: Performance Judge 0.5, Soul Analyst 0.3, Devil's Advocate 0.2.
 * Handles partial failure: if a judge failed (null), use remaining judges with
 * renormalized weights.
 *
 * Per CLAUDE.md / plan spec:
 * - requiresHumanConfirmation=true if verdict is Promote or Retire
 * - hasUnresolvedDevilsAdvocate=true if DA's verdict differs from weighted verdict
 */
function computeWeightedVerdict(
  perfResult: PerformanceJudgeOutput | null,
  soulResult: SoulAnalystOutput | null,
  devilResult: DevilsAdvocateOutput | null,
): {
  verdictType: 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';
  weightedConfidenceScore: number;
  requiresHumanConfirmation: boolean;
  hasUnresolvedDevilsAdvocate: boolean;
  verdictSummary: string;
} {
  type JudgeWeight = {
    result: PerformanceJudgeOutput | SoulAnalystOutput | DevilsAdvocateOutput | null;
    weight: number;
    name: string;
  };

  const judges: JudgeWeight[] = [
    { result: perfResult, weight: 0.5, name: 'Performance Judge' },
    { result: soulResult, weight: 0.3, name: 'Soul Analyst' },
    { result: devilResult, weight: 0.2, name: "Devil's Advocate" },
  ];

  const fulfilled = judges.filter((j) => j.result !== null);

  if (fulfilled.length === 0) {
    // All judges failed — fallback to Monitor
    return {
      verdictType: 'Monitor',
      weightedConfidenceScore: 0,
      requiresHumanConfirmation: true,
      hasUnresolvedDevilsAdvocate: false,
      verdictSummary: 'All council judges failed. Manual review required.',
    };
  }

  // Renormalize weights to sum to 1 for fulfilled judges
  const totalWeight = fulfilled.reduce((sum, j) => sum + j.weight, 0);

  let weightedVerdictValue = 0;
  let weightedConfidenceScore = 0;
  const summaries: string[] = [];

  for (const j of fulfilled) {
    const normalizedWeight = j.weight / totalWeight;
    const verdictVal = VERDICT_VALUES[j.result!.verdictType] ?? 2;
    weightedVerdictValue += verdictVal * normalizedWeight;
    weightedConfidenceScore += j.result!.confidence * normalizedWeight;

    const summary = (j.result as { summary?: string }).summary;
    if (summary) {
      summaries.push(`${j.name}: ${summary}`);
    }
  }

  const rounded = Math.max(0, Math.min(4, Math.round(weightedVerdictValue)));
  const verdictType = VERDICT_FROM_VALUE[rounded] ?? 'Monitor';

  // Promote and Retire require human confirmation per plan spec
  const requiresHumanConfirmation = verdictType === 'Promote' || verdictType === 'Retire';

  // DA's verdict differs from weighted verdict → unresolved disagreement
  const hasUnresolvedDevilsAdvocate =
    devilResult !== null && devilResult.verdictType !== verdictType;

  const verdictSummary = summaries.join('\n\n') || `Weighted verdict: ${verdictType}`;

  return {
    verdictType,
    weightedConfidenceScore,
    requiresHumanConfirmation,
    hasUnresolvedDevilsAdvocate,
    verdictSummary,
  };
}

// ─── runCouncilForBot ────────────────────────────────────────────────────────────

/**
 * Orchestrate three council judges in parallel via Promise.allSettled.
 * Handles partial failures gracefully (one judge failing does not block verdict).
 * Computes weighted verdict with 0.5/0.3/0.2 weights.
 * Inserts result into council_verdicts table.
 * Returns the inserted verdict row.
 */
export async function runCouncilForBot(
  executionId: string,
  botId: string,
  soulId: string | null,
): Promise<CouncilVerdict> {
  console.log('[council-runner] Starting council evaluation:', { executionId, botId, soulId });

  // Assemble context from DB
  const ctx = await loadCouncilContext(executionId, botId, soulId);

  // Run all three judges in parallel — judges never see each other's output
  const [perfSettled, soulSettled, devilSettled] = await Promise.allSettled([
    runPerformanceJudge(ctx),
    runSoulAnalyst(ctx),
    runDevilsAdvocate(ctx),
  ]);

  // Extract fulfilled results, log failures
  const perfResult: PerformanceJudgeOutput | null =
    perfSettled.status === 'fulfilled' ? perfSettled.value : null;
  const soulResult: SoulAnalystOutput | null =
    soulSettled.status === 'fulfilled' ? soulSettled.value : null;
  const devilResult: DevilsAdvocateOutput | null =
    devilSettled.status === 'fulfilled' ? devilSettled.value : null;

  if (perfSettled.status === 'rejected') {
    console.error('[council-runner] Performance Judge failed:', {
      botId,
      error: (perfSettled.reason as Error).message,
    });
  }
  if (soulSettled.status === 'rejected') {
    console.error('[council-runner] Soul Analyst failed:', {
      botId,
      error: (soulSettled.reason as Error).message,
    });
  }
  if (devilSettled.status === 'rejected') {
    console.error("[council-runner] Devil's Advocate failed:", {
      botId,
      error: (devilSettled.reason as Error).message,
    });
  }

  // Compute weighted aggregate verdict
  const verdict = computeWeightedVerdict(perfResult, soulResult, devilResult);

  // Insert into council_verdicts table
  const [insertedVerdict] = await db.insert(councilVerdicts).values({
    executionId,
    botId,
    soulId,
    verdictType: verdict.verdictType,
    status: 'pending',
    weightedConfidenceScore: verdict.weightedConfidenceScore.toFixed(3),
    requiresHumanConfirmation: verdict.requiresHumanConfirmation,
    hasUnresolvedDevilsAdvocate: verdict.hasUnresolvedDevilsAdvocate,
    verdictSummary: verdict.verdictSummary,
    performanceJudgeOutput: perfResult as unknown as Record<string, unknown>,
    soulAnalystOutput: soulResult as unknown as Record<string, unknown>,
    devilsAdvocateOutput: devilResult as unknown as Record<string, unknown>,
  }).returning();

  if (!insertedVerdict) {
    throw new Error(`[council-runner] Failed to insert council verdict for bot ${botId}`);
  }

  console.log('[council-runner] Verdict stored:', {
    executionId,
    botId,
    verdictType: verdict.verdictType,
    confidence: verdict.weightedConfidenceScore.toFixed(3),
    requiresHumanConfirmation: verdict.requiresHumanConfirmation,
    hasUnresolvedDevilsAdvocate: verdict.hasUnresolvedDevilsAdvocate,
  });

  // Fire-and-forget skill learning (non-critical side effect per coding conventions)
  const executionRows = await db
    .select({ objective: executions.objective })
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1);

  const taskContext = executionRows.length > 0 ? executionRows[0]!.objective : 'Unknown objective';

  processSkillLearning(
    executionId,
    botId,
    soulId,
    taskContext,
    verdict.verdictType,
  ).catch((err) => {
    console.error('[council-runner] Skill learning failed:', {
      botId,
      error: (err as Error).message,
    });
  });

  return insertedVerdict;
}
