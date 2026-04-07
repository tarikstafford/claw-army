import { pgTable, uuid, text, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { objectives } from './objectives';

export const executionStatusEnum = pgEnum('execution_status', [
  'pre_flight',
  'queued',
  'running',
  'paused',
  'stopped',
  'completed',
  'failed',
]);

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: executionStatusEnum('status').notNull().default('pre_flight'),
  objective: text('objective').notNull(),
  maxBots: integer('max_bots').notNull(),
  budgetCapCents: integer('budget_cap_cents').notNull(),
  runtimeLimitSeconds: integer('runtime_limit_seconds').notNull(),
  allowedTools: text('allowed_tools').array().notNull(),
  llmProvider: varchar('llm_provider', { length: 50 }),
  allowedDomains: text('allowed_domains').array(),
  taskCategory: varchar('task_category', { length: 255 }), // nullable; derived from objective for soul seeding (Phase 9)
  campaignType: varchar('campaign_type', { length: 20 }), // nullable; 'ad_hoc' | 'campaign'
  objectiveId: uuid('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  ringLeaderRunId: uuid('ring_leader_run_id'), // nullable; logical FK to ring_leader_runs.id — no explicit ref to avoid circular
  projectId: uuid('project_id'), // nullable; logical FK to Paperclip's projects table
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
