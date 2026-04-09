import { z } from 'zod';

export const skillCategorySchema = z.enum([
  'tool_usage',
  'reasoning',
  'error_recovery',
  'delegation',
  'communication',
  'planning',
  'verification',
  'other',
]);

export type SkillCategory = z.infer<typeof skillCategorySchema>;

export const skillApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'auto_approved',
]);

export type SkillApprovalStatus = z.infer<typeof skillApprovalStatusSchema>;

export const skillLearnedEventSchema = z.object({
  type: z.literal('skill_learned'),
  skillId: z.uuid(),
  executionId: z.uuid(),
  botId: z.uuid(),
  soulId: z.uuid().nullable(),
  skillName: z.string(),
  category: skillCategorySchema,
  confidenceScore: z.number().min(0).max(1),
  approvalStatus: skillApprovalStatusSchema,
  sourceTraceIds: z.array(z.uuid()),
  timestamp: z.iso.datetime(),
  skillContent: z.string().optional(),
});

export type SkillLearnedEvent = z.infer<typeof skillLearnedEventSchema>;

export const skillCandidateSchema = z.object({
  name: z.string(),
  category: skillCategorySchema,
  triggerPatterns: z.array(z.string()),
  proceduralBody: z.string(),
  requiredTools: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  sourceTraceIds: z.array(z.string()),
  provenance: z.object({
    executionId: z.string(),
    botId: z.string(),
    soulId: z.string().nullable(),
    decisionCount: z.number(),
    successfulOutcomes: z.number(),
  }),
});

export type SkillCandidate = z.infer<typeof skillCandidateSchema>;
