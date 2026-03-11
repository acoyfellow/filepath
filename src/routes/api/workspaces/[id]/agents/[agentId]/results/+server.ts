import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../../../core/http";
import { getAgent, listAgentResults } from "../../../../../../../core/app";

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");

  await runOrThrow(
    getAgent(
      createUserContext(event),
      event.params.id!,
      event.params.agentId!,
    ),
  );

  const limit = Math.min(
    50,
    Math.max(1, parseInt(event.url.searchParams.get("limit") ?? "20", 10) || 20),
  );

  return json(
    await runOrThrow(
      listAgentResults(
        createUserContext(event),
        event.params.id!,
        event.params.agentId!,
        limit,
      ),
    ),
  );
};
