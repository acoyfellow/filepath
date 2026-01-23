/**
 * worker/src/ContainerManager.ts
 * 
 * Durable Object that manages container lifecycle.
 * Spawns containers, sends instructions, receives results.
 */

export interface RunResult {
  success: boolean
  output: string
  screenshot: string
  error?: string
}

export class ContainerManager {
  private state: DurableObjectState
  private containerRef: any | null = null
  
  constructor(state: DurableObjectState) {
    this.state = state
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    if (url.pathname === '/run' && request.method === 'POST') {
      return this.handleRun(request)
    }
    
    return new Response('ContainerManager DO', { status: 200 })
  }
  
  private async handleRun(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { instruction: string }
      const { instruction } = body
      
      console.log(`[ContainerManager] instruction: ${instruction}`)
      
      // Spawn container
      const container = await this.spawn()
      
      // Send instruction to container
      const result = await this.sendInstruction(container, instruction)
      
      // Cleanup
      await this.cleanup(container)
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      })
      
    } catch (err) {
      const error = err instanceof Error ? err.message : 'unknown error'
      console.error(`[ContainerManager] error: ${error}`)
      
      const result: RunResult = {
        success: false,
        output: '',
        screenshot: '',
        error,
      }
      
      return new Response(JSON.stringify(result), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  private async spawn(): Promise<any> {
    // TODO: Implement CF Container spawn
    // This is a stub - will use CF Containers API
    console.log('[ContainerManager] spawn container')
    
    // For now, return a mock container reference
    this.containerRef = { id: `container-${Date.now()}` }
    return this.containerRef
  }
  
  private async sendInstruction(container: any, instruction: string): Promise<RunResult> {
    // TODO: Implement actual container communication
    // This will use CF Containers fetch/websocket
    console.log(`[ContainerManager] sendInstruction to ${container.id}`)
    
    // Stub result
    return {
      success: true,
      output: `Executed: ${instruction}`,
      screenshot: '', // base64 would go here
    }
  }
  
  private async cleanup(container: any): Promise<void> {
    // TODO: Implement container destroy/cleanup
    console.log(`[ContainerManager] cleanup ${container.id}`)
    this.containerRef = null
  }
}
