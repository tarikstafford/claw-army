import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const skillCategoryEnum = pgEnum('skill_category', [
  'communication',
  'analysis',
  'creation',
  'automation',
  'research',
  'coordination',
  'monitoring',
  'other',
]);

export const skillSourceEnum = pgEnum('skill_source', [
  'user_created',
  'imported',
  'curated',
]);

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    version: varchar('version', { length: 50 }).notNull().default('1.0.0'),
    category: skillCategoryEnum('category').notNull().default('other'),
    triggers: jsonb('triggers').notNull().default([]),
    requiresTools: jsonb('requires_tools').notNull().default([]),
    requiresSkills: jsonb('requires_skills').notNull().default([]),
    minAgentClass: varchar('min_agent_class', { length: 20 }).notNull().default('Novice'),
    content: text('content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    source: skillSourceEnum('source').notNull().default('user_created'),
    isPublic: varchar('is_public', { length: 1 }).notNull().default('n'),
    effectivenessStats: jsonb('effectiveness_stats'),
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
    agentId: uuid('agent_id').notNull(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    equippedAt: timestamp('equipped_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    equippedBy: text('equipped_by').notNull(),
  },
  (t) => [
    uniqueIndex('agent_skills_agent_skill_uniq').on(t.agentId, t.skillId),
    index('agent_skills_agent_id_idx').on(t.agentId),
    index('agent_skills_skill_id_idx').on(t.skillId),
  ],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;

export const AGENT_CLASS_SKILL_CAPACITY: Record<string, number> = {
  Novice: 3,
  Understudy: 5,
  Artisan: 8,
  Retired: 0,
} as const;
