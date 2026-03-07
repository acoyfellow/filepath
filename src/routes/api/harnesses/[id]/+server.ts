import { json, error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { getDrizzle } from "$lib/auth";
import { agentHarness, agentNode } from "$lib/schema";
import type { RequestHandler } from "./$types";

interface HarnessPatchBody {
  name: string;
  description: string;
  adapter: string;
  entryCommand: string;
  defaultModel: string;
  icon: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

function requireAdmin(role: string | undefined): void {
  if (role !== "admin") {
    throw error(403, "Admin only");
  }
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Unauthorized");
  requireAdmin((locals.user as { role?: string }).role);

  const id = params.id;
  if (!id) throw error(400, "Harness id is required");

  const body = (await request.json()) as HarnessPatchBody;
  if (
    !body.name?.trim() ||
    !body.description?.trim() ||
    !body.adapter?.trim() ||
    !body.defaultModel?.trim() ||
    !body.icon?.trim()
  ) {
    throw error(400, "name, description, adapter, defaultModel, and icon are required");
  }

  const db = getDrizzle();
  const existing = await db
    .select({ id: agentHarness.id })
    .from(agentHarness)
    .where(eq(agentHarness.id, id));

  if (existing.length === 0) {
    throw error(404, "Harness not found");
  }

  await db
    .update(agentHarness)
    .set({
      name: body.name.trim(),
      description: body.description.trim(),
      adapter: body.adapter.trim(),
      entryCommand: body.entryCommand?.trim() ?? "",
      defaultModel: body.defaultModel.trim(),
      icon: body.icon.trim(),
      enabled: body.enabled ?? true,
      config: JSON.stringify(body.config ?? {}),
    })
    .where(eq(agentHarness.id, id));

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, "Unauthorized");
  requireAdmin((locals.user as { role?: string }).role);

  const id = params.id;
  if (!id) throw error(400, "Harness id is required");

  const db = getDrizzle();
  const existing = await db
    .select({ id: agentHarness.id })
    .from(agentHarness)
    .where(eq(agentHarness.id, id));

  if (existing.length === 0) {
    throw error(404, "Harness not found");
  }

  const linkedNodes = await db
    .select({ id: agentNode.id })
    .from(agentNode)
    .where(eq(agentNode.agentType, id));

  if (linkedNodes.length > 0) {
    throw error(409, "Harness is in use by existing threads");
  }

  await db.delete(agentHarness).where(eq(agentHarness.id, id));
  return json({ ok: true });
};
