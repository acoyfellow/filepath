/**
 * cli/deploy.ts
 * 
 * filepath deploy - deploy worker + container to CF
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

export async function deploy() {
  console.log('filepath deploy\n')
  
  // Check config exists
  const configPath = join(process.cwd(), '.filepath', 'config.json')
  if (!existsSync(configPath)) {
    console.log('No config found. Run `filepath init` first.\n')
    return
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  
  // Check for worker directory
  const workerDir = join(process.cwd(), 'worker')
  if (!existsSync(workerDir)) {
    console.log('No worker/ directory found.')
    console.log('Make sure you are in the filepath project root.\n')
    return
  }
  
  console.log('Deploying worker...')
  
  // Deploy worker using wrangler
  const wrangler = spawn('npx', ['wrangler', 'deploy'], {
    cwd: workerDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
    }
  })
  
  await new Promise<void>((resolve, reject) => {
    wrangler.on('close', (code) => {
      if (code === 0) {
        console.log('\n✓ Worker deployed')
        resolve()
      } else {
        reject(new Error(`wrangler exited with code ${code}`))
      }
    })
  })
  
  // TODO: Deploy container to CF registry
  console.log('\nContainer deployment: TODO (use CF Containers dashboard for now)')
  
  console.log(`\nWorker URL: ${config.workerUrl}`)
  console.log('\nYou can now use filepath in your code:')
  console.log('')
  console.log("  import { run } from 'filepath'")
  console.log('  const result = await run("go to example.com and get the title")')
  console.log('')
}
