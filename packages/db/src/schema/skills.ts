import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const skillSourceEnum = pgEnum('skill_source', ['user', 'library']);

export const skillCategoryEnum = pgEnum('skill_category', [
  'communication',
  'data_analysis',
  'code_generation',
  'content_creation',
  'research',
  'problem_solving',
  'automation',
  'general',
]);

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    version: varchar('version', { length: 50 }).notNull().default('1.0.0'),
    category: skillCategoryEnum('category').notNull().default('general'),
    triggers: jsonb('triggers').notNull().default([]),
    requiresTools: jsonb('requires_tools').notNull().default([]),
    requiresSkills: jsonb('requires_skills').notNull().default([]),
    minAgentClass: varchar('min_agent_class', { length: 20 }).notNull().default('Novice'),
    content: text('content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    source: skillSourceEnum('source').notNull().default('user'),
    effectivenessStats: jsonb('effectiveness_stats').notNull().default({
      totalEquips: 0,
      avgPerformanceScore: null,
      successRate: null,
    }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('skills_user_id_idx').on(t.userId),
    index('skills_category_idx').on(t.category),
    index('skills_source_idx').on(t.source),
    index('skills_name_idx').on(t.name),
    unique('skills_user_name_unique').on(t.userId, t.name),
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
    equippedBy: varchar('equipped_by', { length: 255 }).notNull(),
    equippedAt: timestamp('equipped_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_skills_bot_id_idx').on(t.botId),
    index('agent_skills_skill_id_idx').on(t.skillId),
    unique('agent_skills_bot_skill_unique').on(t.botId, t.skillId),
  ],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;