import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "./$types";
import { createUserContext, runOrThrow } from "../../../../../../../core/http";
import {
  decodeInput,
  getAgent,
  AgentTaskInputSchema,
} from "../../../../../../../core/app";
import { fetchRuntime } from "$lib/runtime/http";

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");

  await runOrThrow(
    getAgent(createUserContext(event), event.params.id!, event.params.agentId!),
  );
  const input = await runOrThrow(
    decodeInput(
      AgentTaskInputSchema,
      await event.request.json().catch(() => ({})),
    ),
  );

  const response = await fetchRuntime(
    event,
    `/runtime/workspaces/${event.params.id!}/agents/${event.params.agentId!}/tasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  const payload = await response.json().catch(() => ({ error: "Runtime request failed" }));
  return json(payload, { status: response.status });
};
