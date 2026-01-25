/**
 * test/e2e-fresh.ts
 * 
 * E2E test: fresh user flow
 * init → deploy → run → works
 * 
 * NORTH STAR - if this passes, someone else can use filepath
 */

import { spawn } from 'child_process'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'

async function runCommand(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      env: process.env,
    })
    
    proc.on('close', (code) => {
      resolve(code === 0)
    })
  })
}

async function test() {
  console.log('[e2e-fresh] simulating fresh user flow...')
  
  // Clean up any existing config
  const configDir = join(process.cwd(), '.filepath')
  if (existsSync(configDir)) {
    console.log('[e2e-fresh] cleaning up existing .filepath/')
    rmSync(configDir, { recursive: true })
  }
  
  // Step 1: init
  console.log('\n[e2e-fresh] Step 1: filepath init')
  const initOk = await runCommand('bun', ['run', 'cli/index.ts', 'init'])
  if (!initOk) {
    console.error('[e2e-fresh] FAIL: init failed')
    process.exit(1)
  }
  
  // Step 2: deploy
  console.log('\n[e2e-fresh] Step 2: filepath deploy')
  const deployOk = await runCommand('bun', ['run', 'cli/index.ts', 'deploy'])
  if (!deployOk) {
    console.error('[e2e-fresh] FAIL: deploy failed')
    process.exit(1)
  }
  
  // Step 3: run a simple instruction
  console.log('\n[e2e-fresh] Step 3: run instruction')
  const runOk = await runCommand('bun', ['run', 'test/e2e-title.ts'])
  if (!runOk) {
    console.error('[e2e-fresh] FAIL: run failed')
    process.exit(1)
  }
  
  console.log('\n[e2e-fresh] PASS - fresh user flow works!')
  process.exit(0)
}

test().catch(err => {
  console.error('[e2e-fresh] FAIL:', err)
  process.exit(1)
})
