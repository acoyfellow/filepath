#!/usr/bin/env bun

const filePath = process.argv[2]
const searchStrings = process.argv.slice(3)

if (!filePath || searchStrings.length === 0) {
  console.error('Usage: bun run gates/_checks/file-contains.ts <file-path> <string1> [string2] ...')
  process.exit(1)
}

import { existsSync, readFileSync } from 'fs'

if (!existsSync(filePath)) {
  console.error(`File does not exist: ${filePath}`)
  process.exit(1)
}

const content = readFileSync(filePath, 'utf-8')
const missing: string[] = []

for (const s of searchStrings) {
  if (!content.includes(s)) {
    missing.push(s)
  }
}

if (missing.length > 0) {
  console.error(`Missing strings in ${filePath}:`)
  for (const s of missing) {
    console.error(`  - "${s}"`)
  }
  process.exit(1)
}

process.exit(0)
