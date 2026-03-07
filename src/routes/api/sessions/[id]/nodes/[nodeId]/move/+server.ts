import { error, json } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../../../core/http";
import { decodeInput, moveNode, NodeMoveInputSchema } from "../../../../../../../core/app";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(NodeMoveInputSchema, await event.request.json()),
  );
  return json(await runOrThrow(moveNode(ctx, event.params.id!, event.params.nodeId!, input)));
};
