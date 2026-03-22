#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const alchemyRoot = path.join(repoRoot, "node_modules", "alchemy");

const srcMetadataPath = path.join(
  alchemyRoot,
  "src",
  "cloudflare",
  "worker-metadata.ts",
);
const libMetadataPath = path.join(
  alchemyRoot,
  "lib",
  "cloudflare",
  "worker-metadata.js",
);

const CONTAINER_BINDING_MARKER = "PATCHED_CONTAINER_BINDING";

function fail(message) {
  console.error(`[patch-alchemy-cli] ${message}`);
  process.exit(1);
}

function ensureExists(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Expected file not found: ${path.relative(repoRoot, filePath)}`);
  }
}

function patchContainerBinding(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const current = fs.readFileSync(filePath, "utf8");
  if (current.includes(CONTAINER_BINDING_MARKER)) {
    return;
  }
  const pattern =
    /(else if \(binding\.type === "container"\) \{\n[\t ]*meta\.bindings\.push\(\{\n[\t ]*type: "durable_object_namespace",\n[\t ]*class_name: binding\.className,\n)([\t ]*)name: bindingName,\n/;

  if (!pattern.test(current)) {
    if (filePath === srcMetadataPath) {
      fail(
        `Unable to find the container binding metadata block in ${path.relative(repoRoot, filePath)}. Installed Alchemy changed; update the patch script.`,
      );
    }
    return;
  }

  const updated = current.replace(
    pattern,
    (_, prefix, indent) =>
      `${prefix}${indent}name: bindingName,\n${indent}/* ${CONTAINER_BINDING_MARKER} */ script_name: binding.scriptName === props.workerName ? undefined : binding.scriptName,\n`,
  );
  fs.writeFileSync(filePath, updated);
}

const d1DbSrcPath = path.join(alchemyRoot, "src", "cloudflare", "d1-database.ts");
const D1_STATE_CLEAR_MARKER = "ALCHEMY_D1_SKIP_DELETE_API";

function patchD1DeleteSkipApi(filePath) {
  if (!fs.existsSync(filePath)) return;
  const current = fs.readFileSync(filePath, "utf8");
  if (current.includes(D1_STATE_CLEAR_MARKER)) return;
  const pattern =
    /(if \(props\.delete !== false && this\.output\?\.id\) \{\s*\n\s*)await deleteDatabase\(api, this\.output\.id\);/;
  const replacement = `$1if (process.env.ALCHEMY_D1_SKIP_DELETE_API !== "1") {\n        await deleteDatabase(api, this.output.id);\n      }`;
  if (!pattern.test(current)) return;
  const updated = current.replace(pattern, replacement);
  fs.writeFileSync(filePath, updated);
}

ensureExists(alchemyRoot);
ensureExists(srcMetadataPath);

patchContainerBinding(srcMetadataPath);
patchContainerBinding(libMetadataPath);
patchD1DeleteSkipApi(d1DbSrcPath);
