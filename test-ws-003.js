// Simple WebSocket test for WS-003 verification
import WebSocket from 'ws';

async function testWebSocketConnection() {
  console.log('🧪 Testing WS-003: WebSocket connection to ttyd');

  try {
    const wsUrl = 'ws://localhost:8788/terminal/test123/ws';
    console.log(`🔌 Connecting to: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        console.log('✅ WebSocket connection opened successfully');
        clearTimeout(timeout);

        // Send terminal size message (ttyd protocol)
        const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
        console.log(`📤 Sending terminal size: ${sizeMsg}`);
        ws.send(sizeMsg);

        // Wait a bit for response
        setTimeout(() => {
          ws.close();
          resolve(true);
        }, 2000);
      });

      ws.on('message', (data) => {
        console.log('📨 Received message from ttyd:', data.toString());
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} ${reason}`);
        if (!timeout._destroyed) {
          clearTimeout(timeout);
          resolve(true); // Connection worked, just closed
        }
      });
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testWebSocketConnection().then(success => {
  console.log(success ? '✅ WS-003 PASSED' : '❌ WS-003 FAILED');
  process.exit(success ? 0 : 1);
});