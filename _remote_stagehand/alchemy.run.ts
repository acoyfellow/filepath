/**
 * alchemy.run.ts
 * 
 * Typed Cloudflare infrastructure.
 * Run with: bunx alchemy run
 */

import alchemy from 'alchemy'

// The worker that orchestrates containers
export const worker = alchemy.Worker('filepath-worker', {
  main: './worker/src/index.ts',
  compatibilityDate: '2024-01-01',
  durableObjects: {
    CONTAINER_MANAGER: 'ContainerManager'
  }
})

// Container image for the agent
export const container = alchemy.Container('filepath-agent', {
  dockerfile: './container/Dockerfile',
  // The container runs: bun + chromium + playwright + claude
})

// Export for CLI
export default {
  worker,
  container,
}
