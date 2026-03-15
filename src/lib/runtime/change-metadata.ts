import type { AgentEventType } from "$lib/protocol";

const WRITE_LIKE_TOOL_RE = /write|edit|patch|create|delete|move|rename/i;

export function buildDiffSummary(filesTouched: readonly string[]): string | null {
  if (filesTouched.length === 0) {
    return null;
  }

  return filesTouched.length === 1
    ? `1 file touched: ${filesTouched[0]}`
    : `${filesTouched.length} files touched`;
}

function decodeQuotedPatchToken(token: string): string {
  return token
    .replace(/^"/, "")
    .replace(/"$/, "")
    .replace(/\\(.)/g, "$1");
}

function parseDiffGitLine(line: string): [string, string] | null {
  const match = line.match(
    /^diff --git (?:"((?:[^"\\]|\\.)+)"|(a\/\S+)) (?:"((?:[^"\\]|\\.)+)"|(b\/\S+))$/,
  );
  if (!match) {
    return null;
  }

  const left = match[1] ? decodeQuotedPatchToken(match[1]) : match[2];
  const right = match[3] ? decodeQuotedPatchToken(match[3]) : match[4];
  if (!left || !right) {
    return null;
  }

  return [left, right];
}

function stripPatchSidePrefix(value: string): string | null {
  if (value === "/dev/null") {
    return null;
  }

  return value.replace(/^[ab]\//, "");
}

export function extractFilesTouchedFromPatch(patch: string | null): string[] {
  if (!patch?.trim()) {
    return [];
  }

  const filesTouched = new Set<string>();
  for (const line of patch.split(/\r?\n/)) {
    const parsed = parseDiffGitLine(line.trim());
    if (!parsed) {
      continue;
    }

    const [beforePath, afterPath] = parsed;
    const normalizedBefore = stripPatchSidePrefix(beforePath);
    const normalizedAfter = stripPatchSidePrefix(afterPath);

    if (normalizedBefore) {
      filesTouched.add(normalizedBefore);
    }
    if (normalizedAfter) {
      filesTouched.add(normalizedAfter);
    }
  }

  return [...filesTouched];
}

export function normalizeChangeMetadata(input: {
  patch: string | null;
}): { filesTouched: string[]; diffSummary: string | null } {
  const filesTouched = extractFilesTouchedFromPatch(input.patch);
  return {
    filesTouched,
    diffSummary: buildDiffSummary(filesTouched),
  };
}

export function hasWriteIntentEvents(events: readonly AgentEventType[]): boolean {
  return events.some((event) => event.type === "tool" && WRITE_LIKE_TOOL_RE.test(event.name));
}
