-- Skill tables for skill CRUD and loadout management

CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "version" varchar(20) NOT NULL DEFAULT '1.0.0',
  "category" text NOT NULL,
  "triggers" jsonb NOT NULL DEFAULT '[]',
  "requires_tools" jsonb NOT NULL DEFAULT '[]',
  "requires_skills" jsonb NOT NULL DEFAULT '[]',
  "min_agent_class" text NOT NULL DEFAULT 'Novice',
  "content" text NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "source" text NOT NULL DEFAULT 'user_created',
  "effectiveness_stats" jsonb NOT NULL DEFAULT '{"useCount": 0, "successCount": 0, "failureCount": 0, "averageScore": null}',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agent_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bot_id" uuid NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "equipped_by" text NOT NULL,
  "equipped_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "skills_user_id_idx" ON "skills"("user_id");
CREATE INDEX IF NOT EXISTS "skills_category_idx" ON "skills"("category");
CREATE INDEX IF NOT EXISTS "skills_source_idx" ON "skills"("source");
CREATE UNIQUE INDEX IF NOT EXISTS "skills_user_name_uniq" ON "skills"("user_id", "name");

CREATE INDEX IF NOT EXISTS "agent_skills_bot_id_idx" ON "agent_skills"("bot_id");
CREATE INDEX IF NOT EXISTS "agent_skills_skill_id_idx" ON "agent_skills"("skill_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_skills_bot_skill_uniq" ON "agent_skills"("bot_id", "skill_id");