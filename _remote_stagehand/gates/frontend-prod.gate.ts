#!/usr/bin/env bun

/**
 * frontend-prod.gate.ts
 *
 * Test the production frontend UI
 */

import { existsSync } from 'fs'

// Verify worker has frontend route
if (!existsSync('worker/src/index.ts')) {
  console.error('❌ worker/src/index.ts not found')
  process.exit(1)
}

// Read worker file and check for HTML_PAGE constant and frontend route
const workerContent = require('fs').readFileSync('worker/src/index.ts', 'utf-8')

if (!workerContent.includes('HTML_PAGE = `<!DOCTYPE html>')) {
  console.error('❌ Frontend HTML not found in worker')
  process.exit(1)
}

if (!workerContent.includes("if (url.pathname === '/' && request.method === 'GET')")) {
  console.error('❌ Frontend route not found in worker')
  process.exit(1)
}

console.log('✅ Frontend code found in worker')

// Test the frontend endpoint
const https = require('https')

const testFrontend = () => {
  return new Promise((resolve, reject) => {
    const req = https.get('https://filepath-worker.coy.workers.dev/', (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('<title>filepath - Natural Language Browser Automation</title>')) {
          console.log('✅ Frontend served successfully')
          console.log('✅ HTML contains expected title')
          resolve(true)
        } else {
          console.error('❌ Frontend not served correctly')
          console.error('Status:', res.statusCode)
          console.error('Response preview:', data.substring(0, 200) + '...')
          resolve(false)
        }
      })
    })

    req.on('error', (err) => {
      console.error('❌ Frontend request failed:', err.message)
      resolve(false)
    })

    req.setTimeout(10000, () => {
      console.error('❌ Frontend request timed out')
      req.destroy()
      resolve(false)
    })
  })
}

testFrontend().then(success => {
  if (success) {
    console.log('✅ FRONTEND PROD TEST PASSED')
  } else {
    console.log('❌ FRONTEND PROD TEST FAILED')
    process.exit(1)
  }
})