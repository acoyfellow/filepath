import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

// Get all users (admin only)
export const GET: RequestHandler = async ({ request, locals }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session || session.user.role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all users from the database
    const users = await auth.api.listUsers();
    
    // Transform the data to match what the frontend expects
    const userData = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    }));

    return json({ users: userData });
  } catch (error) {
    console.error('Error fetching users:', error);
    return json({ error: 'Failed to fetch users' }, { status: 500 });
  }
};
