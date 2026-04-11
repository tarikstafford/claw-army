-- Evolution Campaigns — closes the Karpathy Loop (issue #74)
-- See packages/db/src/schema/evolution-campaigns.ts for schema rationale.

CREATE TYPE evolution_campaign_status AS ENUM (
  'running',
  'completed_success',
  'completed_max',
  'halted_regression',
  'halted_plateau',
  'halted_budget',
  'halted_error'
);

CREATE TABLE IF NOT EXISTS "evolution_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "objective" text NOT NULL,
  "project_id" uuid,
  "max_iterations" integer NOT NULL DEFAULT 10,
  "campaign_budget_cap_cents" integer,
  "seed_max_bots" integer NOT NULL,
  "seed_budget_cap_cents" integer NOT NULL,
  "seed_runtime_limit_seconds" integer NOT NULL,
  "seed_allowed_tools" text[] NOT NULL,
  "seed_llm_provider" varchar(50),
  "seed_allowed_domains" text[],
  "status" evolution_campaign_status NOT NULL DEFAULT 'running',
  "completed_iteration_count" integer NOT NULL DEFAULT 0,
  "best_efs_score" numeric(5, 4),
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "stopped_at" timestamptz(3)
);

CREATE INDEX IF NOT EXISTS "evolution_campaigns_status_idx" ON "evolution_campaigns" ("status");
CREATE INDEX IF NOT EXISTS "evolution_campaigns_project_id_idx" ON "evolution_campaigns" ("project_id");

CREATE TABLE IF NOT EXISTS "evolution_campaign_iterations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "evolution_campaigns"("id") ON DELETE CASCADE,
  "iteration_num" integer NOT NULL,
  "execution_id" uuid NOT NULL,
  "efs_score" numeric(5, 4),
  "success_rate" numeric(5, 4),
  "cost_efficiency" numeric(5, 4),
  "speed" numeric(5, 4),
  "council_health" numeric(5, 4),
  "delta_from_previous" numeric(6, 4),
  "halted_reason" varchar(64),
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "completed_at" timestamptz(3)
);

CREATE INDEX IF NOT EXISTS "evolution_campaign_iterations_campaign_id_idx" ON "evolution_campaign_iterations" ("campaign_id");
CREATE INDEX IF NOT EXISTS "evolution_campaign_iterations_execution_id_idx" ON "evolution_campaign_iterations" ("execution_id");
CREATE UNIQUE INDEX IF NOT EXISTS "evolution_campaign_iterations_campaign_iter_unique" ON "evolution_campaign_iterations" ("campaign_id", "iteration_num");
CREATE UNIQUE INDEX IF NOT EXISTS "evolution_campaign_iterations_execution_unique" ON "evolution_campaign_iterations" ("execution_id");

-- Add evolution_campaign_id to executions (logical FK, no constraint to avoid
-- cross-file circular schema issues).
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "evolution_campaign_id" uuid;
CREATE INDEX IF NOT EXISTS "executions_evolution_campaign_id_idx" ON "executions" ("evolution_campaign_id");
