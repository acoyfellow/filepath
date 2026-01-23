/**
 * cli/status.ts
 * 
 * filepath status - check deployment status
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export async function status() {
  console.log('filepath status\n')
  
  // Check config
  const configPath = join(process.cwd(), '.filepath', 'config.json')
  if (!existsSync(configPath)) {
    console.log('Status: NOT INITIALIZED')
    console.log('Run `filepath init` to set up.\n')
    return
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  
  console.log('Config: ✓')
  console.log(`  Account ID: ${config.accountId}`)
  console.log(`  Worker URL: ${config.workerUrl}`)
  console.log(`  Created: ${config.createdAt}`)
  
  // Check if worker is deployed and responding
  console.log('\nChecking worker...')
  
  try {
    const response = await fetch(`${config.workerUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`Worker: ✓ deployed and healthy`)
    } else {
      console.log(`Worker: ✗ responded with ${response.status}`)
    }
  } catch (err) {
    console.log(`Worker: ✗ not reachable`)
    console.log(`  Run \`filepath deploy\` to deploy.`)
  }
  
  console.log('')
}
