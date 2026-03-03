-- Must be applied outside a transaction block (run via psql directly)
ALTER TYPE "execution_status" ADD VALUE IF NOT EXISTS 'pre_flight' BEFORE 'queued';
