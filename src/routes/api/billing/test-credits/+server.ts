import { json, error } from '@sveltejs/kit';
import { addUserCredits } from '$lib/billing';
import type { RequestHandler } from './$types';

/**
 * POST /api/billing/test-credits - Add test credits (dev/test mode only)
 * Body: { amount: number }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  // Only allow in development or if explicitly enabled
  const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';
  const testModeEnabled = process.env.ENABLE_TEST_CREDITS === 'true';
  
  if (!isDev && !testModeEnabled) {
    throw error(403, 'Test credits only available in development mode');
  }
  
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  const { amount = 1000 } = await request.json() as { amount?: number };
  
  if (amount < 0 || amount > 10000) {
    throw error(400, 'Amount must be between 0 and 10000');
  }
  
  try {
    await addUserCredits(locals.user.id, amount);
    return json({ 
      success: true, 
      amount,
      message: `Added ${amount} test credits` 
    });
  } catch (err) {
    console.error('Error adding test credits:', err);
    throw error(500, 'Failed to add test credits');
  }
};
