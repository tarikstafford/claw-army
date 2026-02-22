import { z } from 'zod';

/** Schema for a soul_promoted lifecycle event */
export const soulPromotedEventSchema = z.object({
  type: z.literal('soul_promoted'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  fromClass: z.enum(['Novice', 'Understudy']),
  toClass: z.enum(['Understudy', 'Artisan']),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

/** Schema for a soul_demoted lifecycle event */
export const soulDemotedEventSchema = z.object({
  type: z.literal('soul_demoted'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  fromClass: z.enum(['Understudy', 'Artisan']),
  toClass: z.enum(['Novice', 'Understudy']),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

/** Schema for a soul_retired lifecycle event */
export const soulRetiredEventSchema = z.object({
  type: z.literal('soul_retired'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  fromClass: z.enum(['Novice', 'Understudy', 'Artisan']),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

/** Schema for a pioneer_detected lifecycle event */
export const pioneerDetectedEventSchema = z.object({
  type: z.literal('pioneer_detected'),
  botId: z.uuid(),
  executionId: z.uuid(),
  taskCategory: z.string(),
  description: z.string(),
  timestamp: z.iso.datetime(),
});

/** Discriminated union of all soul lifecycle event types */
export const soulLifecycleEventSchema = z.discriminatedUnion('type', [
  soulPromotedEventSchema,
  soulDemotedEventSchema,
  soulRetiredEventSchema,
  pioneerDetectedEventSchema,
]);

export type SoulPromotedEvent = z.infer<typeof soulPromotedEventSchema>;
export type SoulDemotedEvent = z.infer<typeof soulDemotedEventSchema>;
export type SoulRetiredEvent = z.infer<typeof soulRetiredEventSchema>;
export type PioneerDetectedEvent = z.infer<typeof pioneerDetectedEventSchema>;
export type SoulLifecycleEvent = z.infer<typeof soulLifecycleEventSchema>;
