import { json } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { user } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/admin/make-admin
 * One-time endpoint to promote a user to admin
 * Body: { email: string }
 * 
 * SECURITY: This allows anyone to make themselves admin.
 * Only use in development or remove after use!
 */
export const POST: RequestHandler = async ({ request }) => {
  const { email } = await request.json() as { email: string };
  
  if (!email) {
    return json({ error: 'Email required' }, { status: 400 });
  }
  
  try {
    const db = getDrizzle();
    
    // Check if user exists
    const users = await db.select().from(user).where(eq(user.email, email));
    
    if (users.length === 0) {
      return json({ error: 'User not found' }, { status: 404 });
    }
    
    // Promote to admin
    await db.update(user)
      .set({ role: 'admin' })
      .where(eq(user.email, email));
    
    return json({ 
      success: true, 
      message: `${email} is now an admin`,
      userId: users[0].id 
    });
  } catch (err) {
    console.error('Error promoting user:', err);
    return json({ error: 'Failed to promote user' }, { status: 500 });
  }
};
