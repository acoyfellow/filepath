import Stripe from 'stripe';

// Initialize Stripe with the secret key, but only if it exists (to avoid build errors)
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
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

// Export a getter function instead of the instance directly
export const stripe = {
  get instance() {
    return getStripe();
  },
  createCustomer: (email: string, name?: string) => getStripe().customers.create({ email, name }),
  createCreditsProduct: () => {
    const stripe = getStripe();
    return Promise.all([
      stripe.products.create({
        name: 'myfilepath Credits',
        description: 'Credits for using myfilepath.com services',
      }),
      stripe.prices.create({
        product: '', // Will be filled after product creation
        unit_amount: 1000,
        currency: 'usd',
        recurring: undefined,
        metadata: { credits: '1000' },
      })
    ]).then(async ([product, price]) => {
      // Update the price with the actual product ID
      const updatedPrice = await stripe.prices.update(price.id, { product: product.id });
      return { productId: product.id, priceId: updatedPrice.id };
    });
  },
  createCheckoutSession: (
    customerId: string,
    customerEmail: string,
    creditAmount: number,
    successUrl: string,
    cancelUrl: string
  ) => {
    const stripe = getStripe();
    if (creditAmount % 1000 !== 0) {
      throw new Error('Credit amount must be a multiple of 1000');
    }
    const priceId = 'price_1SvhMGF1oOQhJ3pzGR3I65sh';
    const quantity = creditAmount / 1000;
    return stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: !customerId ? customerEmail : undefined,
      line_items: [{ price: priceId, quantity }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { creditAmount: creditAmount.toString() },
    });
  },
  getCheckoutSession: (sessionId: string) => getStripe().checkout.sessions.retrieve(sessionId),
  handleWebhook: (payload: Buffer, signature: string, webhookSecret: string) => 
    getStripe().webhooks.constructEvent(payload, signature, webhookSecret),
  fulfillPayment: async (sessionId: string) => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed');
    }
    const creditAmount = parseInt(session.metadata?.creditAmount || '0');
    if (creditAmount <= 0) {
      throw new Error('Invalid credit amount');
    }
    return creditAmount;
  }
};

/**
 * Create a Stripe customer
 */
export async function createCustomer(email: string, name?: string): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    name,
  });
  
  return customer.id;
}

/**
 * Create a Stripe product for myfilepath credits
 */
export async function createCreditsProduct(): Promise<{ productId: string; priceId: string }> {
  // Create the product
  const product = await stripe.products.create({
    name: 'myfilepath Credits',
    description: 'Credits for using myfilepath.com services',
  });
  
  // Create the price: $10 for 1000 credits ($0.01/credit)
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000, // $10.00 in cents
    currency: 'usd',
    recurring: undefined, // One-time purchase
    metadata: {
      credits: '1000',
    },
  });
  
  return {
    productId: product.id,
    priceId: price.id,
  };
}

/**
 * Create a Stripe checkout session
 */
export async function createCheckoutSession(
  customerId: string,
  customerEmail: string,
  creditAmount: number,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  // Calculate the amount in cents ($0.01/credit)
  const amountInCents = creditAmount; // 1000 credits = $10.00 = 1000 cents
  
  // Use the existing price ID for 1000 credits
  const priceId = 'price_1SvhMGF1oOQhJ3pzGR3I65sh'; // $10 for 1000 credits
  
  // For other amounts, we would need to create new price objects
  // or use quantity multiplier with the base price
  const quantity = creditAmount / 1000;
  
  if (creditAmount % 1000 !== 0) {
    throw new Error('Credit amount must be a multiple of 1000');
  }
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId || undefined,
    customer_email: !customerId ? customerEmail : undefined,
    line_items: [
      {
        price: priceId,
        quantity: quantity,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      creditAmount: creditAmount.toString(),
    },
  });
  
  return session;
}

/**
 * Get a Stripe checkout session
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(payload: Buffer, signature: string, webhookSecret: string): Promise<Stripe.Event> {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Fulfill a successful payment by adding credits to the user's account
 */
export async function fulfillPayment(sessionId: string): Promise<number> {
  const session = await getCheckoutSession(sessionId);
  
  if (session.payment_status !== 'paid') {
    throw new Error('Payment not completed');
  }
  
  const creditAmount = parseInt(session.metadata?.creditAmount || '0');
  if (creditAmount <= 0) {
    throw new Error('Invalid credit amount');
  }
  
  // Note: The actual credit addition to the user's account
  // should be done in the webhook handler where we have
  // access to the user ID from the session metadata
  
  return creditAmount;
}
