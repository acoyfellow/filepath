#!/usr/bin/env bun

/**
 * test-filepath.js
 *
 * Test filepath library from command line
 */

import { run } from './dist/index.js'

async function testFilepath() {
  const instruction = process.argv[2] || 'get title of example.com'

  console.log(`🧪 Testing filepath with instruction: "${instruction}"\n`)

  try {
    const result = await run(instruction, {
      timeout: 30000,
      debug: true
    })

    console.log('📊 Result:')
    console.log('Success:', result.success)

    if (result.success) {
      console.log('Output:', result.output)
      console.log('Screenshot length:', result.screenshot.length, 'characters')

      // Save screenshot to file if available
      if (result.screenshot) {
        const fs = require('fs')
        fs.writeFileSync('screenshot.png', Buffer.from(result.screenshot, 'base64'))
        console.log('📸 Screenshot saved to screenshot.png')
      }
    } else {
      console.log('Error:', result.error)
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

if (import.meta.main) {
  testFilepath()
}