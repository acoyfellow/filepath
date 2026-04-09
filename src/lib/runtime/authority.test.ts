import { describe, expect, test } from "bun:test";

import {
  normalizeAgentScope,
  normalizeAbsoluteScopePath,
  normalizeScopePath,
  normalizeAbsolutePathList,
  normalizePathList,
  validateAgentScope,
  isPathAllowed,
  isPathWritable,
  getRuntimePolicyViolation,
  type AgentScope,
} from "./authority";

describe("normalizeScopePath", () => {
  test("returns null for null, undefined, empty", () => {
    expect(normalizeScopePath(null)).toBe(null);
    expect(normalizeScopePath(undefined)).toBe(null);
    expect(normalizeScopePath("")).toBe(null);
    expect(normalizeScopePath("   ")).toBe(null);
  });

  test("normalizes to . for root", () => {
    expect(normalizeScopePath(".")).toBe(".");
    expect(normalizeScopePath("./")).toBe(".");
    expect(normalizeScopePath("./.")).toBe(".");
  });

  test("strips leading ./, collapses slashes, trims trailing", () => {
    expect(normalizeScopePath("./foo")).toBe("foo");
    expect(normalizeScopePath("foo/bar")).toBe("foo/bar");
    expect(normalizeScopePath("foo//bar")).toBe("foo/bar");
    expect(normalizeScopePath("foo/")).toBe("foo");
    expect(normalizeScopePath("  foo  ")).toBe("foo");
  });

  test("rejects absolute and parent paths", () => {
    expect(normalizeScopePath("/foo")).toBe(null);
    expect(normalizeScopePath("..")).toBe(null);
    expect(normalizeScopePath("../foo")).toBe(null);
    expect(normalizeScopePath("foo/../bar")).toBe(null);
  });

  test("normalizes backslashes to forward slashes", () => {
    expect(normalizeScopePath("foo\\bar")).toBe("foo/bar");
  });
});

describe("normalizeAbsoluteScopePath", () => {
  test("accepts normalized absolute paths", () => {
    expect(normalizeAbsoluteScopePath("/data")).toBe("/data");
    expect(normalizeAbsoluteScopePath("/data/models/")).toBe("/data/models");
    expect(normalizeAbsoluteScopePath(" /mnt//r2 ")).toBe("/mnt/r2");
  });

  test("rejects invalid absolute paths", () => {
    expect(normalizeAbsoluteScopePath("data")).toBe(null);
    expect(normalizeAbsoluteScopePath("/")).toBe(null);
    expect(normalizeAbsoluteScopePath("/data/../etc")).toBe(null);
  });
});

describe("normalizePathList", () => {
  test("deduplicates and filters invalid", () => {
    expect(normalizePathList(["foo", "foo", "bar", "/invalid"])).toEqual(["foo", "bar"]);
  });

  test("returns empty for null/undefined", () => {
    expect(normalizePathList(null)).toEqual([]);
    expect(normalizePathList(undefined)).toEqual([]);
  });
});

describe("normalizeAbsolutePathList", () => {
  test("deduplicates and filters invalid values", () => {
    expect(normalizeAbsolutePathList(["/data", "/data", "data", "/mnt/r2"])).toEqual([
      "/data",
      "/mnt/r2",
    ]);
  });
});

describe("normalizeAgentScope", () => {
  test("uses preset when allowedPaths empty", () => {
    const scope = normalizeAgentScope({});
    expect(scope.allowedPaths).toEqual(["."]);
    expect(scope.forbiddenPaths).toEqual([]);
    expect(scope.mountPaths).toEqual([]);
    expect(scope.readOnlyMountPaths).toEqual([]);
    expect(scope.writableRoot).toBe(".");
  });

  test("normalizes allowed and forbidden paths", () => {
    const scope = normalizeAgentScope({
      allowedPaths: ["apps/web", "./packages/ui"],
      forbiddenPaths: ["apps/web/.env"],
    });
    expect(scope.allowedPaths).toEqual(["apps/web", "packages/ui"]);
    expect(scope.forbiddenPaths).toEqual(["apps/web/.env"]);
  });
});

describe("validateAgentScope", () => {
  test("returns null for valid scope", () => {
    const scope: AgentScope = {
      allowedPaths: ["."],
      forbiddenPaths: [],
      mountPaths: [],
      readOnlyMountPaths: [],
      toolPermissions: ["search", "run"],
      writableRoot: ".",
    };
    expect(validateAgentScope(scope)).toBe(null);
  });

  test("errors when allowedPaths empty", () => {
    const scope: AgentScope = {
      allowedPaths: [],
      forbiddenPaths: [],
      mountPaths: [],
      readOnlyMountPaths: [],
      toolPermissions: ["run"],
      writableRoot: ".",
    };
    expect(validateAgentScope(scope)).toContain("allowed path");
  });

  test("errors when writableRoot outside allowed", () => {
    const scope: AgentScope = {
      allowedPaths: ["apps/web"],
      forbiddenPaths: [],
      mountPaths: [],
      readOnlyMountPaths: [],
      toolPermissions: ["run"],
      writableRoot: "packages/ui",
    };
    expect(validateAgentScope(scope)).toContain("Writable root");
  });

  test("errors when writableRoot in forbidden", () => {
    const scope: AgentScope = {
      allowedPaths: ["apps/web"],
      forbiddenPaths: ["apps/web/dist"],
      mountPaths: [],
      readOnlyMountPaths: [],
      toolPermissions: ["run"],
      writableRoot: "apps/web/dist",
    };
    expect(validateAgentScope(scope)).toContain("Writable root");
  });
});

describe("isPathAllowed", () => {
  const scope: AgentScope = {
    allowedPaths: ["apps/web", "packages"],
    forbiddenPaths: ["apps/web/.env", "packages/dist"],
    mountPaths: ["/data"],
    readOnlyMountPaths: ["/data"],
    toolPermissions: ["run"],
    writableRoot: "apps/web",
  };

  test("allows paths inside allowed and not forbidden", () => {
    expect(isPathAllowed("apps/web", scope)).toBe(true);
    expect(isPathAllowed("apps/web/src", scope)).toBe(true);
    expect(isPathAllowed("packages", scope)).toBe(true);
    expect(isPathAllowed("packages/ui", scope)).toBe(true);
    expect(isPathAllowed("/data/models", scope)).toBe(true);
  });

  test("rejects paths outside allowed", () => {
    expect(isPathAllowed("other", scope)).toBe(false);
    expect(isPathAllowed("scripts", scope)).toBe(false);
    expect(isPathAllowed("/mnt/other", scope)).toBe(false);
  });

  test("rejects paths in forbidden", () => {
    expect(isPathAllowed("apps/web/.env", scope)).toBe(false);
    expect(isPathAllowed("packages/dist", scope)).toBe(false);
    expect(isPathAllowed("packages/dist/foo", scope)).toBe(false);
  });

  test("rejects invalid paths", () => {
    expect(isPathAllowed("/absolute", scope)).toBe(false);
    expect(isPathAllowed("../foo", scope)).toBe(false);
  });
});

describe("isPathWritable", () => {
  const scope: AgentScope = {
    allowedPaths: ["."],
    forbiddenPaths: [],
    mountPaths: ["/data"],
    readOnlyMountPaths: ["/data"],
    toolPermissions: ["write"],
    writableRoot: ".",
  };

  test("rejects readonly mount paths", () => {
    expect(isPathWritable("/data/file.txt", scope)).toBe(false);
  });

  test("allows normal workspace paths", () => {
    expect(isPathWritable("src/app.ts", scope)).toBe(true);
  });
});

describe("getRuntimePolicyViolation", () => {
  const scope: AgentScope = {
    allowedPaths: ["."],
    forbiddenPaths: [".git"],
    mountPaths: ["/data"],
    readOnlyMountPaths: ["/data"],
    toolPermissions: ["search", "run"],
    writableRoot: ".",
  };

  test("returns null when events comply with scope", () => {
    const events = [
      { type: "command" as const, cmd: "ls -la", status: "done" as const },
      { type: "text" as const, content: "hello" },
    ];
    expect(getRuntimePolicyViolation(scope, events)).toBe(null);
  });

  test("violates when commit event without commit permission", () => {
    const events = [
      { type: "commit" as const, hash: "abc123", message: "fix" },
    ];
    const v = getRuntimePolicyViolation(scope, events);
    expect(v).toContain("commit");
  });

  test("violates when git commit command without commit permission", () => {
    const events = [
      { type: "command" as const, cmd: "git commit -m x", status: "done" as const },
    ];
    const v = getRuntimePolicyViolation(scope, events);
    expect(v).toContain("commit");
  });

  test("violates when write tool without write permission", () => {
    const events = [
      {
        type: "tool" as const,
        name: "write_file",
        path: "foo.ts",
        status: "done" as const,
      },
    ];
    const v = getRuntimePolicyViolation(scope, events);
    expect(v).toContain("write");
  });

  test("violates when tool touches path outside scope", () => {
    const scopeWithPaths: AgentScope = {
      allowedPaths: ["apps/web"],
      forbiddenPaths: [],
      mountPaths: [],
      readOnlyMountPaths: [],
      toolPermissions: ["write"],
      writableRoot: "apps/web",
    };
    const events = [
      {
        type: "tool" as const,
        name: "write_file",
        path: "packages/ui/foo.ts",
        status: "done" as const,
      },
    ];
    const v = getRuntimePolicyViolation(scopeWithPaths, events);
    expect(v).toContain("packages/ui/foo.ts");
  });

  test("violates when write tool touches readonly mount", () => {
    const v = getRuntimePolicyViolation(
      {
        allowedPaths: ["."],
        forbiddenPaths: [],
        mountPaths: ["/data"],
        readOnlyMountPaths: ["/data"],
        toolPermissions: ["write"],
        writableRoot: ".",
      },
      [
        {
          type: "tool" as const,
          name: "write_file",
          path: "/data/model.bin",
          status: "done" as const,
        },
      ],
    );
    expect(v).toContain("/data/model.bin");
  });
});
