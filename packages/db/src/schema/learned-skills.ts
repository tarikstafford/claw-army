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
import { bots } from './bots';
import { executions } from './executions';

export const skillApprovalStatusEnum = pgEnum('skill_approval_status', [
  'auto_approved',
  'pending_review',
  'rejected',
]);

/**
 * Stores skills autonomously learned by agents from decision trace analysis.
 *
 * Distinct from the `skills` table (user-created CRUD skills) and `agent_skills`
 * (company-authored skill definitions). This table captures procedural knowledge
 * that agents discover through the Karpathy Loop.
 *
 * Uses logical FK for soulId to avoid circular TS inference at module load time.
 */
export const learnedSkills = pgTable(
  'learned_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    soulId: uuid('soul_id'), // logical FK to bot_souls — no references() to avoid circular TS inference
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
    approvedBy: text('approved_by'),
  },
  (t) => [
    index('learned_skills_bot_id_idx').on(t.botId),
    index('learned_skills_soul_id_idx').on(t.soulId),
    index('learned_skills_execution_id_idx').on(t.executionId),
    index('learned_skills_approval_status_idx').on(t.approvalStatus),
    index('learned_skills_category_idx').on(t.category),
  ],
);

export type LearnedSkill = typeof learnedSkills.$inferSelect;
export type NewLearnedSkill = typeof learnedSkills.$inferInsert;
