#!/usr/bin/env bun

/**
 * prod-test.gate.ts
 *
 * Test the actual deployed library in production.
 * This gate verifies that the built library works end-to-end.
 */

import { existsSync } from 'fs'
import { spawnSync } from 'child_process'

// Verify dist/ exists and has index.js
if (!existsSync('dist/index.js')) {
  console.error('❌ dist/index.js not found - run build first')
  process.exit(1)
}

// Create a test script that imports and tests the library
const testScript = `
import { run } from './dist/index.js'

async function testProd() {
  console.log('🧪 Testing production library...')

  try {
    // Test 1: Basic import works
    console.log('✅ Library imported successfully')

    // Test 2: Try to run a simple instruction
    console.log('🏃 Running test instruction...')
    const result = await run('get title of example.com', {
      timeout: 30000,
      debug: true
    })

    console.log('📊 Result:', {
      success: result.success,
      outputLength: result.output.length,
      screenshotLength: result.screenshot.length,
      hasError: !!result.error
    })

    if (result.success) {
      console.log('✅ Production test PASSED')
      console.log('📝 Output preview:', result.output.substring(0, 100) + '...')
    } else {
      console.log('❌ Production test FAILED')
      console.log('🚨 Error:', result.error)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Production test CRASHED:', error.message)
    process.exit(1)
  }
}

testProd()
`

// Write test script to temp file
require('fs').writeFileSync('prod-test-temp.js', testScript)

// Run the test
console.log('🚀 Running production test...')
const result = spawnSync('bun', ['run', 'prod-test-temp.js'], {
  stdio: 'inherit',
  encoding: 'utf-8'
})

// Clean up
require('fs').unlinkSync('prod-test-temp.js')

// Check result
if (result.status === 0) {
  console.log('✅ PROD TEST PASSED')
} else {
  console.log('❌ PROD TEST FAILED')
  process.exit(1)
}