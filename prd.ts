/**
 * filepath
 * 
 * This file is the entire context.
 * 
 * North star:
 * 
 *   import { run } from 'filepath'
 *   const result = await run("go to example.com, find contact form, fill as Jordan")
 *   // → { success: true, output: "...", screenshot: "base64...", error: undefined }
 * 
 * Rules:
 * 1. Find next eligible story (pending + deps satisfied)
 * 2. Build only what's needed to pass that gate
 * 3. Run: bun run prd.ts
 * 4. If pass → mark status: 'done', commit, continue
 * 5. If fail → fix, retry
 * 
 * Reference patterns:
 * - gateproof     → verification primitives (dogfooded in gates/)
 * - remote        → Svelte + auth + worker template (bootstrap dashboard)
 * - Cloudflare sandbox-sdk examples → container patterns
 * - Cloudflare containers examples → container deployment patterns
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENV SHAPE
// prd declares shape, .env.example documents, gate validates
// ═══════════════════════════════════════════════════════════════════════════════

export const env = {
  required: [
    'CLOUDFLARE_ACCOUNT_ID',   // your CF account
    'CLOUDFLARE_API_TOKEN',    // token with Workers + Containers permissions
    'ANTHROPIC_API_KEY',       // for claude in container
  ],
  optional: [
    'FILEPATH_DEBUG',          // verbose logging
    'FILEPATH_TIMEOUT',        // default timeout ms (60000)
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Story {
  id: string
  title: string
  status: 'pending' | 'done' | 'blocked'
  dependsOn: string[]
  gateFile: string
  notes?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORIES - 8 LAYERS, 29 GATES
// ═══════════════════════════════════════════════════════════════════════════════

export const stories: Story[] = [

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 0: Setup
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'env-example',
    title: '.env.example documents all required vars',
    status: 'done',
    dependsOn: [],
    gateFile: './gates/env-example.gate.ts'
  },

  {
    id: 'deps',
    title: 'bun install succeeds',
    status: 'done',
    dependsOn: ['env-example'],
    gateFile: './gates/deps.gate.ts'
  },

  {
    id: 'remote-bootstrap',
    title: 'remote template bootstrapped (Svelte + auth + worker structure)',
    status: 'done',
    dependsOn: ['deps'],
    gateFile: './gates/remote-bootstrap.gate.ts',
    notes: 'Bootstraps dashboard/admin UI foundation from remote template'
  },

  {
    id: 'alchemy',
    title: 'alchemy.run.ts defines CF resources',
    status: 'done',
    dependsOn: ['remote-bootstrap'],
    gateFile: './gates/alchemy.gate.ts'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 1: Container Runtime
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'dockerfile',
    title: 'Dockerfile has bun + chromium + playwright',
    status: 'done',
    dependsOn: ['alchemy'],
    gateFile: './gates/dockerfile.gate.ts'
  },

  {
    id: 'container-entry',
    title: 'container/agent/index.ts exists',
    status: 'done',
    dependsOn: ['dockerfile'],
    gateFile: './gates/container-entry.gate.ts'
  },

  {
    id: 'container-builds',
    title: 'docker build succeeds locally',
    status: 'done',
    dependsOn: ['container-entry'],
    gateFile: './gates/container-builds.gate.ts'
  },

  {
    id: 'container-browser',
    title: 'playwright launches in container',
    status: 'done',
    dependsOn: ['container-builds'],
    gateFile: './gates/container-browser.gate.ts',
    notes: 'KEY GATE - browser works, no CF Browser limits'
  },

  {
    id: 'container-registry',
    title: 'container pushed to CF registry',
    status: 'done',
    dependsOn: ['container-browser'],
    gateFile: './gates/container-registry.gate.ts'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 2: Agent Logic (inside container)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'agent-browser',
    title: 'agent/browser.ts has goto, click, fill, screenshot',
    status: 'done',
    dependsOn: ['container-browser'],
    gateFile: './gates/agent-browser.gate.ts'
  },

  {
    id: 'agent-execute',
    title: 'agent/index.ts executes instruction via claude',
    status: 'done',
    dependsOn: ['agent-browser'],
    gateFile: './gates/agent-execute.gate.ts'
  },

  {
    id: 'agent-result',
    title: 'agent returns { success, output, screenshot }',
    status: 'done',
    dependsOn: ['agent-execute'],
    gateFile: './gates/agent-result.gate.ts'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 3: Worker (Durable Object)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'worker-entry',
    title: 'worker/src/index.ts exports default',
    status: 'done',
    dependsOn: ['container-registry'],
    gateFile: './gates/worker-entry.gate.ts'
  },

  {
    id: 'worker-do',
    title: 'ContainerManager DO exists',
    status: 'done',
    dependsOn: ['worker-entry'],
    gateFile: './gates/worker-do.gate.ts'
  },

  {
    id: 'worker-spawn',
    title: 'DO can spawn container',
    status: 'done',
    dependsOn: ['worker-do'],
    gateFile: './gates/worker-spawn.gate.ts'
  },

  {
    id: 'worker-run',
    title: 'DO sends instruction, receives result',
    status: 'done',
    dependsOn: ['worker-spawn'],
    gateFile: './gates/worker-run.gate.ts'
  },

  {
    id: 'worker-wrangler',
    title: 'wrangler.toml configured',
    status: 'done',
    dependsOn: ['worker-run'],
    gateFile: './gates/worker-wrangler.gate.ts'
  },

  {
    id: 'worker-deployed',
    title: 'worker deployed to CF',
    status: 'blocked',
    dependsOn: ['worker-wrangler'],
    gateFile: './gates/worker-deployed.gate.ts',
    notes: 'Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 4: Client Library
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'src-types',
    title: 'src/types.ts exports RunResult, RunOptions',
    status: 'done',
    dependsOn: ['worker-wrangler'],
    gateFile: './gates/src-types.gate.ts'
  },

  {
    id: 'src-run',
    title: 'src/index.ts exports run()',
    status: 'done',
    dependsOn: ['src-types'],
    gateFile: './gates/src-run.gate.ts'
  },

  {
    id: 'src-fetch',
    title: 'run() calls worker API',
    status: 'done',
    dependsOn: ['src-run'],
    gateFile: './gates/src-fetch.gate.ts'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 5: CLI
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'cli-bin',
    title: 'cli/index.ts is bin entry',
    status: 'pending',
    dependsOn: ['src-fetch'],
    gateFile: './gates/cli-bin.gate.ts'
  },

  {
    id: 'cli-init',
    title: 'filepath init creates .filepath/config.json',
    status: 'pending',
    dependsOn: ['cli-bin'],
    gateFile: './gates/cli-init.gate.ts'
  },

  {
    id: 'cli-deploy',
    title: 'filepath deploy pushes worker + container',
    status: 'pending',
    dependsOn: ['cli-init'],
    gateFile: './gates/cli-deploy.gate.ts'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 6: Publish
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'pkg-ready',
    title: 'package.json has name, main, types, bin',
    status: 'pending',
    dependsOn: ['cli-deploy'],
    gateFile: './gates/pkg-ready.gate.ts'
  },

  {
    id: 'build-works',
    title: 'bun run build generates dist/',
    status: 'pending',
    dependsOn: ['pkg-ready'],
    gateFile: './gates/build-works.gate.ts'
  },

  {
    id: 'readme',
    title: 'README.md has usage',
    status: 'pending',
    dependsOn: ['build-works'],
    gateFile: './gates/readme.gate.ts'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 7: E2E Proof
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'e2e-title',
    title: 'run("get title of example.com") → "Example Domain"',
    status: 'pending',
    dependsOn: ['worker-deployed', 'agent-result'],
    gateFile: './gates/e2e-title.gate.ts'
  },

  {
    id: 'e2e-form',
    title: 'run("fill form on httpbin") → success + screenshot',
    status: 'pending',
    dependsOn: ['e2e-title'],
    gateFile: './gates/e2e-form.gate.ts',
    notes: 'THE MONEY GATE - verified submission with proof'
  },

  {
    id: 'e2e-fresh',
    title: 'fresh user: init → deploy → run → works',
    status: 'pending',
    dependsOn: ['e2e-form', 'cli-deploy'],
    gateFile: './gates/e2e-fresh.gate.ts',
    notes: 'NORTH STAR - someone else can use this'
  },

]

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

import { spawnSync } from 'child_process'
import { existsSync } from 'fs'

function nextEligible(stories: Story[]): Story | null {
  const done = new Set(stories.filter(s => s.status === 'done').map(s => s.id))
  return stories.find(s => s.status === 'pending' && s.dependsOn.every(d => done.has(d))) ?? null
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const done = stories.filter(s => s.status === 'done').length
const pending = stories.filter(s => s.status === 'pending').length

console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║  filepath                                                                     ║
║  run(instruction) → { success, output, screenshot, error }                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

  done: ${done}  pending: ${pending}  total: ${stories.length}
`)

if (pending === 0) {
  console.log(`  ✓ ALL GATES PASS - NORTH STAR ACHIEVED\n`)
  process.exit(0)
}

const next = nextEligible(stories)
if (!next) {
  console.log(`  ✗ NO ELIGIBLE STORIES (circular dependency?)\n`)
  process.exit(1)
}

console.log(`  ┌─────────────────────────────────────────────────────────────────────────────┐`)
console.log(`  │ ${next.id.padEnd(75)} │`)
console.log(`  │ ${next.title.slice(0, 75).padEnd(75)} │`)
console.log(`  └─────────────────────────────────────────────────────────────────────────────┘`)
if (next.notes) console.log(`\n  notes: ${next.notes}`)
console.log(``)

// Check gate file exists
if (!existsSync(next.gateFile)) {
  console.log(`  ✗ FAIL\n`)
  console.log(`    - gate file missing: ${next.gateFile}\n`)
  process.exit(1)
}

// Run gate file
const result = spawnSync('bun', ['run', next.gateFile], {
  encoding: 'utf-8',
  stdio: 'inherit',
  cwd: process.cwd()
})

if (result.status === 0) {
  console.log(`  ✓ PASS → mark status: 'done' for "${next.id}" in prd.ts, commit, continue\n`)
  process.exit(0)
} else {
  console.log(`  ✗ FAIL\n`)
  process.exit(1)
}
