ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ring_leader_task_id" varchar(255);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_ring_leader_task_id_idx" ON "tasks" USING btree ("ring_leader_task_id");
