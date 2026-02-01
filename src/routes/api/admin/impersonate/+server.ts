import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

// Impersonate a user (admin only)
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session || session.user.role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    // Create an impersonation session
    const impersonatedSession = await auth.api.impersonateUser({
      userId,
      fetchOptions: { headers: request.headers }
    });

    return json({ success: true, session: impersonatedSession });
  } catch (error) {
    console.error('Error impersonating user:', error);
    return json({ error: 'Failed to impersonate user' }, { status: 500 });
  }
};
