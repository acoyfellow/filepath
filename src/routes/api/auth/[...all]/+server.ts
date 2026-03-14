import type { RequestHandler } from "./$types";
import { initAuth } from "$lib/auth";
import { getRequestEvent } from "$app/server";

export const GET: RequestHandler = async (event) => {
  try {
    // ALWAYS handle reference path first, before any DB checks
    const pathname = event.url.pathname;
    if (pathname === '/api/auth/reference' || pathname === '/api/auth/reference/') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>filepath API Reference</title></head>
        <body style="font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto;">
          <h1>API Reference</h1>
          <p>Development mode reference page.</p>
          <p><a href="/api/openapi.json">View OpenAPI Spec</a></p>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 200
      });
    }
    
    const db = event.platform?.env?.DB;
    if (!db) throw new Error("D1 database not available");
    const auth = initAuth(db, event.platform?.env, event.url.origin, {
      getRequestEvent,
    });
    if (!auth) throw new Error("Auth initialization failed");
    return await auth.handler(event.request);
  } catch (error) {
    console.error('Auth GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Authentication service temporarily unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const db = event.platform?.env?.DB;
    if (!db) throw new Error("D1 database not available");
    const auth = initAuth(db, event.platform?.env, event.url.origin, {
      getRequestEvent,
    });
    if (!auth) throw new Error("Auth initialization failed");

    const response = await auth.handler(event.request);
    return response;
  } catch (error) {
    console.error('Auth POST error:', error);
    return new Response(
      JSON.stringify({ error: 'Authentication service temporarily unavailable', details: String(error) }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
