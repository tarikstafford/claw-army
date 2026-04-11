/**
 * Skill Unlearning Service
 *
 * Automatically removes underperforming skills from an agent's loadout.
 * Tracks consecutiveNegativeCount per skill per agent and triggers
 * unlearning when threshold is reached (FR-34: 2 consecutive negative cycles).
 *
 * After each council evaluation:
 * 1. Check activation classification (already set by the evolution pipeline)
 * 2. Increment or reset consecutiveNegativeCount accordingly
 * 3. When threshold reached: auto-remove skill, emit event, log to negative signal register
 */

import { eq, and } from 'drizzle-orm';
import { db, skillActivations, skillLoadouts, negativeSignalRegister, agentSkills } from '@claw/db';
import { skillUnlearnedEventSchema, type SkillUnlearnedEvent } from '@claw/event-schemas/skill-events';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNLEARNING_THRESHOLD = 2;

interface SkillUnlearningResult {
  unlearnedSkills: Array<{
    skillId: string;
    skillName: string;
    reason: string;
  }>;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function processSkillUnlearning(
  botId: string,
  executionId: string,
  soulId: string | null,
  verdictType: string,
): Promise<SkillUnlearningResult> {
  const unlearnedSkills: SkillUnlearningResult['unlearnedSkills'] = [];

  // Join activations with agentSkills to get skill names
  const activations = await db
    .select({
      activation: skillActivations,
      skillName: agentSkills.skillName,
    })
    .from(skillActivations)
    .innerJoin(agentSkills, eq(skillActivations.skillId, agentSkills.id))
    .where(eq(skillActivations.botId, botId));

  for (const { activation, skillName } of activations) {
    let newConsecutiveCount: number;
    let shouldUnlearn = false;
    let reason = '';

    if (activation.classification === 'negative' || verdictType === 'Demote' || verdictType === 'Retire') {
      newConsecutiveCount = activation.consecutiveNegativeCount + 1;

      if (newConsecutiveCount >= UNLEARNING_THRESHOLD) {
        shouldUnlearn = true;
        reason = `Skill "${skillName}" reached ${newConsecutiveCount} consecutive negative evaluations (threshold: ${UNLEARNING_THRESHOLD}). Last verdict: ${verdictType}, classification: ${activation.classification}`;
      }
    } else {
      newConsecutiveCount = 0;
    }

    if (shouldUnlearn) {
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(skillLoadouts)
          .set({
            isActive: false,
            removedAt: now,
          })
          .where(
            and(
              eq(skillLoadouts.botId, botId),
              eq(skillLoadouts.skillId, activation.skillId),
            ),
          );

        await tx.delete(skillActivations).where(eq(skillActivations.id, activation.id));

        await tx.insert(negativeSignalRegister).values({
          soulId: soulId ?? undefined,
          botId,
          executionId,
          failureType: 'skill_unlearning',
          directiveFailureSummary: reason,
          mutationBlacklist: {
            skillId: activation.skillId,
            skillName,
            consecutiveNegativeCount: newConsecutiveCount,
            verdictType,
          },
        } as any);
      });

      const event: SkillUnlearnedEvent = {
        type: 'skill_unlearned',
        botId,
        executionId,
        skillId: activation.skillId,
        skillName,
        reason,
        consecutiveNegativeCount: newConsecutiveCount,
        removedAt: now.toISOString() as any,
      };

      skillUnlearnedEventSchema.parse(event);

      console.log('[skill-unlearning] Skill unlearned:', {
        botId,
        skillId: activation.skillId,
        skillName,
        consecutiveNegativeCount: newConsecutiveCount,
      });

      unlearnedSkills.push({
        skillId: activation.skillId,
        skillName,
        reason,
      });
    } else {
      await db
        .update(skillActivations)
        .set({
          consecutiveNegativeCount: newConsecutiveCount,
        })
        .where(eq(skillActivations.id, activation.id));
    }
  }

  return { unlearnedSkills };
}
