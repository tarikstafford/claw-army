import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  text,
  jsonb,
  integer,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';

export const verdictTypeEnum = pgEnum('verdict_type', [
  'Promote',
  'Maintain',
  'Monitor',
  'Demote',
  'Retire',
]);

export const verdictStatusEnum = pgEnum('verdict_status', [
  'pending',
  'confirmed',
  'rejected',
]);

export const councilVerdicts = pgTable(
  'council_verdicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    botId: uuid('bot_id').notNull(),
    soulId: uuid('soul_id'), // nullable; FK to bot_souls, no explicit ref to avoid cross-file circular issues
    verdictType: verdictTypeEnum('verdict_type').notNull(),
    status: verdictStatusEnum('status').notNull().default('pending'),
    weightedConfidenceScore: numeric('weighted_confidence_score', { precision: 4, scale: 3 }).notNull(),
    requiresHumanConfirmation: boolean('requires_human_confirmation').notNull().default(false),
    hasUnresolvedDevilsAdvocate: boolean('has_unresolved_devils_advocate').notNull().default(false),
    verdictSummary: text('verdict_summary').notNull(),
    performanceJudgeOutput: jsonb('performance_judge_output'),
    soulAnalystOutput: jsonb('soul_analyst_output'),
    devilsAdvocateOutput: jsonb('devils_advocate_output'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, precision: 3 }),
    confirmedBy: varchar('confirmed_by', { length: 255 }),
    timeOnScreenMs: integer('time_on_screen_ms'), // nullable, no default — set on confirm/reject
    godLayerProcessedAt: timestamp('god_layer_processed_at', { withTimezone: true, precision: 3 }), // nullable; idempotency column for God Layer (GODL-01)
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('council_verdicts_execution_id_idx').on(t.executionId),
    index('council_verdicts_bot_id_idx').on(t.botId),
    index('council_verdicts_verdict_type_idx').on(t.verdictType),
    index('council_verdicts_status_idx').on(t.status),
    index('council_verdicts_requires_human_idx').on(t.requiresHumanConfirmation),
  ],
);

export type CouncilVerdict = typeof councilVerdicts.$inferSelect;
export type NewCouncilVerdict = typeof councilVerdicts.$inferInsert;
