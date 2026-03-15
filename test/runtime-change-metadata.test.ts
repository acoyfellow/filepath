import { describe, expect, test } from "bun:test";

import { extractFilesTouchedFromPatch, hasWriteIntentEvents, normalizeChangeMetadata } from "../src/lib/runtime/change-metadata";
import type { AgentEventType } from "../src/lib/protocol";

describe("runtime change metadata", () => {
  test("derives touched files and diff summary from a unified patch", () => {
    const patch = [
      "diff --git a/src/app.ts b/src/app.ts",
      "index 1111111..2222222 100644",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1 +1 @@",
      "-console.log('before')",
      "+console.log('after')",
      "diff --git a/README.md b/README.md",
      "index aaaaaaa..bbbbbbb 100644",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");

    expect(extractFilesTouchedFromPatch(patch)).toEqual(["src/app.ts", "README.md"]);
    expect(normalizeChangeMetadata({ patch })).toEqual({
      filesTouched: ["src/app.ts", "README.md"],
      diffSummary: "2 files touched",
    });
  });

  test("treats empty patches as no-op results", () => {
    expect(normalizeChangeMetadata({ patch: null })).toEqual({
      filesTouched: [],
      diffSummary: null,
    });
  });

  test("detects write-intent tool events", () => {
    const events: AgentEventType[] = [
      {
        type: "tool",
        name: "write_file",
        path: "src/app.ts",
        status: "done",
      },
      {
        type: "done",
        summary: "Updated the file.",
      },
    ];

    expect(hasWriteIntentEvents(events)).toBe(true);
    expect(
      hasWriteIntentEvents([
        {
          type: "tool",
          name: "read_file",
          path: "src/app.ts",
          status: "done",
        },
      ]),
    ).toBe(false);
  });
});
