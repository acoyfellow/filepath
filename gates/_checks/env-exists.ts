#!/usr/bin/env bun

const envKeys = process.argv.slice(2)

if (envKeys.length === 0) {
  console.error('Usage: bun run gates/_checks/env-exists.ts <key1> [key2] ...')
  process.exit(1)
}

const missing: string[] = []

for (const key of envKeys) {
  if (!process.env[key]) {
    missing.push(key)
  }
}

if (missing.length > 0) {
  console.error(`Missing environment variables:`)
  for (const key of missing) {
    console.error(`  - ${key}`)
  }
  process.exit(1)
}

process.exit(0)
