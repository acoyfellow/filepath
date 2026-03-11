import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import {
  createAgent,
  decodeInput,
  listAgents,
  AgentCreateInputSchema,
} from "../../../../../core/app";
import { getDrizzle } from "$lib/auth";
import { user } from "$lib/schema";
import { decryptApiKey } from "$lib/crypto";
import { deserializeStoredProviderKeys, getProviderForModel, PROVIDERS } from "$lib/provider-keys";
import { eq } from "drizzle-orm";

const DEFAULT_AGENT_SCOPE = {
  allowedPaths: ["."],
  forbiddenPaths: [".git", "node_modules"],
  toolPermissions: ["search", "run", "write", "commit"],
  writableRoot: ".",
};

function getBetterAuthSecret(platform: RequestEvent["platform"]): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

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
      { error: `Add a ${providerDefinition.label} key before creating this agent.` },
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
        { error: `Add a ${providerDefinition.label} key before creating this agent.` },
        { status: 400 },
      );
    }
  } catch {
    return json(
      {
        error: "Stored account router keys are unreadable. Re-save them before creating an agent.",
      },
      { status: 409 },
    );
  }

  return json(await runOrThrow(createAgent(ctx, event.params.id!, input)), {
    status: 201,
  });
};
