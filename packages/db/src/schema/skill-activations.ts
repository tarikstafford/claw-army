import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { bots } from './bots';
import { executions } from './executions';

export const skillActivations = pgTable(
  'skill_activations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id').notNull(),
    skillName: varchar('skill_name', { length: 255 }).notNull(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    compositeScoreBefore: numeric('composite_score_before', { precision: 5, scale: 2 }),
    compositeScoreAfter: numeric('composite_score_after', { precision: 5, scale: 2 }),
    scoreDelta: numeric('score_delta', { precision: 5, scale: 2 }),
    classification: varchar('classification', { length: 20 }).notNull().default('neutral'),
    consecutiveNegativeCount: integer('consecutive_negative_count').notNull().default(0),
    activatedAt: timestamp('activated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index('skill_activations_bot_id_idx').on(t.botId),
    index('skill_activations_skill_id_idx').on(t.skillId),
    index('skill_activations_execution_id_idx').on(t.executionId),
    index('skill_activations_classification_idx').on(t.classification),
  ],
);

export type SkillActivation = typeof skillActivations.$inferSelect;
export type NewSkillActivation = typeof skillActivations.$inferInsert;