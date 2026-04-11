import Stripe from 'stripe';
import { db, authUsers } from '@claw/db';
import { eq } from 'drizzle-orm';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';

const STRIPE_PRICE_ID_INPUT_TOKENS = process.env.STRIPE_PRICE_ID_INPUT_TOKENS ?? '';
const STRIPE_PRICE_ID_OUTPUT_TOKENS = process.env.STRIPE_PRICE_ID_OUTPUT_TOKENS ?? '';
const STRIPE_PRICE_ID_BOT_HOURS = process.env.STRIPE_PRICE_ID_BOT_HOURS ?? '';
const STRIPE_PRICE_ID_TOOL_INVOCATIONS = process.env.STRIPE_PRICE_ID_TOOL_INVOCATIONS ?? '';

const MARKUP_MULTIPLIER = 1.20;

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripeClient();

  const [user] = await db
    .select({ email: authUsers.email, name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const customers = await stripe.customers.list({
    email: user.email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0].id;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId },
  });

  return customer.id;
}

export async function createMeteredSubscription(customerId: string): Promise<{
  subscriptionId: string;
  itemMap: Record<string, string>;
}> {
  const stripe = getStripeClient();

  const priceItems = [
    { price: STRIPE_PRICE_ID_INPUT_TOKENS, key: 'input_tokens' },
    { price: STRIPE_PRICE_ID_OUTPUT_TOKENS, key: 'output_tokens' },
    { price: STRIPE_PRICE_ID_BOT_HOURS, key: 'bot_hours' },
    { price: STRIPE_PRICE_ID_TOOL_INVOCATIONS, key: 'tool_invocations' },
  ].filter((p) => p.price);

  if (priceItems.length === 0) {
    console.warn('[stripe] No Stripe metered price IDs configured — skipping subscription creation');
    return { subscriptionId: '', itemMap: {} };
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: priceItems.map((p) => ({ price: p.price })),
    billing_scheme: 'tiered',
    usage_type: 'metered',
  });

  const itemMap: Record<string, string> = {};
  for (const item of subscription.items.data) {
    const priceId = item.price?.id;
    if (priceId === STRIPE_PRICE_ID_INPUT_TOKENS) itemMap.input_tokens = item.id;
    else if (priceId === STRIPE_PRICE_ID_OUTPUT_TOKENS) itemMap.output_tokens = item.id;
    else if (priceId === STRIPE_PRICE_ID_BOT_HOURS) itemMap.bot_hours = item.id;
    else if (priceId === STRIPE_PRICE_ID_TOOL_INVOCATIONS) itemMap.tool_invocations = item.id;
  }

  return { subscriptionId: subscription.id, itemMap };
}

export async function submitTokenUsage(params: {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: number;
}): Promise<void> {
  const stripe = getStripeClient();
  const quantityWithMarkup = Math.round(params.quantity * MARKUP_MULTIPLIER);

  await stripe.subscriptionItems.createUsageRecord(params.subscriptionItemId, {
    quantity: quantityWithMarkup,
    timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
    action: 'increment',
  });
}

export async function submitBotHoursUsage(params: {
  subscriptionItemId: string;
  quantity: number;
}): Promise<void> {
  const stripe = getStripeClient();
  const quantityWithMarkup = Math.round(params.quantity * MARKUP_MULTIPLIER * 100) / 100;

  await stripe.subscriptionItems.createUsageRecord(params.subscriptionItemId, {
    quantity: quantityWithMarkup,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment',
  });
}

export type { Stripe };
