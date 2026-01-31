import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripeService } from '$lib/stripe';
import { getDrizzle } from '$lib/auth';
import { user } from '$lib/schema';
import { eq, sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, platform }) => {
  const stripeSecret = platform?.env?.STRIPE_WEBHOOK_SECRET;
  
  if (!stripeSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    throw error(500, 'Webhook configuration error');
  }

  const payload = await request.arrayBuffer();
  const signature = request.headers.get('stripe-signature');
  
  if (!signature) {
    throw error(400, 'Missing signature');
  }

  try {
    // Reset the global payment completed flag
    delete (globalThis as any).stripePaymentCompleted;
    
    const success = await stripeService.handleWebhook(
      Buffer.from(payload),
      signature,
      stripeSecret
    );
    
    if (!success) {
      throw error(500, 'Webhook handling failed');
    }
    
    // Check if a payment was completed and add credits
    const paymentData = (globalThis as any).stripePaymentCompleted;
    if (paymentData) {
      const { userId, credits } = paymentData;
      
      // Add credits to user's account
      const db = getDrizzle();
      
      // First, get the customer ID from the Stripe session
      // This would require storing the session ID in the global data
      // For now, we'll just add the credits
      await db.update(user)
        .set({
          creditBalance: sql`credit_balance + ${credits}`
        })
        .where(eq(user.id, userId));
      
      console.log(`Added ${credits} credits to user ${userId}`);
    }
    
    return new Response(null, { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    throw error(400, 'Webhook error');
  }
};
