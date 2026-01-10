const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8788/terminal/test123/ws');
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
  console.log('[FINAL-TEST] Connected');
  ws.send(JSON.stringify({columns: 80, rows: 24}));
};

ws.onmessage = (data) => {
  console.log('[FINAL-TEST] Received:', data.toString());
  if (data.toString().includes('root@')) {
    console.log('[FINAL-TEST] SUCCESS - Bash prompt received!');
    ws.close();
  }
};

ws.onerror = (error) => {
  console.error('[FINAL-TEST] Error:', error.message);
};

setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}, 1000);
