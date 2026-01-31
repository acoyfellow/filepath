import Stripe from 'stripe';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}

export class StripeService {
  /**
   * Create a Stripe checkout session for credit purchase
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<string> {
    try {
      // Calculate amount in cents ($10 minimum, $1 = 100 credits)
      const amountInCents = Math.max(1000, params.credits * 10); // $10 minimum
      
      // Create or retrieve customer
      let customer: Stripe.Customer;
      
      // In production, you'd want to look up existing customers by userId
      // For now, we'll create a new customer each time
      customer = await stripe.customers.create({
        email: params.userEmail,
        metadata: {
          userId: params.userId,
        },
      });

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customer.id,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'myfilepath.com Credits',
                description: `${params.credits} credits ($0.01/minute compute time)`,
              },
              unit_amount: Math.round(amountInCents / (params.credits / 100)), // cents per credit
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          userId: params.userId,
          credits: params.credits.toString(),
        },
      });

      if (!session.url) {
        throw new Error('Failed to create checkout session');
      }

      return session.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(payload: Buffer, signature: string, secret: string): Promise<boolean> {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, secret);
      
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Extract metadata
        const userId = session.metadata?.userId;
        const creditsStr = session.metadata?.credits;
        
        if (!userId || !creditsStr) {
          console.error('Missing metadata in checkout session');
          return false;
        }
        
        const credits = parseInt(creditsStr, 10);
        
        // Emit event for credit addition
        // The actual credit addition will be handled by the webhook endpoint
        // which has access to the database
        console.log(`Payment completed for user ${userId}: ${credits} credits`);
        
        // Store the event data for processing
        (globalThis as any).stripePaymentCompleted = {
          userId,
          credits
        };
        
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('Error handling webhook:', error);
      return false;
    }
  }
}

export const stripeService = new StripeService();
