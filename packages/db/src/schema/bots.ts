import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';

export const botStatusEnum = pgEnum('bot_status', [
  'spawning',
  'idle',
  'working',
  'stopping',
  'stopped',
  'failed',
]);

export const bots = pgTable(
  'bots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    status: botStatusEnum('status').notNull().default('spawning'),
    containerId: varchar('container_id', { length: 255 }),
    imageTag: varchar('image_tag', { length: 255 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, precision: 3 }),
    stoppedAt: timestamp('stopped_at', { withTimezone: true, precision: 3 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true, precision: 3 }),
    tasksClaimed: integer('tasks_claimed').notNull().default(0),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    tasksFailed: integer('tasks_failed').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('bots_execution_id_idx').on(t.executionId),
    index('bots_status_idx').on(t.status),
  ],
);

export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;
