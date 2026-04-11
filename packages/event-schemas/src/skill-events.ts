import { z } from 'zod';

export const skillLearnedEventSchema = z.object({
  type: z.literal('skill_learned'),
  skillId: z.uuid(),
  botId: z.uuid(),
  executionId: z.uuid(),
  soulId: z.uuid().nullable(),
  taskCategory: z.string(),
  skillName: z.string(),
  confidenceScore: z.number().min(0).max(1),
  approvalStatus: z.enum(['auto_approved', 'pending_review', 'rejected']),
  sourceTraceIds: z.array(z.uuid()),
  timestamp: z.iso.datetime(),
});

export type SkillLearnedEvent = z.infer<typeof skillLearnedEventSchema>;
