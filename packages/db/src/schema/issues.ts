import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Issues table — task tracking for agents.
 * Uses logical FKs (no references()) to avoid circular TS inference.
 */
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    projectId: uuid('project_id'),
    goalId: uuid('goal_id'),
    parentId: uuid('parent_id'),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('backlog'),
    priority: text('priority').notNull().default('medium'),
    assigneeAgentId: uuid('assignee_agent_id'),
    assigneeUserId: text('assignee_user_id'),
    checkoutRunId: uuid('checkout_run_id'),
    executionRunId: uuid('execution_run_id'),
    executionAgentNameKey: text('execution_agent_name_key'),
    executionLockedAt: timestamp('execution_locked_at', { withTimezone: true }),
    createdByAgentId: uuid('created_by_agent_id'),
    createdByUserId: text('created_by_user_id'),
    issueNumber: integer('issue_number'),
    identifier: text('identifier'),
    requestDepth: integer('request_depth').notNull().default(0),
    billingCode: text('billing_code'),
    assigneeAdapterOverrides: jsonb('assignee_adapter_overrides').$type<Record<string, unknown>>(),
    executionWorkspaceSettings: jsonb('execution_workspace_settings').$type<Record<string, unknown>>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index('issues_company_status_idx').on(table.companyId, table.status),
    assigneeStatusIdx: index('issues_company_assignee_status_idx').on(
      table.companyId,
      table.assigneeAgentId,
      table.status,
    ),
    assigneeUserStatusIdx: index('issues_company_assignee_user_status_idx').on(
      table.companyId,
      table.assigneeUserId,
      table.status,
    ),
    parentIdx: index('issues_company_parent_idx').on(table.companyId, table.parentId),
    projectIdx: index('issues_company_project_idx').on(table.companyId, table.projectId),
    identifierIdx: uniqueIndex('issues_identifier_idx').on(table.identifier),
  }),
);
