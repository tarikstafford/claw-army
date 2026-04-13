import Stripe from 'stripe';
import { db, authAccounts } from '@claw/db';
import { eq } from 'drizzle-orm';

const MARKUP_MULTIPLIER = 1.2;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-03-25.dahlia',
});

export type MeterDimension = 'llm_input_tokens' | 'llm_output_tokens' | 'bot_hours' | 'tool_invocations';

export interface UsageRecordParams {
  userId: string;
  dimension: MeterDimension;
  quantity: number;
  timestamp: Date;
  executionId: string;
}

async function getOrCreateStripeCustomer(userId: string, email?: string): Promise<string> {
  const existing = await db
    .select()
    .from(authAccounts)
    .where(eq(authAccounts.userId, userId))
    .limit(1);

  const stripeCustomerId = existing[0]?.accessToken;

  if (stripeCustomerId) {
    return stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    metadata: { userId },
    email,
  });

  const now = new Date();
  await db.insert(authAccounts).values({
    id: crypto.randomUUID(),
    userId,
    providerId: 'stripe',
    accountId: customer.id,
    accessToken: customer.id,
    createdAt: now,
    updatedAt: now,
  });

  return customer.id;
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(authAccounts)
    .where(eq(authAccounts.userId, userId))
    .limit(1);

  return rows[0]?.accessToken ?? null;
}

export async function getOrCreateSubscription(customerId: string): Promise<string> {
  const METRIC_MAP: Record<MeterDimension, string> = {
    llm_input_tokens: 'llm_input_tokens',
    llm_output_tokens: 'llm_output_tokens',
    bot_hours: 'bot_hours',
    tool_invocations: 'tool_invocations',
  };

  const existing = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0]!.id;
  }

  const priceMap: Record<MeterDimension, Record<'currency' | 'unit_label' | 'product' | 'nickname', string>> = {
    llm_input_tokens: {
      currency: 'usd',
      unit_label: 'M tokens',
      product: process.env.STRIPE_LLM_INPUT_PRODUCT_ID ?? '',
      nickname: 'LLM Input Tokens',
    },
    llm_output_tokens: {
      currency: 'usd',
      unit_label: 'M tokens',
      product: process.env.STRIPE_LLM_OUTPUT_PRODUCT_ID ?? '',
      nickname: 'LLM Output Tokens',
    },
    bot_hours: {
      currency: 'usd',
      unit_label: 'hour',
      product: process.env.STRIPE_BOT_HOURS_PRODUCT_ID ?? '',
      nickname: 'Bot Hours',
    },
    tool_invocations: {
      currency: 'usd',
      unit_label: 'invocation',
      product: process.env.STRIPE_TOOL_INVOCATIONS_PRODUCT_ID ?? '',
      nickname: 'Tool Invocations',
    },
  };

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [],
    expand: ['items.data.price'],
  });

  return subscription.id;
}

export async function submitUsageRecord(params: UsageRecordParams): Promise<void> {
  const customerId = await getOrCreateStripeCustomer(params.userId);
  const subscriptionId = await getOrCreateSubscription(customerId);

  const quantityCents = Math.round(params.quantity * MARKUP_MULTIPLIER * 100);

  await stripe.billing.meterEvents.create({
    event_name: params.dimension,
    payload: {
      stripe_customer_id: customerId,
      value: String(quantityCents),
    },
    timestamp: Math.floor(params.timestamp.getTime() / 1000),
  });
}

export async function constructWebhookEvent(
  payload: string,
  signature: string,
): Promise<Stripe.Event> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export { stripe };
