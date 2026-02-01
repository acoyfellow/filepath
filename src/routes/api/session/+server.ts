import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { session as sessionTable, user as userTable } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// Simple ID generator
function generateId(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * POST /api/session - Create a new session for the authenticated user
 */
export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  try {
    const db = getDrizzle();
    
    // Check user's credit balance before creating session
    const users = await db.select().from(userTable).where(eq(userTable.id, locals.user.id));
    if (users.length === 0) {
      throw error(404, 'User not found');
    }
    
    const user = users[0];
    const creditBalance = user.creditBalance || 0;
    
    // Check if user has at least $10 (1000 credits)
    if (creditBalance < 1000) {
      throw error(402, 'Insufficient credits. Please add credits to your account to create a session. Minimum $10 (1000 credits) required.');
    }
    
    // Create a new session for the user
    const sessionToken = generateId(32);
    const newSession = {
      id: generateId(16),
      token: sessionToken,
      userId: locals.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '',
      userAgent: '',
    };
    
    await db.insert(sessionTable).values(newSession);
    
    return json({ 
      success: true, 
      sessionId: sessionToken, // Use the session token as the ID
      message: 'Session created successfully' 
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Insufficient credits')) {
      throw error(402, err.message);
    }
    console.error('Error creating session:', err);
    throw error(500, 'Failed to create session');
  }
};
