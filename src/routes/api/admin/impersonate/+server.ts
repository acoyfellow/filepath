import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

// Impersonate a user (admin only)
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session || (session.user as unknown as { role?: string }).role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    
    // Type guard for request body
    if (typeof body !== 'object' || body === null || !('userId' in body) || typeof (body as { userId: unknown }).userId !== 'string') {
      return json({ error: 'Invalid request body: userId is required' }, { status: 400 });
    }
    
    const { userId } = body as { userId: string };
    
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
      let errorData: unknown = {};
      try {
        errorData = await response.json();
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      // Type guard for error data
      let errorMessage = '';
      if (typeof errorData === 'object' && errorData !== null && 'message' in errorData && typeof (errorData as { message: unknown }).message === 'string') {
        errorMessage = (errorData as { message: string }).message;
      }
      
      throw new Error(`Failed to impersonate user: ${response.status} ${response.statusText} - ${errorMessage}`);
    }
    
    const impersonatedSession: unknown = await response.json();

    return json({ success: true, session: impersonatedSession });
  } catch (error) {
    console.error('Error impersonating user:', error);
    return json({ error: 'Failed to impersonate user' }, { status: 500 });
  }
};
