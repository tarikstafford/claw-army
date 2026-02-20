import { z } from 'zod';

/** Schema for a bot_started lifecycle event */
export const botStartedEventSchema = z.object({
  type: z.literal('bot_started'),
  botId: z.uuid(),
  executionId: z.uuid(),
  timestamp: z.iso.datetime(),
  metadata: z.object({
    imageTag: z.string().optional(),
    containerId: z.string().optional(),
    instanceName: z.string().optional(),
    internalIp: z.string().optional(),
    port: z.number().optional(),
    zone: z.string().optional(),
  }).optional(),
});

/** Schema for a bot_stopped lifecycle event */
export const botStoppedEventSchema = z.object({
  type: z.literal('bot_stopped'),
  botId: z.uuid(),
  executionId: z.uuid(),
  timestamp: z.iso.datetime(),
  reason: z.enum(['completed', 'terminated', 'failed', 'budget_exceeded', 'idle_timeout']),
  metadata: z.object({
    tasksClaimed: z.number().int().nonnegative().optional(),
    tasksCompleted: z.number().int().nonnegative().optional(),
    tasksFailed: z.number().int().nonnegative().optional(),
  }).optional(),
});

/** Schema for a bot_heartbeat liveness event */
export const botHeartbeatEventSchema = z.object({
  type: z.literal('bot_heartbeat'),
  botId: z.uuid(),
  executionId: z.uuid(),
  timestamp: z.iso.datetime(),
  currentTaskId: z.uuid().optional(),
});

export type BotStartedEvent = z.infer<typeof botStartedEventSchema>;
export type BotStoppedEvent = z.infer<typeof botStoppedEventSchema>;
export type BotHeartbeatEvent = z.infer<typeof botHeartbeatEventSchema>;
