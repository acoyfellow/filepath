import { describe, it, expect } from 'vitest';
import { app } from '../worker/index';

describe('001: Session + tabs data model', () => {
  it('POST /session returns {sessionId}', async () => {
    const res = await app.request('http://localhost/session', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('sessionId');
    expect(typeof data.sessionId).toBe('string');
  });

  it('GET /session/:sessionId/info returns {sessionId, hasPassword}', async () => {
    // First create a session
    const createRes = await app.request('http://localhost/session', { method: 'POST' });
    const { sessionId } = await createRes.json();

    const res = await app.request(`http://localhost/session/${sessionId}/info`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionId).toBe(sessionId);
    expect(data.hasPassword).toBe(false);
  });

  it('GET /session/:sessionId/tabs returns {tabs, activeTab}', async () => {
    const createRes = await app.request('http://localhost/session', { method: 'POST' });
    const { sessionId } = await createRes.json();

    const res = await app.request(`http://localhost/session/${sessionId}/tabs`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tabs).toBeInstanceOf(Array);
    expect(data.tabs.length).toBe(1);
    expect(data.tabs[0]).toHaveProperty('id');
    expect(data.tabs[0]).toHaveProperty('name');
    expect(typeof data.activeTab).toBe('number');
    expect(data.activeTab).toBe(0);
  });

  it('POST /session/:sessionId/tabs updates tabs/activeTab', async () => {
    const createRes = await app.request('http://localhost/session', { method: 'POST' });
    const { sessionId } = await createRes.json();

    const updateRes = await app.request(`http://localhost/session/${sessionId}/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs: [
          { id: 'tab1', name: 'Terminal 1' },
          { id: 'tab2', name: 'Terminal 2' }
        ],
        activeTab: 1
      })
    });
    expect(updateRes.status).toBe(200);

    // Verify the update
    const getRes = await app.request(`http://localhost/session/${sessionId}/tabs`);
    const data = await getRes.json();
    expect(data.tabs.length).toBe(2);
    expect(data.activeTab).toBe(1);
  });
});
