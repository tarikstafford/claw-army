import type { UUID, Cents, ISOTimestamp } from './common';

/** Mirrors the execution_status pgEnum in packages/db/src/schema/executions.ts */
export type ExecutionStatus =
  | 'pre_flight'
  | 'queued'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'failed';

/** Runtime-iterable array of all execution status values */
export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  'pre_flight',
  'queued',
  'running',
  'paused',
  'stopped',
  'completed',
  'failed',
] as const;

/**
 * Domain entity for an execution run.
 * Mirrors the executions table shape without importing Drizzle.
 */
export interface Execution {
  id: UUID;
  status: ExecutionStatus;
  objective: string;
  maxBots: number;
  /** Budget cap in integer cents */
  budgetCapCents: Cents | null;
  runtimeLimitSeconds: number | null;
  allowedTools: string[];
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Input type for creating a new execution (server assigns id, status, timestamps) */
export type NewExecution = Omit<Execution, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
