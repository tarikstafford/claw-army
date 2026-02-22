import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const categoryBenchmarks = pgTable(
  'category_benchmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskCategory: varchar('task_category', { length: 255 }).notNull().unique(),
    pioneerBotId: uuid('pioneer_bot_id').notNull(),
    pioneerSoulId: uuid('pioneer_soul_id'), // nullable
    pioneerExecutionId: uuid('pioneer_execution_id').notNull(),
    baselineCompositeScore: numeric('baseline_composite_score', { precision: 5, scale: 2 }).notNull(),
    confirmedRunCount: integer('confirmed_run_count').notNull().default(1),
    thinDataFlag: boolean('thin_data_flag').notNull().default(true),
    benchmarkMature: boolean('benchmark_mature').notNull().default(false),
    standardPromotion: boolean('standard_promotion').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
);

export type CategoryBenchmark = typeof categoryBenchmarks.$inferSelect;
export type NewCategoryBenchmark = typeof categoryBenchmarks.$inferInsert;
