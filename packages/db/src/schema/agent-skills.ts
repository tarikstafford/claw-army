import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { bots } from './bots.js';

export const sourceTypeEnum = pgEnum('source_type', [
  'authored',
  'learned',
  'acquired',
]);

export interface SkillMetadata {
  category: string;
  triggers: string[];
  requires_tools: string[];
  requires_skills: string[];
  min_agent_class: 'Novice' | 'Understudy' | 'Artisan';
}

export const agentSkills = pgTable(
  'agent_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    skillName: varchar('skill_name', { length: 255 }).notNull(),
    skillDescription: text('skill_description').notNull(),
    skillContent: text('skill_content').notNull(),
    metadata: jsonb('metadata').$type<SkillMetadata>().notNull(),
    version: integer('version').notNull().default(1),
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true, precision: 3 }),
    sourceType: sourceTypeEnum('source_type').notNull().default('authored'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_skills_company_id_idx').on(t.companyId),
    index('agent_skills_skill_name_idx').on(t.skillName),
    unique('agent_skills_company_skill_version_unique').on(t.companyId, t.skillName, t.version),
  ],
);

export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;
