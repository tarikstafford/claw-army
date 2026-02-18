import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
