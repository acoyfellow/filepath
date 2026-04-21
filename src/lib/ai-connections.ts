/**
 * AI connection helpers — DB-side integration with `@acoyfellow/ai-connect`.
 *
 * This module is the ONLY place filepath should touch inference endpoints.
 * Everything upstream (routes, agent-runtime, UI) goes through these helpers.
 *
 * Shape: aiConnection rows in D1 + ai-connect for encryption + dispatch.
 */

import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import {
  callModel as acCallModel,
  decryptKey,
  encryptKey,
  testConnection as acTestConnection,
  DEFAULT_ENDPOINTS,
  type AIConnection as AcAIConnection,
  type CallOptions,
  type CallResult,
  type ChatMessage,
  type ProviderFormat,
  type TestResult,
} from "@acoyfellow/ai-connect";
import { aiConnection, user } from "./schema";

// =============================================================================
// types
// =============================================================================

/** Public-facing shape — api key never leaves the server. */
export interface AiConnectionPublic {
  id: string;
  displayName: string;
  provider: ProviderFormat;
  endpoint: string;
  model: string;
  maxContextTokens: number;
  tags: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAiConnectionInput {
  displayName: string;
  provider: ProviderFormat;
  /** When omitted, the default endpoint for `provider` is used. */
  endpoint?: string;
  model: string;
  apiKey: string;
  maxContextTokens?: number;
  tags?: string[];
  /** When true, sets this as the user's default connection. */
  setAsDefault?: boolean;
}

export interface UpdateAiConnectionInput {
  displayName?: string;
  provider?: ProviderFormat;
  endpoint?: string;
  model?: string;
  /** Only replaces the stored key when a non-empty string is provided. */
  apiKey?: string;
  maxContextTokens?: number;
  tags?: string[];
  setAsDefault?: boolean;
}

// =============================================================================
// guards / validation
// =============================================================================

export const PROVIDER_FORMATS: ProviderFormat[] = [
  "anthropic",
  "openai-chat",
  "openai-responses",
  "gemini",
];

export function isProviderFormat(value: unknown): value is ProviderFormat {
  return typeof value === "string" && (PROVIDER_FORMATS as string[]).includes(value);
}

function normalizeDisplayName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("displayName is required");
  if (trimmed.length > 80) throw new Error("displayName must be ≤ 80 characters");
  return trimmed;
}

function normalizeEndpoint(value: string | undefined, provider: ProviderFormat): string {
  const fallback = DEFAULT_ENDPOINTS[provider];
  if (!value || !value.trim()) return fallback;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`endpoint must be http(s): ${parsed.protocol}`);
    }
    return parsed.href;
  } catch {
    throw new Error(`invalid endpoint URL: ${value}`);
  }
}

function normalizeModel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("model is required");
  if (trimmed.length > 200) throw new Error("model must be ≤ 200 characters");
  return trimmed;
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t): t is string => t.length > 0 && t.length <= 32)
    .slice(0, 16);
}

// =============================================================================
// row <-> public shape
// =============================================================================

type RawAiConnectionRow = typeof aiConnection.$inferSelect;

function rowToPublic(row: RawAiConnectionRow, userDefaultId: string | null): AiConnectionPublic {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === "string");
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    displayName: row.displayName,
    provider: row.provider as ProviderFormat,
    endpoint: row.endpoint,
    model: row.model,
    maxContextTokens: row.maxContextTokens,
    tags,
    isDefault: userDefaultId === row.id,
    createdAt: row.createdAt.getTime?.() ?? Number(row.createdAt),
    updatedAt: row.updatedAt.getTime?.() ?? Number(row.updatedAt),
  };
}

function rowToAcConnection(row: RawAiConnectionRow, userId: string, isDefault: boolean): AcAIConnection {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === "string");
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    userId,
    displayName: row.displayName,
    provider: row.provider as ProviderFormat,
    endpoint: row.endpoint,
    model: row.model,
    apiKeyEncrypted: row.apiKeyEncrypted,
    maxContextTokens: row.maxContextTokens,
    tags,
    isDefault,
    createdAt: row.createdAt.getTime?.() ?? Number(row.createdAt),
    updatedAt: row.updatedAt.getTime?.() ?? Number(row.updatedAt),
  };
}

// =============================================================================
// CRUD
// =============================================================================

export async function listAiConnections(
  db: D1Database,
  userId: string,
): Promise<AiConnectionPublic[]> {
  const orm = drizzle(db);
  const [userRow] = await orm
    .select({ defaultAiConnectionId: user.defaultAiConnectionId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const defaultId = userRow?.defaultAiConnectionId ?? null;
  const rows = await orm
    .select()
    .from(aiConnection)
    .where(eq(aiConnection.userId, userId))
    .orderBy(desc(aiConnection.createdAt));
  return rows.map((r) => rowToPublic(r, defaultId));
}

export async function getAiConnection(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AiConnectionPublic | null> {
  const orm = drizzle(db);
  const [row] = await orm
    .select()
    .from(aiConnection)
    .where(and(eq(aiConnection.userId, userId), eq(aiConnection.id, id)))
    .limit(1);
  if (!row) return null;
  const [userRow] = await orm
    .select({ defaultAiConnectionId: user.defaultAiConnectionId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rowToPublic(row, userRow?.defaultAiConnectionId ?? null);
}

export async function createAiConnection(
  db: D1Database,
  secret: string,
  userId: string,
  input: CreateAiConnectionInput,
): Promise<AiConnectionPublic> {
  if (!isProviderFormat(input.provider)) {
    throw new Error(`unknown provider: ${String(input.provider)}`);
  }
  if (!input.apiKey || !input.apiKey.trim()) {
    throw new Error("apiKey is required");
  }
  const displayName = normalizeDisplayName(input.displayName);
  const endpoint = normalizeEndpoint(input.endpoint, input.provider);
  const model = normalizeModel(input.model);
  const maxContextTokens = Math.min(
    Math.max(1_024, Math.trunc(input.maxContextTokens ?? 128_000)),
    2_000_000,
  );
  const tags = normalizeTags(input.tags);
  const apiKeyEncrypted = await encryptKey(input.apiKey.trim(), secret);
  const id = crypto.randomUUID();

  const orm = drizzle(db);
  await orm.insert(aiConnection).values({
    id,
    userId,
    displayName,
    provider: input.provider,
    endpoint,
    model,
    apiKeyEncrypted,
    maxContextTokens,
    tags: JSON.stringify(tags),
  });

  // First connection auto-becomes default; explicit setAsDefault overrides anyway.
  const count = await orm
    .select({ id: aiConnection.id })
    .from(aiConnection)
    .where(eq(aiConnection.userId, userId));
  const shouldSetDefault = input.setAsDefault === true || count.length === 1;
  if (shouldSetDefault) {
    await orm.update(user).set({ defaultAiConnectionId: id }).where(eq(user.id, userId));
  }

  const created = await getAiConnection(db, userId, id);
  if (!created) throw new Error("Created connection not readable");
  return created;
}

export async function updateAiConnection(
  db: D1Database,
  secret: string,
  userId: string,
  id: string,
  input: UpdateAiConnectionInput,
): Promise<AiConnectionPublic> {
  const orm = drizzle(db);
  const [existing] = await orm
    .select()
    .from(aiConnection)
    .where(and(eq(aiConnection.userId, userId), eq(aiConnection.id, id)))
    .limit(1);
  if (!existing) throw new Error("connection not found");

  const patch: Partial<RawAiConnectionRow> = {};
  const provider: ProviderFormat =
    input.provider && isProviderFormat(input.provider)
      ? input.provider
      : (existing.provider as ProviderFormat);
  if (input.provider && !isProviderFormat(input.provider)) {
    throw new Error(`unknown provider: ${String(input.provider)}`);
  }
  if (input.provider) patch.provider = provider;
  if (input.displayName !== undefined) patch.displayName = normalizeDisplayName(input.displayName);
  if (input.endpoint !== undefined) patch.endpoint = normalizeEndpoint(input.endpoint, provider);
  if (input.model !== undefined) patch.model = normalizeModel(input.model);
  if (input.maxContextTokens !== undefined) {
    patch.maxContextTokens = Math.min(
      Math.max(1_024, Math.trunc(input.maxContextTokens)),
      2_000_000,
    );
  }
  if (input.tags !== undefined) patch.tags = JSON.stringify(normalizeTags(input.tags));
  if (input.apiKey && input.apiKey.trim()) {
    patch.apiKeyEncrypted = await encryptKey(input.apiKey.trim(), secret);
  }

  if (Object.keys(patch).length > 0) {
    await orm
      .update(aiConnection)
      .set(patch)
      .where(and(eq(aiConnection.userId, userId), eq(aiConnection.id, id)));
  }

  if (input.setAsDefault === true) {
    await orm.update(user).set({ defaultAiConnectionId: id }).where(eq(user.id, userId));
  }

  const updated = await getAiConnection(db, userId, id);
  if (!updated) throw new Error("Updated connection not readable");
  return updated;
}

export async function deleteAiConnection(
  db: D1Database,
  userId: string,
  id: string,
): Promise<{ ok: true }> {
  const orm = drizzle(db);
  await orm
    .delete(aiConnection)
    .where(and(eq(aiConnection.userId, userId), eq(aiConnection.id, id)));

  // If this was the default, clear the FK (null is fine; UI will nudge the user).
  await orm
    .update(user)
    .set({ defaultAiConnectionId: null })
    .where(and(eq(user.id, userId), eq(user.defaultAiConnectionId, id)));

  return { ok: true };
}

// =============================================================================
// dispatch + test — thin passthroughs to @acoyfellow/ai-connect
// =============================================================================

async function loadAcConnection(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AcAIConnection | null> {
  const orm = drizzle(db);
  const [row] = await orm
    .select()
    .from(aiConnection)
    .where(and(eq(aiConnection.userId, userId), eq(aiConnection.id, id)))
    .limit(1);
  if (!row) return null;
  const [userRow] = await orm
    .select({ defaultAiConnectionId: user.defaultAiConnectionId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rowToAcConnection(row, userId, userRow?.defaultAiConnectionId === id);
}

export interface CallAiModelInput {
  connectionId: string;
  messages: ChatMessage[];
  options?: CallOptions;
}

export async function callAiModel(
  db: D1Database,
  secret: string,
  userId: string,
  input: CallAiModelInput,
): Promise<CallResult> {
  const conn = await loadAcConnection(db, userId, input.connectionId);
  if (!conn) throw new Error("connection not found");
  return await acCallModel({
    connection: conn,
    secret,
    messages: input.messages,
    options: input.options,
  });
}

export async function testAiConnection(
  db: D1Database,
  secret: string,
  userId: string,
  connectionId: string,
): Promise<TestResult> {
  const conn = await loadAcConnection(db, userId, connectionId);
  if (!conn) {
    return { ok: false, error: "connection not found", durationMs: 0 };
  }
  return await acTestConnection({ connection: conn, secret });
}

/**
 * Decrypt the raw API key — ONLY call server-side for legitimate passthrough
 * (e.g. when we need to hand the key to a subprocess adapter). Never send
 * the result back to the browser.
 */
export async function decryptConnectionKey(
  db: D1Database,
  secret: string,
  userId: string,
  connectionId: string,
): Promise<string | null> {
  const conn = await loadAcConnection(db, userId, connectionId);
  if (!conn) return null;
  return await decryptKey(conn.apiKeyEncrypted, secret);
}

/** Resolve a connection for use by the agent runtime, or null if missing. */
export async function resolveAgentConnection(
  db: D1Database,
  userId: string,
  connectionId: string,
): Promise<AiConnectionPublic | null> {
  return await getAiConnection(db, userId, connectionId);
}

// Re-exports so callers don't have to import from two places.
export type { ChatMessage, CallOptions, CallResult, TestResult, ProviderFormat };
