import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const agentClassEnum = pgEnum('agent_class', [
  'Novice',
  'Understudy',
  'Artisan',
  'Retired',
]);

export const agentClasses = pgTable(
  'agent_classes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    taskCategory: varchar('task_category', { length: 255 }).notNull(),
    currentClass: agentClassEnum('current_class').notNull().default('Novice'),
    aboveBenchmarkCount: integer('above_benchmark_count').notNull().default(0),
    belowBenchmarkCount: integer('below_benchmark_count').notNull().default(0),
    humanConfirmationCount: integer('human_confirmation_count').notNull().default(0),
    consecutiveBelowCount: integer('consecutive_below_count').notNull().default(0),
    isPioneer: boolean('is_pioneer').notNull().default(false),
    lastVerdictId: uuid('last_verdict_id'), // nullable
    lastTransitionAt: timestamp('last_transition_at', { withTimezone: true, precision: 3 }), // nullable
    artisanGraduationAt: timestamp('artisan_graduation_at', { withTimezone: true, precision: 3 }), // nullable
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_classes_bot_id_idx').on(t.botId),
    index('agent_classes_task_category_idx').on(t.taskCategory),
    unique('agent_classes_bot_category_unique').on(t.botId, t.taskCategory),
  ],
);

export type AgentClass = typeof agentClasses.$inferSelect;
export type NewAgentClass = typeof agentClasses.$inferInsert;
