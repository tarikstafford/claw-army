import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { botSouls } from './bot-souls';

export const skillApprovalStatusEnum = pgEnum('skill_approval_status', [
  'auto_approved',
  'pending_review',
  'rejected',
]);

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    soulId: uuid('soul_id').references(() => botSouls.id),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    triggerPatterns: jsonb('trigger_patterns').notNull().default([]),
    proceduralBody: text('procedural_body').notNull(),
    requiredTools: jsonb('required_tools').notNull().default([]),
    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }).notNull(),
    approvalStatus: skillApprovalStatusEnum('approval_status').notNull().default('pending_review'),
    sourceTraceIds: jsonb('source_trace_ids').notNull().default([]),
    skillContent: text('skill_content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true, precision: 3 }),
    approvedBy: varchar('approved_by', { length: 255 }),
  },
  (t) => [
    index('skills_bot_id_idx').on(t.botId),
    index('skills_soul_id_idx').on(t.soulId),
    index('skills_execution_id_idx').on(t.executionId),
    index('skills_approval_status_idx').on(t.approvalStatus),
    index('skills_category_idx').on(t.category),
  ],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
