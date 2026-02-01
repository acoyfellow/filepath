import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

// Get all users (admin only)
export const GET: RequestHandler = async ({ request, locals }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session || (session.user as unknown as { role?: string }).role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Make direct HTTP request to admin endpoint
    const baseUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:5173';
    const response = await fetch(`${baseUrl}/api/auth/admin/list-users`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
    }
    
    const data: unknown = await response.json();
    
    // Type guard for the response data
    if (typeof data !== 'object' || data === null || !('users' in data) || !Array.isArray((data as { users: unknown[] }).users)) {
      throw new Error('Invalid response format from auth service');
    }
    
    // Transform the data to match what the frontend expects
    const userData = (data as { users: Array<Record<string, unknown>> }).users.map((user) => ({
      id: typeof user.id === 'string' ? user.id : '',
      email: typeof user.email === 'string' ? user.email : '',
      name: typeof user.name === 'string' ? user.name : null,
      role: typeof user.role === 'string' ? user.role : 'user',
      createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(String(user.createdAt))
    }));

    return json({ users: userData });
  } catch (error) {
    console.error('Error fetching users:', error);
    return json({ error: 'Failed to fetch users' }, { status: 500 });
  }
};
