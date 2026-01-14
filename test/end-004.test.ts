import { describe, it } from 'vitest';

describe('004: North Star - shareable multi-terminal session', () => {
  it.todo('Shareable URL /session/:sessionId loads without login; optional password gate supported');
  it.todo('Page shows N tabs; switching tabs swaps iframe src');
  it.todo('Each iframe shows a live terminal; typing runs commands; output streams back');
  it.todo('WebSocket path works: /terminal/:sessionId/:tabId/ws (101; bidirectional bytes)');
  it.todo('ttyd handshake: after WS connect, send {columns,rows} JSON as TEXT and prompt appears');
  it.todo('Local dev works (2-process): bun run dev:container + bun run dev');
  it.todo('Prod works after deploy with the same UX');
});
