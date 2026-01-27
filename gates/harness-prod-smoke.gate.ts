import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Gate, Act, Assert } from 'gateproof'
import { CloudflareProvider } from 'gateproof/cloudflare'

function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadDotEnv()

if (!process.env.PROD_URL) {
  try {
    const appStatePath = join(
      '.alchemy',
      'filepath',
      'jordan',
      'filepath-app.json'
    )
    if (existsSync(appStatePath)) {
      const raw = readFileSync(appStatePath, 'utf8')
      const parsed = JSON.parse(raw) as { output?: { url?: string } }
      if (parsed.output?.url) {
        process.env.PROD_URL = parsed.output.url
      }
    }
  } catch {
    // best effort; fall back to other hints
  }
}

if (!process.env.PROD_URL) {
  try {
    const webStatePath = join(
      '.alchemy',
      'filepath',
      'jordan',
      'filepath-web.json'
    )
    if (existsSync(webStatePath)) {
      const raw = readFileSync(webStatePath, 'utf8')
      const parsed = JSON.parse(raw) as { output?: { url?: string } }
      if (parsed.output?.url) {
        process.env.PROD_URL = parsed.output.url
      }
    }
  } catch {
    // best effort; fall back to API origin
  }
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN
const backend = process.env.CLOUDFLARE_LOG_BACKEND ?? 'cli-stream'
const dataset = process.env.CLOUDFLARE_LOG_DATASET
const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? 'filepath-worker'

if (!process.env.PROD_API_URL && process.env.PROD_URL) {
  try {
    const prodOrigin = new URL(process.env.PROD_URL).origin
    if (prodOrigin.includes('myfilepath.com')) {
      process.env.PROD_API_URL = 'https://api.myfilepath.com'
    }
  } catch {
    // best effort
  }
}

if (!process.env.PROD_API_URL) {
  process.env.PROD_API_URL = 'https://api.myfilepath.com'
}

if (
  process.env.PROD_URL &&
  process.env.PROD_URL.includes('workers.dev') &&
  process.env.PROD_API_URL
) {
  try {
    process.env.PROD_URL = new URL(process.env.PROD_API_URL).origin
  } catch {
    // best effort
  }
}

if (!process.env.PROD_URL && process.env.PROD_API_URL) {
  try {
    process.env.PROD_URL = new URL(process.env.PROD_API_URL).origin
  } catch {
    // best effort
  }
}

if (!accountId) {
  throw new Error('Missing CLOUDFLARE_ACCOUNT_ID')
}
if (!apiToken) {
  throw new Error('Missing CLOUDFLARE_API_TOKEN')
}

const Provider = CloudflareProvider({ accountId, apiToken })

const observe =
  backend === 'analytics'
    ? Provider.observe({
        backend,
        dataset: dataset ?? 'worker_logs'
      })
    : backend === 'workers-logs'
      ? Provider.observe({
          backend,
          workerName
        })
      : Provider.observe({
          backend: 'cli-stream',
          workerName
        })

const result = await Gate.run({
  name: 'harness-prod-smoke',
  observe,
  act: [
    Act.exec(
      'bun run gates/_checks/env-exists.ts CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN PROD_URL'
    ),
    Act.exec(`bun run gates/_checks/http-ok.ts ${process.env.PROD_URL}`),
    Act.exec('bun run gates/_checks/prod-terminal-ws.ts'),
    Act.wait(250)
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}
