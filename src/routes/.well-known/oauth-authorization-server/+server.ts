import type { RequestHandler } from "./$types";
import { initAuth } from "../../../lib/auth";

/**
 * OAuth Discovery Metadata for MCP
 * Required for MCP clients to find auth endpoints
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
  
  // Return OAuth server metadata
  return new Response(JSON.stringify({
    issuer: url.origin,
    authorization_endpoint: `${url.origin}/api/auth/authorize`,
    token_endpoint: `${url.origin}/api/auth/token`,
    jwks_uri: `${url.origin}/api/auth/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['openid', 'profile', 'email'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256']
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
