CREATE TYPE "public"."ring_leader_status" AS ENUM('assembling', 'spawning', 'coordinating', 'synthesizing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ring_leader_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"soul_id" uuid,
	"status" "ring_leader_status" DEFAULT 'assembling' NOT NULL,
	"mission_brief" jsonb NOT NULL,
	"population_manifest" jsonb,
	"run_state" jsonb,
	"synthesis" jsonb,
	"started_at" timestamp (3) with time zone,
	"completed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ring_leader_fitness" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ring_leader_run_id" uuid NOT NULL,
	"coordination_score" jsonb NOT NULL,
	"soul_selection_score" jsonb NOT NULL,
	"composite_score" numeric(5, 2) NOT NULL,
	"soul_selection_log" jsonb,
	"library_search_queries" jsonb,
	"selection_retrospective" text,
	"pioneer_tasks_handled" integer DEFAULT 0 NOT NULL,
	"mutation_operations_applied" integer DEFAULT 0 NOT NULL,
	"mutation_success_rate" numeric(4, 3),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "ring_leader_run_id" uuid;--> statement-breakpoint
ALTER TABLE "ring_leader_runs" ADD CONSTRAINT "ring_leader_runs_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ring_leader_fitness" ADD CONSTRAINT "ring_leader_fitness_ring_leader_run_id_ring_leader_runs_id_fk" FOREIGN KEY ("ring_leader_run_id") REFERENCES "public"."ring_leader_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ring_leader_fitness" ADD CONSTRAINT "ring_leader_fitness_run_unique" UNIQUE ("ring_leader_run_id");--> statement-breakpoint
CREATE INDEX "ring_leader_runs_execution_id_idx" ON "ring_leader_runs" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "ring_leader_runs_soul_id_idx" ON "ring_leader_runs" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "ring_leader_runs_status_idx" ON "ring_leader_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ring_leader_fitness_run_id_idx" ON "ring_leader_fitness" USING btree ("ring_leader_run_id");--> statement-breakpoint
CREATE INDEX "ring_leader_fitness_composite_score_idx" ON "ring_leader_fitness" USING btree ("composite_score");
