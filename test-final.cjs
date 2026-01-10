const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8788/ws');
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
  console.log('[CLIENT-TEST] Connected to container server');
  ws.send(JSON.stringify({columns: 80, rows: 24}));
};

ws.onmessage = (data) => {
  console.log('[CLIENT-TEST] Received:', data.toString());
  if (data.toString().includes('hello')) {
    console.log('[CLIENT-TEST] SUCCESS - Message received correctly!');
    ws.close();
  } else {
    setTimeout(() => ws.close(), 500);
  }
};

ws.onerror = (error) => {
  console.error('[CLIENT-TEST] Error:', error.message);
};

setTimeout(() => process.exit(0), 5000);
