import {
  pgTable,
  uuid,
  text,
  jsonb,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const skillCategories = ['communication', 'reasoning', 'tool_use', 'domain_knowledge', 'meta'] as const;
export type SkillCategory = (typeof skillCategories)[number];

export const skillSources = ['user_created', 'dna_captured', 'archetype'] as const;
export type SkillSource = (typeof skillSources)[number];

export const agentClassRequired = ['Novice', 'Understudy', 'Artisan'] as const;
export type AgentClassRequired = (typeof agentClassRequired)[number];

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
    category: text('category').notNull(), // skillCategories union
    triggers: jsonb('triggers').notNull().default([]), // array of regex/glob patterns
    requiresTools: jsonb('requires_tools').notNull().default([]), // array of tool IDs
    requiresSkills: jsonb('requires_skills').notNull().default([]), // array of skill IDs
    minAgentClass: text('min_agent_class').notNull().default('Novice'), // agentClassRequired
    content: text('content').notNull(), // full SKILL.md markdown
    contentHash: varchar('content_hash', { length: 64 }).notNull(), // SHA-256 hex digest
    source: text('source').notNull().default('user_created'), // skillSources
    effectivenessStats: jsonb('effectiveness_stats').notNull().default({
      useCount: 0,
      successCount: 0,
      failureCount: 0,
      averageScore: null,
    }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('skills_user_id_idx').on(t.userId),
    index('skills_category_idx').on(t.category),
    index('skills_source_idx').on(t.source),
    uniqueIndex('skills_user_name_uniq').on(t.userId, t.name),
  ],
);

export const agentSkills = pgTable(
  'agent_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    equippedBy: text('equipped_by').notNull(),
    equippedAt: timestamp('equipped_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_skills_bot_id_idx').on(t.botId),
    index('agent_skills_skill_id_idx').on(t.skillId),
    uniqueIndex('agent_skills_bot_skill_uniq').on(t.botId, t.skillId),
  ],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;