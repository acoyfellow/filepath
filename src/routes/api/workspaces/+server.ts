import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../core/http";
import {
  createWorkspace,
  decodeInput,
  listWorkspaces,
  WorkspaceCreateInputSchema,
} from "../../../core/app";

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(listWorkspaces(createUserContext(event))));
};

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(
      WorkspaceCreateInputSchema,
      await event.request.json().catch(() => ({})),
    ),
  );
  return json(await runOrThrow(createWorkspace(ctx, input)), { status: 201 });
};
