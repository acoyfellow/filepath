import { json, error } from '@sveltejs/kit';
import { createCheckoutSession, getCheckoutSession } from '$lib/stripe';
import { addUserCredits, getUserCreditBalance, setApiKeyBudgetCap } from '$lib/billing';
import { getDrizzle } from '$lib/auth';
import { user as userTable } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/billing/checkout - Create a Stripe checkout session
 */
export const POST: RequestHandler = async ({ request, locals }) => {
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
    
    // Create Stripe checkout session
    const checkoutSession = await createCheckoutSession(
      fullUser.stripeCustomerId || '',
      session.user.email || '',
      creditAmount,
      `${import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5173'}/settings/billing/success`,
      `${import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5173'}/settings/billing`
    );
    
    return json({ sessionId: checkoutSession.id });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    throw error(500, 'Failed to create checkout session');
  }
};

/**
 * GET /api/billing/balance - Get user's credit balance
 */
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  const session = { user: locals.user };
  
  try {
    const balance = await getUserCreditBalance(session.user.id);
    return json({ balance });
  } catch (err) {
    console.error('Error getting credit balance:', err);
    throw error(500, 'Failed to get credit balance');
  }
};

