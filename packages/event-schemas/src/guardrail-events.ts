import { z } from 'zod';

/** Schema for guardrail_triggered event — fired when a bot violates a safety limit */
export const guardrailTriggeredEventSchema = z.object({
  type: z.literal('guardrail_triggered'),
  botId: z.uuid(),
  executionId: z.uuid(),
  reason: z.enum(['budget_exceeded', 'rate_limit', 'loop_detected', 'idle_timeout']),
  action: z.enum(['warned', 'throttled', 'revoked', 'terminated']),
  timestamp: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GuardrailTriggeredEvent = z.infer<typeof guardrailTriggeredEventSchema>;
