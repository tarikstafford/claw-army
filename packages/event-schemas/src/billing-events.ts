import { z } from 'zod';

/** Billing event type values — mirrors billing_event_type pgEnum */
const billingEventTypeSchema = z.enum([
  'bot_started',
  'bot_stopped',
  'tool_invoked',
  'execution_completed',
  'budget_exceeded',
]);

/** Generic billing event schema covering all billing_event_type values */
export const billingEventSchema = z.object({
  type: z.literal('billing_event'),
  executionId: z.uuid(),
  botId: z.uuid().optional(),
  eventType: billingEventTypeSchema,
  /** Amount in integer cents */
  amountCents: z.number().int().nonnegative().optional(),
  /** Input token count for LLM calls (used for metered billing) */
  inputTokenCount: z.number().int().nonnegative().optional(),
  /** Output token count for LLM calls (used for metered billing) */
  outputTokenCount: z.number().int().nonnegative().optional(),
  /** Legacy token count field (total tokens, used if input/output not available) */
  tokenCount: z.number().int().nonnegative().optional(),
  timestamp: z.iso.datetime(),
});

/** Schema for budget_exceeded event — emitted when cumulative spend exceeds cap */
export const budgetExceededEventSchema = z.object({
  type: z.literal('budget_exceeded'),
  executionId: z.uuid(),
  /** Budget cap in integer cents */
  budgetCapCents: z.number().int().nonnegative(),
  /** Total spend in integer cents at time of breach */
  totalSpentCents: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type BillingEvent = z.infer<typeof billingEventSchema>;
export type BudgetExceededEvent = z.infer<typeof budgetExceededEventSchema>;

/** Threshold levels for budget alerts */
const budgetAlertThresholdSchema = z.enum(['50', '75', '90']);

/** Schema for budget_alert event — emitted when spend reaches 50%, 75%, or 90% of budget cap */
export const budgetAlertEventSchema = z.object({
  type: z.literal('budget_alert'),
  executionId: z.uuid(),
  /** Threshold reached: '50', '75', or '90' */
  threshold: budgetAlertThresholdSchema,
  /** Budget cap in integer cents */
  budgetCapCents: z.number().int().nonnegative(),
  /** Total spend in integer cents at time of alert */
  totalSpentCents: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type BudgetAlertEvent = z.infer<typeof budgetAlertEventSchema>;
