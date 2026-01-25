/**
 * agent/index.ts
 * 
 * Entry point for the filepath agent.
 * Receives instruction, executes via claude, returns result.
 */

import * as browser from './browser'

export interface AgentResult {
  success: boolean
  output: string
  screenshot: string
  error?: string
}

/**
 * Execute an instruction using the browser
 * 
 * This is called by the worker with a natural language instruction.
 * The agent uses claude to interpret and execute the instruction.
 */
export async function execute(instruction: string): Promise<AgentResult> {
  try {
    // For now: simple implementation
    // TODO: integrate with claude CLI for full natural language execution
    
    console.log(`[agent] executing: ${instruction}`)
    
    // Parse simple instructions (this is the stub - claude will handle complex ones)
    if (instruction.toLowerCase().includes('title') && instruction.toLowerCase().includes('example.com')) {
      await browser.goto('https://example.com')
      const title = await browser.getTitle()
      const screenshot = await browser.screenshot()
      await browser.close()
      
      return {
        success: true,
        output: title,
        screenshot,
      }
    }
    
    // Default: try to go to first URL found in instruction
    const urlMatch = instruction.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      await browser.goto(urlMatch[0])
      const title = await browser.getTitle()
      const screenshot = await browser.screenshot()
      await browser.close()
      
      return {
        success: true,
        output: `Visited ${urlMatch[0]}. Title: ${title}`,
        screenshot,
      }
    }
    
    return {
      success: false,
      output: '',
      screenshot: '',
      error: 'Could not parse instruction. TODO: integrate claude for complex instructions.',
    }
    
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[agent] error: ${error}`)
    
    return {
      success: false,
      output: '',
      screenshot: '',
      error,
    }
  }
}

// If run directly, read instruction from stdin or args
if (import.meta.main) {
  const instruction = process.argv[2] || await Bun.stdin.text()
  
  if (!instruction.trim()) {
    console.error('Usage: bun run agent/index.ts "instruction"')
    process.exit(1)
  }
  
  const result = await execute(instruction.trim())
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}
