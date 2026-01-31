import Stripe from 'stripe';

// Initialize Stripe with the secret key
// In production, this should be loaded from environment variables
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const secretKey = import.meta.env.VITE_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey) {
      // Return a mock Stripe object during build time or when no key is available
      if (process.env.NODE_ENV === 'production') {
        throw new Error('STRIPE_SECRET_KEY is required in production');
      }
      return new Proxy({}, {
        get() {
          return () => Promise.reject(new Error('Stripe not initialized'));
        }
      }) as unknown as Stripe;
    }
    stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return stripe;
}

/**
 * Create a Stripe customer for a user
 */
export async function createCustomer(email: string, name?: string) {
  const stripe = getStripe();
  return await stripe.customers.create({
    email,
    name,
  });
}

/**
 * Create a Stripe checkout session for credit purchase
 */
export async function createCheckoutSession(
  customerId: string,
  userEmail: string,
  creditAmount: number,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripe();
  // $10 minimum purchase for 1000 credits ($0.01/credit)
  // Calculate amount in cents ($0.01 per credit)
  const amountInCents = Math.max(1000, creditAmount); // $10 minimum
  
  return await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'myfilepath Credits',
            description: `${creditAmount} credits for myfilepath`,
          },
          unit_amount: amountInCents, // $10.00 for 1000 credits (minimum)
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      credit_amount: creditAmount.toString(),
    },
  });
}

/**
 * Get a Stripe checkout session
 */
export async function getCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Get a Stripe customer
 */
export async function getCustomer(customerId: string) {
  const stripe = getStripe();
  return await stripe.customers.retrieve(customerId);
}

export { getStripe as stripe };