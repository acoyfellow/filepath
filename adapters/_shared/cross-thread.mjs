/**
 * Shared runtime bridge for same-workspace cross-thread tools.
 * JSON harnesses use bridge actions inside `run-adapter.mjs`.
 * CLI/subprocess harnesses (e.g. Hermes) use `runCrossThreadPreflightBeforeSubprocess` first.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const CROSS_THREAD_ACTION_HELP =
  'Cross-thread (same workspace only): {"action":"list_threads"}; {"action":"thread_last","agentId":"..."}; {"action":"thread_snapshot","agentId":"..."}; {"action":"thread_send","agentId":"...","content":"..."}';

export function crossThreadPermissionFromEnv() {
  const raw = process.env.FILEPATH_TOOL_PERMISSIONS?.trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.includes("cross_thread");
  } catch {
    return false;
  }
}

export function assertCrossThread() {
  if (!crossThreadPermissionFromEnv()) {
    throw new Error("Cross-thread actions require the cross_thread tool permission.");
  }
}

export async function runtimeBridgeFetch(pathAfterOrigin, options = {}) {
  const base = process.env.FILEPATH_RUNTIME_URL?.replace(/\/$/, "") || "";
  const token = process.env.FILEPATH_RUNTIME_TOKEN?.trim() || "";
  if (!base || !token) {
    throw new Error(
      "Cross-thread bridge is not available (enable Cross-thread permission on this agent).",
    );
  }
  const path = pathAfterOrigin.startsWith("/") ? pathAfterOrigin : `/${pathAfterOrigin}`;
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "X-Filepath-Runtime-Token": token,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Runtime bridge failed (${res.status})`);
  }
  return data;
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/**
 * @param {Record<string, unknown>} instruction
 * @param {(e: Record<string, unknown>) => void} emit
 * @returns {Promise<string>} user message line for transcript
 */
export async function executeCrossThreadInstruction(instruction, emit) {
  assertCrossThread();
  const ws = readRequiredEnv("FILEPATH_WORKSPACE_ID");

  if (instruction.action === "list_threads") {
    emit({ type: "tool", name: "list_threads", status: "start" });
    const data = await runtimeBridgeFetch(`/runtime/workspaces/${encodeURIComponent(ws)}/threads`);
    emit({ type: "tool", name: "list_threads", status: "done" });
    return `Threads in this workspace (count=${data.count}): ${JSON.stringify(data.threads)}. Use {"action":"done","summary":"..."} or another JSON action.`;
  }

  if (instruction.action === "thread_last") {
    const agentId = String(instruction.agentId ?? "").trim();
    if (!agentId) throw new Error("thread_last requires agentId.");
    emit({ type: "tool", name: "thread_last", status: "start" });
    const data = await runtimeBridgeFetch(
      `/runtime/workspaces/${encodeURIComponent(ws)}/agents/${encodeURIComponent(agentId)}/last-message`,
    );
    emit({ type: "tool", name: "thread_last", status: "done" });
    return `Last message for thread ${agentId}: ${JSON.stringify(data.message)}. Next JSON action or done.`;
  }

  if (instruction.action === "thread_snapshot") {
    const agentId = String(instruction.agentId ?? "").trim();
    if (!agentId) throw new Error("thread_snapshot requires agentId.");
    emit({ type: "tool", name: "thread_snapshot", status: "start" });
    const data = await runtimeBridgeFetch(
      `/runtime/workspaces/${encodeURIComponent(ws)}/agents/${encodeURIComponent(agentId)}`,
    );
    emit({ type: "tool", name: "thread_snapshot", status: "done" });
    const snap = data.runtime;
    const tail = Array.isArray(snap?.messages) ? snap.messages.slice(-24) : [];
    return `Snapshot for thread ${agentId}: ${JSON.stringify({ status: snap?.status, messages: tail, result: snap?.result })}. Next JSON action or done.`;
  }

  if (instruction.action === "thread_send") {
    const agentId = String(instruction.agentId ?? "").trim();
    const sendContent = typeof instruction.content === "string" ? instruction.content.trim() : "";
    if (!agentId) throw new Error("thread_send requires agentId.");
    if (!sendContent) throw new Error("thread_send requires content.");
    emit({ type: "tool", name: "thread_send", path: agentId, status: "start" });
    const data = await runtimeBridgeFetch(
      `/runtime/workspaces/${encodeURIComponent(ws)}/agents/${encodeURIComponent(agentId)}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({ content: sendContent }),
      },
    );
    emit({ type: "tool", name: "thread_send", path: agentId, status: "done" });
    return `Enqueued task on thread ${agentId}: ${JSON.stringify({ taskId: data.taskId, state: data.state })}. Next JSON action or done.`;
  }

  throw new Error(`Unknown cross-thread action: ${instruction.action}`);
}

function extractTextContent(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function stripCodeFences(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export function parseJsonInstruction(raw) {
  const normalized = stripCodeFences(raw);
  const parsed = JSON.parse(normalized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model response was not a JSON object.");
  }
  if (typeof parsed.action !== "string") {
    throw new Error("Model response did not include an action.");
  }
  return parsed;
}

const CROSS_THREAD_ONLY_ACTIONS = new Set([
  "list_threads",
  "thread_last",
  "thread_snapshot",
  "thread_send",
  "done",
]);

async function callOpenRouterCrossThreadPass({ harnessId, task, apiKey, model, transcript }) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://myfilepath.com",
      "X-Title": `filepath-${harnessId}-cross-thread`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You are a filepath orchestration assistant.",
            "Respond with exactly one JSON object per turn, no markdown fences.",
            `Allowed actions only: ${CROSS_THREAD_ACTION_HELP}; {"action":"done","summary":"..."}.`,
            "Use one action at a time. Same workspace only.",
          ].join("\n"),
        },
        { role: "user", content: task },
        ...transcript,
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorBody.slice(0, 400) || response.statusText}`,
    );
  }

  const payload = await response.json();
  const content = extractTextContent(payload?.choices?.[0]?.message?.content).trim();
  if (!content) {
    throw new Error("OpenRouter response did not include assistant text.");
  }
  return content;
}

/**
 * For harnesses that run a subprocess CLI (not the shared JSON loop): cross-thread only via OpenRouter, then prepend context to the real task.
 * @returns {Promise<string>} prefix (empty if cross_thread off)
 */
export async function runCrossThreadPreflightBeforeSubprocess({
  harnessId,
  task,
  apiKey,
  model,
  emit,
  maxSteps = 16,
}) {
  if (!crossThreadPermissionFromEnv()) {
    return "";
  }

  const transcript = [];
  const traceLines = [];

  for (let step = 0; step < maxSteps; step += 1) {
    const raw = await callOpenRouterCrossThreadPass({
      harnessId,
      task,
      apiKey,
      model,
      transcript,
    });
    const instruction = parseJsonInstruction(raw);
    transcript.push({ role: "assistant", content: raw });

    if (instruction.action === "done") {
      const summary =
        typeof instruction.summary === "string" && instruction.summary.trim()
          ? instruction.summary.trim()
          : "Cross-thread preflight complete.";
      traceLines.push(`(done) ${summary}`);
      return [
        "[filepath cross-thread preflight — same workspace only]",
        ...traceLines,
        "",
        "Main harness task follows after the delimiter line.",
        "---",
        "",
      ].join("\n");
    }

    if (!CROSS_THREAD_ONLY_ACTIONS.has(instruction.action)) {
      transcript.push({
        role: "user",
        content:
          "Invalid action for this phase. Use only list_threads, thread_last, thread_snapshot, thread_send, or done.",
      });
      continue;
    }

    const userLine = await executeCrossThreadInstruction(instruction, emit);
    traceLines.push(userLine);
    transcript.push({ role: "user", content: userLine });
  }

  throw new Error("Cross-thread preflight exceeded step limit.");
}
