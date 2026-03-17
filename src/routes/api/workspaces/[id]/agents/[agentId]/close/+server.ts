import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "./$types";
import { createUserContext, runOrThrow } from "../../../../../../../core/http";
import { closeAgentConversation } from "../../../../../../../core/app";

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");

  return json(
    await runOrThrow(
      closeAgentConversation(
        createUserContext(event),
        event.params.id!,
        event.params.agentId!,
      ),
    ),
  );
};
