#!/usr/bin/env bun
import { spawn } from 'child_process';
import { Effect, Queue } from 'effect';
import { chromium } from 'playwright';

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

// Start tailing and return a queue that receives logs
async function startTailing(accountId: string, workerName: string): Promise<{
  queue: Queue.Queue<StructuredLog>;
  process: ReturnType<typeof spawn>;
}> {
  const queue = await Effect.runPromise(Queue.unbounded<StructuredLog>());
  
  const wrangler = spawn('wrangler', ['tail', workerName, '--format', 'json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId }
  });

  wrangler.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      const entry = parseLog(line);
      if (entry) {
        Effect.runPromise(Queue.offer(queue, entry));
      }
    }
  });

  wrangler.stderr.on('data', (data: Buffer) => {
    const error = data.toString();
    if (error.includes('ERROR')) {
      console.error(`[Wrangler] ${error}`);
    }
  });

  wrangler.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[Wrangler] Process exited with code ${code}`);
    }
  });

  return { queue, process: wrangler };
}

// Process logs from queue with timeout - non-blocking
async function processLogsWithTimeout(queue: Queue.Queue<StructuredLog>, timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  let lastLogTime = startTime;
  const noLogTimeout = 3000; // If no logs for 3s, consider done
  
  while (Date.now() - startTime < timeoutMs) {
    // Check queue size first to avoid blocking
    const size = await Effect.runPromise(Queue.size(queue));
    
    if (size > 0) {
      try {
        const log = await Effect.runPromise(Queue.take(queue));
        lastLogTime = Date.now();
        if (log.requestId || log.stage || log.action) {
          console.log(JSON.stringify(log, null, 2));
        }
      } catch (error) {
        // Continue on error
      }
    } else {
      // Queue is empty, check if we should exit
      const timeSinceLastLog = Date.now() - lastLogTime;
      if (timeSinceLastLog > noLogTimeout) {
        console.log(`[Logs] No logs for ${noLogTimeout}ms. Exiting...`);
        break;
      }
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

// Playwright automation
async function runBrowserTest(url: string): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('WebSocket') || text.includes('error') || text.includes('Error') || text.includes('failed')) {
      console.error(`[Browser] ${msg.type()}: ${text}`);
    }
  });

  // Capture network failures
  page.on('requestfailed', (request) => {
    console.error(`[Browser] Request failed: ${request.method()} ${request.url()}`);
  });

  console.log(`[Browser] Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
    // Continue even if page load times out
  });

  // Wait 5 seconds, then close
  console.log(`[Browser] Waiting 5s...`);
  await page.waitForTimeout(5000);
  
  console.log(`[Browser] Closing browser...`);
  await browser.close();
}

// Main orchestration
async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'bfcb6ac5b3ceaf42a09607f6f7925823';
  const workerName = process.argv[2] || 'terminal-app';
  const testUrl = process.argv[3] || 'https://terminal-app.coy.workers.dev/';

  console.log('🔍 E2E Debug Harness');
  console.log(`Worker: ${workerName}`);
  console.log(`URL: ${testUrl}`);
  console.log(`Account: ${accountId.slice(0, 8)}...\n`);

  // Start log tailing
  console.log('[Logs] Starting wrangler tail...');
  const { queue, process: wranglerProcess } = await startTailing(accountId, workerName);
  
  // Small delay to let tailing establish connection
  console.log('[Logs] Waiting for tail connection (2s)...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('[Logs] Tailing active. Starting browser test...\n');

  // Run browser test
  await runBrowserTest(testUrl);

  // Quick success - just wait 5 seconds for any logs, then exit
  console.log('\n[Logs] Waiting 5s for any logs, then exiting...\n');
  await processLogsWithTimeout(queue, 5000);
  
  console.log('\n✅ Test complete. Exiting...\n');
  wranglerProcess.kill('SIGTERM');
  process.exit(0);
}

main().catch(console.error);
