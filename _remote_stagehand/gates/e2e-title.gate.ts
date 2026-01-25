import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

// Get worker URL from account subdomain
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN
if (!accountId || !apiToken) {
  console.error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not set')
  process.exit(1)
}

// Fetch account subdomain from CF API
const subdomainResponse = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
  { headers: { Authorization: `Bearer ${apiToken}` } }
)
const subdomainData = await subdomainResponse.json()
const subdomain = subdomainData.result?.subdomain

if (!subdomain) {
  console.error('Failed to get workers.dev subdomain')
  process.exit(1)
}

const workerUrl = `https://filepath-worker.${subdomain}.workers.dev`
process.env.FILEPATH_WORKER_URL = workerUrl

const result = await Gate.run({
  name: 'e2e-title',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run test/e2e-title.ts', { timeoutMs: 60000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  if (result.error) {
    console.error('E2E error:', result.error)
  }
  process.exit(1)
}
