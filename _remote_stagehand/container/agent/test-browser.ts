/**
 * test-browser.ts
 * Verify playwright works in container
 */

import { chromium } from 'playwright'

async function test() {
  console.log('[test] launching browser...')
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  console.log('[test] browser launched')
  
  const page = await browser.newPage()
  await page.goto('https://example.com')
  
  const title = await page.title()
  console.log(`[test] page title: ${title}`)
  
  await browser.close()
  console.log('[test] browser closed')
  
  if (title.includes('Example')) {
    console.log('[test] PASS')
    process.exit(0)
  } else {
    console.log('[test] FAIL - unexpected title')
    process.exit(1)
  }
}

test().catch(err => {
  console.error('[test] FAIL:', err)
  process.exit(1)
})
