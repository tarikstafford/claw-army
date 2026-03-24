import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const toolInvocationLogs = pgTable(
  'tool_invocation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: text('tool_id').notNull(),
    action: text('action').notNull(), // e.g. 'hubspot:create-contact'
    agentId: text('agent_id'), // null for user-initiated test calls
    userId: text('user_id').notNull(),
    connectionId: uuid('connection_id').notNull(), // logical FK to tool_connections.id
    latencyMs: integer('latency_ms'),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    requestSummary: text('request_summary'), // first 500 chars of request
    responseSummary: text('response_summary'), // first 500 chars of response
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tool_invocation_logs_connection_id_idx').on(t.connectionId),
    index('tool_invocation_logs_user_id_idx').on(t.userId),
    index('tool_invocation_logs_created_at_idx').on(t.createdAt),
  ],
);

export type ToolInvocationLog = typeof toolInvocationLogs.$inferSelect;
export type NewToolInvocationLog = typeof toolInvocationLogs.$inferInsert;
