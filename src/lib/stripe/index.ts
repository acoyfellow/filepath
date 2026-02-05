import Stripe from 'stripe';

const stripeCache = new Map<string, Stripe>();

export function getStripe(env?: { STRIPE_SECRET_KEY?: string }): Stripe {
  // Try to get secret key from env parameter first, then import.meta.env
  const secretKey = env?.STRIPE_SECRET_KEY || import.meta.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  
  // Cache by key to avoid creating multiple instances
  if (!stripeCache.has(secretKey)) {
    stripeCache.set(secretKey, new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    }));
  }
  return stripeCache.get(secretKey)!;
}

// Product and Price IDs (created in Stripe dashboard/API)
export const CREDITS_PRODUCT_ID = 'prod_TtUK30b7c9Uuvh';
export const CREDITS_PRICE_ID = 'price_1SvhMJF1oOQhJ3pzPkqJROjj';

export async function createCheckoutSession(
  customerId: string,
  customerEmail: string,
  creditAmount: number,
  successUrl: string,
  cancelUrl: string,
  env?: { STRIPE_SECRET_KEY?: string }
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe(env);
  
  // Calculate quantity based on credit amount ($10 for 1000 credits)
  const quantity = Math.max(1, Math.floor(creditAmount / 1000));
  
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId || undefined,
    customer_email: (!customerId && customerEmail) ? customerEmail : undefined,
    line_items: [{
      price: CREDITS_PRICE_ID,
      quantity: quantity,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      credits: (quantity * 1000).toString(),
      creditAmount: creditAmount.toString(),
    },
  });
}

export async function getCheckoutSession(sessionId: string, env?: { STRIPE_SECRET_KEY?: string }): Promise<Stripe.Checkout.Session> {
  return getStripe(env).checkout.sessions.retrieve(sessionId);
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
  env?: { STRIPE_SECRET_KEY?: string }
): Stripe.Event {
  return getStripe(env).webhooks.constructEvent(payload, signature, webhookSecret);
}

// For direct access when needed
export function createStripeClient(env?: { STRIPE_SECRET_KEY?: string }) {
  const stripe = getStripe(env);
  return {
    instance: stripe,
    customers: stripe.customers,
    products: stripe.products,
    prices: stripe.prices,
    checkout: stripe.checkout,
    webhooks: stripe.webhooks,
  };
}
