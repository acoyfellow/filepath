import { json, error } from '@sveltejs/kit';
import { createCheckoutSession, getCheckoutSession } from '$lib/stripe';
import { addUserCredits, getUserCreditBalance, setApiKeyBudgetCap } from '$lib/billing';
import { authClient } from '$lib/auth-client';
import type { RequestHandler } from './$types';

/**
 * POST /api/billing/checkout - Create a Stripe checkout session
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user) {
    throw error(401, 'Unauthorized');
  }
  
  const { creditAmount } = await request.json();
  
  if (!creditAmount || creditAmount < 1000) {
    throw error(400, 'Minimum purchase is 1000 credits ($10)');
  }
  
  try {
    // Create Stripe checkout session
    const checkoutSession = await createCheckoutSession(
      session.user.stripeCustomerId || '',
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
  const session = await locals.auth();
  if (!session?.user) {
    throw error(401, 'Unauthorized');
  }
  
  try {
    const balance = await getUserCreditBalance(session.user.id);
    return json({ balance });
  } catch (err) {
    console.error('Error getting credit balance:', err);
    throw error(500, 'Failed to get credit balance');
  }
};

/**
 * PATCH /api/billing/apikey/:id/budget - Set budget cap for an API key
 */
export const PATCH: RequestHandler = async ({ request, locals, params }) => {
  const session = await locals.auth();
  if (!session?.user) {
    throw error(401, 'Unauthorized');
  }
  
  const { budgetCap } = await request.json();
  
  if (budgetCap !== null && (typeof budgetCap !== 'number' || budgetCap < 0)) {
    throw error(400, 'Invalid budget cap');
  }
  
  try {
    await setApiKeyBudgetCap(params.id, session.user.id, budgetCap);
    return json({ success: true });
  } catch (err) {
    console.error('Error setting budget cap:', err);
    throw error(500, 'Failed to set budget cap');
  }
};