-- 1. New enum for agent class
CREATE TYPE "public"."agent_class" AS ENUM('Novice', 'Understudy', 'Artisan', 'Retired');

-- 2. agent_classes table
CREATE TABLE IF NOT EXISTS "agent_classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bot_id" uuid NOT NULL,
  "task_category" varchar(255) NOT NULL,
  "current_class" "public"."agent_class" DEFAULT 'Novice' NOT NULL,
  "above_benchmark_count" integer DEFAULT 0 NOT NULL,
  "below_benchmark_count" integer DEFAULT 0 NOT NULL,
  "human_confirmation_count" integer DEFAULT 0 NOT NULL,
  "consecutive_below_count" integer DEFAULT 0 NOT NULL,
  "is_pioneer" boolean DEFAULT false NOT NULL,
  "last_verdict_id" uuid,
  "last_transition_at" timestamp(3) with time zone,
  "artisan_graduation_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_classes_bot_category_unique" UNIQUE("bot_id", "task_category")
);

-- 3. category_benchmarks table
CREATE TABLE IF NOT EXISTS "category_benchmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_category" varchar(255) NOT NULL UNIQUE,
  "pioneer_bot_id" uuid NOT NULL,
  "pioneer_soul_id" uuid,
  "pioneer_execution_id" uuid NOT NULL,
  "baseline_composite_score" numeric(5, 2) NOT NULL,
  "confirmed_run_count" integer DEFAULT 1 NOT NULL,
  "thin_data_flag" boolean DEFAULT true NOT NULL,
  "benchmark_mature" boolean DEFAULT false NOT NULL,
  "standard_promotion" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- 4. God Layer idempotency column on council_verdicts
ALTER TABLE "council_verdicts"
  ADD COLUMN "god_layer_processed_at" timestamp(3) with time zone;

-- 5. Provisional flag on dna_store (GODL-04)
ALTER TABLE "dna_store"
  ADD COLUMN "is_provisional" boolean DEFAULT false NOT NULL;

-- 6. Version uniqueness constraint on dna_store (prevents duplicate version races)
ALTER TABLE "dna_store"
  ADD CONSTRAINT "dna_store_category_soul_version_unique" UNIQUE ("objective_category", "soul_id", "version");

-- 7. Indexes for agent_classes
CREATE INDEX IF NOT EXISTS "agent_classes_bot_id_idx" ON "agent_classes" USING btree ("bot_id");
CREATE INDEX IF NOT EXISTS "agent_classes_task_category_idx" ON "agent_classes" USING btree ("task_category");
