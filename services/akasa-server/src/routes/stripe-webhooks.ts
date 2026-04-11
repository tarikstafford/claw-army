import { Router, type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
}

function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

export function stripeWebhooksRouter(): Router {
  const router = Router();

  router.post(
    '/:signature',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const signature = req.params.signature;

        if (!STRIPE_WEBHOOK_SECRET) {
          res.status(500).json({ error: 'Stripe webhook secret not configured' });
          return;
        }

        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as string);

        let event: Stripe.Event;
        try {
          event = constructWebhookEvent(rawBody, signature);
        } catch {
          res.status(400).json({ error: 'Invalid webhook signature' });
          return;
        }

        switch (event.type) {
          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log('[stripe-webhooks] Invoice paid:', {
              customerId: invoice.customer,
              subscriptionId: invoice.subscription,
              amountPaid: invoice.amount_paid,
              invoiceId: invoice.id,
            });
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            console.warn('[stripe-webhooks] Invoice payment failed:', {
              customerId: invoice.customer,
              subscriptionId: invoice.subscription,
              amountDue: invoice.amount_due,
              invoiceId: invoice.id,
            });
            break;
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            console.log('[stripe-webhooks] Subscription updated:', {
              customerId: subscription.customer,
              subscriptionId: subscription.id,
              status: subscription.status,
            });
            break;
          }

          default:
            console.log('[stripe-webhooks] Unhandled event type:', event.type);
        }

        res.json({ received: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
