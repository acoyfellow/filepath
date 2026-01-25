import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

// Ensure env vars are available for init
if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
  console.error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not set')
  process.exit(1)
}

const result = await Gate.run({
  name: 'e2e-fresh',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run test/e2e-fresh.ts', { timeoutMs: 300000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  if (result.error) {
    console.error('E2E fresh error:', result.error)
  }
  process.exit(1)
}
