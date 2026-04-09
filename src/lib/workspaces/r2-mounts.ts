import type { WorkspaceR2Mount } from "$lib/types/workspace";

const BUCKET_NAME_RE = /^[a-z0-9]([a-z0-9.-]{1,61}[a-z0-9])?$/;

function normalizeSlashPath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

export function normalizeMountPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeSlashPath(value);
  if (!normalized.startsWith("/")) return null;
  const trimmed = normalized.replace(/\/$/, "") || "/";
  if (trimmed === "/" || trimmed === "/." || trimmed === "/..") return null;
  if (trimmed.includes("/../") || trimmed.endsWith("/..")) return null;
  if (trimmed.includes("/./")) return null;
  return trimmed;
}

export function normalizeMountPrefix(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeSlashPath(value);
  if (!normalized.startsWith("/")) return null;
  if (normalized.includes("/../") || normalized.endsWith("/..")) return null;
  if (normalized.includes("/./")) return null;
  return normalized === "/" ? "/" : normalized.replace(/\/$/, "");
}

export function normalizeBucketName(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !BUCKET_NAME_RE.test(trimmed)) return null;
  return trimmed;
}

export function normalizeWorkspaceR2Mounts(
  value: readonly Partial<WorkspaceR2Mount>[] | null | undefined,
): WorkspaceR2Mount[] {
  const mounts: WorkspaceR2Mount[] = [];
  const seen = new Set<string>();

  for (const entry of value ?? []) {
    const bucket = normalizeBucketName(entry.bucket);
    const mountPath = normalizeMountPath(entry.mountPath);
    const prefix = normalizeMountPrefix(entry.prefix);
    if (!bucket || !mountPath) continue;
    if (seen.has(mountPath)) continue;
    seen.add(mountPath);
    mounts.push({
      bucket,
      mountPath,
      readonly: entry.readonly ?? true,
      prefix,
    });
  }

  return mounts;
}

export function parseWorkspaceR2Mounts(value: string | null | undefined): WorkspaceR2Mount[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeWorkspaceR2Mounts(parsed) : [];
  } catch {
    return [];
  }
}

export function serializeWorkspaceR2Mounts(
  value: readonly Partial<WorkspaceR2Mount>[] | null | undefined,
): string {
  return JSON.stringify(normalizeWorkspaceR2Mounts(value));
}
