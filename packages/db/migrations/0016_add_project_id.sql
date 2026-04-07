ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "project_id" uuid;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "project_id" uuid;
ALTER TABLE "billing_events" ADD COLUMN IF NOT EXISTS "project_id" uuid;

CREATE INDEX IF NOT EXISTS "executions_project_id_idx" ON "executions" ("project_id");
CREATE INDEX IF NOT EXISTS "objectives_project_id_idx" ON "objectives" ("project_id");
CREATE INDEX IF NOT EXISTS "billing_events_project_id_idx" ON "billing_events" ("project_id");
