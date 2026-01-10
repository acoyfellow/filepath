// Test WebSocket message flow
import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8788/terminal/test123/ws');
ws.binaryType = 'arraybuffer';

ws.on('open', () => {
  console.log('[TEST] WebSocket opened');
  
  // ttyd protocol: send terminal size as JSON text
  ws.send(JSON.stringify({columns: 80, rows: 24}));
  
  setTimeout(() => ws.close(), 2000);
});

ws.on('message', (data) => {
  console.log('[TEST] Received:', {
    type: typeof data,
    length: data.length || data.byteLength,
    content: data instanceof ArrayBuffer ? 
      (data.byteLength > 0 ? Array.from(new Uint8Array(data.slice(0,1))).map(x => String.fromCharCode(x)).join('') : 'empty') : 'text'
  });
});

ws.on('error', (error) => {
  console.error('[TEST] Error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('[TEST] Closed:', code, reason);
});