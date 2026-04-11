import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  varchar,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * Evolution Campaign — chains multiple executions against the same objective,
 * with auto-triggering after Council verdicts close. Closes the Karpathy Loop
 * (issue #74).
 *
 * Design:
 * - Opt-in: created only when POST /executions is called with enableEvolution=true
 * - Capped at maxIterations (default 10)
 * - Halted on: max iterations, cumulative budget exhausted, EFS regression,
 *   EFS plateau, EFS ceiling (success), or internal error
 * - Each iteration = one execution; iteration row records the EFS score
 *   (Execution Fitness Score) and the delta from the previous iteration
 */
export const evolutionCampaignStatusEnum = pgEnum("evolution_campaign_status", [
  "running",
  "completed_success", // EFS ceiling reached (>= 0.95)
  "completed_max", // hit max_iterations
  "halted_regression", // EFS dropped >10% from best
  "halted_plateau", // delta < 3% for 2+ consecutive iterations
  "halted_budget", // cumulative spend >= campaign_budget_cap_cents
  "halted_error", // something went wrong in the loop
]);

export const evolutionCampaigns = pgTable(
  "evolution_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Objective text snapshotted at campaign creation — source of truth for
    // every iteration in the campaign. Identical across all iterations.
    objective: text("objective").notNull(),
    projectId: uuid("project_id"), // logical FK to Paperclip projects
    maxIterations: integer("max_iterations").notNull().default(10),
    // Cumulative cost cap across ALL iterations in the campaign. Nullable =
    // no campaign-level cap (only per-execution caps apply).
    campaignBudgetCapCents: integer("campaign_budget_cap_cents"),
    // Seed execution params — snapshotted at campaign creation so every
    // iteration spawns with identical constraints.
    seedMaxBots: integer("seed_max_bots").notNull(),
    seedBudgetCapCents: integer("seed_budget_cap_cents").notNull(),
    seedRuntimeLimitSeconds: integer("seed_runtime_limit_seconds").notNull(),
    seedAllowedTools: text("seed_allowed_tools").array().notNull(),
    seedLlmProvider: varchar("seed_llm_provider", { length: 50 }),
    seedAllowedDomains: text("seed_allowed_domains").array(),
    status: evolutionCampaignStatusEnum("status").notNull().default("running"),
    // How many iterations have completed (reached a terminal state — succeeded,
    // failed, or halted). Incremented by the halt evaluator in the worker.
    completedIterationCount: integer("completed_iteration_count")
      .notNull()
      .default(0),
    // Highest EFS score seen across all iterations; used for regression guard.
    bestEfsScore: numeric("best_efs_score", { precision: 5, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index("evolution_campaigns_status_idx").on(t.status),
    index("evolution_campaigns_project_id_idx").on(t.projectId),
  ],
);

/**
 * Evolution Campaign Iteration — 1 row per execution in a campaign, carrying
 * the EFS score breakdown and the delta from the previous iteration. Used
 * for trend analysis and halt-criteria evaluation.
 */
export const evolutionCampaignIterations = pgTable(
  "evolution_campaign_iterations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => evolutionCampaigns.id, { onDelete: "cascade" }),
    iterationNum: integer("iteration_num").notNull(), // 1-indexed
    // The execution this iteration ran as. UNIQUE across all iterations —
    // one execution belongs to at most one iteration.
    executionId: uuid("execution_id").notNull(),
    // EFS breakdown — populated by god-layer-worker after the final verdict
    // for this execution is processed. NULL while the execution is still
    // running or has pending verdicts.
    efsScore: numeric("efs_score", { precision: 5, scale: 4 }),
    successRate: numeric("success_rate", { precision: 5, scale: 4 }),
    costEfficiency: numeric("cost_efficiency", { precision: 5, scale: 4 }),
    speed: numeric("speed", { precision: 5, scale: 4 }),
    councilHealth: numeric("council_health", { precision: 5, scale: 4 }),
    // Signed delta from previous iteration's EFS. Positive = improvement.
    // NULL on iteration 1 (no previous).
    deltaFromPrevious: numeric("delta_from_previous", {
      precision: 6,
      scale: 4,
    }),
    // If this iteration caused the campaign to halt, the reason is recorded here.
    // Mirrors one of the 'halted_*' / 'completed_*' values from the campaign status enum.
    haltedReason: varchar("halted_reason", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    // Set when the iteration's EFS has been computed and halt criteria evaluated.
    // Idempotency guard: god-layer-worker atomically UPDATEs ... WHERE completed_at IS NULL
    // to ensure only one worker triggers the next iteration.
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      precision: 3,
    }),
  },
  (t) => [
    index("evolution_campaign_iterations_campaign_id_idx").on(t.campaignId),
    index("evolution_campaign_iterations_execution_id_idx").on(t.executionId),
    unique("evolution_campaign_iterations_campaign_iter_unique").on(
      t.campaignId,
      t.iterationNum,
    ),
    unique("evolution_campaign_iterations_execution_unique").on(t.executionId),
  ],
);

export type EvolutionCampaign = typeof evolutionCampaigns.$inferSelect;
export type NewEvolutionCampaign = typeof evolutionCampaigns.$inferInsert;
export type EvolutionCampaignIteration =
  typeof evolutionCampaignIterations.$inferSelect;
export type NewEvolutionCampaignIteration =
  typeof evolutionCampaignIterations.$inferInsert;
