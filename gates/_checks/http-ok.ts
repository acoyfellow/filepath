#!/usr/bin/env bun

const url = process.argv[2]

if (!url) {
  console.error('Usage: bun run gates/_checks/http-ok.ts <url>')
  process.exit(1)
}

if (!/^https?:\/\//.test(url)) {
  console.error(`Invalid URL: ${url}`)
  process.exit(1)
}

try {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    console.error(`Expected 200-299 from ${url}, got ${response.status}`)
    process.exit(1)
  }
} catch (error) {
  console.error(`Request failed for ${url}: ${String(error)}`)
  process.exit(1)
}

process.exit(0)
