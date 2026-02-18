import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { bots } from './bots';

export const telemetry = pgTable(
  'telemetry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    metricName: varchar('metric_name', { length: 255 }).notNull(),
    metricValue: numeric('metric_value', { precision: 12, scale: 6 }).notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('telemetry_execution_id_idx').on(t.executionId),
    index('telemetry_bot_id_idx').on(t.botId),
    index('telemetry_bot_id_metric_name_idx').on(t.botId, t.metricName),
  ],
);

export type Telemetry = typeof telemetry.$inferSelect;
export type NewTelemetry = typeof telemetry.$inferInsert;
