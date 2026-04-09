import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { executions } from './executions';

export interface DnaPayload {
  systemPromptTemplate: string;
  toolCallSequence: string[];
  argumentPatterns: Record<string, unknown>;
  retryStrategy: Record<string, unknown>;
  timingProfile: Record<string, unknown>;
  tokenDistribution: Record<string, unknown>;
  // GODL-02 fields — optional since existing rows lack these
  soulContent?: string; // full SOUL.md at time of write
  taskCategory?: string; // from bot_souls.taskCategory
  agentClassAtWrite?: string; // Novice | Understudy | Artisan
  compositeFitnessScore?: number; // bots.compositeScore at verdict time
  fitnessDimensionBreakdown?: Record<string, number>; // from soulAnalystOutput
  causalAttributionSummary?: string; // from soulAnalystOutput summary
  councilVerdictSummary?: string; // council_verdicts.verdictSummary
  councilConfidenceScores?: {
    performance: number;
    soulAnalyst: number;
    devilsAdvocate: number;
    weighted: number;
  };
  humanConfirmationTimestamp?: string | null; // confirmedAt ISO string or null
  mutationLineageOps?: string[]; // mutation operations applied
  isPioneerEntry?: boolean; // GODL-06
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
    isProvisional: boolean('is_provisional').notNull().default(false), // GODL-04
    soulId: uuid('soul_id'), // nullable; links DNA capture to source soul (Phase 9)
    parentSoulIds: uuid('parent_soul_ids').array(), // nullable; mutation lineage parent IDs (Phase 13)
    mutationLineage: jsonb('mutation_lineage'), // nullable; operations applied from parent (Phase 13)
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true, precision: 3 }),
    publishTitle: text('publish_title'),
    publishDescription: text('publish_description'),
    acquiredCount: integer('acquired_count').notNull().default(0),
  },
  (t) => [
    index('dna_store_execution_id_idx').on(t.executionId),
    index('dna_store_bot_id_idx').on(t.botId),
    index('dna_store_objective_category_idx').on(t.objectiveCategory),
    index('dna_store_objective_category_version_idx').on(t.objectiveCategory, t.version),
    unique('dna_store_category_soul_version_unique').on(t.objectiveCategory, t.soulId, t.version), // GODL-03
  ],
);

export type DnaStore = typeof dnaStore.$inferSelect;
export type NewDnaStore = typeof dnaStore.$inferInsert;
