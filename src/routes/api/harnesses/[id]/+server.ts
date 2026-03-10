import { json } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../core/http";
import {
  decodeInput,
  deleteHarness,
  HarnessUpdateInputSchema,
  updateHarness,
} from "../../../../core/app";
import type { RequestHandler } from "./$types";
export const PATCH: RequestHandler = async (event) => {
  const ctx = createUserContext(event);
  const id = event.params.id;
  const input = await runOrThrow(
    decodeInput(HarnessUpdateInputSchema, await event.request.json()),
  );
  return json(await runOrThrow(updateHarness(ctx, id, input)));
};

export const DELETE: RequestHandler = async (event) => {
  const ctx = createUserContext(event);
  return json(await runOrThrow(deleteHarness(ctx, event.params.id)));
};
