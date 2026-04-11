import { z } from 'zod';

/** Billing event type values — mirrors billing_event_type pgEnum */
const billingEventTypeSchema = z.enum([
  'bot_started',
  'bot_stopped',
  'tool_invoked',
  'execution_completed',
  'budget_exceeded',
]);

/** Schema for budget_alert event — emitted at 50%, 75%, 90% of budget cap */
export const budgetAlertEventSchema = z.object({
  type: z.literal('budget_alert'),
  executionId: z.uuid(),
  userId: z.string(),
  alertThreshold: z.union([z.literal(0.5), z.literal(0.75), z.literal(0.9)]),
  budgetCapCents: z.number().int().nonnegative(),
  totalSpentCents: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});

/** Generic billing event schema covering all billing_event_type values */
export const billingEventSchema = z.object({
  type: z.literal('billing_event'),
  executionId: z.uuid(),
  botId: z.uuid().optional(),
  eventType: billingEventTypeSchema,
  /** Amount in integer cents */
  amountCents: z.number().int().nonnegative().optional(),
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
export type BudgetAlertEvent = z.infer<typeof budgetAlertEventSchema>;
