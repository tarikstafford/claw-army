import { z } from 'zod';

/** Ring Leader status transition (DASH-02) */
export const ringLeaderStatusChangeEventSchema = z.object({
  type: z.literal('ring_leader_status_change'),
  runId: z.uuid(),
  executionId: z.uuid(),
  fromStatus: z.enum(['assembling', 'spawning', 'coordinating', 'synthesizing', 'completed', 'failed']),
  toStatus: z.enum(['assembling', 'spawning', 'coordinating', 'synthesizing', 'completed', 'failed']),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

/** Intelligence routed between agents (COORD-02, DASH-03) */
export const intelligenceRoutingEventSchema = z.object({
  type: z.literal('intelligence_routing'),
  runId: z.uuid(),
  executionId: z.uuid(),
  fromAgentSessionId: z.uuid(),
  toAgentSessionId: z.uuid(),
  fromTaskId: z.string(),
  toTaskId: z.string(),
  signalSummary: z.string(),
  routingRationale: z.string(),
  timestamp: z.iso.datetime(),
});

/** Agent reallocation on failure or early completion (COORD-03, COORD-04, DASH-03) */
export const reallocationEventSchema = z.object({
  type: z.literal('reallocation'),
  runId: z.uuid(),
  executionId: z.uuid(),
  trigger: z.enum(['agent_failure', 'early_completion', 'guardrail_trigger']),
  affectedAgentSessionId: z.uuid(),
  affectedTaskId: z.string(),
  action: z.enum(['redistributed', 'replacement_spawned', 'capacity_redirected', 'paused_for_review']),
  rationale: z.string(),
  timestamp: z.iso.datetime(),
});

/** Objective reanchoring broadcast (COORD-06, COORD-07, DASH-03) */
export const reanchoringEventSchema = z.object({
  type: z.literal('reanchoring'),
  runId: z.uuid(),
  executionId: z.uuid(),
  driftScore: z.number().min(0).max(1),
  objectiveRestatement: z.string(),
  driftSummary: z.string(),
  reorientationDirective: z.string(),
  timestamp: z.iso.datetime(),
});

/** Budget degradation tier change (COORD-08, DASH-03) */
export const budgetDegradationEventSchema = z.object({
  type: z.literal('budget_degradation'),
  runId: z.uuid(),
  executionId: z.uuid(),
  previousTier: z.enum(['normal', 'deprioritize', 'consolidate', 'wrap_up', 'hard_stop']),
  newTier: z.enum(['normal', 'deprioritize', 'consolidate', 'wrap_up', 'hard_stop']),
  budgetConsumedPercent: z.number().min(0).max(1),
  projectedOverrunPercent: z.number().nullable(),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

/** Discriminated union of all Ring Leader event types */
export const ringLeaderEventSchema = z.discriminatedUnion('type', [
  ringLeaderStatusChangeEventSchema,
  intelligenceRoutingEventSchema,
  reallocationEventSchema,
  reanchoringEventSchema,
  budgetDegradationEventSchema,
]);

// Inferred types
export type RingLeaderStatusChangeEvent = z.infer<typeof ringLeaderStatusChangeEventSchema>;
export type IntelligenceRoutingEvent = z.infer<typeof intelligenceRoutingEventSchema>;
export type ReallocationEvent = z.infer<typeof reallocationEventSchema>;
export type ReanchoringEvent = z.infer<typeof reanchoringEventSchema>;
export type BudgetDegradationEvent = z.infer<typeof budgetDegradationEventSchema>;
export type RingLeaderEvent = z.infer<typeof ringLeaderEventSchema>;
