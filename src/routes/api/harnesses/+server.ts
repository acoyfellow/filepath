import { json, error } from "@sveltejs/kit";
import { asc } from "drizzle-orm";
import { getDrizzle } from "$lib/auth";
import { agentHarness } from "$lib/schema";
import type { AgentHarness } from "$lib/types/session";
import type { RequestHandler } from "./$types";

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
