/**
 * test/e2e-form.ts
 * 
 * E2E test: fill form with verification screenshot
 * 
 * THE MONEY GATE - if this passes, the core product works
 */

import { run, configure } from '../src'

async function test() {
  console.log('[e2e-form] starting...')
  
  const workerUrl = process.env.FILEPATH_WORKER_URL
  if (workerUrl) {
    configure(workerUrl)
  }
  
  const instruction = `
    Go to https://httpbin.org/forms/post
    Find the form on the page
    Fill it with:
      - custname: Test User
      - custtel: 555-1234
      - custemail: test@example.com
      - size: medium
      - topping: bacon
      - comments: Automated test from filepath
    Submit the form
    Verify it was submitted successfully
  `
  
  const result = await run(instruction, {
    debug: true,
    timeout: 60000,
  })
  
  console.log('[e2e-form] result:', JSON.stringify({
    success: result.success,
    output: result.output,
    error: result.error,
    screenshotLength: result.screenshot?.length || 0,
  }, null, 2))
  
  if (!result.success) {
    console.error('[e2e-form] FAIL: not successful')
    console.error('[e2e-form] error:', result.error)
    process.exit(1)
  }
  
  if (!result.screenshot || result.screenshot.length < 100) {
    console.error('[e2e-form] FAIL: no screenshot proof')
    process.exit(1)
  }
  
  console.log('[e2e-form] PASS')
  console.log('[e2e-form] screenshot proof captured (%d bytes)', result.screenshot.length)
  process.exit(0)
}

test().catch(err => {
  console.error('[e2e-form] FAIL:', err)
  process.exit(1)
})
