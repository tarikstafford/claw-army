ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "llm_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "allowed_domains" text[];
