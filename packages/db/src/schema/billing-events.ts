import {
  pgTable,
  uuid,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions.js';

export const billingEventTypeEnum = pgEnum('billing_event_type', [
  'bot_started',
  'bot_stopped',
  'tool_invoked',
  'execution_completed',
  'budget_exceeded',
]);

export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id'),
    projectId: uuid('project_id'), // nullable; logical FK to Paperclip's projects table; set from parent execution
    eventType: billingEventTypeEnum('event_type').notNull(),
    amountCents: integer('amount_cents'),
    tokenCount: integer('token_count'),
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('billing_events_execution_id_idx').on(t.executionId),
    index('billing_events_event_type_idx').on(t.eventType),
    index('billing_events_occurred_at_idx').on(t.occurredAt),
  ],
);

export type BillingEvent = typeof billingEvents.$inferSelect;
export type NewBillingEvent = typeof billingEvents.$inferInsert;
