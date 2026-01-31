import type { RequestHandler } from './$types';

// Render terminal HTML page with xterm.js
// This connects via WebSocket to /terminal/{sessionId}/{tabId}/ws
export const GET: RequestHandler = async ({ params, url }) => {
  const { sessionId, tabId } = params;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terminal ${tabId}</title>
  <link rel="stylesheet" href="https://unpkg.com/@xterm/xterm@6.0.0/css/xterm.css" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    #terminal { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://unpkg.com/@xterm/xterm@6.0.0/lib/xterm.js"></script>
  <script src="https://unpkg.com/@xterm/addon-fit@0.11.0/lib/addon-fit.js"></script>
  <script>
    (function() {
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'monospace',
        theme: { background: '#000000', foreground: '#ffffff', cursor: '#ffffff' }
      });
      const fitAddon = new FitAddon.FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(document.getElementById('terminal'));
      fitAddon.fit();

      terminal.write('\\x1b[2J\\x1b[H');
      terminal.writeln('\\r\\n  Connecting to terminal...\\r\\n');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/terminal/${sessionId}/${tabId}/ws';

      const textEncoder = new TextEncoder();
      const CMD_OUTPUT = '0';
      let ws = null;
      let retries = 0;
      const maxRetries = 10;

      function connect() {
        terminal.writeln('  Attempting connection... (attempt ' + (retries + 1) + ')\\r\\n');
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.addEventListener('open', function() {
          retries = 0;
          terminal.clear();
          terminal.writeln('[connected]');
          const sizeMsg = JSON.stringify({ columns: terminal.cols, rows: terminal.rows });
          ws.send(sizeMsg);
          
          // Report to parent
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'terminal-status', tabId: '${tabId}', status: 'connected' }, '*');
          }
        });

        ws.addEventListener('message', function(e) {
          if (typeof e.data === 'string') return;
          if (e.data instanceof ArrayBuffer) {
            const u8 = new Uint8Array(e.data);
            if (u8.length === 0) return;
            const cmd = String.fromCharCode(u8[0]);
            const data = e.data.slice(1);
            if (cmd === CMD_OUTPUT || cmd) {
              terminal.write(new Uint8Array(data));
            }
          }
        });

        terminal.onData(function(data) {
          if (ws.readyState !== WebSocket.OPEN) return;
          const payload = new Uint8Array(data.length * 3 + 1);
          payload[0] = CMD_OUTPUT.charCodeAt(0);
          const stats = textEncoder.encodeInto(data, payload.subarray(1));
          ws.send(payload.subarray(0, stats.written + 1));
        });

        function sendResize() {
          if (ws.readyState !== WebSocket.OPEN) return;
          const sizeMsg = JSON.stringify({ columns: terminal.cols, rows: terminal.rows });
          ws.send(sizeMsg);
        }

        window.addEventListener('resize', function() {
          fitAddon.fit();
          sendResize();
        });
        terminal.onResize(sendResize);

        ws.addEventListener('close', function() {
          if (retries < maxRetries) {
            retries++;
            const waitMs = Math.min(500 * retries, 5000);
            terminal.writeln('\\r\\n[disconnected, reconnecting in ' + waitMs + 'ms...]\\r\\n');
            setTimeout(connect, waitMs);
          } else {
            terminal.writeln('\\r\\n[connection failed after ' + maxRetries + ' attempts]\\r\\n');
          }
        });

        ws.addEventListener('error', function() {
          terminal.writeln('\\r\\n[connection error]\\r\\n');
        });
      }

      connect();
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
};
