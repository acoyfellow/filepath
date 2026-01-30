import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform }) => {
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
    const response = await stub.fetch(new Request('http://do/tab', { method: 'POST' }));
    const result = await response.json();
    
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[session/tab]', error);
    return new Response(JSON.stringify({ error: 'Failed to create tab' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
