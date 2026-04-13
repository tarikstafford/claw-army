import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { executions } from './executions.js';
import { botSouls } from './bot-souls.js';

/**
 * Stores per-agent per-execution decision attribution records.
 *
 * TTL POLICY: Records older than 90 days are eligible for archival.
 * Archival is triggered before this table reaches 5,000,000 rows.
 * A scheduled Cloud Scheduler job or Drizzle-driven cleanup script handles archival.
 * Phase 8 documents this policy; Phase 10 implements the archival mechanism.
 */
export const decisionTraces = pgTable(
  'decision_traces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id').notNull(),
    soulId: uuid('soul_id').references(() => botSouls.id), // nullable; populated by Phase 9
    decisionId: uuid('decision_id').notNull(), // caller-generated idempotency key
    decisionType: varchar('decision_type', { length: 50 }).notNull(), // tool_call | reasoning_branch | output_step
    directiveReferenced: text('directive_referenced'),
    attributionConfidence: numeric('attribution_confidence', { precision: 4, scale: 3 }), // 0.000–1.000
    outcome: varchar('outcome', { length: 50 }), // success | failure | partial
    metadata: jsonb('metadata'),
    decidedAt: timestamp('decided_at', { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('decision_traces_execution_id_idx').on(t.executionId),
    index('decision_traces_bot_id_idx').on(t.botId),
    index('decision_traces_soul_id_idx').on(t.soulId),
    index('decision_traces_decided_at_idx').on(t.decidedAt), // needed for TTL archival queries
    unique('decision_traces_decision_id_unique').on(t.decisionId),
  ],
);

export type DecisionTrace = typeof decisionTraces.$inferSelect;
export type NewDecisionTrace = typeof decisionTraces.$inferInsert;
