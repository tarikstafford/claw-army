import type { UUID, ISOTimestamp } from './common';

/** The 7 behavioral dimensions of a SOUL document (SOUL-01) */
export interface SoulDimension {
  /** Dimension 1: who the agent is and its core purpose */
  identityRole: string;
  /** Dimension 2: ranked order of decision drivers */
  decisionPriorities: string;
  /** Dimension 3: how and when to use tools */
  toolUsageDoctrine: string;
  /** Dimension 4: appetite for reversible vs irreversible actions */
  riskTolerance: string;
  /** Dimension 5: how the agent reports progress and asks for help */
  communicationStyle: string;
  /** Dimension 6: what to do when tasks fail or errors occur */
  recoveryBehavior: string;
  /** Dimension 7: inviolable lines that are never mutated away */
  ethicalHardStops: string;
}

/**
 * Full SOUL document for a bot (SOUL-01, SOUL-03).
 * Mirrors bot_souls table but without Drizzle dependency.
 */
export interface SoulDocument {
  id: UUID;
  isArchetype: boolean;
  archetypeName: string | null;
  botId: UUID | null;
  executionId: UUID | null;
  taskCategory: string | null;
  /** Full SOUL.md markdown text */
  soulContent: string;
  /** SHA-256 hex digest of soulContent (SOUL-03) */
  contentHash: string;
  /** Mutation generation counter, starts at 1 (SOUL-03) */
  generation: number;
  /** Immediate parent for lineage tracing (SOUL-03) */
  parentSoulId: UUID | null;
  /** 7 behavioral dimensions */
  dimensions: SoulDimension;
  /** Inviolable directives (SOUL-01) */
  constitutionDirectives: string[];
  createdAt: ISOTimestamp;
}

/** The 5 verdict types the Council can issue (CNCL-06) */
export type VerdictType = 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';

/** Runtime-iterable array of all verdict types */
export const VERDICT_TYPES: readonly VerdictType[] = [
  'Promote',
  'Maintain',
  'Monitor',
  'Demote',
  'Retire',
] as const;

/** Archetype soul template (SOUL-04) */
export interface SoulArchetype {
  name: string;
  description: string;
  defaultDimensions: SoulDimension;
  defaultConstitutionDirectives: string[];
}
