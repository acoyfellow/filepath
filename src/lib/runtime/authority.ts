import type { AgentEventType } from "$lib/protocol";

export const TOOL_PERMISSION_OPTIONS = [
  {
    id: "inspect",
    label: "Inspect",
    description: "Read plans, summaries, and results.",
  },
  {
    id: "search",
    label: "Search",
    description: "Search and read files in scope.",
  },
  {
    id: "run",
    label: "Run",
    description: "Run commands and checks.",
  },
  {
    id: "write",
    label: "Write",
    description: "Edit files inside allowed paths.",
  },
  {
    id: "commit",
    label: "Commit",
    description: "Create git commits.",
  },
  {
    id: "cross_thread",
    label: "Cross-thread",
    description: "List threads in the workspace, read last messages, and enqueue tasks on other threads (sandbox bridge only).",
  },
] as const;

export type ToolPermission = (typeof TOOL_PERMISSION_OPTIONS)[number]["id"];

export interface AgentScope {
  allowedPaths: string[];
  forbiddenPaths: string[];
  toolPermissions: ToolPermission[];
  writableRoot: string | null;
}

export interface AgentScopeInput {
  allowedPaths?: readonly string[] | null;
  forbiddenPaths?: readonly string[] | null;
  toolPermissions?: readonly string[] | null;
  writableRoot?: string | null;
}

const ALL_TOOL_PERMISSIONS = new Set<ToolPermission>(
  TOOL_PERMISSION_OPTIONS.map((entry) => entry.id),
);

export const AGENT_SCOPE_PRESET: AgentScope = {
  allowedPaths: ["."],
  forbiddenPaths: [".git", "node_modules"],
  toolPermissions: ["search", "run", "write", "commit"],
  writableRoot: ".",
};

export function parseDelimitedInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => normalizeScopePath(entry))
    .filter((entry, index, all) => entry !== null && all.indexOf(entry) === index) as string[];
}

export function normalizeScopePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) return null;

  let normalized = trimmed.replace(/^\.\/+/, "").replace(/\/{2,}/g, "/");
  if (normalized === "") normalized = ".";
  normalized = normalized.replace(/\/$/, "") || ".";

  if (normalized === "." || normalized === "") return ".";
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    return null;
  }
  if (normalized.includes("/../")) {
    return null;
  }

  return normalized;
}

export function normalizePathList(values: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const path = normalizeScopePath(value);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    normalized.push(path);
  }

  return normalized;
}

export function normalizeToolPermissions(
  values: readonly string[] | null | undefined,
  fallback: ToolPermission[],
): ToolPermission[] {
  const next = [
    ...new Set(
      (values ?? []).filter(
        (value): value is ToolPermission => ALL_TOOL_PERMISSIONS.has(value as ToolPermission),
      ),
    ),
  ];
  return next.length > 0 ? next : fallback;
}

export function normalizeAgentScope(input?: AgentScopeInput | null): AgentScope {
  const normalizedAllowedPaths = normalizePathList(input?.allowedPaths);
  const allowedPaths =
    normalizedAllowedPaths.length > 0
      ? normalizedAllowedPaths
      : [...AGENT_SCOPE_PRESET.allowedPaths];

  const forbiddenPaths = normalizePathList(input?.forbiddenPaths);
  const writableRoot =
    normalizeScopePath(input?.writableRoot) ??
    allowedPaths[0] ??
    AGENT_SCOPE_PRESET.writableRoot;

  return {
    allowedPaths,
    forbiddenPaths,
    toolPermissions: normalizeToolPermissions(
      input?.toolPermissions,
      AGENT_SCOPE_PRESET.toolPermissions,
    ),
    writableRoot,
  };
}

export function validateAgentScope(scope: AgentScope): string | null {
  if (scope.allowedPaths.length === 0) {
    return "Agents need at least one allowed path.";
  }

  if (!scope.writableRoot) {
    return "Agents need a writable root.";
  }

  if (!isPathAllowed(scope.writableRoot, scope)) {
    return "Writable root must stay inside allowed paths and outside forbidden paths.";
  }

  return null;
}

export function isPathAllowed(path: string, scope: AgentScope): boolean {
  const target = normalizeScopePath(path);
  if (!target) return false;

  const insideAllowed = scope.allowedPaths.some((allowed) => isPathWithin(target, allowed));
  if (!insideAllowed) return false;

  return !scope.forbiddenPaths.some((forbidden) => isPathWithin(target, forbidden));
}

export function resolveScopedWorkspaceRoot(
  workspaceRoot: string,
  writableRoot: string | null,
): string {
  if (!writableRoot || writableRoot === ".") return workspaceRoot;
  const base = workspaceRoot.replace(/\/$/, "");
  return `${base}/${writableRoot}`;
}

function isPathWithin(target: string, scope: string): boolean {
  if (scope === ".") return true;
  return target === scope || target.startsWith(`${scope}/`);
}

function classifyToolPermission(event: AgentEventType): ToolPermission | null {
  if (event.type === "command") {
    return /\bgit\s+commit\b/i.test(event.cmd) ? "commit" : "run";
  }

  if (event.type === "commit") {
    return "commit";
  }

  if (event.type === "tool") {
    return /write|edit|patch|create|delete|move|rename/i.test(event.name) ? "write" : "run";
  }

  return null;
}

export function getRuntimePolicyViolation(
  scope: AgentScope,
  events: AgentEventType[],
): string | null {
  for (const event of events) {
    const required = classifyToolPermission(event);
    if (required && !scope.toolPermissions.includes(required)) {
      return `This agent is not allowed to ${required}.`;
    }

    if (event.type === "tool" && event.path && !isPathAllowed(event.path, scope)) {
      return `This agent is not allowed to touch ${event.path}.`;
    }
  }

  return null;
}
