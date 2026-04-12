CREATE TABLE IF NOT EXISTS "marketplace_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "target_id" uuid NOT NULL,
  "target_type" text NOT NULL,
  "rating" integer NOT NULL,
  "review_text" text,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rating_range" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "target_type_valid" CHECK ("target_type" IN ('soul', 'skill'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_reviews_user_target_uniq" ON "marketplace_reviews" ("user_id", "target_id");
CREATE INDEX IF NOT EXISTS "marketplace_reviews_target_idx" ON "marketplace_reviews" ("target_id", "target_type");
