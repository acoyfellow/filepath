/**
 * Legacy worker index — kept minimal for Alchemy binding compatibility.
 * The Sandbox re-export is required by alchemy.run.ts Container binding.
 * SessionDO exists only as a compatibility binding and fails closed.
 */

import { Sandbox } from '@cloudflare/sandbox';
import { DurableObject } from 'cloudflare:workers';

// Re-export Sandbox for Container binding (alchemy.run.ts references it)
export { Sandbox };

// Compatibility SessionDO — referenced in alchemy config until removed.
export class SessionDO extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    return new Response('SessionDO is not implemented', { status: 501 });
  }
}
