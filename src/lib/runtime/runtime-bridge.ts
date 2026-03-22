import type { D1Database } from "@cloudflare/workers-types";
import { normalizeAgentScope, type ToolPermission } from "$lib/runtime/authority";

export interface RuntimeBridgeEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  API_WS_HOST?: string;
  /** e.g. https://api.myfilepath.com — overrides API_WS_HOST / localhost default */
  FILEPATH_RUNTIME_PUBLIC_BASE_URL?: string;
}

export interface RuntimeBridgePayload {
  workspaceId: string;
  sourceAgentId: string;
  taskId: string;
  exp: number;
}

const BRIDGE_TOKEN_TTL_SEC = 2 * 60 * 60;

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "====".slice(padded.length % 4);
  const b64 = padded + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function mintRuntimeBridgeToken(
  secret: string,
  input: { workspaceId: string; sourceAgentId: string; taskId: string },
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + BRIDGE_TOKEN_TTL_SEC;
  const payload: RuntimeBridgePayload = {
    workspaceId: input.workspaceId,
    sourceAgentId: input.sourceAgentId,
    taskId: input.taskId,
    exp,
  };
  const body = JSON.stringify(payload);
  const bodyB64 = bytesToBase64url(new TextEncoder().encode(body));
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyB64));
  const sigB64 = bytesToBase64url(new Uint8Array(sigBuf));
  return `${bodyB64}.${sigB64}`;
}

export async function verifyRuntimeBridgeToken(
  secret: string,
  token: string,
): Promise<RuntimeBridgePayload> {
  const trimmed = token.trim();
  const dot = trimmed.indexOf(".");
  if (dot < 1) {
    throw new Error("Invalid runtime bridge token.");
  }
  const bodyB64 = trimmed.slice(0, dot);
  const sigB64 = trimmed.slice(dot + 1);
  if (!bodyB64 || !sigB64) {
    throw new Error("Invalid runtime bridge token.");
  }
  const key = await hmacKey(secret);
  const sigBytes = base64urlToBytes(sigB64);
  const sig = new Uint8Array(sigBytes);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sig as BufferSource,
    new TextEncoder().encode(bodyB64),
  );
  if (!ok) {
    throw new Error("Invalid runtime bridge token.");
  }
  const bodyJson = new TextDecoder().decode(base64urlToBytes(bodyB64));
  const parsed = JSON.parse(bodyJson) as RuntimeBridgePayload;
  if (
    typeof parsed.workspaceId !== "string" ||
    typeof parsed.sourceAgentId !== "string" ||
    typeof parsed.taskId !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    throw new Error("Invalid runtime bridge token payload.");
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Runtime bridge token expired.");
  }
  return parsed;
}

export function resolveRuntimePublicBaseUrl(env: RuntimeBridgeEnv): string {
  const explicit = env.FILEPATH_RUNTIME_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const host = env.API_WS_HOST?.trim();
  if (host) return `https://${host}`;

  const auth = env.BETTER_AUTH_URL?.trim();
  if (auth?.startsWith("http://localhost") || auth?.startsWith("http://127.0.0.1")) {
    return "http://localhost:1337";
  }

  throw new Error(
    "FILEPATH_RUNTIME_PUBLIC_BASE_URL or API_WS_HOST is required to mint a runtime bridge URL.",
  );
}

async function loadToolPermissions(
  db: D1Database,
  agentId: string,
  workspaceId: string,
): Promise<ToolPermission[]> {
  const row = await db
    .prepare(
      `SELECT tool_permissions, workspace_id FROM agent WHERE id = ? LIMIT 1`,
    )
    .bind(agentId)
    .first<{ tool_permissions: string | null; workspace_id: string }>();
  if (!row || row.workspace_id !== workspaceId) {
    throw new Error("Agent not found in this workspace.");
  }
  let perms: string[] = [];
  try {
    const raw = row.tool_permissions?.trim();
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) perms = p.filter((x): x is string => typeof x === "string");
    }
  } catch {
    perms = [];
  }
  return normalizeAgentScope({ toolPermissions: perms }).toolPermissions;
}

export async function assertRuntimeBridgeCaller(
  env: RuntimeBridgeEnv,
  token: string | null,
  urlWorkspaceId: string,
): Promise<RuntimeBridgePayload> {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("Runtime bridge is not configured.");
  }
  if (!token?.trim()) {
    throw new Error("Missing X-Filepath-Runtime-Token.");
  }
  const payload = await verifyRuntimeBridgeToken(secret, token);
  if (payload.workspaceId !== urlWorkspaceId) {
    throw new Error("Runtime bridge token does not match this workspace.");
  }
  const perms = await loadToolPermissions(env.DB, payload.sourceAgentId, urlWorkspaceId);
  if (!perms.includes("cross_thread")) {
    throw new Error("This agent does not have cross-thread permission.");
  }
  return payload;
}

export async function assertTargetThreadInWorkspace(
  db: D1Database,
  targetAgentId: string,
  workspaceId: string,
): Promise<void> {
  const row = await db
    .prepare(`SELECT 1 AS ok FROM agent WHERE id = ? AND workspace_id = ? LIMIT 1`)
    .bind(targetAgentId, workspaceId)
    .first<{ ok: number }>();
  if (!row) {
    throw new Error("Target thread not found in this workspace.");
  }
}

export async function listWorkspaceThreadsForBridge(
  db: D1Database,
  workspaceId: string,
): Promise<{
  count: number;
  threads: Array<{
    id: string;
    name: string;
    status: string;
    closedAt: number | null;
  }>;
}> {
  const { results = [] } = await db
    .prepare(
      `SELECT id, name, status, closed_at
         FROM agent
        WHERE workspace_id = ?
        ORDER BY updated_at DESC`,
    )
    .bind(workspaceId)
    .all<{ id: string; name: string; status: string; closed_at: number | null }>();

  const threads = results.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    closedAt: r.closed_at ?? null,
  }));

  return { count: threads.length, threads };
}

export async function getThreadLastMessageForBridge(
  db: D1Database,
  workspaceId: string,
  targetAgentId: string,
): Promise<{ role: string; content: string; createdAt: number } | null> {
  await assertTargetThreadInWorkspace(db, targetAgentId, workspaceId);

  const row = await db
    .prepare(
      `SELECT role, content, created_at
         FROM agent_message
        WHERE agent_id = ?
        ORDER BY created_at DESC
        LIMIT 1`,
    )
    .bind(targetAgentId)
    .first<{ role: string; content: string; created_at: number }>();

  if (!row) return null;
  return { role: row.role, content: row.content, createdAt: row.created_at };
}
