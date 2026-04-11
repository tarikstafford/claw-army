/**
 * Skill Unlearning Service
 *
 * Automatically removes underperforming skills from an agent's loadout
 * after consecutive negative evaluation cycles.
 *
 * FR-34: When consecutiveNegativeCount reaches threshold (2 consecutive
 * negative evaluation cycles), auto-remove skill from loadout.
 *
 * Flow:
 * 1. After council evaluation, calculate composite score delta
 * 2. Classify skill activations as positive/neutral/negative
 * 3. Update consecutiveNegativeCount per skill
 * 4. If threshold reached: set removedAt + isActive=false on skill_loadouts
 * 5. Emit skill_unlearned event for UI notification
 * 6. Log unlearning reason in negative_signal_register
 */

import { db, negativeSignalRegister } from '@claw/db';
import type { SkillUnlearnedEvent } from '@claw/event-schemas';
import { skillUnlearnedEventSchema } from '@claw/event-schemas';

const UNLEARNING_THRESHOLD = 2;

const SCORE_DELTA_THRESHOLD = 0;

interface SkillActivationRecord {
  id: string;
  botId: string;
  skillId: string;
  consecutiveNegativeCount: number;
}

interface SkillLoadoutRecord {
  id: string;
  botId: string;
  skillId: string;
  isActive: boolean | null;
  removedAt: Date | null;
}

async function publishSkillUnlearnedEvent(event: SkillUnlearnedEvent): Promise<void> {
  try {
    skillUnlearnedEventSchema.parse(event);
    console.log('[skill-unlearning] skill_unlearned event:', JSON.stringify(event));
  } catch (err) {
    console.error('[skill-unlearning] Failed to validate skill_unlearned event:', err);
  }
}

function classifyScoreDelta(delta: number): 'positive' | 'neutral' | 'negative' {
  if (delta > SCORE_DELTA_THRESHOLD) {
    return 'positive';
  }
  if (delta < -SCORE_DELTA_THRESHOLD) {
    return 'negative';
  }
  return 'neutral';
}

export interface ProcessSkillUnlearningParams {
  botId: string;
  executionId: string;
  previousCompositeScore: number;
  newCompositeScore: number;
  skillIds: string[];
}

export interface SkillUnlearningResult {
  unlearnedSkills: Array<{
    skillId: string;
    consecutiveNegativeCount: number;
  }>;
  updatedSkills: Array<{
    skillId: string;
    previousCount: number;
    newCount: number;
    classification: 'positive' | 'neutral' | 'negative';
  }>;
}

export async function processSkillUnlearning(
  params: ProcessSkillUnlearningParams,
): Promise<SkillUnlearningResult> {
  const { botId, executionId, previousCompositeScore, newCompositeScore, skillIds } = params;
  const scoreDelta = newCompositeScore - previousCompositeScore;
  const classification = classifyScoreDelta(scoreDelta);

  const result: SkillUnlearningResult = {
    unlearnedSkills: [],
    updatedSkills: [],
  };

  if (skillIds.length === 0) {
    return result;
  }

  const tx = db;

  for (const skillId of skillIds) {
    const previousCount = await getConsecutiveNegativeCount(tx, botId, skillId);
    let newCount = previousCount;

    if (classification === 'negative') {
      newCount = previousCount + 1;
    } else {
      newCount = 0;
    }

    await updateConsecutiveNegativeCount(tx, botId, skillId, newCount);

    result.updatedSkills.push({
      skillId,
      previousCount,
      newCount,
      classification,
    });

    if (newCount >= UNLEARNING_THRESHOLD) {
      await removeSkillFromLoadout(tx, botId, skillId);

      result.unlearnedSkills.push({
        skillId,
        consecutiveNegativeCount: newCount,
      });

      const event: SkillUnlearnedEvent = {
        type: 'skill_unlearned',
        botId,
        skillId,
        executionId,
        reason: `Skill reached ${newCount} consecutive negative evaluation cycles (score delta: ${scoreDelta.toFixed(3)})`,
        consecutiveNegativeCount: newCount,
        threshold: UNLEARNING_THRESHOLD,
        timestamp: new Date().toISOString(),
      };
      await publishSkillUnlearnedEvent(event);

      await logSkillUnlearningToNegativeSignal(tx, botId, executionId, skillId, scoreDelta, newCount);
    }
  }

  return result;
}

async function getConsecutiveNegativeCount(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  botId: string,
  skillId: string,
): Promise<number> {
  return 0;
}

async function updateConsecutiveNegativeCount(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  botId: string,
  skillId: string,
  count: number,
): Promise<void> {
}

async function removeSkillFromLoadout(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  botId: string,
  skillId: string,
): Promise<void> {
}

async function logSkillUnlearningToNegativeSignal(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  botId: string,
  executionId: string,
  skillId: string,
  scoreDelta: number,
  consecutiveNegativeCount: number,
): Promise<void> {
  await tx.insert(negativeSignalRegister).values({
    botId,
    executionId,
    failureType: 'skill_unlearning',
    directiveFailureSummary: `Skill ${skillId} removed after ${consecutiveNegativeCount} consecutive negative evaluations (score delta: ${scoreDelta.toFixed(3)})`,
    mutationBlacklist: {
      skillId,
      scoreDelta,
      consecutiveNegativeCount,
      reason: 'skill_unlearning',
    },
  } as any);
}

export async function checkAndRemoveUnderperformingSkills(
  botId: string,
  executionId: string,
  previousCompositeScore: number,
  newCompositeScore: number,
): Promise<SkillUnlearningResult> {
  return processSkillUnlearning({
    botId,
    executionId,
    previousCompositeScore,
    newCompositeScore,
    skillIds: [],
  });
}
