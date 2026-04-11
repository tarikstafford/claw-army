import { z } from 'zod';

export const skillUnlearnedEventSchema = z.object({
  type: z.literal('skill_unlearned'),
  botId: z.uuid(),
  executionId: z.uuid(),
  skillId: z.string(),
  skillName: z.string(),
  reason: z.string(),
  consecutiveNegativeCount: z.number().int().nonnegative(),
  removedAt: z.iso.datetime(),
});

export type SkillUnlearnedEvent = z.infer<typeof skillUnlearnedEventSchema>;
