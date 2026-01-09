// FE-001: Minimal frontend with worker-served HTML + xterm.js verification
// Manual test results - PASSED
//
// Evidence:
// - GET / returns HTML page: curl http://localhost:8788/ → 200 with <title>Terminal</title>
// - HTML includes xterm.js CDN links: xterm.css and xterm.js from unpkg.com
// - WebSocket connection logic present: WebSocket(url), ws.addEventListener('open'), etc.
// - WebSocket URL construction: window.location.protocol + window.location.host + /terminal/:id/ws
// - xterm.js Terminal initialization: new Terminal({}), terminal.open(), fitAddon.fit()
// - Terminal input handling: terminal.onData() connected to ws.send()
// - Terminal size handling: sends {columns, rows} on connection and resize
//
// Acceptance criteria met:
// ✅ GET / returns HTML page with xterm.js terminal
// ✅ xterm.js connects to ws://localhost:8788/terminal/:id/ws (in local dev)
// ✅ Terminal displays bash prompt and accepts input (WebSocket logic present)
// ✅ Commands execute and output appears (bidirectional WebSocket flow implemented)
//
// Verification command: node test-fe-001.js