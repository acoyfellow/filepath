#!/usr/bin/env bun

const base = 'http://localhost:1337'

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}${path}`, init)
}

try {
  const sessionId = crypto.randomUUID()
  const createRes = await request('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  })
  if (!createRes.ok) {
    console.error(`Expected 200-299 from /session, got ${createRes.status}`)
    process.exit(1)
  }

  const tabsRes = await request(`/session/${sessionId}/tabs`)
  if (!tabsRes.ok) {
    console.error(
      `Expected 200-299 from /session/${sessionId}/tabs, got ${tabsRes.status}`
    )
    process.exit(1)
  }

  const tabRes = await request(
    `/terminal/${sessionId}/tab?tab=tab1&parentOrigin=${encodeURIComponent(
      'http://localhost:5173'
    )}`
  )
  if (!tabRes.ok) {
    console.error(
      `Expected 200-299 from /terminal/${sessionId}/tab, got ${tabRes.status}`
    )
    process.exit(1)
  }
  const contentType = tabRes.headers.get('Content-Type') || ''
  if (!contentType.includes('text/html')) {
    console.error(
      `Expected text/html from /terminal/${sessionId}/tab, got ${contentType}`
    )
    process.exit(1)
  }
} catch (error) {
  console.error(`Dev API check failed: ${String(error)}`)
  process.exit(1)
}

process.exit(0)
