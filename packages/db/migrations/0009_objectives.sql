CREATE TABLE IF NOT EXISTS "objectives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "default_max_bots" integer NOT NULL DEFAULT 5,
  "default_budget_cap_cents" integer,
  "default_runtime_limit_seconds" integer,
  "default_allowed_tools" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "objectives_is_archived_idx" ON "objectives" USING btree ("is_archived");
CREATE INDEX IF NOT EXISTS "objectives_created_at_idx" ON "objectives" USING btree ("created_at");
