function resolveApiUrl(): string {
  if (process.env.PROD_API_URL) return process.env.PROD_API_URL
  if (process.env.PROD_URL) {
    try {
      return new URL(process.env.PROD_URL).origin
    } catch {}
  }
  return 'https://api.myfilepath.com'
}

const API_URL = resolveApiUrl()
console.log('[ws-debug] api url', API_URL)

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, init, 15000)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}

function toWsUrl(url: string): string {
  return url.replace(/^http/, 'ws')
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { attempts: number; delayMs: number }
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= opts.attempts; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`[ws-debug] retrying ${label} (attempt ${attempt})`)
      }
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < opts.attempts) {
        await sleep(opts.delayMs * attempt)
      }
    }
  }
  throw lastError
}

const session = await withRetries(
  'create session',
  () =>
    requestJson<{ sessionId: string }>(`${API_URL}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }),
  { attempts: 3, delayMs: 500 }
)
console.log('[ws-debug] session', session.sessionId)

await withRetries(
  'get tabs',
  () => requestJson(`${API_URL}/session/${session.sessionId}/tabs`),
  { attempts: 3, delayMs: 500 }
)
console.log('[ws-debug] tabs ok')

await withRetries(
  'start terminal',
  () =>
    requestJson(`${API_URL}/terminal/${session.sessionId}/tab1/start`, {
      method: 'POST'
    }),
  { attempts: 3, delayMs: 1000 }
)
console.log('[ws-debug] start ok')

const wsUrl = `${toWsUrl(API_URL)}/terminal/${session.sessionId}/tab1/ws`
console.log('[ws-debug] ws url', wsUrl)

await withRetries(
  'open websocket',
  () =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket open timed out'))
      }, 8000)

      const ws = new WebSocket(wsUrl)

      ws.addEventListener('open', () => {
        console.log('[ws-debug] ws open')
        const openTimer = setTimeout(() => {
          clearTimeout(timeout)
          ws.close(1000, 'ok')
          resolve()
        }, 1500)

        ws.addEventListener('close', (event) => {
          clearTimeout(openTimer)
          clearTimeout(timeout)
          if (event.code !== 1000) {
            reject(
              new Error(
                `WebSocket closed early: ${event.code} ${event.reason || ''}`.trim()
              )
            )
          } else {
            resolve()
          }
        })
      })

      ws.addEventListener('error', () => {
        console.error('[ws-debug] ws error')
        clearTimeout(timeout)
        reject(new Error('WebSocket error'))
      })
    }),
  { attempts: 3, delayMs: 1000 }
)
