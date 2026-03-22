import { json } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../core/http";
import {
  createHarness,
  decodeInput,
  HarnessCreateInputSchema,
  listHarnesses,
} from "../../../core/app";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const ctx = createUserContext(event);
  return json(await runOrThrow(listHarnesses(ctx)));
};

export const POST: RequestHandler = async (event) => {
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(HarnessCreateInputSchema, await event.request.json()),
  );
  return json(await runOrThrow(createHarness(ctx, input)), { status: 201 });
};
