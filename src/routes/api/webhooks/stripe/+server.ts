import type Stripe from 'stripe';
import { json, error, text } from '@sveltejs/kit';
import { stripe } from '$lib/stripe';
import { addUserCredits } from '$lib/billing';
import { getDrizzle } from '$lib/auth';
import { user } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 */
export const POST: RequestHandler = async ({ request, platform }) => {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  
  let event: Stripe.Event;
  
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      sig || '',
      import.meta.env.VITE_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    throw error(400, `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      
      try {
        // Get the credit amount from metadata
        const creditAmount = parseInt(session.metadata?.credit_amount || '0');
        
        if (creditAmount > 0 && session.customer) {
          // Find user by Stripe customer ID
          const db = getDrizzle();
          const users = await db.select().from(user).where(eq(user.stripeCustomerId, session.customer as string));
          
          if (users.length > 0) {
            // Add credits to user's account
            await addUserCredits(users[0].id, creditAmount);
            console.log(`Added ${creditAmount} credits to user ${users[0].id}`);
          } else {
            console.error(`User not found for Stripe customer ID: ${session.customer}`);
          }
        }
      } catch (err) {
        console.error('Error processing checkout session:', err);
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  return json({ received: true });
};