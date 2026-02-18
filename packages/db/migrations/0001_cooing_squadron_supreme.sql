CREATE TABLE "tool_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"tool_name" varchar(50) NOT NULL,
	"invocation_id" uuid NOT NULL,
	"rejected" boolean DEFAULT false NOT NULL,
	"rejection_reason" varchar(100),
	"duration_ms" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"request_summary" jsonb,
	"response_summary" jsonb,
	"invoked_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_invocations_execution_id_idx" ON "tool_invocations" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "tool_invocations_bot_id_idx" ON "tool_invocations" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "tool_invocations_invoked_at_idx" ON "tool_invocations" USING btree ("invoked_at");