/**
 * Skill Unlearning Service
 *
 * Automatically removes underperforming skills from an agent's loadout
 * based on consecutive negative evaluation cycles (FR-34).
 *
 * Flow:
 * 1. After each council evaluation, classify skill activations as positive/neutral/negative
 *    based on composite score delta
 * 2. Track consecutiveNegativeCount per skill per bot
 * 3. When consecutiveNegativeCount reaches threshold (2), auto-remove skill from loadout
 * 4. Set removedAt timestamp and isActive = false on skill_loadouts
 * 5. Emit skill_unlearned event for UI notification
 * 6. Log unlearning reason in negative signal register
 */

import { eq, and, desc } from 'drizzle-orm';
import { db, skillActivations, skillLoadouts, negativeSignalRegister } from '@claw/db';
import type { SkillActivation, SkillLoadout } from '@claw/db';

const CONSECUTIVE_NEGATIVE_THRESHOLD = 2;

export interface ScoreClassification {
  classification: 'positive' | 'neutral' | 'negative';
  scoreDelta: number;
}

export function classifyScoreDelta(delta: number): ScoreClassification {
  if (delta > 0) {
    return { classification: 'positive', scoreDelta: delta };
  } else if (delta < 0) {
    return { classification: 'negative', scoreDelta: delta };
  }
  return { classification: 'neutral', scoreDelta: 0 };
}

export async function getPreviousCompositeScore(
  botId: string,
  currentExecutionId: string,
): Promise<number | null> {
  const previousActivations = await db
    .select({
      compositeScoreAfter: skillActivations.compositeScoreAfter,
      executionId: skillActivations.executionId,
    })
    .from(skillActivations)
    .where(eq(skillActivations.botId, botId))
    .orderBy(desc(skillActivations.evaluatedAt))
    .limit(10);

  for (const activation of previousActivations) {
    if (
      activation.compositeScoreAfter !== null &&
      String(activation.executionId) !== currentExecutionId
    ) {
      return parseFloat(String(activation.compositeScoreAfter));
    }
  }

  return null;
}

export async function getActiveSkillsForBot(botId: string): Promise<SkillLoadout[]> {
  const activeLoadouts = await db
    .select()
    .from(skillLoadouts)
    .where(
      and(
        eq(skillLoadouts.botId, botId),
        eq(skillLoadouts.isActive, true),
      ),
    );

  return activeLoadouts;
}

export async function recordSkillActivation(params: {
  skillId: string;
  skillName: string;
  botId: string;
  executionId: string;
  compositeScoreBefore: number | null;
  compositeScoreAfter: number;
  classification: 'positive' | 'neutral' | 'negative';
  consecutiveNegativeCount: number;
}): Promise<void> {
  const scoreDelta =
    params.compositeScoreBefore !== null
      ? params.compositeScoreAfter - params.compositeScoreBefore
      : 0;

  await db.insert(skillActivations).values({
    skillId: params.skillId,
    skillName: params.skillName,
    botId: params.botId,
    executionId: params.executionId,
    compositeScoreBefore:
      params.compositeScoreBefore !== null ? String(params.compositeScoreBefore) : null,
    compositeScoreAfter: String(params.compositeScoreAfter),
    scoreDelta: String(scoreDelta),
    classification: params.classification,
    consecutiveNegativeCount: params.consecutiveNegativeCount,
    evaluatedAt: new Date(),
  });
}

export async function getSkillActivationHistory(
  botId: string,
  skillId: string,
): Promise<SkillActivation[]> {
  const history = await db
    .select()
    .from(skillActivations)
    .where(
      and(
        eq(skillActivations.botId, botId),
        eq(skillActivations.skillId, skillId),
      ),
    )
    .orderBy(desc(skillActivations.evaluatedAt));

  return history;
}

export async function getConsecutiveNegativeCount(
  botId: string,
  skillId: string,
): Promise<number> {
  const history = await getSkillActivationHistory(botId, skillId);

  if (history.length === 0) {
    return 0;
  }

  let consecutiveNegativeCount = 0;
  for (const activation of history) {
    if (activation.classification === 'negative') {
      consecutiveNegativeCount++;
    } else {
      break;
    }
  }

  return consecutiveNegativeCount;
}

export async function removeSkillFromLoadout(
  botId: string,
  skillId: string,
): Promise<void> {
  await db
    .update(skillLoadouts)
    .set({
      isActive: false,
      removedAt: new Date(),
    })
    .where(
      and(
        eq(skillLoadouts.botId, botId),
        eq(skillLoadouts.skillId, skillId),
        eq(skillLoadouts.isActive, true),
      ),
    );
}

export async function logSkillUnlearningReason(params: {
  botId: string;
  executionId: string;
  skillId: string;
  skillName: string;
  reason: string;
  consecutiveNegativeCount: number;
}): Promise<void> {
  await db.insert(negativeSignalRegister).values({
    botId: params.botId,
    executionId: params.executionId,
    failureType: 'skill_unlearning',
    directiveFailureSummary: params.reason,
    mutationBlacklist: {
      skillId: params.skillId,
      skillName: params.skillName,
      consecutiveNegativeCount: params.consecutiveNegativeCount,
      reason: params.reason,
    } as any,
  });
}

export interface SkillUnlearningResult {
  skillId: string;
  skillName: string;
  removed: boolean;
  consecutiveNegativeCount: number;
  reason?: string;
}

export async function processSkillUnlearning(params: {
  botId: string;
  executionId: string;
  compositeScore: number;
  previousCompositeScore: number | null;
}): Promise<SkillUnlearningResult[]> {
  const results: SkillUnlearningResult[] = [];
  const activeSkills = await getActiveSkillsForBot(params.botId);

  if (activeSkills.length === 0) {
    return results;
  }

  const scoreDelta =
    params.previousCompositeScore !== null
      ? params.compositeScore - params.previousCompositeScore
      : 0;

  const { classification } = classifyScoreDelta(scoreDelta);

  for (const skillLoadout of activeSkills) {
    const previousCount = await getConsecutiveNegativeCount(params.botId, skillLoadout.skillId);

    let newConsecutiveCount = previousCount;
    if (classification === 'negative') {
      newConsecutiveCount = previousCount + 1;
    } else {
      newConsecutiveCount = 0;
    }

    await recordSkillActivation({
      skillId: skillLoadout.skillId,
      skillName: skillLoadout.skillName,
      botId: params.botId,
      executionId: params.executionId,
      compositeScoreBefore: params.previousCompositeScore,
      compositeScoreAfter: params.compositeScore,
      classification,
      consecutiveNegativeCount: newConsecutiveCount,
    });

    if (newConsecutiveCount >= CONSECUTIVE_NEGATIVE_THRESHOLD) {
      const reason = `Skill "${skillLoadout.skillName}" reached ${newConsecutiveCount} consecutive negative evaluations (delta: ${scoreDelta})`;

      await removeSkillFromLoadout(params.botId, skillLoadout.skillId);

      await logSkillUnlearningReason({
        botId: params.botId,
        executionId: params.executionId,
        skillId: skillLoadout.skillId,
        skillName: skillLoadout.skillName,
        reason,
        consecutiveNegativeCount: newConsecutiveCount,
      });

      results.push({
        skillId: skillLoadout.skillId,
        skillName: skillLoadout.skillName,
        removed: true,
        consecutiveNegativeCount: newConsecutiveCount,
        reason,
      });
    } else {
      results.push({
        skillId: skillLoadout.skillId,
        skillName: skillLoadout.skillName,
        removed: false,
        consecutiveNegativeCount: newConsecutiveCount,
      });
    }
  }

  return results;
}

export async function emitSkillUnlearnedEvents(
  results: SkillUnlearningResult[],
  _botId: string,
  _executionId: string,
): Promise<void> {
  for (const result of results) {
    if (result.removed && result.reason) {
      console.log('[skill-unlearning] Skill unlearned:', {
        skillId: result.skillId,
        skillName: result.skillName,
        reason: result.reason,
        consecutiveNegativeCount: result.consecutiveNegativeCount,
      });
    }
  }
}
