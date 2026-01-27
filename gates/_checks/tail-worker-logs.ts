import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? 'filepath-worker'

const proc = spawn(
  'wrangler',
  ['tail', workerName, '--format', 'json'],
  { stdio: ['ignore', 'pipe', 'pipe'], env: process.env }
)

if (!proc.stdout || !proc.stderr) {
  throw new Error('Failed to spawn wrangler tail')
}

proc.stderr.on('data', (buf) => {
  process.stderr.write(buf)
})

const rl = createInterface({ input: proc.stdout })
rl.on('line', (line) => {
  if (!line.trim()) return
  try {
    const parsed = JSON.parse(line)
    console.log(JSON.stringify(parsed))
  } catch {
    // Wrangler can emit non-JSON lines; forward them for visibility.
    console.log(line)
  }
})

const stop = () => {
  proc.kill('SIGTERM')
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
