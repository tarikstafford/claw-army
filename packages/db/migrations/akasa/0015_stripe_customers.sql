-- Stripe customer mapping for metered billing integration
-- Stores the Stripe customer ID and subscription ID per user

CREATE TABLE IF NOT EXISTS "stripe_customer" (
  "user_id" text PRIMARY KEY NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text,
  "subscription_item_map" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "stripe_customer_stripe_customer_id_idx" ON "stripe_customer"("stripe_customer_id");
