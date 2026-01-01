<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  interface Props {
    sessionId: string;
    dockerfile: string;
  }

  let { sessionId, dockerfile }: Props = $props();

  let terminalContainer: HTMLDivElement;
  let terminal: any;
  let fitAddon: any;
  let ws: WebSocket | null = null;
  let connected = $state(false);

  onMount(async () => {
    if (!browser) return;

    // Dynamic import for browser-only xterm
    const { Terminal } = await import("xterm");
    const { FitAddon } = await import("xterm-addon-fit");
    const { WebLinksAddon } = await import("xterm-addon-web-links");
    await import("xterm/css/xterm.css");

    terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "monospace",
      theme: {
        background: "#000000",
        foreground: "#ffffff",
        cursor: "#ffffff",
      },
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(terminalContainer);
    fitAddon.fit();

    terminal.writeln("Connecting to terminal session...\r");

    // Connect WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/session/${sessionId}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected = true;
      terminal.writeln("\r\n\x1b[32mConnected!\x1b[0m\r\n");
      terminal.writeln("Type commands to execute in the container.\r\n");
      terminal.write("$ ");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "output") {
          terminal.write(data.data);
          terminal.write("\r\n$ ");
        } else if (data.type === "error") {
          terminal.write(`\x1b[31mError: ${data.data}\x1b[0m\r\n$ `);
        }
      } catch (e) {
        terminal.write(event.data);
      }
    };

    ws.onerror = (error) => {
      terminal.writeln(`\x1b[31mWebSocket error\x1b[0m\r\n`);
    };

    ws.onclose = () => {
      connected = false;
      terminal.writeln("\r\n\x1b[33mConnection closed\x1b[0m\r\n");
    };

    // Handle user input
    let currentLine = "";
    terminal.onData((data) => {
      if (data === "\r") {
        // Enter pressed
        if (currentLine.trim() && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "command",
              command: currentLine,
            })
          );
          terminal.write("\r\n");
          currentLine = "";
        } else {
          terminal.write("\r\n$ ");
        }
      } else if (data === "\x7f") {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write("\b \b");
        }
      } else {
        currentLine += data;
        terminal.write(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  onDestroy(() => {
    if (!browser) return;
    if (ws) {
      ws.close();
    }
    if (terminal) {
      terminal.dispose();
    }
  });
</script>

<div class="terminal-wrapper">
  <div class="terminal-header">
    <span class="status-indicator" class:connected></span>
    <span class="session-id">Session: {sessionId.slice(0, 8)}...</span>
  </div>
  <div bind:this={terminalContainer} class="terminal-container"></div>
</div>

<style>
  .terminal-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #000;
    border: 1px solid #333;
    border-radius: 4px;
    overflow: hidden;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #111;
    border-bottom: 1px solid #333;
    font-size: 12px;
    color: #999;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #666;
  }

  .status-indicator.connected {
    background: #0f0;
  }

  .session-id {
    font-family: monospace;
  }

  .terminal-container {
    flex: 1;
    padding: 8px;
    min-height: 400px;
  }
</style>
