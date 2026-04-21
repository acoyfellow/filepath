import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import {
  createAgent,
  decodeInput,
  listAgents,
  AgentCreateInputSchema,
} from "../../../../../core/app";
import { getAiConnection } from "$lib/ai-connections";

const DEFAULT_AGENT_SCOPE = {
  allowedPaths: ["."],
  forbiddenPaths: [".git", "node_modules"],
  toolPermissions: ["search", "run", "write", "commit"],
  writableRoot: ".",
};

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(listAgents(createUserContext(event), event.params.id!)));
};

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  const ctx = createUserContext(event);
  const raw = await event.request.json().catch(() => ({})) as Record<string, unknown>;

  const input = await runOrThrow(
    decodeInput(AgentCreateInputSchema, {
      ...DEFAULT_AGENT_SCOPE,
      ...raw,
    }),
  );

  // Ensure the chosen connection exists and belongs to this user.
  const connection = await getAiConnection(db, event.locals.user.id, input.aiConnectionId);
  if (!connection) {
    return json({ error: "AI connection not found" }, { status: 400 });
  }

  return json(await runOrThrow(createAgent(ctx, event.params.id!, input)), {
    status: 201,
  });
};
