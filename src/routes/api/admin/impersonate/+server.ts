import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

// Impersonate a user (admin only)
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session || (session.user as any).role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    // Make direct HTTP request to admin endpoint
    const baseUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:5173';
    const response = await fetch(`${baseUrl}/api/auth/admin/impersonate-user`, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to impersonate user: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
    }
    
    const impersonatedSession = await response.json();

    return json({ success: true, session: impersonatedSession });
  } catch (error) {
    console.error('Error impersonating user:', error);
    return json({ error: 'Failed to impersonate user' }, { status: 500 });
  }
};
