/**
 * cli/init.ts
 * 
 * filepath init - set up config
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function init() {
  console.log('filepath init\n')
  
  const configDir = join(process.cwd(), '.filepath')
  const configPath = join(configDir, 'config.json')
  
  if (existsSync(configPath)) {
    console.log('Config already exists at .filepath/config.json')
    console.log('Delete it to re-initialize.\n')
    return
  }
  
  // Check for required env vars
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  
  const missing: string[] = []
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID')
  if (!apiToken) missing.push('CLOUDFLARE_API_TOKEN')
  if (!anthropicKey) missing.push('ANTHROPIC_API_KEY')
  
  if (missing.length > 0) {
    console.log('Missing required environment variables:')
    for (const v of missing) {
      console.log(`  - ${v}`)
    }
    console.log('\nSet these in your environment or .env file, then run init again.\n')
    return
  }
  
  // Create config
  mkdirSync(configDir, { recursive: true })
  
  const config = {
    accountId,
    workerUrl: `https://filepath-worker.${accountId}.workers.dev`,
    createdAt: new Date().toISOString(),
  }
  
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  
  // Add .filepath to .gitignore
  const gitignorePath = join(process.cwd(), '.gitignore')
  if (existsSync(gitignorePath)) {
    const content = Bun.file(gitignorePath).text()
    if (!(await content).includes('.filepath')) {
      Bun.write(gitignorePath, (await content) + '\n.filepath/\n')
      console.log('Added .filepath/ to .gitignore')
    }
  }
  
  console.log('Created .filepath/config.json')
  console.log('\nNext: filepath deploy')
  console.log('')
}
