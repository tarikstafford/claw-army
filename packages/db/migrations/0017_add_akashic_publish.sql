ALTER TABLE "dna_store" ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false;
ALTER TABLE "dna_store" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
ALTER TABLE "dna_store" ADD COLUMN IF NOT EXISTS "publish_title" text;
ALTER TABLE "dna_store" ADD COLUMN IF NOT EXISTS "publish_description" text;
ALTER TABLE "dna_store" ADD COLUMN IF NOT EXISTS "acquired_count" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "dna_store_is_published_idx" ON "dna_store" ("is_published");
CREATE INDEX IF NOT EXISTS "dna_store_published_at_idx" ON "dna_store" ("published_at") WHERE "is_published" = true;
