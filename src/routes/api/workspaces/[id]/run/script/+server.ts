import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "./$types";
import { createUserContext, runOrThrow } from "../../../../../../core/http";
import { decodeInput, getWorkspace, WorkerScriptRunInputSchema } from "../../../../../../core/app";
import { fetchRuntime } from "$lib/runtime/http";
import type { WorkerRunResponse } from "$lib/types/workspace";

const SCRIPT_MAX_BYTES = 32 * 1024;

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");

  const raw = await event.request.json().catch(() => ({}));
  const input = await runOrThrow(decodeInput(WorkerScriptRunInputSchema, raw));

  const scriptBytes = new TextEncoder().encode(input.script).length;
  if (scriptBytes > SCRIPT_MAX_BYTES) {
    throw error(400, `Script exceeds ${SCRIPT_MAX_BYTES / 1024}KB limit`);
  }

  const workspaceId = event.params.id!;
  const ctx = createUserContext(event);

  await runOrThrow(getWorkspace(ctx, workspaceId));

  const response = await fetchRuntime(
    event,
    `/runtime/workspaces/${workspaceId}/run/script`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: input.script,
        scope: input.scope,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: {
      status: string;
      summary: string;
      commands?: Array<{ command: string; exitCode: number | null }>;
      filesTouched?: string[];
      violations?: string[];
      diffSummary?: string | null;
      patch?: string | null;
      commit?: { sha: string; message: string } | null;
      startedAt: number;
      finishedAt: number;
    };
    error?: string;
  };

  if (!response.ok) {
    throw error(response.status, payload.error ?? "Script run failed");
  }

  if (!payload.ok || !payload.result) {
    throw error(500, "Invalid runtime response");
  }

  const result = payload.result;
  const runId = crypto.randomUUID();

  const body: WorkerRunResponse = {
    status: result.status as WorkerRunResponse["status"],
    summary: result.summary,
    events: [],
    filesTouched: result.filesTouched ?? [],
    violations: result.violations ?? [],
    diffSummary: result.diffSummary ?? null,
    patch: result.patch ?? null,
    commit: result.commit ?? null,
    agentId: "",
    runId,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
  };

  return json(body, { status: 200 });
};
