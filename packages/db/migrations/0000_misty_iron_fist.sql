CREATE TYPE "public"."billing_event_type" AS ENUM('bot_started', 'bot_stopped', 'tool_invoked', 'execution_completed', 'budget_exceeded');--> statement-breakpoint
CREATE TYPE "public"."bot_status" AS ENUM('spawning', 'idle', 'working', 'stopping', 'stopped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('queued', 'running', 'paused', 'stopped', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'claimed', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"bot_id" uuid,
	"event_type" "billing_event_type" NOT NULL,
	"amount_cents" integer,
	"token_count" integer,
	"metadata" jsonb,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"status" "bot_status" DEFAULT 'spawning' NOT NULL,
	"container_id" varchar(255),
	"image_tag" varchar(255) NOT NULL,
	"started_at" timestamp (3) with time zone,
	"stopped_at" timestamp (3) with time zone,
	"last_heartbeat_at" timestamp (3) with time zone,
	"tasks_claimed" integer DEFAULT 0 NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"tasks_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dna_store" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"execution_id" uuid NOT NULL,
	"objective_category" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"composite_score" numeric(5, 2) NOT NULL,
	"dna_payload" jsonb NOT NULL,
	"captured_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "execution_status" DEFAULT 'queued' NOT NULL,
	"objective" text NOT NULL,
	"max_bots" integer NOT NULL,
	"budget_cap_cents" integer NOT NULL,
	"runtime_limit_seconds" integer NOT NULL,
	"allowed_tools" text[] NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"description" text NOT NULL,
	"result" text,
	"claimed_by_bot_id" uuid,
	"lease_expires_at" timestamp (3) with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"metric_name" varchar(255) NOT NULL,
	"metric_value" numeric(12, 6) NOT NULL,
	"computed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dna_store" ADD CONSTRAINT "dna_store_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry" ADD CONSTRAINT "telemetry_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry" ADD CONSTRAINT "telemetry_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_events_execution_id_idx" ON "billing_events" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "billing_events_event_type_idx" ON "billing_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "billing_events_occurred_at_idx" ON "billing_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "bots_execution_id_idx" ON "bots" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "bots_status_idx" ON "bots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dna_store_execution_id_idx" ON "dna_store" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "dna_store_bot_id_idx" ON "dna_store" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "dna_store_objective_category_idx" ON "dna_store" USING btree ("objective_category");--> statement-breakpoint
CREATE INDEX "dna_store_objective_category_version_idx" ON "dna_store" USING btree ("objective_category","version");--> statement-breakpoint
CREATE INDEX "tasks_execution_id_idx" ON "tasks" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_execution_id_status_idx" ON "tasks" USING btree ("execution_id","status");--> statement-breakpoint
CREATE INDEX "telemetry_execution_id_idx" ON "telemetry" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "telemetry_bot_id_idx" ON "telemetry" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "telemetry_bot_id_metric_name_idx" ON "telemetry" USING btree ("bot_id","metric_name");