import Stripe from 'stripe';

// Initialize Stripe with the secret key
// In production, this should be loaded from environment variables
const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

/**
 * Create a Stripe customer for a user
 */
export async function createCustomer(email: string, name?: string) {
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
  // $10 minimum purchase for 1000 credits ($0.01/credit)
  const amountInCents = Math.max(1000, creditAmount);
  
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
          unit_amount: amountInCents, // $10.00 for 1000 credits
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
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Get a Stripe customer
 */
export async function getCustomer(customerId: string) {
  return await stripe.customers.retrieve(customerId);
}

export { stripe };