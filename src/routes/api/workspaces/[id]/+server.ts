import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import {
  createUserContext,
  runOrThrow,
} from "../../../../core/http";
import {
  decodeInput,
  deleteWorkspace,
  getWorkspace,
  WorkspaceUpdateInputSchema,
  updateWorkspace,
} from "../../../../core/app";

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(getWorkspace(createUserContext(event), event.params.id!)));
};

export const PATCH: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(
      WorkspaceUpdateInputSchema,
      await event.request.json().catch(() => ({})),
    ),
  );
  return json(await runOrThrow(updateWorkspace(ctx, event.params.id!, input)));
};

export const DELETE: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(deleteWorkspace(createUserContext(event), event.params.id!)));
};
