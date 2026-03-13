import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import {
  createAgent,
  decodeInput,
  listAgents,
  AgentCreateInputSchema,
} from "../../../../../core/app";
import { ensureProviderKeyForModel } from "$lib/server/provider-access";

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
  const ctx = createUserContext(event);
  const raw = await event.request.json().catch(() => ({})) as Record<string, unknown>;

  const input = await runOrThrow(
    decodeInput(AgentCreateInputSchema, {
      ...DEFAULT_AGENT_SCOPE,
      ...raw,
    }),
  );

  const access = await ensureProviderKeyForModel({
    userId: event.locals.user.id,
    model: input.model,
    platform: event.platform,
  });
  if (!("ok" in access)) {
    return json({ error: access.error }, { status: access.status });
  }

  return json(await runOrThrow(createAgent(ctx, event.params.id!, input)), {
    status: 201,
  });
};
