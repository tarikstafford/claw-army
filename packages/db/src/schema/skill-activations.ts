import {
  pgTable,
  uuid,
  integer,
  real,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { bots } from './bots.js';
import { agentSkills } from './agent-skills.js';

export const activationClassificationEnum = pgEnum('activation_classification', [
  'positive',
  'neutral',
  'negative',
]);

export const skillActivations = pgTable(
  'skill_activations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => agentSkills.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id').notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    compositeScoreDelta: real('composite_score_delta').notNull(),
    classification: activationClassificationEnum('classification').notNull(),
    consecutiveNegativeCount: integer('consecutive_negative_count').notNull().default(0),
  },
  (t) => [
    index('skill_activations_bot_id_idx').on(t.botId),
    index('skill_activations_skill_id_idx').on(t.skillId),
    index('skill_activations_execution_id_idx').on(t.executionId),
  ],
);

export type SkillActivation = typeof skillActivations.$inferSelect;
export type NewSkillActivation = typeof skillActivations.$inferInsert;
