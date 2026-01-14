import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

// Mock Cloudflare modules
vi.mock('@cloudflare/sandbox', () => ({
  getSandbox: vi.fn(),
  Sandbox: vi.fn(),
}));

vi.mock('@cloudflare/containers', () => ({
  ContainerError: class ContainerError extends Error {},
  WebSocketError: class WebSocketError extends Error {},
}));

// Mock Cloudflare Workers globals
global.WebSocketPair = vi.fn(() => ({
  0: { accept: vi.fn() },
  1: { accept: vi.fn() }
}));

import { app } from '../worker/index';

// Set local dev mode for testing
process.env.LOCAL_DEV = 'true';

describe('003: Session page UI', () => {
  it('GET /session/:sessionId returns HTML with tab bar + iframe region', async () => {
    // Create session first
    const createRes = await app.request('http://localhost/session', { method: 'POST' });
    const { sessionId } = await createRes.json();

    const res = await app.request(`http://localhost/session/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<title>Session'); // Contains session title
    expect(html).toContain('Tab bar'); // Has tab bar
    expect(html).toContain('<iframe'); // Has iframe
    expect(html).toContain('/tab/'); // Iframe points to tab route
  });

  it('Each tab corresponds to /tab/:sessionId/:tabId (iframe src)', async () => {
    // Create session with multiple tabs
    const createRes = await app.request('http://localhost/session', { method: 'POST' });
    const { sessionId } = await createRes.json();

    // Update tabs
    const updateRes = await app.request(`http://localhost/session/${sessionId}/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs: [
          { id: 'tab1', name: 'Terminal 1' },
          { id: 'tab2', name: 'Terminal 2' }
        ]
      })
    });
    expect(updateRes.status).toBe(200);

    const res = await app.request(`http://localhost/session/${sessionId}`);
    const html = await res.text();
    expect(html).toContain('/tab/'); // Contains iframe src
  });

  it('Tab page connects to /terminal/:sessionId/:tabId/ws and is interactive', async () => {
    // Create session
    const createRes = await app.request('http://localhost/session', { method: 'POST' });
    const { sessionId } = await createRes.json();

    const res = await app.request(`http://localhost/tab/${sessionId}/tab1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('Terminal tab1'); // Tab-specific title
    expect(html).toContain('/terminal/'); // Contains WS connection
    expect(html).toContain(`${sessionId}/tab1/ws`); // Correct WS URL for tab
    expect(html).toContain('xterm.js'); // Has terminal library
  });
});
