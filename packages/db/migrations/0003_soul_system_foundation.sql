CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."verdict_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."verdict_type" AS ENUM('Promote', 'Maintain', 'Monitor', 'Demote', 'Retire');--> statement-breakpoint
CREATE TABLE "bot_souls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_archetype" boolean DEFAULT false NOT NULL,
	"archetype_name" varchar(100),
	"bot_id" uuid,
	"execution_id" uuid,
	"task_category" varchar(255),
	"soul_content" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"parent_soul_id" uuid,
	"dimensions" jsonb NOT NULL,
	"constitution_directives" jsonb NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_verdicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"soul_id" uuid,
	"verdict_type" "verdict_type" NOT NULL,
	"status" "verdict_status" DEFAULT 'pending' NOT NULL,
	"weighted_confidence_score" numeric(4, 3) NOT NULL,
	"requires_human_confirmation" boolean DEFAULT false NOT NULL,
	"has_unresolved_devils_advocate" boolean DEFAULT false NOT NULL,
	"verdict_summary" text NOT NULL,
	"performance_judge_output" jsonb,
	"soul_analyst_output" jsonb,
	"devils_advocate_output" jsonb,
	"confirmed_at" timestamp (3) with time zone,
	"confirmed_by" varchar(255),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"soul_id" uuid,
	"decision_id" uuid NOT NULL,
	"decision_type" varchar(50) NOT NULL,
	"directive_referenced" text,
	"attribution_confidence" numeric(4, 3),
	"outcome" varchar(50),
	"metadata" jsonb,
	"decided_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negative_signal_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"soul_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"execution_id" uuid,
	"failure_type" varchar(50) NOT NULL,
	"directive_failure_summary" text,
	"mutation_blacklist" jsonb,
	"registered_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "soul_id" uuid;--> statement-breakpoint
ALTER TABLE "dna_store" ADD COLUMN "soul_id" uuid;--> statement-breakpoint
ALTER TABLE "dna_store" ADD COLUMN "parent_soul_ids" uuid[];--> statement-breakpoint
ALTER TABLE "dna_store" ADD COLUMN "mutation_lineage" jsonb;--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "task_category" varchar(255);--> statement-breakpoint
ALTER TABLE "bot_souls" ADD CONSTRAINT "bot_souls_parent_soul_id_bot_souls_id_fk" FOREIGN KEY ("parent_soul_id") REFERENCES "public"."bot_souls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_verdicts" ADD CONSTRAINT "council_verdicts_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_soul_id_bot_souls_id_fk" FOREIGN KEY ("soul_id") REFERENCES "public"."bot_souls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_signal_register" ADD CONSTRAINT "negative_signal_register_soul_id_bot_souls_id_fk" FOREIGN KEY ("soul_id") REFERENCES "public"."bot_souls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_signal_register" ADD CONSTRAINT "negative_signal_register_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_souls_is_archetype_idx" ON "bot_souls" USING btree ("is_archetype");--> statement-breakpoint
CREATE INDEX "bot_souls_bot_id_idx" ON "bot_souls" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "bot_souls_task_category_idx" ON "bot_souls" USING btree ("task_category");--> statement-breakpoint
CREATE INDEX "bot_souls_content_hash_idx" ON "bot_souls" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "bot_souls_parent_soul_id_idx" ON "bot_souls" USING btree ("parent_soul_id");--> statement-breakpoint
CREATE INDEX "council_verdicts_execution_id_idx" ON "council_verdicts" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "council_verdicts_bot_id_idx" ON "council_verdicts" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "council_verdicts_verdict_type_idx" ON "council_verdicts" USING btree ("verdict_type");--> statement-breakpoint
CREATE INDEX "council_verdicts_status_idx" ON "council_verdicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "council_verdicts_requires_human_idx" ON "council_verdicts" USING btree ("requires_human_confirmation");--> statement-breakpoint
CREATE INDEX "decision_traces_execution_id_idx" ON "decision_traces" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "decision_traces_bot_id_idx" ON "decision_traces" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "decision_traces_soul_id_idx" ON "decision_traces" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "decision_traces_decided_at_idx" ON "decision_traces" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "negative_signal_soul_id_idx" ON "negative_signal_register" USING btree ("soul_id");--> statement-breakpoint
CREATE INDEX "negative_signal_failure_type_idx" ON "negative_signal_register" USING btree ("failure_type");--> statement-breakpoint
CREATE INDEX "negative_signal_registered_at_idx" ON "negative_signal_register" USING btree ("registered_at");--> statement-breakpoint
COMMENT ON TABLE "decision_traces" IS 'TTL POLICY: Records older than 90 days are eligible for archival. Archival trigger: before table reaches 5,000,000 rows. Policy documented Phase 8; archival mechanism implemented Phase 10.';
