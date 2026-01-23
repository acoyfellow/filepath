/**
 * test/e2e-title.ts
 * 
 * E2E test: run("get title of example.com") → "Example Domain"
 */

import { run, configure } from '../src'

async function test() {
  console.log('[e2e-title] starting...')
  
  // Configure worker URL from env or config
  const workerUrl = process.env.FILEPATH_WORKER_URL
  if (workerUrl) {
    configure(workerUrl)
  }
  
  const result = await run('go to example.com and get the page title', {
    debug: true,
    timeout: 30000,
  })
  
  console.log('[e2e-title] result:', JSON.stringify(result, null, 2))
  
  if (!result.success) {
    console.error('[e2e-title] FAIL: not successful')
    console.error('[e2e-title] error:', result.error)
    process.exit(1)
  }
  
  if (!result.output.toLowerCase().includes('example')) {
    console.error('[e2e-title] FAIL: output does not contain "example"')
    console.error('[e2e-title] output:', result.output)
    process.exit(1)
  }
  
  console.log('[e2e-title] PASS')
  process.exit(0)
}

test().catch(err => {
  console.error('[e2e-title] FAIL:', err)
  process.exit(1)
})
