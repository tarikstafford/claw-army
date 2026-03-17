import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { bots } from './bots';
import { executions } from './executions';

// ──────────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────────

export const agentClassEnum = pgEnum('agent_class', [
  'novice',
  'understudy',
  'artisan',
]);

// ──────────────────────────────────────────────────────────────────────────────
// bot_souls — maps a bot to a soul identity
//
// A "soul" is the behavioral configuration (SOUL.md content + directives) that
// governs how an agent reasons and acts. Multiple bot executions can share a
// soul lineage via parentSoulId. Each row represents a discrete soul version.
// ──────────────────────────────────────────────────────────────────────────────

export interface SoulConfigPayload {
  /** Rendered SOUL.md content */
  soulMd: string;
  /** Individual directive items extracted from the SOUL.md */
  directives: Array<{
    id: string;
    text: string;
    dimension: string; // e.g. 'risk_tolerance', 'speed_vs_verification', etc.
    weight: number;
  }>;
  /** Mutation operations applied to derive this soul from its parent */
  mutationOps: string[];
  /** Drift score vs nearest validated Artisan soul (0-1, lower = closer) */
  driftScore: number;
}

export const botSouls = pgTable(
  'bot_souls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Logical soul identifier — stable across mutations within a lineage */
    soulId: uuid('soul_id').notNull(),
    /** Parent soul this was derived from (null = pioneer/archetype) */
    parentSoulId: uuid('parent_soul_id'),
    /** The bot running with this soul */
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    /** Task category this soul operates in */
    objectiveCategory: varchar('objective_category', { length: 255 }).notNull(),
    agentClass: agentClassEnum('agent_class').notNull().default('novice'),
    configPayload: jsonb('config_payload').$type<SoulConfigPayload>().notNull(),
    /** Number of confirmed runs in this category */
    runCount: integer('run_count').notNull().default(0),
    promotedAt: timestamp('promoted_at', { withTimezone: true, precision: 3 }),
    demotedAt: timestamp('demoted_at', { withTimezone: true, precision: 3 }),
    retiredAt: timestamp('retired_at', { withTimezone: true, precision: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('bot_souls_soul_id_idx').on(t.soulId),
    index('bot_souls_bot_id_idx').on(t.botId),
    index('bot_souls_category_idx').on(t.objectiveCategory),
    index('bot_souls_class_idx').on(t.agentClass),
    index('bot_souls_category_class_idx').on(t.objectiveCategory, t.agentClass),
  ],
);

export type BotSoul = typeof botSouls.$inferSelect;
export type NewBotSoul = typeof botSouls.$inferInsert;

// ──────────────────────────────────────────────────────────────────────────────
// soul_run_scores — per-soul per-execution performance record
//
// Written by score-engine after scoring each bot. Enables aggregate soul-level
// analytics across multiple executions (avgCompositeScore in akashic_library).
// ──────────────────────────────────────────────────────────────────────────────

export const soulRunScores = pgTable(
  'soul_run_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    soulId: uuid('soul_id').notNull(),
    botId: uuid('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
    compositeScore: numeric('composite_score', { precision: 5, scale: 2 }).notNull(),
    tier: varchar('tier', { length: 10 }),
    scoredAt: timestamp('scored_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('soul_run_scores_soul_id_idx').on(t.soulId),
    index('soul_run_scores_bot_id_idx').on(t.botId),
    index('soul_run_scores_execution_id_idx').on(t.executionId),
  ],
);

export type SoulRunScore = typeof soulRunScores.$inferSelect;
export type NewSoulRunScore = typeof soulRunScores.$inferInsert;

// ──────────────────────────────────────────────────────────────────────────────
// akashic_library — denormalized archived soul patterns
//
// Written on soul retirement (or Artisan graduation). Self-contained: does not
// depend on bot_souls being intact. The mutation engine queries this table for
// top performers and lineage seeding. Versioned — a new write never overwrites.
// ──────────────────────────────────────────────────────────────────────────────

export interface SuccessPattern {
  /** Category of the success */
  category: string;
  /** Tool call sequences that correlated with high performance */
  highSignalToolSequences: string[][];
  /** Directive IDs that were active during top-tier runs */
  activeDirectiveIds: string[];
  /** Average composite score across qualifying runs */
  avgCompositeScore: number;
  /** Number of runs contributing to this pattern */
  runCount: number;
}

export interface ArchivalSoulSnapshot {
  soulMd: string;
  directives: SoulConfigPayload['directives'];
  mutationLineage: string[];
  finalClass: string;
  finalScore: number;
}

export const akashicLibrary = pgTable(
  'akashic_library',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Logical soul id (stable across this lineage) */
    soulId: uuid('soul_id').notNull(),
    /** Parent soul id for lineage traversal */
    parentSoulId: uuid('parent_soul_id'),
    objectiveCategory: varchar('objective_category', { length: 255 }).notNull(),
    agentClass: agentClassEnum('agent_class').notNull(),
    /** Average composite score across all recorded soul_run_scores for this soul */
    avgCompositeScore: numeric('avg_composite_score', { precision: 5, scale: 2 }).notNull(),
    /** Number of runs recorded for this soul */
    runCount: integer('run_count').notNull().default(0),
    /** Extracted success patterns from top-performing runs */
    successPatterns: jsonb('success_patterns').$type<SuccessPattern[]>().notNull().default([]),
    /** Failure annotations (if retired after demotion) */
    failurePatterns: jsonb('failure_patterns').$type<string[]>().notNull().default([]),
    /** Directive-level activation annotations */
    directiveActivations: jsonb('directive_activations').$type<Record<string, number>>().notNull().default({}),
    /** Full immutable snapshot of soul config at archival time */
    soulSnapshot: jsonb('soul_snapshot').$type<ArchivalSoulSnapshot>().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('akashic_library_soul_id_idx').on(t.soulId),
    index('akashic_library_category_idx').on(t.objectiveCategory),
    index('akashic_library_class_idx').on(t.agentClass),
    index('akashic_library_category_class_idx').on(t.objectiveCategory, t.agentClass),
    index('akashic_library_avg_score_idx').on(t.avgCompositeScore),
    index('akashic_library_category_score_idx').on(t.objectiveCategory, t.avgCompositeScore),
  ],
);

export type AkashicLibraryEntry = typeof akashicLibrary.$inferSelect;
export type NewAkashicLibraryEntry = typeof akashicLibrary.$inferInsert;

// ──────────────────────────────────────────────────────────────────────────────
// negative_signal_register — failure patterns for mutation constraints
//
// Written when a soul is retired after demotion. The mutation algorithm queries
// this to avoid directive combinations and mutation paths that produced failure.
// ──────────────────────────────────────────────────────────────────────────────

export const negativeSignalRegister = pgTable(
  'negative_signal_register',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    soulId: uuid('soul_id').notNull(),
    objectiveCategory: varchar('objective_category', { length: 255 }).notNull(),
    /** Human-readable failure summary */
    failureSummary: varchar('failure_summary', { length: 1000 }).notNull(),
    /** Directive IDs that were active and contributed to failure */
    failingDirectiveIds: jsonb('failing_directive_ids').$type<string[]>().notNull().default([]),
    /** Mutation operations that should not be re-applied in this category */
    mutationBlacklist: jsonb('mutation_blacklist').$type<string[]>().notNull().default([]),
    /** Raw council/scoring data that triggered retirement */
    evidencePayload: jsonb('evidence_payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('negative_signal_soul_id_idx').on(t.soulId),
    index('negative_signal_category_idx').on(t.objectiveCategory),
  ],
);

export type NegativeSignalEntry = typeof negativeSignalRegister.$inferSelect;
export type NewNegativeSignalEntry = typeof negativeSignalRegister.$inferInsert;
