/**
 * src/types.ts
 * 
 * Public types for the filepath library
 */

/**
 * Result returned from run()
 */
export interface RunResult {
  /** Whether the instruction executed successfully */
  success: boolean
  
  /** Output from the agent (what it found/did) */
  output: string
  
  /** Base64-encoded PNG screenshot as proof */
  screenshot: string
  
  /** Error message if success is false */
  error?: string
}

/**
 * Options for run()
 */
export interface RunOptions {
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number
  
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Configuration for filepath
 * Stored in .filepath/config.json by `filepath init`
 */
export interface FilepathConfig {
  /** Your deployed worker URL */
  workerUrl: string
  
  /** Cloudflare account ID */
  accountId?: string
  
  /** API token (not stored, read from env) */
  apiToken?: string
}
