import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return stripeInstance;
}

// Product and Price IDs (created in Stripe dashboard/API)
export const CREDITS_PRODUCT_ID = 'prod_TtUK30b7c9Uuvh';
export const CREDITS_PRICE_ID = 'price_1SvhMJF1oOQhJ3pzPkqJROjj';

export async function createCheckoutSession(
  customerEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [{
      price: CREDITS_PRICE_ID,
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      credits: '1000',
    },
  });
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId);
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}

// For direct access when needed
export const stripe = {
  get instance() { return getStripe(); },
  get customers() { return getStripe().customers; },
  get products() { return getStripe().products; },
  get prices() { return getStripe().prices; },
  get checkout() { return getStripe().checkout; },
  get webhooks() { return getStripe().webhooks; },
};
