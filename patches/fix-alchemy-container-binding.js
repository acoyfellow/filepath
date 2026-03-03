#!/usr/bin/env node
// Patch for Alchemy container bindings in API deploy metadata.
// The wrangler.json path emits script_name for container DO bindings, but the
// API worker-metadata path currently drops it. That can leave the deployed
// Worker bound to the wrong Sandbox DO namespace and force a post-deploy fixup.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const filePath = join(process.cwd(), 'node_modules/alchemy/lib/cloudflare/worker-metadata.js');

if (!existsSync(filePath)) {
  console.log('[patch] Alchemy worker-metadata file not found, skipping container patch');
  process.exit(0);
}

let content = readFileSync(filePath, 'utf8');

if (content.includes('/* PATCHED_CONTAINER_BINDING */')) {
  console.log('[patch] Alchemy container binding already patched');
  process.exit(0);
}

const oldCode = `        else if (binding.type === "container") {
            meta.bindings.push({
                type: "durable_object_namespace",
                class_name: binding.className,
                name: bindingName,
            });`;

const newCode = `        else if (binding.type === "container") {
            meta.bindings.push({
                type: "durable_object_namespace",
                class_name: binding.className,
                name: bindingName,
                /* PATCHED_CONTAINER_BINDING */ script_name: binding.scriptName,
            });`;

if (!content.includes(oldCode)) {
  console.log('[patch] Could not find target code in Alchemy worker-metadata, may already be patched or version changed');
  process.exit(0);
}

content = content.replace(oldCode, newCode);
writeFileSync(filePath, content);
console.log('[patch] Patched Alchemy container binding metadata (added script_name)');
