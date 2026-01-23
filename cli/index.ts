#!/usr/bin/env bun
/**
 * cli/index.ts
 * 
 * filepath CLI
 * 
 * Usage:
 *   filepath init    - set up config with CF credentials
 *   filepath deploy  - deploy worker + container to CF
 *   filepath status  - check deployment status
 */

const command = process.argv[2]

async function main() {
  switch (command) {
    case 'init':
      const { init } = await import('./init')
      await init()
      break
      
    case 'deploy':
      const { deploy } = await import('./deploy')
      await deploy()
      break
      
    case 'status':
      const { status } = await import('./status')
      await status()
      break
      
    default:
      console.log(`
filepath - run(instruction) → verified result

Usage:
  filepath init     Set up config with Cloudflare credentials
  filepath deploy   Deploy worker + container to Cloudflare
  filepath status   Check deployment status

After deploying, use in your code:

  import { run } from 'filepath'
  const result = await run("go to example.com and get the title")
`)
      break
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
