ALTER TABLE "bots" ADD COLUMN "composite_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "tier" varchar(10);--> statement-breakpoint
CREATE INDEX "bots_composite_score_idx" ON "bots" USING btree ("composite_score");