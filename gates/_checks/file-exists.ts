#!/usr/bin/env bun

const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: bun run gates/_checks/file-exists.ts <file-path>')
  process.exit(1)
}

import { existsSync } from 'fs'

if (existsSync(filePath)) {
  process.exit(0)
} else {
  console.error(`File does not exist: ${filePath}`)
  process.exit(1)
}
