import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import {
  decodeInput,
  listNodes,
  NodeSpawnInputSchema,
  spawnNode,
} from "../../../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { user } from "$lib/schema";
import { decryptApiKey } from "$lib/crypto";
import { deserializeStoredProviderKeys, getProviderForModel, PROVIDERS } from "$lib/provider-keys";
import { eq } from "drizzle-orm";

function getBetterAuthSecret(platform: RequestEvent["platform"]): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

/**
 * GET /api/sessions/[id]/nodes - List all nodes in a session (flat)
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(listNodes(createUserContext(event), event.params.id!)));
};

/**
 * POST /api/sessions/[id]/nodes - Spawn a new agent node
 * Body: { name, harnessId, model, parentId?, config? }
 */
export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(NodeSpawnInputSchema, await event.request.json()),
  );

  if (!input.name.trim()) {
    return json({ error: "Name is required" }, { status: 400 });
  }

  if (!input.model.trim()) {
    return json({ error: "Choose a model before spawning an agent" }, { status: 400 });
  }

  const provider = getProviderForModel(input.model);
  const providerDefinition = PROVIDERS[provider];
  const db = getDrizzle();
  const rows = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, event.locals.user.id))
    .limit(1);

  const encryptedKeys = rows[0]?.openrouterApiKey;
  if (!encryptedKeys) {
    return json(
      { error: `Add a ${providerDefinition.label} key before spawning this agent.` },
      { status: 400 },
    );
  }

  const secret = getBetterAuthSecret(event.platform);
  if (!secret) throw error(500, "Server misconfigured");

  try {
    const decrypted = await decryptApiKey(encryptedKeys, secret);
    const providerKeys = deserializeStoredProviderKeys(decrypted);
    if (!providerKeys[provider]) {
      return json(
        { error: `Add a ${providerDefinition.label} key before spawning this agent.` },
        { status: 400 },
      );
    }
  } catch {
    return json(
      {
        error: "Stored account router keys are unreadable. Re-save them before spawning an agent.",
      },
      { status: 409 },
    );
  }

  return json(await runOrThrow(spawnNode(ctx, event.params.id!, input)), { status: 201 });
};
