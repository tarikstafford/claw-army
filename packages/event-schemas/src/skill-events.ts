import { z } from 'zod';

const skillMetadataSchema = z.object({
  description: z.string().optional(),
  version: z.string().optional(),
  minAgentClass: z.string().optional(),
  requiresSkills: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  learnedFromTraces: z.array(z.string()).optional(),
});

export const skillLearnedEventSchema = z.object({
  type: z.literal('skill_learned'),
  skillId: z.uuid(),
  executionId: z.uuid(),
  botId: z.uuid(),
  skillName: z.string(),
  category: z.string(),
  confidenceScore: z.number().min(0).max(1),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']),
  source: z.enum(['learned', 'manual', 'marketplace']),
  timestamp: z.iso.datetime(),
});

export type SkillLearnedEvent = z.infer<typeof skillLearnedEventSchema>;