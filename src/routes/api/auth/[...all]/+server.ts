import type { RequestHandler } from "./$types";
import { initAuth } from "$lib/auth";

export const GET: RequestHandler = async (event) => {
  try {
    // Check if this is the OpenAPI reference path - handle without DB if needed
    const url = new URL(event.request.url);
    if (url.pathname === '/api/auth/reference' || url.pathname === '/api/auth/reference/') {
      // For local dev without DB, serve a basic HTML redirect or error
      if (!event.platform?.env?.DB) {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>filepath API Reference</title></head>
          <body style="font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto;">
            <h1>API Reference</h1>
            <p>The interactive API documentation is available in production.</p>
            <p>In development, you can view the OpenAPI spec at <code>/api/openapi.json</code></p>
            <p><a href="/api/openapi.json">View OpenAPI Spec</a></p>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
          status: 200
        });
      }
    }
    
    const db = event.platform?.env?.DB;
    if (!db) throw new Error("D1 database not available");
    const auth = initAuth(db, event.platform?.env, event.url.origin);
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
    const auth = initAuth(db, event.platform?.env, event.url.origin);
    if (!auth) throw new Error("Auth initialization failed");
    
    // Handle auth request and capture response
    const response = await auth.handler(event.request);
    
    // If it's a 500, try to log the body for debugging
    if (response.status === 500) {
      const cloned = response.clone();
      try {
        const body = await cloned.text();
        console.error('Auth handler returned 500:', body);
      } catch (e) {
        console.error('Auth handler returned 500 with unreadable body');
      }
    }
    
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
