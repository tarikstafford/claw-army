import { pgTable, uuid, text, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { objectives } from './objectives';

export const executionStatusEnum = pgEnum('execution_status', [
  'queued',
  'running',
  'paused',
  'stopped',
  'completed',
  'failed',
]);

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: executionStatusEnum('status').notNull().default('queued'),
  objective: text('objective').notNull(),
  maxBots: integer('max_bots').notNull(),
  budgetCapCents: integer('budget_cap_cents').notNull(),
  runtimeLimitSeconds: integer('runtime_limit_seconds').notNull(),
  allowedTools: text('allowed_tools').array().notNull(),
  taskCategory: varchar('task_category', { length: 255 }), // nullable; derived from objective for soul seeding (Phase 9)
  objectiveId: uuid('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  ringLeaderRunId: uuid('ring_leader_run_id'), // nullable; logical FK to ring_leader_runs.id — no explicit ref to avoid circular
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
