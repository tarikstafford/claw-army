import { z } from 'zod';

export const fleetVerdictConfirmedEventSchema = z.object({
  type: z.literal('fleet.verdict.confirmed'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  verdictType: z.enum(['Promote', 'Maintain', 'Demote', 'Monitor', 'Retire']),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

export const fleetClassTransitionEventSchema = z.object({
  type: z.literal('fleet.class.transition'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  fromClass: z.enum(['Novice', 'Understudy', 'Artisan']),
  toClass: z.enum(['Novice', 'Understudy', 'Artisan', 'Retired']),
  transitionType: z.enum(['promote', 'demote', 'retire', 'maintain']),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

export const fleetDnaCapturedEventSchema = z.object({
  type: z.literal('fleet.dna.captured'),
  botId: z.uuid(),
  executionId: z.uuid(),
  soulId: z.uuid(),
  taskCategory: z.string(),
  compositeScore: z.string(),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

export const fleetPioneerDetectedEventSchema = z.object({
  type: z.literal('fleet.pioneer.detected'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

export const fleetBudgetAlertEventSchema = z.object({
  type: z.literal('fleet.budget.alert'),
  executionId: z.uuid(),
  budgetType: z.enum(['daily', 'monthly', 'execution']),
  spentCents: z.number(),
  budgetCents: z.number(),
  percentage: z.number(),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

export const fleetExecutionCompletedEventSchema = z.object({
  type: z.literal('fleet.execution.completed'),
  executionId: z.uuid(),
  taskCategory: z.string(),
  completedBots: z.number().int().nonnegative(),
  totalBots: z.number().int().nonnegative(),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

export const fleetEventSchema = z.discriminatedUnion('type', [
  fleetVerdictConfirmedEventSchema,
  fleetClassTransitionEventSchema,
  fleetDnaCapturedEventSchema,
  fleetPioneerDetectedEventSchema,
  fleetBudgetAlertEventSchema,
  fleetExecutionCompletedEventSchema,
]);

export type FleetVerdictConfirmedEvent = z.infer<typeof fleetVerdictConfirmedEventSchema>;
export type FleetClassTransitionEvent = z.infer<typeof fleetClassTransitionEventSchema>;
export type FleetDnaCapturedEvent = z.infer<typeof fleetDnaCapturedEventSchema>;
export type FleetPioneerDetectedEvent = z.infer<typeof fleetPioneerDetectedEventSchema>;
export type FleetBudgetAlertEvent = z.infer<typeof fleetBudgetAlertEventSchema>;
export type FleetExecutionCompletedEvent = z.infer<typeof fleetExecutionCompletedEventSchema>;
export type FleetEvent = z.infer<typeof fleetEventSchema>;
