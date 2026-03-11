import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../../core/http";
import {
  decodeInput,
  deleteAgent,
  getAgent,
  AgentUpdateInputSchema,
  updateAgent,
} from "../../../../../../core/app";
import { fetchRuntime } from "$lib/runtime/http";

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const agentData = await runOrThrow(
    getAgent(
      createUserContext(event),
      event.params.id!,
      event.params.agentId!,
    ),
  );

  try {
    const response = await fetchRuntime(
      event,
      `/runtime/workspaces/${event.params.id!}/agents/${event.params.agentId!}`,
      { method: "GET" },
    );
    const payload = await response.json().catch(() => ({})) as {
      runtime?: unknown;
    };
    return json({
      ...agentData,
      runtime: payload.runtime ?? null,
    });
  } catch {
    return json({
      ...agentData,
      runtime: null,
    });
  }
};

export const PATCH: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(
      AgentUpdateInputSchema,
      await event.request.json().catch(() => ({})),
    ),
  );

  return json(
    await runOrThrow(
      updateAgent(ctx, event.params.id!, event.params.agentId!, input),
    ),
  );
};

export const DELETE: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");

  await runOrThrow(
    getAgent(
      createUserContext(event),
      event.params.id!,
      event.params.agentId!,
    ),
  );

  await fetchRuntime(
    event,
    `/runtime/workspaces/${event.params.id!}/agents/${event.params.agentId!}`,
    { method: "DELETE" },
  );

  return json(
    await runOrThrow(
      deleteAgent(
        createUserContext(event),
        event.params.id!,
        event.params.agentId!,
      ),
    ),
  );
};
