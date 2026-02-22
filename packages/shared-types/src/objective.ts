import type { UUID, Cents, ISOTimestamp } from './common';

/**
 * Domain entity for a named objective (reusable execution template).
 * Mirrors the objectives table shape without importing Drizzle.
 */
export interface Objective {
  id: UUID;
  name: string;
  description: string | null;
  /** Default number of bots to spawn for executions created from this objective */
  defaultMaxBots: number;
  /** Default budget cap in integer cents; null means no cap */
  defaultBudgetCapCents: Cents | null;
  /** Default runtime limit in seconds; null means no limit */
  defaultRuntimeLimitSeconds: number | null;
  /** Default set of allowed tool identifiers */
  defaultAllowedTools: string[];
  /** Archived objectives are hidden from new-execution flows */
  isArchived: boolean;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Input type for creating a new objective (server assigns id, isArchived, and timestamps) */
export type NewObjective = Omit<Objective, 'id' | 'isArchived' | 'createdAt' | 'updatedAt'>;
