/**
 * Legacy worker index — kept minimal for Alchemy binding compatibility.
 * The Sandbox re-export is required by alchemy.run.ts Container binding.
 * SessionDO is kept as a stub until fully removed from alchemy config.
 */

import { Sandbox } from '@cloudflare/sandbox';
import { DurableObject } from 'cloudflare:workers';

// Re-export Sandbox for Container binding (alchemy.run.ts references it)
export { Sandbox };

// Stub SessionDO — referenced in alchemy config, will be removed
export class SessionDO extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    return new Response('SessionDO deprecated', { status: 410 });
  }
}
