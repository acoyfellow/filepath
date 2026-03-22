const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  CROSS_THREAD_ACTION_HELP,
  crossThreadPermissionFromEnv,
  executeCrossThreadInstruction,
  parseJsonInstruction,
} from "./cross-thread.mjs";

export { parseJsonInstruction };

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function extractTextContent(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
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

function parseJsonArrayEnv(name) {
  const raw = process.env[name]?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function isPathInside(root, candidate) {
  const resolved = resolve(root, candidate);
  const rel = normalizePath(relative(root, resolved));
  return rel === "" || (!rel.startsWith("../") && rel !== "..");
}

function matchesScopedPrefix(path, prefixes) {
  if (prefixes.length === 0) {
    return true;
  }
  const normalized = normalizePath(path);
  return prefixes.some((prefix) => {
    const candidate = normalizePath(prefix);
    return normalized === candidate.replace(/\/$/, "") || normalized.startsWith(candidate);
  });
}

function ensurePathAllowed(workspaceRoot, path, allowedPaths, forbiddenPaths) {
  if (!path || typeof path !== "string") {
    throw new Error("Instruction path is required.");
  }

  const normalized = normalizePath(path);
  if (!isPathInside(workspaceRoot, normalized)) {
    throw new Error(`Path escapes the workspace: ${normalized}`);
  }
  if (!matchesScopedPrefix(normalized, allowedPaths)) {
    throw new Error(`Path is outside the allowed scope: ${normalized}`);
  }
  if (forbiddenPaths.some((prefix) => matchesScopedPrefix(normalized, [prefix]))) {
    throw new Error(`Path is forbidden by scope: ${normalized}`);
  }

  return resolve(workspaceRoot, normalized);
}

async function callOpenRouter({
  harnessId,
  systemPrompt,
  task,
  apiKey,
  model,
  transcript,
  allowedPaths,
  forbiddenPaths,
  crossThreadHelp,
}) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://myfilepath.com",
      "X-Title": `filepath-${harnessId}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            systemPrompt,
            "You are editing files inside a bounded filepath workspace.",
            "Respond with exactly one JSON object and no markdown fences unless asked otherwise.",
            'Allowed actions: {"action":"read","path":"relative/path"}, {"action":"write","path":"relative/path","content":"..."}, {"action":"replace","path":"relative/path","find":"...","replace":"..."}, {"action":"done","summary":"..."}' +
              (crossThreadHelp ? ` ${crossThreadHelp}` : ""),
            "Use one action at a time. Prefer the smallest possible change. Do not commit.",
            `Allowed paths: ${JSON.stringify(allowedPaths)}`,
            `Forbidden paths: ${JSON.stringify(forbiddenPaths)}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: task,
        },
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

function parseLocalVerifyDirective(task) {
  const match = task.trim().match(/^__filepath_local_wait__:(\d+)(?::([\s\S]+))?$/);
  if (!match) return null;

  const delayMs = Math.min(Math.max(Number.parseInt(match[1], 10), 250), 60_000);
  const reply = match[2]?.trim() || `Waited ${delayMs}ms`;
  return { delayMs, reply };
}

const CROSS_THREAD_ACTION_IDS = new Set([
  "list_threads",
  "thread_last",
  "thread_snapshot",
  "thread_send",
]);

export async function runAdapter({ harnessId, systemPrompt }) {
  const task = readRequiredEnv("FILEPATH_TASK");
  const apiKey = readRequiredEnv("FILEPATH_API_KEY");
  const model = readRequiredEnv("FILEPATH_MODEL");
  const workspaceRoot = readRequiredEnv("FILEPATH_WORKSPACE");
  const allowedPaths = parseJsonArrayEnv("FILEPATH_ALLOWED_PATHS");
  const forbiddenPaths = parseJsonArrayEnv("FILEPATH_FORBIDDEN_PATHS");
  const localVerify = parseLocalVerifyDirective(task);
  const crossThreadEnabled = crossThreadPermissionFromEnv();
  const crossThreadHelp = crossThreadEnabled ? CROSS_THREAD_ACTION_HELP : "";

  emit({ type: "status", state: "thinking" });

  if (localVerify) {
    emit({ type: "status", state: "running" });
    await new Promise((resolve) => setTimeout(resolve, localVerify.delayMs));
    emit({ type: "text", content: localVerify.reply });
    emit({ type: "done", summary: "Agent completed the local verification task." });
    return;
  }

  const transcript = [];
  const maxSteps = crossThreadEnabled ? 16 : 4;

  for (let step = 0; step < maxSteps; step += 1) {
    const content = await callOpenRouter({
      harnessId,
      systemPrompt,
      task,
      apiKey,
      model,
      transcript,
      allowedPaths,
      forbiddenPaths,
      crossThreadHelp,
    });
    const instruction = parseJsonInstruction(content);
    transcript.push({ role: "assistant", content });

    if (instruction.action === "done") {
      const summary = typeof instruction.summary === "string" && instruction.summary.trim()
        ? instruction.summary.trim()
        : "Agent completed the task.";
      emit({ type: "text", content: summary });
      emit({ type: "done", summary });
      return;
    }

    if (instruction.action === "read") {
      const path = String(instruction.path ?? "");
      const absolutePath = ensurePathAllowed(workspaceRoot, path, allowedPaths, forbiddenPaths);
      emit({ type: "tool", name: "read_file", path, status: "start" });
      const fileContents = await readFile(absolutePath, "utf8").catch(() => "");
      emit({ type: "tool", name: "read_file", path, status: "done" });
      transcript.push({
        role: "user",
        content: `Read ${path}:\n${fileContents || "(empty file)"}\nIf more work is needed, respond with the next JSON action.`,
      });
      continue;
    }

    if (instruction.action === "write") {
      const path = String(instruction.path ?? "");
      const absolutePath = ensurePathAllowed(workspaceRoot, path, allowedPaths, forbiddenPaths);
      const nextContent = typeof instruction.content === "string" ? instruction.content : "";
      emit({ type: "tool", name: "write_file", path, status: "start" });
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, nextContent, "utf8");
      emit({ type: "tool", name: "write_file", path, status: "done" });
      transcript.push({
        role: "user",
        content: `Wrote ${path}. If the task is complete, respond with {"action":"done","summary":"..."}; otherwise respond with the next JSON action.`,
      });
      continue;
    }

    if (instruction.action === "replace") {
      const path = String(instruction.path ?? "");
      const absolutePath = ensurePathAllowed(workspaceRoot, path, allowedPaths, forbiddenPaths);
      const find = typeof instruction.find === "string" ? instruction.find : "";
      const replace = typeof instruction.replace === "string" ? instruction.replace : "";
      emit({ type: "tool", name: "replace_text", path, status: "start" });
      const existing = await readFile(absolutePath, "utf8").catch(() => "");
      if (!existing.includes(find)) {
        emit({ type: "tool", name: "replace_text", path, status: "error", output: "target text not found" });
        transcript.push({
          role: "user",
          content: `The text ${JSON.stringify(find)} was not present in ${path}. Respond with a different JSON action.`,
        });
        continue;
      }
      await writeFile(absolutePath, existing.replace(find, replace), "utf8");
      emit({ type: "tool", name: "replace_text", path, status: "done" });
      transcript.push({
        role: "user",
        content: `Updated ${path}. If the task is complete, respond with {"action":"done","summary":"..."}; otherwise respond with the next JSON action.`,
      });
      continue;
    }

    if (CROSS_THREAD_ACTION_IDS.has(instruction.action)) {
      const userLine = await executeCrossThreadInstruction(instruction, emit);
      transcript.push({
        role: "user",
        content: userLine,
      });
      continue;
    }

    throw new Error(`Unsupported instruction action: ${instruction.action}`);
  }

  throw new Error("Adapter exhausted its edit loop before declaring done.");
}
