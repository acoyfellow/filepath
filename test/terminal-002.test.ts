import { describe, it } from 'vitest';

describe('002: Per-tab terminal plumbing', () => {
  it.todo('POST /terminal/:sessionId/:tabId/start starts ttyd and waits for port 7681');
  it.todo('GET /terminal/:sessionId/:tabId/ws returns 101 and forwards bytes both directions');
  it.todo('After connecting to ttyd WS, send {columns,rows} JSON as TEXT to trigger prompt');
});
