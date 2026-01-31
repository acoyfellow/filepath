import { json, error } from '@sveltejs/kit';
import { setApiKeyBudgetCap } from '$lib/billing';
import { getDrizzle } from '$lib/auth';
import { user } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * PATCH /api/billing/apikey/:id/budget - Set budget cap for an API key
 */
export const PATCH: RequestHandler = async ({ request, locals, params }) => {
  // Type assertion for the id parameter
  const { id } = params as { id: string; };
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  // Fetch the complete user object from the database
  const db = getDrizzle();
  const users = await db.select().from(user).where(eq(user.id, locals.user.id));
  if (users.length === 0) {
    throw error(404, 'User not found');
  }
  const fullUser = users[0];
  
  const session = { user: fullUser };
  
  const { budgetCap } = await request.json() as { budgetCap: number | null; };
  
  if (budgetCap !== null && (typeof budgetCap !== 'number' || budgetCap < 0)) {
    throw error(400, 'Invalid budget cap');
  }
  
  try {
    await setApiKeyBudgetCap(id, session.user?.id || '', budgetCap);
    return json({ success: true });
  } catch (err) {
    console.error('Error setting budget cap:', err);
    throw error(500, 'Failed to set budget cap');
  }
};