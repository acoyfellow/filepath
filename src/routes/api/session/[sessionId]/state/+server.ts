import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  const { sessionId } = params;
  
  if (!platform?.env?.SESSION_DO) {
    return new Response(JSON.stringify({ error: 'SESSION_DO not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const id = platform.env.SESSION_DO.idFromName(sessionId);
    const stub = platform.env.SESSION_DO.get(id);
    const response = await stub.fetch(new Request('http://do/state'));
    const state = await response.json();
    
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[session/state]', error);
    return new Response(JSON.stringify({ error: 'Failed to get session state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
