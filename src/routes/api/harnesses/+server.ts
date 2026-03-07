import { json, error } from "@sveltejs/kit";
import { asc, eq } from "drizzle-orm";
import { getDrizzle } from "$lib/auth";
import { agentHarness } from "$lib/schema";
import type { AgentHarness } from "$lib/types/session";
import type { RequestHandler } from "./$types";

interface HarnessBody {
  id: string;
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

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  const rows = await db
    .select()
    .from(agentHarness)
    .orderBy(asc(agentHarness.name));

  const harnesses: AgentHarness[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    adapter: row.adapter,
    entryCommand: row.entryCommand,
    defaultModel: row.defaultModel,
    icon: row.icon,
    enabled: row.enabled,
    config: JSON.parse(row.config),
  }));

  return json({ harnesses });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Unauthorized");
  requireAdmin((locals.user as { role?: string }).role);

  const body = (await request.json()) as HarnessBody;
  if (
    !body.id?.trim() ||
    !body.name?.trim() ||
    !body.description?.trim() ||
    !body.adapter?.trim() ||
    !body.defaultModel?.trim() ||
    !body.icon?.trim()
  ) {
    throw error(400, "id, name, description, adapter, defaultModel, and icon are required");
  }

  const db = getDrizzle();
  const existing = await db
    .select({ id: agentHarness.id })
    .from(agentHarness)
    .where(eq(agentHarness.id, body.id.trim()));

  if (existing.length > 0) {
    throw error(409, "Harness already exists");
  }

  await db.insert(agentHarness).values({
    id: body.id.trim(),
    name: body.name.trim(),
    description: body.description.trim(),
    adapter: body.adapter.trim(),
    entryCommand: body.entryCommand?.trim() ?? "",
    defaultModel: body.defaultModel.trim(),
    icon: body.icon.trim(),
    enabled: body.enabled ?? true,
    config: JSON.stringify(body.config ?? {}),
  });

  return json({ ok: true }, { status: 201 });
};
