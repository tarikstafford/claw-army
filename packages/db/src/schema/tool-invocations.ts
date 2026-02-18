import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { bots } from './bots';

export const toolInvocations = pgTable(
  'tool_invocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    toolName: varchar('tool_name', { length: 50 }).notNull(),
    invocationId: uuid('invocation_id').notNull(),
    rejected: boolean('rejected').notNull().default(false),
    rejectionReason: varchar('rejection_reason', { length: 100 }),
    durationMs: integer('duration_ms'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    requestSummary: jsonb('request_summary'),
    responseSummary: jsonb('response_summary'),
    invokedAt: timestamp('invoked_at', { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('tool_invocations_execution_id_idx').on(t.executionId),
    index('tool_invocations_bot_id_idx').on(t.botId),
    index('tool_invocations_invoked_at_idx').on(t.invokedAt),
  ],
);

export type ToolInvocation = typeof toolInvocations.$inferSelect;
export type NewToolInvocation = typeof toolInvocations.$inferInsert;
