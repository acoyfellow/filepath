import { json, error } from '@sveltejs/kit';
import { createCheckoutSession } from '$lib/stripe';
import { getDrizzle } from '$lib/auth';
import { user as userTable } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/billing/checkout - Create a Stripe checkout session
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  const session = { user: locals.user };
  
  const { creditAmount } = await request.json() as { creditAmount: number; };
  
  if (!creditAmount || creditAmount < 1000) {
    throw error(400, 'Minimum purchase is 1000 credits ($10)');
  }
  
  try {
    // Get full user record from database to access stripeCustomerId
    const db = getDrizzle();
    const [fullUser] = await db.select().from(userTable).where(eq(userTable.id, session.user.id));
    
    if (!fullUser) {
      throw error(404, 'User not found');
    }
    
    // Get env from platform (Cloudflare) - type-safe access
    const env = platform?.env as { STRIPE_SECRET_KEY?: string } | undefined;
    
    // Create Stripe checkout session
    const checkoutSession = await createCheckoutSession(
      fullUser.stripeCustomerId || '',
      session.user.email || '',
      creditAmount,
      `${import.meta.env.VITE_PUBLIC_URL || 'https://myfilepath.com'}/settings/billing/success`,
      `${import.meta.env.VITE_PUBLIC_URL || 'https://myfilepath.com'}/settings/billing`,
      env
    );
    
    // Return the URL for the frontend to redirect
    return json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    throw error(500, 'Failed to create checkout session');
  }
};
