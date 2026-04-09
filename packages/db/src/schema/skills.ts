import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';

export const skillCategoryEnum = pgEnum('skill_category', [
  'tool_usage',
  'reasoning',
  'error_recovery',
  'delegation',
  'communication',
  'planning',
  'verification',
  'other',
]);

export const skillApprovalStatusEnum = pgEnum('skill_approval_status', [
  'pending',
  'approved',
  'rejected',
  'auto_approved',
]);

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    category: skillCategoryEnum('category').notNull(),
    triggerPatterns: jsonb('trigger_patterns').$type<string[]>().notNull().default([]),
    proceduralBody: text('procedural_body').notNull(),
    requiredTools: jsonb('required_tools').$type<string[]>().notNull().default([]),
    skillContent: text('skill_content'),
    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }).notNull(),
    approvalStatus: skillApprovalStatusEnum('approval_status').notNull().default('pending'),
    botId: uuid('bot_id'),
    soulId: uuid('soul_id'),
    executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }),
    sourceTraceIds: jsonb('source_trace_ids').$type<string[]>().notNull().default([]),
    provenance: jsonb('provenance').$type<{
      decisionCount: number;
      successfulOutcomes: number;
      averageAttributionConfidence: number;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true, precision: 3 }),
    approvedBy: varchar('approved_by', { length: 255 }),
  },
  (t) => [
    index('skills_bot_id_idx').on(t.botId),
    index('skills_soul_id_idx').on(t.soulId),
    index('skills_execution_id_idx').on(t.executionId),
    index('skills_category_idx').on(t.category),
    index('skills_approval_status_idx').on(t.approvalStatus),
    index('skills_confidence_score_idx').on(t.confidenceScore),
  ],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
