/**
 * God Layer Handler
 *
 * Main orchestrator for post-verdict processing.
 * Executes class transitions, DNA capture, negative signals, and pioneer detection.
 *
 * Idempotency: if godLayerProcessedAt is already set on the verdict,
 * returns early without making any changes.
 */

import { eq, desc } from 'drizzle-orm';
import { db, councilVerdicts, bots, botSouls, agentClasses, type DnaPayload } from '@claw/db';
import { computeClassTransition, type AgentClass, type VerdictType } from './class-machine.js';
import { captureDna } from './dna-writer.js';
import { recordNegativeSignal } from './negative-register.js';
import { checkAndRecordPioneer } from './pioneer-tracker.js';
import { processSkillUnlearning } from './skill-unlearning.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GodLayerResult {
  processed: boolean;
  reason?: string;
}

type SoulAnalystOutputWithSkills = {
  skillEvaluations?: Array<{
    skillId: string;
    skillName: string;
    activationCount: number;
    effectivenessScore: number;
    alignmentWithSoul: number;
    conflictsWithDirectives: Array<{
      directive: string;
      conflictDescription: string;
      severity: string;
    }>;
  }>;
  skillSoulConflictSummary?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum composite score to trigger DNA capture on Maintain verdicts. */
const MAINTAIN_DNA_CAPTURE_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Execute the God Layer for a confirmed verdict.
 *
 * Flow:
 * 1. Load verdict. If godLayerProcessedAt is set, return { processed: false, reason: 'already_processed' }.
 * 2. Load bot and soul data.
 * 3. Get current agent class (most recent row for botId + taskCategory, or default 'Novice').
 * 4. Compute class transition.
 * 5. If transitioned: insert new agentClasses row.
 * 6. If Promote or Maintain with compositeScore >= 0.7: capture DNA.
 * 7. If Demote, Monitor, or Retire: record negative signal.
 * 8. If Promote: check and record pioneer.
 * 9. Mark verdict as processed (godLayerProcessedAt = now).
 *
 * All sub-calls are wrapped in individual try/catch — one failure does not
 * block the whole God Layer.
 */
export async function executeGodLayer(verdictId: string): Promise<GodLayerResult> {
  // Step 1: Load verdict and check idempotency
  let verdict: {
    id: string;
    botId: string;
    executionId: string;
    soulId: string | null;
    verdictType: string;
    status: string;
    godLayerProcessedAt: Date | null;
    verdictSummary: string;
    weightedConfidenceScore: string;
    soulAnalystOutput: SoulAnalystOutputWithSkills | null;
  } | undefined;

  try {
    const rows = await db
      .select()
      .from(councilVerdicts)
      .where(eq(councilVerdicts.id, verdictId))
      .limit(1);
    verdict = rows[0] as typeof verdict;
  } catch (err) {
    console.error('[god-layer] Failed to load verdict:', { verdictId, error: (err as Error).message });
    throw err;
  }

  if (!verdict) {
    return { processed: false, reason: 'verdict_not_found' };
  }

  // Idempotency guard: if already processed, return early
  if (verdict.godLayerProcessedAt !== null && verdict.godLayerProcessedAt !== undefined) {
    return { processed: false, reason: 'already_processed' };
  }

  // Step 2: Load bot data
  let bot: {
    id: string;
    executionId: string;
    soulId: string | null;
    compositeScore: string | null;
  } | undefined;

  try {
    const botRows = await db
      .select()
      .from(bots)
      .where(eq(bots.id, verdict.botId))
      .limit(1);
    bot = botRows[0] as typeof bot;
  } catch (err) {
    console.error('[god-layer] Failed to load bot:', { botId: verdict.botId, error: (err as Error).message });
  }

  // Step 3: Load soul data (if soulId present)
  let soul: {
    id: string;
    dimensions: unknown;
    taskCategory: string | null;
  } | undefined;

  if (verdict.soulId) {
    try {
      const soulRows = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.id, verdict.soulId))
        .limit(1);
      soul = soulRows[0] as typeof soul;
    } catch (err) {
      console.error('[god-layer] Failed to load soul:', { soulId: verdict.soulId, error: (err as Error).message });
    }
  }

  // Step 4: Get current agent class
  const taskCategory = (soul?.taskCategory) ?? 'general';
  let currentClass: AgentClass = 'Novice';

  try {
    const classRows = await db
      .select()
      .from(agentClasses)
      .where(eq(agentClasses.botId, verdict.botId))
      .orderBy(desc(agentClasses.updatedAt))
      .limit(1);

    if (classRows.length > 0 && classRows[0]) {
      currentClass = classRows[0].currentClass as AgentClass;
    }
  } catch (err) {
    console.error('[god-layer] Failed to load agent class:', { botId: verdict.botId, error: (err as Error).message });
  }

  // Step 5: Compute class transition
  const transition = computeClassTransition(currentClass, verdict.verdictType as VerdictType);

  // Step 6: Persist class transition if needed
  if (transition.transitioned) {
    try {
      await db.insert(agentClasses).values({
        botId: verdict.botId,
        taskCategory,
        currentClass: transition.newClass,
        lastVerdictId: verdictId,
        lastTransitionAt: new Date(),
        artisanGraduationAt: transition.newClass === 'Artisan' ? new Date() : undefined,
      } as any);
    } catch (err) {
      console.error('[god-layer] Failed to insert agent class transition:', {
        botId: verdict.botId,
        newClass: transition.newClass,
        error: (err as Error).message,
      });
    }
  }

  // Step 7: DNA capture for Promote or high-score Maintain
  const compositeScore = bot?.compositeScore ?? '0';
  const shouldCaptureDna =
    (verdict.verdictType === 'Promote' || verdict.verdictType === 'Maintain') &&
    parseFloat(compositeScore) >= MAINTAIN_DNA_CAPTURE_THRESHOLD &&
    soul !== undefined;

  if (shouldCaptureDna) {
    try {
      const skillLoadout = extractSkillLoadoutFromSoulAnalyst(verdict.soulAnalystOutput);
      await captureDna(
        verdict.botId,
        verdict.executionId,
        verdict.soulId ?? '',
        taskCategory,
        (soul?.dimensions as Record<string, unknown>) ?? {},
        compositeScore,
        skillLoadout,
      );
    } catch (err) {
      console.error('[god-layer] DNA capture failed:', { botId: verdict.botId, error: (err as Error).message });
    }
  }

  // Step 8: Negative signal for Demote, Monitor, or Retire
  if (
    verdict.verdictType === 'Demote' ||
    verdict.verdictType === 'Monitor' ||
    verdict.verdictType === 'Retire'
  ) {
    try {
      await recordNegativeSignal(
        verdict.botId,
        verdict.executionId,
        verdict.soulId,
        verdict.verdictType,
        verdict.verdictSummary,
        verdictId,
      );
    } catch (err) {
      console.error('[god-layer] Negative signal recording failed:', { botId: verdict.botId, error: (err as Error).message });
    }
  }

  // Step 9: Pioneer detection for Promote verdicts
  if (verdict.verdictType === 'Promote') {
    try {
      const isPioneer = await checkAndRecordPioneer(
        verdict.botId,
        verdict.soulId,
        taskCategory,
        compositeScore,
        verdict.executionId,
      );
      if (isPioneer) {
        console.log('[god-layer] Pioneer detected:', { botId: verdict.botId, taskCategory });
      }
    } catch (err) {
      console.error('[god-layer] Pioneer check failed:', { botId: verdict.botId, error: (err as Error).message });
    }
  }

  // Step 10: Skill unlearning - track consecutiveNegativeCount and auto-remove underperforming skills
  try {
    const unlearningResult = await processSkillUnlearning(
      verdict.botId,
      verdict.executionId,
      verdict.soulId,
      verdict.verdictType,
    );
    if (unlearningResult.unlearnedSkills.length > 0) {
      console.log('[god-layer] Skills unlearned:', {
        botId: verdict.botId,
        skills: unlearningResult.unlearnedSkills,
      });
    }
  } catch (err) {
    console.error('[god-layer] Skill unlearning failed:', { botId: verdict.botId, error: (err as Error).message });
  }

  // Step 11: Mark verdict as processed (idempotency stamp)
  try {
    await db
      .update(councilVerdicts)
      .set({ godLayerProcessedAt: new Date() } as any)
      .where(eq(councilVerdicts.id, verdictId));
  } catch (err) {
    console.error('[god-layer] Failed to mark verdict as processed:', { verdictId, error: (err as Error).message });
    throw err;
  }

  return { processed: true };
}

function extractSkillLoadoutFromSoulAnalyst(
  soulAnalystOutput: SoulAnalystOutputWithSkills | null,
): DnaPayload['skillLoadout'] | undefined {
  if (!soulAnalystOutput?.skillEvaluations?.length) {
    return undefined;
  }

  const equippedSkills = soulAnalystOutput.skillEvaluations.map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    activationCount: s.activationCount,
    avgEffectiveness: s.effectivenessScore,
  }));

  const conflictsDetected = soulAnalystOutput.skillEvaluations
    .flatMap((s) =>
      (s.conflictsWithDirectives ?? []).map((c) => ({
        skillId: s.skillId,
        directiveId: c.directive,
        conflictDescription: c.conflictDescription,
      })),
    );

  return {
    equippedSkills,
    conflictsDetected,
  };
}
