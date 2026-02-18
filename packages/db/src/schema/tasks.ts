import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'claimed',
  'completed',
  'failed',
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    status: taskStatusEnum('status').notNull().default('pending'),
    description: text('description').notNull(),
    result: text('result'),
    claimedByBotId: uuid('claimed_by_bot_id'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, precision: 3 }),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('tasks_execution_id_idx').on(t.executionId),
    index('tasks_status_idx').on(t.status),
    index('tasks_execution_id_status_idx').on(t.executionId, t.status),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
