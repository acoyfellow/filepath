import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

// Ensure env vars are available
if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN')
  process.exit(1)
}

const result = await Gate.run({
  name: 'worker-deployed',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('npx wrangler deploy', { cwd: 'worker', timeoutMs: 300000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  if (result.error) {
    console.error('Deployment error:', result.error)
  }
  process.exit(1)
}
