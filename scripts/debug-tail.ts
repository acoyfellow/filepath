#!/usr/bin/env bun
import { spawn } from 'child_process';

interface StructuredLog {
  requestId?: string;
  timestamp?: string;
  stage?: 'worker' | 'durable_object' | 'container';
  action?: string;
  status?: 'start' | 'success' | 'error' | 'info';
  durableObjectId?: string;
  containerId?: string;
  error?: {
    tag: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
  durationMs?: number;
  [key: string]: unknown;
}

function parseLog(line: string): StructuredLog | null {
  try {
    const parsed = JSON.parse(line);
    
    // If message contains JSON, try to parse it
    if (typeof parsed.message === 'string') {
      try {
        const innerLog = JSON.parse(parsed.message);
        return { ...parsed, ...innerLog };
      } catch {
        // Not JSON, return original
      }
    }
    
    return parsed;
  } catch {
    return null;
  }
}

function formatForAI(entry: StructuredLog): string {
  // Return pure JSON - AI can parse this best
  return JSON.stringify(entry, null, 2);
}

const filterRequestId = process.argv[2];
const filterStage = process.argv[3];

// For production tailing, we need account_id
// Try to get it from env or wrangler config
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const tailArgs = ['tail', '--format', 'json'];
if (accountId) {
  tailArgs.push('--account-id', accountId);
}

const wrangler = spawn('wrangler', tailArgs, {
  stdio: ['ignore', 'pipe', 'pipe'],
  cwd: process.cwd(),
  env: { ...process.env }
});

console.error('🔍 Streaming structured logs (AI-friendly format)\n');
console.error(`Filters: ${filterRequestId ? `requestId=${filterRequestId.slice(0, 8)}` : 'none'} ${filterStage ? `stage=${filterStage}` : ''}\n`);

wrangler.stdout.on('data', (data: Buffer) => {
  const lines = data.toString().split('\n').filter(Boolean);
  
  for (const line of lines) {
    const entry = parseLog(line);
    if (!entry) {
      // Output raw line if not parseable
      console.log(line);
      continue;
    }
    
    // Filtering
    if (filterRequestId && entry.requestId?.slice(0, 8) !== filterRequestId.slice(0, 8)) {
      continue;
    }
    if (filterStage && entry.stage !== filterStage) {
      continue;
    }
    
    // Output pure JSON for AI consumption
    console.log(formatForAI(entry));
  }
});

wrangler.stderr.on('data', (data: Buffer) => {
  process.stderr.write(data);
});

wrangler.on('close', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  wrangler.kill();
  process.exit(0);
});
