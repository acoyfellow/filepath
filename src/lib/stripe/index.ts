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
  customerId: string,
  customerEmail: string,
  creditAmount: number,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  
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
