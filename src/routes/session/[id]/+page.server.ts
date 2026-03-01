import { redirect, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode, user } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { ServerLoadEvent } from "@sveltejs/kit";
import { decryptApiKey } from "$lib/crypto";
import { deserializeStoredProviderKeys, maskProviderKeys } from "$lib/provider-keys";

function getBetterAuthSecret(platform: ServerLoadEvent["platform"]): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

export const load = async ({ params, locals, platform }: ServerLoadEvent) => {
  if (!locals.user) throw redirect(302, "/");

  const db = getDrizzle();

  // Fetch session
  const sessions = await db
    .select()
    .from(agentSession)
    .where(
      and(
        eq(agentSession.id, params.id as string),
        eq(agentSession.userId, locals.user.id),
      ),
    );

  if (sessions.length === 0) throw error(404, "Session not found");

  const session = sessions[0];

  // Fetch nodes
  const nodes = await db
    .select()
    .from(agentNode)
    .where(eq(agentNode.sessionId, params.id as string))
    .orderBy(agentNode.sortOrder);

  // Fetch user's API key (server-side, no flicker!)
  const users = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, locals.user.id));

  let accountKeysMasked = { openrouter: null, zen: null } as {
    openrouter: string | null;
    zen: string | null;
  };

  const encryptedKeys = users[0]?.openrouterApiKey;
  const secret = getBetterAuthSecret(platform);
  if (encryptedKeys && secret) {
    try {
      const decrypted = await decryptApiKey(encryptedKeys, secret);
      accountKeysMasked = maskProviderKeys(deserializeStoredProviderKeys(decrypted));
    } catch {
      accountKeysMasked = { openrouter: null, zen: null };
    }
  }

  return {
    user: locals.user,
    session,
    nodes,
    accountKeysMasked,
  };
};
