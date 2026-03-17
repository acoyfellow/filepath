import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "./$types";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import {
  decodeInput,
  getAgent,
  createAgentForRun,
  WorkerRunInputSchema,
} from "../../../../../core/app";
import { fetchRuntime } from "$lib/runtime/http";
import type { WorkerRunResponse } from "$lib/types/workspace";

const CONTENT_MAX_BYTES = 64 * 1024;

function toWorkerRunResponse(
  result: {
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
  },
  events: unknown[],
  agentId: string,
  runId: string,
  identity: {
    traceId: string | null;
    workspaceId: string;
    conversationId: string;
    proofRunId: string | null;
    proofIterationId: string | null;
  },
): WorkerRunResponse {
  return {
    status: result.status as WorkerRunResponse["status"],
    summary: result.summary,
    events: events as WorkerRunResponse["events"],
    filesTouched: result.filesTouched ?? [],
    violations: result.violations ?? [],
    diffSummary: result.diffSummary ?? null,
    patch: result.patch ?? null,
    commit: result.commit ?? null,
    agentId,
    runId,
    traceId: identity.traceId,
    workspaceId: identity.workspaceId,
    conversationId: identity.conversationId,
    proofRunId: identity.proofRunId,
    proofIterationId: identity.proofIterationId,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
  };
}

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");

  const raw = await event.request.json().catch(() => ({}));
  const input = await runOrThrow(decodeInput(WorkerRunInputSchema, raw));

  const contentBytes = new TextEncoder().encode(input.content).length;
  if (contentBytes > CONTENT_MAX_BYTES) {
    throw error(400, `Task content exceeds ${CONTENT_MAX_BYTES / 1024}KB limit`);
  }

  const workspaceId = event.params.id!;
  const ctx = createUserContext(event);

  let agentId: string;
  if (input.agentId) {
    const { agent } = await runOrThrow(getAgent(ctx, workspaceId, input.agentId));
    agentId = agent.id;
  } else {
    const { id } = await runOrThrow(createAgentForRun(ctx, workspaceId, input));
    agentId = id;
  }

  const response = await fetchRuntime(
    event,
    `/runtime/workspaces/${workspaceId}/agents/${agentId}/tasks?wait=1`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-filepath-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        content: input.content,
        identity: input.identity,
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
    events?: unknown[];
  };

  if (!response.ok) {
    throw error(response.status, (payload as { error?: string }).error ?? "Runtime request failed");
  }

  if (!payload.ok || !payload.result) {
    throw error(500, "Invalid runtime response");
  }

  const accepted = payload as { result: typeof payload.result; events?: unknown[]; taskId?: string };
  const runId = accepted.taskId ?? crypto.randomUUID();
  const result = accepted.result!;

  const body = toWorkerRunResponse(
    result,
    accepted.events ?? [],
    agentId,
    runId,
    {
      traceId: input.identity?.traceId ?? runId,
      workspaceId,
      conversationId: agentId,
      proofRunId: input.identity?.proofRunId ?? null,
      proofIterationId: input.identity?.proofIterationId ?? null,
    },
  );

  return json(body, { status: 200 });
};
