import { createServer } from "http";
import { spawn } from "child_process";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT || 8085;

// Store ttyd process (single instance for local dev)
let ttydProcess = null;
let ttydWsServer = null;

const server = createServer(function (req, res) {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, status: "healthy" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello from terminal container!");
});

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', function connection(ws, request) {
  console.log('[Container] WebSocket client connected');

  // Spawn ttyd process if not already running
  if (!ttydProcess) {
    console.log('[Container] Spawning ttyd process...');
    
    ttydProcess = spawn('ttyd', ['-W', '-p', '7681', 'bash'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    ttydProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        console.error('[Container] ERROR: ttyd not found. Please install ttyd:');
        console.error('  macOS: brew install ttyd');
        console.error('  Linux: sudo apt-get install ttyd  (or use your package manager)');
        console.error('  Or build from source: https://github.com/tsl0922/ttyd');
        ws.close(1011, 'ttyd not installed');
        ttydProcess = null;
        return;
      } else {
        console.error('[Container] ttyd spawn error:', error);
        ws.close(1011, 'Failed to start ttyd');
        ttydProcess = null;
        return;
      }
    });

    // Set up exit handler
    ttydProcess.on('exit', () => {
      console.log('[Container] ttyd process exited');
      ttydProcess = null;
      ttydWsServer = null;
    });

    // Check if spawn succeeded (has PID) after a tick
    process.nextTick(() => {
      // Only connect if ttyd process actually started (has PID)
      if (ttydProcess && ttydProcess.pid) {
        // Wait a bit for ttyd to start before connecting
        setTimeout(() => {
          if (!ttydProcess) {
            return;
          }
          
          // Connect to ttyd WebSocket server
          const ttydWsUrl = 'ws://localhost:7681/ws';
          const ttydWs = new WebSocket(ttydWsUrl);

          ttydWs.on('open', () => {
            console.log('[Container] Connected to ttyd WebSocket');
            ttydWsServer = ttydWs;

            // Send terminal size to ttyd
            const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
            ttydWs.send(sizeMsg);

            // Forward messages: ttyd -> client
            ttydWs.on('message', (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
              }
            });
          });

          ttydWs.on('error', (error) => {
            console.error('[Container] ttyd WebSocket error:', error);
            console.error('[Container] Ttyd WebSocket error - closing connection to client');
            ws.close(1011, 'Container internal error');
          });

          ttydWs.on('close', () => {
            console.log('[Container] ttyd WebSocket closed');
            ttydWsServer = null;
          });
        }, 500);
      }
      // If spawn failed (no PID), error handler already closed the client WebSocket
    });
  } else {
    // ttyd already running, messages will be forwarded via existing ttydWsServer
  }

  // Forward messages: client -> ttyd
  ws.on('message', (data) => {
    if (ttydWsServer && ttydWsServer.readyState === WebSocket.OPEN) {
      ttydWsServer.send(data);
    }
  });

  ws.on('close', () => {
    console.log('[Container] Client WebSocket closed');
  });

  ws.on('error', (error) => {
    console.error('[Container] Client WebSocket error:', {
      type: error.type,
      message: error.message,
      code: error.code,
      reason: error.reason
    });
    console.error('[Container] Client WebSocket error - closing connection');
    ws.close(1011, 'Container internal error');
  });
});

server.on('upgrade', function upgrade(request, socket, head) {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, function () {
  console.log(`Container server listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('[Container] Shutting down...');
  if (ttydProcess) ttydProcess.kill();
  wss.close();
  server.close();
});

process.on('SIGINT', () => {
  console.log('[Container] Shutting down...');
  if (ttydProcess) ttydProcess.kill();
  wss.close();
  server.close();
});

