CREATE TYPE source_type AS ENUM ('authored', 'learned', 'acquired');
CREATE TYPE activation_classification AS ENUM ('positive', 'neutral', 'negative');

CREATE TABLE IF NOT EXISTS "agent_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "skill_name" varchar(255) NOT NULL,
  "skill_description" text NOT NULL,
  "skill_content" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "is_published" boolean NOT NULL DEFAULT false,
  "published_at" timestamptz,
  "source_type" source_type NOT NULL DEFAULT 'authored',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_skills_company_id_idx" ON "agent_skills" ("company_id");
CREATE INDEX IF NOT EXISTS "agent_skills_skill_name_idx" ON "agent_skills" ("skill_name");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_skills_company_skill_version_unique" ON "agent_skills" ("company_id", "skill_name", "version");

CREATE TABLE IF NOT EXISTS "skill_loadouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bot_id" uuid NOT NULL REFERENCES "bots"("id") ON DELETE CASCADE,
  "skill_id" uuid NOT NULL REFERENCES "agent_skills"("id") ON DELETE CASCADE,
  "is_active" boolean NOT NULL DEFAULT true,
  "equipped_at" timestamptz NOT NULL DEFAULT now(),
  "removed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "skill_loadouts_bot_id_idx" ON "skill_loadouts" ("bot_id");
CREATE INDEX IF NOT EXISTS "skill_loadouts_skill_id_idx" ON "skill_loadouts" ("skill_id");
CREATE UNIQUE INDEX IF NOT EXISTS "skill_loadouts_bot_skill_active_unique" ON "skill_loadouts" ("bot_id", "skill_id");

CREATE TABLE IF NOT EXISTS "skill_activations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bot_id" uuid NOT NULL REFERENCES "bots"("id") ON DELETE CASCADE,
  "skill_id" uuid NOT NULL REFERENCES "agent_skills"("id") ON DELETE CASCADE,
  "execution_id" uuid NOT NULL,
  "activated_at" timestamptz NOT NULL DEFAULT now(),
  "composite_score_delta" float NOT NULL,
  "classification" activation_classification NOT NULL,
  "consecutive_negative_count" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "skill_activations_bot_id_idx" ON "skill_activations" ("bot_id");
CREATE INDEX IF NOT EXISTS "skill_activations_skill_id_idx" ON "skill_activations" ("skill_id");
CREATE INDEX IF NOT EXISTS "skill_activations_execution_id_idx" ON "skill_activations" ("execution_id");
