import type { UUID, Cents, ISOTimestamp } from './common';

/** Mirrors the billing_event_type pgEnum in packages/db/src/schema/billing-events.ts */
export type BillingEventType =
  | 'bot_started'
  | 'bot_stopped'
  | 'tool_invoked'
  | 'execution_completed'
  | 'budget_exceeded';

/** Runtime-iterable array of all billing event type values */
export const BILLING_EVENT_TYPES: readonly BillingEventType[] = [
  'bot_started',
  'bot_stopped',
  'tool_invoked',
  'execution_completed',
  'budget_exceeded',
] as const;

/**
 * Domain entity for a billing event.
 * Mirrors the billing_events table shape without importing Drizzle.
 */
export interface BillingEvent {
  id: UUID;
  executionId: UUID;
  botId: UUID | null;
  eventType: BillingEventType;
  /** Amount in integer cents */
  amountCents: Cents | null;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
  occurredAt: ISOTimestamp;
}

/** Performance tier classification for a bot run */
export type PerformanceTier = 'high' | 'medium' | 'low';

/**
 * JSONB payload structure for a DNA record.
 * Mirrors the DnaPayload interface in packages/db/src/schema/dna-store.ts.
 */
export interface DnaPayload {
  systemPromptTemplate: string;
  toolCallSequence: string[];
  argumentPatterns: Record<string, unknown>;
  retryStrategy: Record<string, unknown>;
  timingProfile: Record<string, unknown>;
  tokenDistribution: Record<string, unknown>;
}
