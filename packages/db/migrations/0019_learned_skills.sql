-- Migration: 0019_learned_skills
-- Creates the learned_skills table for agent-discovered procedural knowledge
-- from decision trace analysis (Karpathy Loop skill extraction).

DO $$ BEGIN
  CREATE TYPE "skill_approval_status" AS ENUM ('auto_approved', 'pending_review', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "learned_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bot_id" uuid NOT NULL REFERENCES "bots"("id") ON DELETE CASCADE,
  "soul_id" uuid,
  "execution_id" uuid NOT NULL REFERENCES "executions"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "category" varchar(100) NOT NULL,
  "trigger_patterns" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "procedural_body" text NOT NULL,
  "required_tools" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "confidence_score" numeric(4, 3) NOT NULL,
  "approval_status" "skill_approval_status" NOT NULL DEFAULT 'pending_review',
  "source_trace_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "skill_content" text NOT NULL,
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "approved_at" timestamp(3) with time zone,
  "approved_by" text
);

CREATE INDEX IF NOT EXISTS "learned_skills_bot_id_idx" ON "learned_skills" ("bot_id");
CREATE INDEX IF NOT EXISTS "learned_skills_soul_id_idx" ON "learned_skills" ("soul_id");
CREATE INDEX IF NOT EXISTS "learned_skills_execution_id_idx" ON "learned_skills" ("execution_id");
CREATE INDEX IF NOT EXISTS "learned_skills_approval_status_idx" ON "learned_skills" ("approval_status");
CREATE INDEX IF NOT EXISTS "learned_skills_category_idx" ON "learned_skills" ("category");
