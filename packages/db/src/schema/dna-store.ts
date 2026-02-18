import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';

export interface DnaPayload {
  systemPromptTemplate: string;
  toolCallSequence: string[];
  argumentPatterns: Record<string, unknown>;
  retryStrategy: Record<string, unknown>;
  timingProfile: Record<string, unknown>;
  tokenDistribution: Record<string, unknown>;
}

export const dnaStore = pgTable(
  'dna_store',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    objectiveCategory: varchar('objective_category', { length: 255 }).notNull(),
    version: integer('version').notNull().default(1),
    compositeScore: numeric('composite_score', { precision: 5, scale: 2 }).notNull(),
    dnaPayload: jsonb('dna_payload').$type<DnaPayload>().notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('dna_store_execution_id_idx').on(t.executionId),
    index('dna_store_bot_id_idx').on(t.botId),
    index('dna_store_objective_category_idx').on(t.objectiveCategory),
    index('dna_store_objective_category_version_idx').on(t.objectiveCategory, t.version),
  ],
);

export type DnaStore = typeof dnaStore.$inferSelect;
export type NewDnaStore = typeof dnaStore.$inferInsert;
