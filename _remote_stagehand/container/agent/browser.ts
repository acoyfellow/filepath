/**
 * browser.ts
 * Playwright helpers for the agent
 */

import { chromium, Browser, Page } from 'playwright'

let browser: Browser | null = null
let page: Page | null = null

export async function launch(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  
  if (!page) {
    page = await browser.newPage()
  }
  
  return page
}

export async function goto(url: string): Promise<void> {
  const p = await launch()
  await p.goto(url, { waitUntil: 'domcontentloaded' })
}

export async function click(selector: string): Promise<void> {
  const p = await launch()
  await p.click(selector)
}

export async function fill(selector: string, value: string): Promise<void> {
  const p = await launch()
  await p.fill(selector, value)
}

export async function type(selector: string, value: string): Promise<void> {
  const p = await launch()
  await p.type(selector, value)
}

export async function screenshot(): Promise<string> {
  const p = await launch()
  const buffer = await p.screenshot({ type: 'png', fullPage: false })
  return buffer.toString('base64')
}

export async function getTitle(): Promise<string> {
  const p = await launch()
  return p.title()
}

export async function getContent(): Promise<string> {
  const p = await launch()
  return p.content()
}

export async function close(): Promise<void> {
  if (page) {
    await page.close()
    page = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
}
