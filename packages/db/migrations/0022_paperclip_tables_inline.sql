-- Migration 0022: Inline Paperclip tables into @claw/db schema
-- These tables were previously managed by Paperclip's migration system.
-- They already exist in the database — this migration uses IF NOT EXISTS
-- so it's safe to run on databases that already have these tables.

CREATE TABLE IF NOT EXISTS "companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'active',
  "pause_reason" text,
  "paused_at" timestamp with time zone,
  "issue_prefix" text NOT NULL DEFAULT 'AKA',
  "issue_counter" integer NOT NULL DEFAULT 0,
  "budget_monthly_cents" integer NOT NULL DEFAULT 0,
  "spent_monthly_cents" integer NOT NULL DEFAULT 0,
  "require_board_approval_for_new_agents" boolean NOT NULL DEFAULT false,
  "brand_color" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_issue_prefix_idx" ON "companies" ("issue_prefix");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "company_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "principal_type" text NOT NULL,
  "principal_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "membership_role" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_memberships_company_principal_unique_idx" ON "company_memberships" ("company_id", "principal_type", "principal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_memberships_principal_status_idx" ON "company_memberships" ("principal_type", "principal_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_memberships_company_status_idx" ON "company_memberships" ("company_id", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL DEFAULT 'general',
  "title" text,
  "icon" text,
  "status" text NOT NULL DEFAULT 'idle',
  "reports_to" uuid REFERENCES "agents"("id"),
  "capabilities" text,
  "adapter_type" text NOT NULL DEFAULT 'opencode_local',
  "adapter_config" jsonb NOT NULL DEFAULT '{}',
  "runtime_config" jsonb NOT NULL DEFAULT '{}',
  "budget_monthly_cents" integer NOT NULL DEFAULT 0,
  "spent_monthly_cents" integer NOT NULL DEFAULT 0,
  "pause_reason" text,
  "paused_at" timestamp with time zone,
  "permissions" jsonb NOT NULL DEFAULT '{}',
  "last_heartbeat_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_company_status_idx" ON "agents" ("company_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_company_reports_to_idx" ON "agents" ("company_id", "reports_to");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "instance_user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "role" text NOT NULL DEFAULT 'instance_admin',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "instance_user_roles_user_role_unique_idx" ON "instance_user_roles" ("user_id", "role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "instance_user_roles_role_idx" ON "instance_user_roles" ("role");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "heartbeat_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "invocation_source" text NOT NULL DEFAULT 'on_demand',
  "trigger_detail" text,
  "status" text NOT NULL DEFAULT 'queued',
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "error" text,
  "wakeup_request_id" uuid,
  "exit_code" integer,
  "signal" text,
  "usage_json" jsonb,
  "result_json" jsonb,
  "session_id_before" text,
  "session_id_after" text,
  "log_store" text,
  "log_ref" text,
  "log_bytes" bigint,
  "log_sha256" text,
  "log_compressed" boolean NOT NULL DEFAULT false,
  "stdout_excerpt" text,
  "stderr_excerpt" text,
  "error_code" text,
  "external_run_id" text,
  "context_snapshot" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heartbeat_runs_company_agent_started_idx" ON "heartbeat_runs" ("company_id", "agent_id", "started_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "agent_runtime_state" (
  "agent_id" uuid PRIMARY KEY,
  "company_id" uuid NOT NULL,
  "adapter_type" text NOT NULL,
  "session_id" text,
  "state_json" jsonb NOT NULL DEFAULT '{}',
  "last_run_id" uuid,
  "last_run_status" text,
  "total_input_tokens" bigint NOT NULL DEFAULT 0,
  "total_output_tokens" bigint NOT NULL DEFAULT 0,
  "total_cached_input_tokens" bigint NOT NULL DEFAULT 0,
  "total_cost_cents" bigint NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runtime_state_company_agent_idx" ON "agent_runtime_state" ("company_id", "agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runtime_state_company_updated_idx" ON "agent_runtime_state" ("company_id", "updated_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "project_id" uuid,
  "goal_id" uuid,
  "parent_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'backlog',
  "priority" text NOT NULL DEFAULT 'medium',
  "assignee_agent_id" uuid,
  "assignee_user_id" text,
  "checkout_run_id" uuid,
  "execution_run_id" uuid,
  "execution_agent_name_key" text,
  "execution_locked_at" timestamp with time zone,
  "created_by_agent_id" uuid,
  "created_by_user_id" text,
  "issue_number" integer,
  "identifier" text,
  "request_depth" integer NOT NULL DEFAULT 0,
  "billing_code" text,
  "assignee_adapter_overrides" jsonb,
  "execution_workspace_settings" jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "hidden_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_status_idx" ON "issues" ("company_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_assignee_status_idx" ON "issues" ("company_id", "assignee_agent_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_assignee_user_status_idx" ON "issues" ("company_id", "assignee_user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_parent_idx" ON "issues" ("company_id", "parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_project_idx" ON "issues" ("company_id", "project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issues_identifier_idx" ON "issues" ("identifier");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "goal_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'backlog',
  "lead_agent_id" uuid,
  "target_date" date,
  "color" text,
  "pause_reason" text,
  "paused_at" timestamp with time zone,
  "execution_workspace_policy" jsonb,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_company_idx" ON "projects" ("company_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chat_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "creator_agent_id" uuid,
  "creator_user_id" text,
  "title" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_company_agent_idx" ON "chat_threads" ("company_id", "agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_company_created_at_idx" ON "chat_threads" ("company_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL,
  "sender_type" text NOT NULL,
  "sender_agent_id" uuid,
  "sender_user_id" text,
  "body" text NOT NULL,
  "token_count" integer,
  "processing_status" text NOT NULL DEFAULT 'enqueued',
  "telegram_update_id" bigint,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_thread_created_at_idx" ON "chat_messages" ("thread_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_processing_status_idx" ON "chat_messages" ("processing_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_telegram_update_id_idx" ON "chat_messages" ("telegram_update_id");
