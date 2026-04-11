import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { bots } from './bots';

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<SkillMetadata>().notNull(),
    source: varchar('source', { length: 50 }).notNull(), // 'learned' | 'manual' | 'marketplace'
    effectivenessScore: numeric('effectiveness_score', { precision: 4, scale: 3 }),
    approvalStatus: varchar('approval_status', { length: 20 }).notNull().default('pending'),
    sourceExecutionId: uuid('source_execution_id').references(() => executions.id),
    sourceBotId: uuid('source_bot_id').references(() => bots.id),
    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }),
    triggerPatterns: jsonb('trigger_patterns').$type<string[]>().notNull().default([]),
    requiredTools: jsonb('required_tools').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('skills_user_id_idx').on(t.userId),
    index('skills_category_idx').on(t.category),
    index('skills_approval_status_idx').on(t.approvalStatus),
    index('skills_source_execution_id_idx').on(t.sourceExecutionId),
  ],
);

export interface SkillMetadata {
  description?: string;
  version?: string;
  minAgentClass?: string;
  requiresSkills?: string[];
  tags?: string[];
  learnedFromTraces?: string[];
}

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;