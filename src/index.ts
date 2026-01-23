/**
 * filepath
 * 
 * run(instruction) → { success, output, screenshot, error }
 */

import type { RunResult, RunOptions, FilepathConfig } from './types'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export type { RunResult, RunOptions, FilepathConfig } from './types'

// Default worker URL (user's deployed worker)
let workerUrl: string | null = null

/**
 * Load config from .filepath/config.json
 */
function loadConfig(): FilepathConfig | null {
  const configPath = join(process.cwd(), '.filepath', 'config.json')
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  
  return null
}

/**
 * Configure the worker URL
 */
export function configure(url: string): void {
  workerUrl = url
}

/**
 * Run an instruction
 * 
 * @example
 * ```ts
 * import { run } from 'filepath'
 * 
 * const result = await run("go to example.com and get the page title")
 * 
 * if (result.success) {
 *   console.log(result.output)      // "Example Domain"
 *   console.log(result.screenshot)  // base64 PNG
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export async function run(
  instruction: string,
  options: RunOptions = {}
): Promise<RunResult> {
  const { timeout = 60000, debug = false } = options
  
  // Get worker URL
  let url = workerUrl
  
  if (!url) {
    const config = loadConfig()
    if (config?.workerUrl) {
      url = config.workerUrl
    }
  }
  
  if (!url) {
    // Check env
    url = process.env.FILEPATH_WORKER_URL || null
  }
  
  if (!url) {
    return {
      success: false,
      output: '',
      screenshot: '',
      error: 'No worker URL configured. Run `filepath init` and `filepath deploy` first, or set FILEPATH_WORKER_URL.',
    }
  }
  
  if (debug) {
    console.log(`[filepath] POST ${url}/run`)
    console.log(`[filepath] instruction: ${instruction}`)
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(`${url}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instruction }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    const result = await response.json() as RunResult
    
    if (debug) {
      console.log(`[filepath] success: ${result.success}`)
      if (result.error) console.log(`[filepath] error: ${result.error}`)
    }
    
    return result
    
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown error'
    
    if (debug) {
      console.error(`[filepath] fetch error: ${error}`)
    }
    
    return {
      success: false,
      output: '',
      screenshot: '',
      error: `Failed to reach worker: ${error}`,
    }
  }
}

// Default export for convenience
export default { run, configure }
