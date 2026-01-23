/**
 * worker/src/index.ts
 * 
 * Worker entry point. Routes requests to ContainerManager DO.
 */

import { ContainerManager } from './ContainerManager'

export { ContainerManager }

export interface Env {
  CONTAINER_MANAGER: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // POST /run - execute instruction
    if (url.pathname === '/run' && request.method === 'POST') {
      try {
        // Clone request so we can read body and forward to DO
        const clonedRequest = request.clone()
        const body = await request.json() as { instruction: string }
        
        if (!body.instruction) {
          return new Response(JSON.stringify({ error: 'instruction required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        // Get or create a container manager
        const id = env.CONTAINER_MANAGER.idFromName('default')
        const stub = env.CONTAINER_MANAGER.get(id)
        
        // Forward cloned request to DO (body not consumed)
        return stub.fetch(clonedRequest)
        
      } catch (err) {
        const error = err instanceof Error ? err.message : 'unknown error'
        return new Response(JSON.stringify({ error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    return new Response('filepath worker. POST /run with { instruction: "..." }', {
      status: 200,
    })
  }
}
