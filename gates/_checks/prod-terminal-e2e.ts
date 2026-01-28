#!/usr/bin/env bun

/**
 * E2E gate: verify the full terminal flow works in prod via Playwright.
 *
 * 1. Navigate to the prod URL
 * 2. Wait for the app to create a session and load a terminal iframe
 * 3. Wait for the terminal status to become "connected"
 *    (proves: sandbox warmup, ttyd start, WS proxy, xterm attach)
 * 4. Verify terminal output appears inside the iframe
 */

import { chromium } from 'playwright';

const PROD_URL = process.env.PROD_URL || 'https://myfilepath.com';
const TIMEOUT = 90_000; // 90s — sandbox warmup can take up to ~10s

/** Redact anything that looks like a secret key or token */
function redact(text: string): string {
  return text.replace(/\b(sk-[A-Za-z0-9]{6})[A-Za-z0-9]+/g, '$1***');
}

let browser;
try {
  console.log(`[e2e] launching browser, navigating to ${PROD_URL}`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages for debugging
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  console.log('[e2e] page loaded');

  // Wait for a terminal iframe to appear
  const iframeLocator = page.locator('iframe.terminal-iframe').first();
  await iframeLocator.waitFor({ state: 'attached', timeout: 15_000 });
  console.log('[e2e] terminal iframe attached');

  // Wait for terminal status to become "connected"
  // The parent page renders a .terminal-status element with class .terminal-status-connected
  const connectedBadge = page.locator('.terminal-status-connected').first();
  await connectedBadge.waitFor({ state: 'visible', timeout: TIMEOUT });
  console.log('[e2e] terminal status: connected');

  // Verify the iframe has loaded and xterm rendered something
  const frame = await iframeLocator.contentFrame();
  if (!frame) {
    throw new Error('Could not access terminal iframe content');
  }

  // xterm renders into a .xterm-screen element; wait for it
  await frame.locator('.xterm-screen').waitFor({ state: 'visible', timeout: 15_000 });
  console.log('[e2e] xterm screen visible inside iframe');

  // Check that the xterm viewport has some text content (not empty)
  // xterm renders rows as divs inside .xterm-rows
  const rowCount = await frame.locator('.xterm-rows > div').count();
  if (rowCount === 0) {
    throw new Error('xterm rendered but has no rows');
  }
  console.log(`[e2e] xterm has ${rowCount} rows`);

  // Try to read some visible text from the terminal
  const textContent = await frame.locator('.xterm-rows').textContent({ timeout: 5_000 }).catch(() => '');
  const trimmed = textContent?.trim() || '';
  if (trimmed.length > 0) {
    // Show first 200 chars of terminal output (redacted)
    console.log(`[e2e] terminal text (first 200): ${redact(trimmed.slice(0, 200))}`);
  } else {
    console.log('[e2e] terminal rows present but text empty (canvas-rendered, expected)');
  }

  // Clean up: extract sessionId from iframe src and delete the session
  const iframeSrc = await iframeLocator.getAttribute('src') || '';
  const sessionMatch = iframeSrc.match(/\/terminal\/([^/]+)\//);
  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    const apiBase = new URL(PROD_URL).origin.replace('://myfilepath', '://api.myfilepath');
    try {
      await fetch(`${apiBase}/session/${sessionId}`, { method: 'DELETE' });
      console.log(`[e2e] session ${sessionId} cleaned up`);
    } catch {
      console.log(`[e2e] session cleanup failed (non-fatal)`);
    }
  }

  console.log('[e2e] PASS');
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[e2e] FAIL: ${msg}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
} finally {
  if (browser) {
    await browser.close();
  }
}
