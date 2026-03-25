import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const webhookRoutingRules = pgTable(
  'webhook_routing_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    connectionId: uuid('connection_id').notNull(), // logical FK to tool_connections — no references() to avoid circular inference
    toolId: text('tool_id').notNull(),
    eventType: text('event_type').notNull(), // e.g. 'deal.created', 'message', 'row.added'
    condition: text('condition'), // optional JSON/text match condition
    assignToAgentId: text('assign_to_agent_id'), // logical FK to Paperclip agents table
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhook_routing_rules_user_id_idx').on(t.userId),
    index('webhook_routing_rules_connection_id_idx').on(t.connectionId),
  ],
);

export type WebhookRoutingRule = typeof webhookRoutingRules.$inferSelect;
export type NewWebhookRoutingRule = typeof webhookRoutingRules.$inferInsert;
