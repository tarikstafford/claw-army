CREATE TYPE "public"."agent_class" AS ENUM('novice', 'understudy', 'artisan');--> statement-breakpoint

CREATE TABLE "bot_souls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "soul_id" uuid NOT NULL,
  "parent_soul_id" uuid,
  "bot_id" uuid NOT NULL,
  "objective_category" varchar(255) NOT NULL,
  "agent_class" "agent_class" DEFAULT 'novice' NOT NULL,
  "config_payload" jsonb NOT NULL,
  "run_count" integer DEFAULT 0 NOT NULL,
  "promoted_at" timestamp(3) with time zone,
  "demoted_at" timestamp(3) with time zone,
  "retired_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "soul_run_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "soul_id" uuid NOT NULL,
  "bot_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "composite_score" numeric(5, 2) NOT NULL,
  "tier" varchar(10),
  "scored_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "akashic_library" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "soul_id" uuid NOT NULL,
  "parent_soul_id" uuid,
  "objective_category" varchar(255) NOT NULL,
  "agent_class" "agent_class" NOT NULL,
  "avg_composite_score" numeric(5, 2) NOT NULL,
  "run_count" integer DEFAULT 0 NOT NULL,
  "success_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "failure_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "directive_activations" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "soul_snapshot" jsonb NOT NULL,
  "archived_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "negative_signal_register" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "soul_id" uuid NOT NULL,
  "objective_category" varchar(255) NOT NULL,
  "failure_summary" varchar(1000) NOT NULL,
  "failing_directive_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "mutation_blacklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "evidence_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "bot_souls" ADD CONSTRAINT "bot_souls_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soul_run_scores" ADD CONSTRAINT "soul_run_scores_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soul_run_scores" ADD CONSTRAINT "soul_run_scores_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "bot_souls_soul_id_idx" ON "bot_souls" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "bot_souls_bot_id_idx" ON "bot_souls" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "bot_souls_category_idx" ON "bot_souls" USING btree ("objective_category");--> statement-breakpoint
CREATE INDEX "bot_souls_class_idx" ON "bot_souls" USING btree ("agent_class");--> statement-breakpoint
CREATE INDEX "bot_souls_category_class_idx" ON "bot_souls" USING btree ("objective_category", "agent_class");--> statement-breakpoint
CREATE INDEX "soul_run_scores_soul_id_idx" ON "soul_run_scores" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "soul_run_scores_bot_id_idx" ON "soul_run_scores" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "soul_run_scores_execution_id_idx" ON "soul_run_scores" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "akashic_library_soul_id_idx" ON "akashic_library" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "akashic_library_category_idx" ON "akashic_library" USING btree ("objective_category");--> statement-breakpoint
CREATE INDEX "akashic_library_class_idx" ON "akashic_library" USING btree ("agent_class");--> statement-breakpoint
CREATE INDEX "akashic_library_category_class_idx" ON "akashic_library" USING btree ("objective_category", "agent_class");--> statement-breakpoint
CREATE INDEX "akashic_library_avg_score_idx" ON "akashic_library" USING btree ("avg_composite_score");--> statement-breakpoint
CREATE INDEX "akashic_library_category_score_idx" ON "akashic_library" USING btree ("objective_category", "avg_composite_score");--> statement-breakpoint
CREATE INDEX "negative_signal_soul_id_idx" ON "negative_signal_register" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "negative_signal_category_idx" ON "negative_signal_register" USING btree ("objective_category");
