import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

// Get all users (admin only)
export const GET: RequestHandler = async ({ request, locals }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session || (session.user as any).role !== 'admin') {
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
    
    const data: any = await response.json();
    
    // Transform the data to match what the frontend expects
    const userData = data.users.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      createdAt: user.createdAt
    }));

    return json({ users: userData });
  } catch (error) {
    console.error('Error fetching users:', error);
    return json({ error: 'Failed to fetch users' }, { status: 500 });
  }
};
