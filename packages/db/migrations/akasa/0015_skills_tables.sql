-- Skills and agent skill loadout tables

CREATE TABLE IF NOT EXISTS "skill_category" (
  "value" text PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS "skill_source" (
  "value" text PRIMARY KEY NOT NULL
);

INSERT INTO "skill_category" ("value") VALUES
  ('communication'),
  ('analysis'),
  ('creation'),
  ('automation'),
  ('research'),
  ('coordination'),
  ('monitoring'),
  ('other')
ON CONFLICT DO NOTHING;

INSERT INTO "skill_source" ("value") VALUES
  ('user_created'),
  ('imported'),
  ('curated')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "version" varchar(50) NOT NULL DEFAULT '1.0.0',
  "category" text NOT NULL DEFAULT 'other',
  "triggers" jsonb NOT NULL DEFAULT '[]',
  "requires_tools" jsonb NOT NULL DEFAULT '[]',
  "requires_skills" jsonb NOT NULL DEFAULT '[]',
  "min_agent_class" varchar(20) NOT NULL DEFAULT 'Novice',
  "content" text NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "source" text NOT NULL DEFAULT 'user_created',
  "is_public" varchar(1) NOT NULL DEFAULT 'n',
  "effectiveness_stats" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agent_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "equipped_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "equipped_by" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "skills_user_id_idx" ON "skills"("user_id");
CREATE INDEX IF NOT EXISTS "skills_category_idx" ON "skills"("category");
CREATE INDEX IF NOT EXISTS "skills_source_idx" ON "skills"("source");
CREATE UNIQUE INDEX IF NOT EXISTS "skills_user_name_uniq" ON "skills"("user_id", "name");

CREATE INDEX IF NOT EXISTS "agent_skills_agent_id_idx" ON "agent_skills"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_skills_skill_id_idx" ON "agent_skills"("skill_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_skills_agent_skill_uniq" ON "agent_skills"("agent_id", "skill_id");
