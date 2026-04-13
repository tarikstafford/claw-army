import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  numeric,
  timestamp,
  index,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { executions } from './executions.js';

export const ringLeaderStatusEnum = pgEnum('ring_leader_status', [
  'assembling',   // soul library search + population assembly
  'spawning',     // agents being launched
  'coordinating', // real-time execution monitoring
  'synthesizing', // producing run synthesis
  'completed',    // terminal: success
  'failed',       // terminal: failure
]);

export const ringLeaderRuns = pgTable(
  'ring_leader_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
    soulId: uuid('soul_id'), // nullable; logical FK to bot_souls.id — no explicit ref to avoid circular (same pattern as bots.soulId)
    status: ringLeaderStatusEnum('status').notNull().default('assembling'),
    // Stores RingLeaderMissionBrief: { objective, task_graph, tool_grants, budget_cap, runtime_limit, campaign_type, run_id }
    missionBrief: jsonb('mission_brief').notNull(),
    // Stores PopulationManifest[] (one per task). Null until assembly complete.
    populationManifest: jsonb('population_manifest'),
    // Stores live run state: { elapsed_time, budget_consumed, task_states, drift_score, anomalies }. Updated during coordination.
    runState: jsonb('run_state'),
    // Stores RingLeaderSynthesis. Null until synthesis phase.
    synthesis: jsonb('synthesis'),
    startedAt: timestamp('started_at', { withTimezone: true, precision: 3 }),
    completedAt: timestamp('completed_at', { withTimezone: true, precision: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('ring_leader_runs_execution_id_idx').on(t.executionId),
    index('ring_leader_runs_soul_id_idx').on(t.soulId),
    index('ring_leader_runs_status_idx').on(t.status),
  ],
);

export type RingLeaderRun = typeof ringLeaderRuns.$inferSelect;
export type NewRingLeaderRun = typeof ringLeaderRuns.$inferInsert;

export const ringLeaderFitness = pgTable(
  'ring_leader_fitness',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ringLeaderRunId: uuid('ring_leader_run_id').notNull().references(() => ringLeaderRuns.id, { onDelete: 'cascade' }),
    // 4-dimension breakdown: { collectiveOutcome, driftPrevention, reallocationEffectiveness, budgetManagement }
    coordinationScore: jsonb('coordination_score').notNull(),
    // 5-dimension breakdown: { librarySearchQuality, differentiationEffectiveness, mutationDecisionQuality, pioneerHandling, selectionRetrospectiveQuality }
    soulSelectionScore: jsonb('soul_selection_score').notNull(),
    // Weighted composite: coordination 60% + soul selection 40%
    compositeScore: numeric('composite_score', { precision: 5, scale: 2 }).notNull(),
    // Full population manifest snapshot for the run
    soulSelectionLog: jsonb('soul_selection_log'),
    // Search queries per task, results, selections
    librarySearchQueries: jsonb('library_search_queries'),
    // Ring Leader's own assessment
    selectionRetrospective: text('selection_retrospective'),
    pioneerTasksHandled: integer('pioneer_tasks_handled').notNull().default(0),
    mutationOperationsApplied: integer('mutation_operations_applied').notNull().default(0),
    // Fraction 0.000 to 1.000
    mutationSuccessRate: numeric('mutation_success_rate', { precision: 4, scale: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('ring_leader_fitness_run_id_idx').on(t.ringLeaderRunId),
    index('ring_leader_fitness_composite_score_idx').on(t.compositeScore),
    unique('ring_leader_fitness_run_unique').on(t.ringLeaderRunId),
  ],
);

export type RingLeaderFitness = typeof ringLeaderFitness.$inferSelect;
export type NewRingLeaderFitness = typeof ringLeaderFitness.$inferInsert;
