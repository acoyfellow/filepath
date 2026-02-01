import { json, error } from '@sveltejs/kit';
import { getUserCreditBalance } from '$lib/billing';
import type { RequestHandler } from './$types';

/**
 * GET /api/billing/balance - Get user's credit balance
 */
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  try {
    const balance = await getUserCreditBalance(locals.user.id);
    return json({ balance });
  } catch (err) {
    console.error('Error getting credit balance:', err);
    throw error(500, 'Failed to get credit balance');
  }
};
