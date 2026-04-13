import { pgTable, uuid, text, timestamp, integer, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Chat messages — individual messages within chat threads.
 * Uses logical FK to chat_threads (no references()) to avoid circular TS inference.
 */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id').notNull(),
    senderType: text('sender_type').notNull(),
    senderAgentId: uuid('sender_agent_id'),
    senderUserId: text('sender_user_id'),
    body: text('body').notNull(),
    tokenCount: integer('token_count'),
    processingStatus: text('processing_status').notNull().default('enqueued'),
    telegramUpdateId: bigint('telegram_update_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    threadCreatedAtIdx: index('chat_messages_thread_created_at_idx').on(table.threadId, table.createdAt),
    processingStatusIdx: index('chat_messages_processing_status_idx').on(table.processingStatus),
    telegramUpdateIdIdx: uniqueIndex('chat_messages_telegram_update_id_idx').on(table.telegramUpdateId),
  }),
);
