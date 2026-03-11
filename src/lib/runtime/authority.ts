import type { AgentEventType } from "$lib/protocol";

export const NODE_AUTHORITIES = ["orchestrator", "agent"] as const;
export type NodeAuthority = (typeof NODE_AUTHORITIES)[number];

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
    id: "delegate",
    label: "Delegate",
    description: "Spawn bounded child agents.",
  },
] as const;

export type ToolPermission = (typeof TOOL_PERMISSION_OPTIONS)[number]["id"];

export interface NodeRuntimePolicy {
  allowedPaths: string[];
  forbiddenPaths: string[];
  toolPermissions: ToolPermission[];
  writableRoot: string | null;
}

export interface NodeRuntimePolicyInput {
  allowedPaths?: readonly string[] | null;
  forbiddenPaths?: readonly string[] | null;
  toolPermissions?: readonly string[] | null;
  writableRoot?: string | null;
}

const ALL_TOOL_PERMISSIONS = new Set<ToolPermission>(
  TOOL_PERMISSION_OPTIONS.map((entry) => entry.id),
);

export const ORCHESTRATOR_POLICY_PRESET: NodeRuntimePolicy = {
  allowedPaths: ["."],
  forbiddenPaths: [],
  toolPermissions: ["inspect", "search", "run", "delegate"],
  writableRoot: null,
};

export const AGENT_POLICY_PRESET: NodeRuntimePolicy = {
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
  const next = [...new Set((values ?? []).filter((value): value is ToolPermission => ALL_TOOL_PERMISSIONS.has(value as ToolPermission)))];
  return next.length > 0 ? next : fallback;
}

export function getDefaultPolicy(authority: NodeAuthority): NodeRuntimePolicy {
  return authority === "agent"
    ? { ...AGENT_POLICY_PRESET, allowedPaths: [...AGENT_POLICY_PRESET.allowedPaths], forbiddenPaths: [...AGENT_POLICY_PRESET.forbiddenPaths], toolPermissions: [...AGENT_POLICY_PRESET.toolPermissions] }
    : { ...ORCHESTRATOR_POLICY_PRESET, allowedPaths: [...ORCHESTRATOR_POLICY_PRESET.allowedPaths], forbiddenPaths: [...ORCHESTRATOR_POLICY_PRESET.forbiddenPaths], toolPermissions: [...ORCHESTRATOR_POLICY_PRESET.toolPermissions] };
}

export function normalizeNodeRuntimePolicy(
  authority: NodeAuthority,
  input?: NodeRuntimePolicyInput | null,
): NodeRuntimePolicy {
  const fallback = getDefaultPolicy(authority);
  const normalizedAllowedPaths = normalizePathList(input?.allowedPaths);
  const allowedPaths = normalizedAllowedPaths.length > 0
    ? normalizedAllowedPaths
    : fallback.allowedPaths;
  const forbiddenPaths = normalizePathList(input?.forbiddenPaths);

  if (authority === "orchestrator") {
    return {
      allowedPaths: allowedPaths.length > 0 ? allowedPaths : fallback.allowedPaths,
      forbiddenPaths,
      toolPermissions: normalizeToolPermissions(
        input?.toolPermissions?.filter((permission) => permission !== "write" && permission !== "commit"),
        fallback.toolPermissions,
      ),
      writableRoot: null,
    };
  }

  const writableRoot = normalizeScopePath(input?.writableRoot) ?? allowedPaths[0] ?? fallback.writableRoot;
  return {
    allowedPaths: allowedPaths.length > 0 ? allowedPaths : fallback.allowedPaths,
    forbiddenPaths,
    toolPermissions: normalizeToolPermissions(input?.toolPermissions, fallback.toolPermissions),
    writableRoot,
  };
}

export function validateNodeRuntimePolicy(
  authority: NodeAuthority,
  policy: NodeRuntimePolicy,
): string | null {
  if (authority === "orchestrator") {
    if (policy.writableRoot) {
      return "Orchestrator cannot have a writable workspace.";
    }
    if (policy.toolPermissions.includes("write") || policy.toolPermissions.includes("commit")) {
      return "Orchestrator cannot have write or commit permission.";
    }
    return null;
  }

  if (policy.allowedPaths.length === 0) {
    return "Agents need at least one allowed path.";
  }

  if (!policy.writableRoot) {
    return "Agents need a writable root.";
  }

  if (!isPathAllowed(policy.writableRoot, policy)) {
    return "Writable root must stay inside allowed paths and outside forbidden paths.";
  }

  return null;
}

export function isPathAllowed(path: string, policy: NodeRuntimePolicy): boolean {
  const target = normalizeScopePath(path);
  if (!target) return false;

  const insideAllowed = policy.allowedPaths.some((allowed) => isPathWithin(target, allowed));
  if (!insideAllowed) return false;

  return !policy.forbiddenPaths.some((forbidden) => isPathWithin(target, forbidden));
}

export function resolveScopedWorkspaceRoot(workspaceRoot: string, writableRoot: string | null): string {
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

  if (event.type === "spawn" || event.type === "agents") {
    return "delegate";
  }

  return null;
}

export function getRuntimePolicyViolation(
  authority: NodeAuthority,
  policy: NodeRuntimePolicy,
  events: AgentEventType[],
): string | null {
  for (const event of events) {
    const required = classifyToolPermission(event);
    if (required && !policy.toolPermissions.includes(required)) {
      return `${authority} agents are not allowed to ${required}.`;
    }

    if (event.type === "tool" && event.path && !isPathAllowed(event.path, policy)) {
      return `This agent is not allowed to touch ${event.path}.`;
    }
  }

  return null;
}
