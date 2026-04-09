import { describe, expect, test } from "bun:test";

import {
  normalizeBucketName,
  normalizeMountPath,
  normalizeMountPrefix,
  normalizeWorkspaceR2Mounts,
  parseWorkspaceR2Mounts,
} from "./r2-mounts";

describe("workspace R2 mounts", () => {
  test("normalizes valid bucket names", () => {
    expect(normalizeBucketName(" My-Bucket ")).toBe("my-bucket");
    expect(normalizeBucketName("INVALID_BUCKET")).toBe(null);
  });

  test("normalizes absolute mount paths", () => {
    expect(normalizeMountPath("/data/")).toBe("/data");
    expect(normalizeMountPath("data")).toBe(null);
  });

  test("normalizes prefixes", () => {
    expect(normalizeMountPrefix("/models/")).toBe("/models");
    expect(normalizeMountPrefix("models")).toBe(null);
  });

  test("normalizes and deduplicates stored mounts", () => {
    expect(
      normalizeWorkspaceR2Mounts([
        { bucket: "models-bucket", mountPath: "/data", readonly: true },
        { bucket: "models-bucket", mountPath: "/data", readonly: false },
        { bucket: "datasets", mountPath: "/mnt/r2", readonly: false, prefix: "/train/" },
      ]),
    ).toEqual([
      { bucket: "models-bucket", mountPath: "/data", readonly: true, prefix: null },
      { bucket: "datasets", mountPath: "/mnt/r2", readonly: false, prefix: "/train" },
    ]);
  });

  test("parses stored json safely", () => {
    expect(
      parseWorkspaceR2Mounts(
        '[{"bucket":"models-bucket","mountPath":"/data","readonly":true}]',
      ),
    ).toEqual([{ bucket: "models-bucket", mountPath: "/data", readonly: true, prefix: null }]);
    expect(parseWorkspaceR2Mounts("not-json")).toEqual([]);
  });
});
