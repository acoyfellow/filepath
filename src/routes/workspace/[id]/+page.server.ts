import { redirect, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { workspace, agent, user } from "$lib/schema";
import { eq, and, desc } from "drizzle-orm";
import type { ServerLoadEvent } from "@sveltejs/kit";
import { decryptApiKey } from "$lib/crypto";
import {
  deserializeStoredProviderKeys,
  maskProviderKeys,
} from "$lib/provider-keys";

function getBetterAuthSecret(
  platform: ServerLoadEvent["platform"],
): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

export const load = async ({ params, locals, platform }: ServerLoadEvent) => {
  if (!locals.user) throw redirect(302, "/");

  const db = getDrizzle();

  const workspaces = await db
    .select()
    .from(workspace)
    .where(
      and(eq(workspace.id, params.id as string), eq(workspace.userId, locals.user.id)),
    );

  if (workspaces.length === 0) throw error(404, "Workspace not found");

  const currentWorkspace = workspaces[0];

  const agents = await db
    .select()
    .from(agent)
    .where(eq(agent.workspaceId, params.id as string))
    .orderBy(desc(agent.updatedAt), desc(agent.createdAt));

  const users = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, locals.user.id));

  let accountKeysMasked = { openrouter: null, zen: null } as {
    openrouter: string | null;
    zen: string | null;
  };
  let accountKeysError: string | null = null;

  const encryptedKeys = users[0]?.openrouterApiKey;
  const secret = getBetterAuthSecret(platform);
  if (encryptedKeys && secret) {
    try {
      const decrypted = await decryptApiKey(encryptedKeys, secret);
      accountKeysMasked = maskProviderKeys(
        deserializeStoredProviderKeys(decrypted),
      );
    } catch {
      accountKeysMasked = { openrouter: null, zen: null };
      accountKeysError =
        "Stored provider keys are unreadable. Re-save them in Settings -> Account.";
    }
  }

  return {
    user: locals.user,
    workspace: currentWorkspace,
    agents,
    accountKeysMasked,
    accountKeysError,
  };
};
