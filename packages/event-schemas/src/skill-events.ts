import { z } from 'zod';

export const skillUnlearnedEventSchema = z.object({
  type: z.literal('skill_unlearned'),
  botId: z.uuid(),
  skillId: z.uuid(),
  executionId: z.uuid(),
  reason: z.string(),
  consecutiveNegativeCount: z.number().int().nonnegative(),
  threshold: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type SkillUnlearnedEvent = z.infer<typeof skillUnlearnedEventSchema>;
