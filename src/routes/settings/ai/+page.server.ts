import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { listAiConnections } from "$lib/ai-connections";

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) {
    throw redirect(302, "/login?redirect=/settings/ai");
  }
  const db = platform?.env?.DB;
  const connections = db ? await listAiConnections(db, locals.user.id) : [];
  return {
    userId: locals.user.id,
    connections,
  };
};
