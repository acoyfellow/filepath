#!/usr/bin/env bun

const envBase = process.env.VITE_API_BASE

if (!envBase) {
  process.exit(0)
}

if (envBase === 'http://localhost:1337') {
  process.exit(0)
}

console.error(
  `VITE_API_BASE must be unset or http://localhost:1337 in dev, got: ${envBase}`
)
process.exit(1)
