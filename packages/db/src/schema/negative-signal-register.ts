import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { botSouls } from './bot-souls.js';
import { executions } from './executions.js';

export const negativeSignalRegister = pgTable(
  'negative_signal_register',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    soulId: uuid('soul_id')
      .notNull()
      .references(() => botSouls.id),
    botId: uuid('bot_id').notNull(),
    executionId: uuid('execution_id')
      .references(() => executions.id, { onDelete: 'set null' }),
    failureType: varchar('failure_type', { length: 50 }).notNull(), // retirement | budget_overrun | guardrail_violation | quality_floor_breach
    directiveFailureSummary: text('directive_failure_summary'),
    mutationBlacklist: jsonb('mutation_blacklist'), // populated in Phase 13
    registeredAt: timestamp('registered_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('negative_signal_soul_id_idx').on(t.soulId),
    index('negative_signal_failure_type_idx').on(t.failureType),
    index('negative_signal_registered_at_idx').on(t.registeredAt),
  ],
);

export type NegativeSignal = typeof negativeSignalRegister.$inferSelect;
export type NewNegativeSignal = typeof negativeSignalRegister.$inferInsert;
