ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "objective_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'executions_objective_id_objectives_id_fk'
  ) THEN
    ALTER TABLE "executions" ADD CONSTRAINT "executions_objective_id_objectives_id_fk"
      FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE SET NULL;
  END IF;
END $$;
