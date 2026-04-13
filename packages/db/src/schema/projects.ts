import { pgTable, uuid, text, timestamp, date, index, jsonb } from 'drizzle-orm/pg-core';

/**
 * Projects table — project management for companies.
 * Uses logical FKs (no references()) to avoid circular TS inference.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    goalId: uuid('goal_id'),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('backlog'),
    leadAgentId: uuid('lead_agent_id'),
    targetDate: date('target_date'),
    color: text('color'),
    pauseReason: text('pause_reason'),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    executionWorkspacePolicy: jsonb('execution_workspace_policy').$type<Record<string, unknown>>(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('projects_company_idx').on(table.companyId),
  }),
);
