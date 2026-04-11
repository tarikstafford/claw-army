CREATE TABLE "user_preferences" (
  "user_id" text PRIMARY KEY,
  "email_evolution_events" boolean DEFAULT true NOT NULL,
  "email_budget_alerts" boolean DEFAULT true NOT NULL,
  "email_skill_events" boolean DEFAULT true NOT NULL,
  "in_app_evolution_events" boolean DEFAULT true NOT NULL,
  "in_app_budget_alerts" boolean DEFAULT true NOT NULL,
  "in_app_skill_events" boolean DEFAULT true NOT NULL,
  "budget_alert_threshold_50" boolean DEFAULT true NOT NULL,
  "budget_alert_threshold_75" boolean DEFAULT true NOT NULL,
  "budget_alert_threshold_90" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" varchar(8) NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");
