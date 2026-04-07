import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Named Objectives — reusable execution templates.
 *
 * An objective captures a named intent (e.g. "Audit competitor pricing") with
 * preset defaults for bots, budget, runtime, and allowed tools. Users can
 * launch executions from an objective and the defaults are pre-filled.
 *
 * Archived objectives are hidden from new-execution flows but retained for
 * historical reference on past executions.
 */
export const objectives = pgTable(
  'objectives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    defaultMaxBots: integer('default_max_bots').notNull().default(5),
    defaultBudgetCapCents: integer('default_budget_cap_cents'),
    defaultRuntimeLimitSeconds: integer('default_runtime_limit_seconds'),
    defaultAllowedTools: text('default_allowed_tools').array().notNull().default([]),
    isArchived: boolean('is_archived').notNull().default(false),
    projectId: uuid('project_id'), // nullable; logical FK to Paperclip's projects table
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('objectives_is_archived_idx').on(t.isArchived),
    index('objectives_created_at_idx').on(t.createdAt),
  ],
);

export type Objective = typeof objectives.$inferSelect;
export type NewObjective = typeof objectives.$inferInsert;
