import { initAuth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { error } from "@sveltejs/kit";

import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  try {
    // Handle API reference path - Better Auth Scalar UI has issues in dev
    if (event.url.pathname === '/api/auth/reference' || event.url.pathname === '/api/auth/reference/') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>filepath API Reference</title></head>
        <body style="font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto;">
          <h1>API Reference</h1>
          <p>The interactive Scalar UI is available in production.</p>
          <p>In development, view the OpenAPI spec directly:</p>
          <p><a href="/api/openapi.json">/api/openapi.json</a></p>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200
      });
    }
    
    const db = event.platform?.env?.DB;
    if (!db) {
      // D1 not available — serve page without auth (better than hard 500)
      console.warn('D1 database not available, serving without auth');
      event.locals.user = null;
      event.locals.session = null;
      return await resolve(event);
    }

    // Initialize auth for this origin (previews/prod/local)
    const auth = initAuth(db, event.platform?.env, event.url.origin);

    if (auth) {
      try {
        const session = await auth.api.getSession({
          headers: event.request.headers,
        });
        event.locals.user = session?.user || null;
        event.locals.session = session?.session || null;
      } catch (sessionError) {
        console.error('Session loading error:', sessionError);
        event.locals.user = null;
        event.locals.session = null;
      }
    } else {
      event.locals.user = null;
      event.locals.session = null;
    }

    const response = await svelteKitHandler({ event, resolve, auth: auth ?? undefined, building });
    return response;

  } catch (criticalError) {
    console.error('Critical error in handle:', criticalError);

    // Graceful fallback - serve app without auth
    event.locals.user = null;
    event.locals.session = null;

    try {
      return await resolve(event);
    } catch (resolveError) {
      console.error('Failed to resolve even without auth:', resolveError);
      return error(500, 'Service temporarily unavailable');
    }
  }
};
