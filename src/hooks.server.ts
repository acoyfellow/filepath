import { initAuth, resolveRequestAuth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { getRequestEvent } from "$app/server";

import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  try {
    if (building) {
      event.locals.user = null;
      event.locals.session = null;
      return resolve(event);
    }

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
      console.error('D1 database not available');
      return new Response('Authentication database unavailable', { status: 503 });
    }

    // Initialize auth for this origin (previews/prod/local)
    const auth = initAuth(db, event.platform?.env, event.url.origin, {
      getRequestEvent,
    });
    if (!auth) {
      console.error('Auth initialization failed');
      return new Response('Authentication service unavailable', { status: 503 });
    }

    try {
      const resolved = await resolveRequestAuth({
        db,
        env: event.platform?.env,
        baseURL: event.url.origin,
        headers: event.request.headers,
      });
      event.locals.user = resolved.user;
      event.locals.session = resolved.session as typeof event.locals.session;
    } catch (sessionError) {
      console.error('Session loading error:', sessionError);
      event.locals.user = null;
      event.locals.session = null;
    }

    const response = await svelteKitHandler({ event, resolve, auth, building });
    return response;

  } catch (criticalError) {
    console.error('Critical error in handle:', criticalError);
    return new Response('Service temporarily unavailable', { status: 503 });
  }
};
