import type { RequestHandler } from "./$types";
import { initAuth } from "../../../lib/auth";

/**
 * OAuth Protected Resource Metadata for MCP
 * Tells MCP clients how to authenticate to access resources
 */
export const GET: RequestHandler = async ({ platform, url }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const auth = initAuth(db, platform?.env as Record<string, unknown>, url.origin);
  
  // Return protected resource metadata
  return new Response(JSON.stringify({
    resource: `${url.origin}/mcp`,
    authorization_servers: [url.origin],
    jwks_uri: `${url.origin}/api/auth/jwks`,
    scopes_supported: [
      'sessions:read',
      'sessions:write', 
      'nodes:read',
      'nodes:write',
      'chat:send',
      'chat:receive'
    ],
    bearer_methods_supported: ['header', 'body'],
    resource_signing_alg_values_supported: ['RS256']
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
