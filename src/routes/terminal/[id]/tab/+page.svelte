<script lang="ts">
  import "@xterm/xterm/css/xterm.css";
  import { onMount, onDestroy } from "svelte";
  import { browser, dev } from "$app/environment";
  import { page } from "$app/state";
  import type { Terminal as TerminalType } from "@xterm/xterm";
  import type { FitAddon as FitAddonType } from "@xterm/addon-fit";

  // ttyd protocol commands
  const CMD_OUTPUT = "0";

  const sessionId = $derived(page.params.id);
  const tabId = $derived(page.url.searchParams.get("tab") || "");

  let terminal: TerminalType | null = $state(null);
  let fitAddon: FitAddonType | null = $state(null);
  let ws: WebSocket | null = $state(null);
  let container: HTMLDivElement | null = $state(null);
  let connected = $state(false);
  let error = $state<string | null>(null);
  let resizeHandler: (() => void) | null = null;

  const textEncoder = new TextEncoder();

  function getPassword(): string | null {
    if (!browser) return null;
    // Try URL param first (passed from parent iframe)
    const urlPassword = page.url.searchParams.get("password");
    if (urlPassword) return urlPassword;
    // Fallback to sessionStorage
    return sessionStorage.getItem(`session:${sessionId}:password`);
  }

  async function initializeTerminal() {
    if (!browser || !sessionId || !tabId || !container) return;
    if (terminal && connected) return;

    // Clean up existing
    if (ws) {
      ws.close();
      ws = null;
    }

    error = null;

    try {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

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
      terminal.open(container);
      fitAddon.fit();

      // Loading message
      terminal.write("\x1b[2J\x1b[H");
      terminal.writeln("\r\n  Connecting to terminal...\r\n");

      // Initialize the sandbox for this tab
      const password = getPassword();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (password) headers["X-Session-Password"] = password;

      // First, ensure main session is initialized
      const mainStartRes = await fetch(`/api/terminal/${sessionId}/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({ agents: [] }), // Agents already set on session creation
      });

      if (!mainStartRes.ok) {
        const data = await mainStartRes.json();
        throw new Error(data.error || "Failed to initialize session");
      }

      // Then start this specific tab
      const tabStartRes = await fetch(`/api/terminal/${sessionId}/${tabId}/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!tabStartRes.ok) {
        const data = await tabStartRes.json();
        throw new Error(data.error || "Failed to start tab");
      }

      // Connect WebSocket directly to ttyd (no proxy!)
      const passwordParam = password ? `?password=${encodeURIComponent(password)}` : "";
      const wsUrl = dev
        ? `ws://localhost:1337/terminal/${sessionId}/${tabId}/ws${passwordParam}`
        : `wss://api.myfilepath.com/terminal/${sessionId}/${tabId}/ws${passwordParam}`;

      ws = new WebSocket(wsUrl, ["tty"]);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        if (!terminal || !ws) return;
        connected = true;
        error = null;

        // Clear loading message
        terminal.clear();

        // ttyd handshake - send terminal size
        ws.send(JSON.stringify({
          columns: terminal.cols,
          rows: terminal.rows,
        }));

        // Handle input
        terminal.onData((data) => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          const payload = new Uint8Array(data.length * 3 + 1);
          payload[0] = "0".charCodeAt(0);
          const stats = textEncoder.encodeInto(data, payload.subarray(1));
          ws.send(payload.subarray(0, (stats.written as number) + 1));
        });

        // Focus
        setTimeout(() => terminal?.focus(), 100);
      };

      ws.onmessage = (e) => {
        if (!terminal) return;

        if (typeof e.data === "string") return;

        const handle = (raw: ArrayBuffer) => {
          const u8 = new Uint8Array(raw);
          if (u8.length === 0) return;

          const cmd = String.fromCharCode(u8[0]);
          const data = raw.slice(1);

          if (cmd === CMD_OUTPUT) {
            terminal!.write(new Uint8Array(data));
          }
        };

        if (e.data instanceof ArrayBuffer) {
          handle(e.data);
        }
      };

      ws.onerror = () => {
        error = "Connection error";
        connected = false;
      };

      ws.onclose = (event) => {
        connected = false;
        if (event.code !== 1000 && event.code !== 1001) {
          error = "Connection closed";
        }
      };

      // Resize handler
      resizeHandler = () => {
        if (terminal && fitAddon && ws && ws.readyState === WebSocket.OPEN) {
          fitAddon.fit();
          ws.send(JSON.stringify({
            columns: terminal.cols,
            rows: terminal.rows,
          }));
        }
      };
      window.addEventListener("resize", resizeHandler);

    } catch (err) {
      console.error("Terminal initialization error:", err);
      error = err instanceof Error ? err.message : String(err);
    }
  }

  onMount(() => {
    if (!browser || !tabId) return;

    // Wait for container
    const initWithRetry = (attempt = 0) => {
      if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
        initializeTerminal();
      } else if (attempt < 20) {
        setTimeout(() => initWithRetry(attempt + 1), 100);
      } else {
        error = "Failed to initialize terminal container";
      }
    };

    setTimeout(() => initWithRetry(), 50);
  });

  onDestroy(() => {
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
    }
    if (ws) {
      ws.close();
    }
    if (terminal) {
      terminal.dispose();
    }
  });
</script>

<div class="h-full w-full bg-black">
  {#if error}
    <div class="flex h-full items-center justify-center text-red-400">
      Error: {error}
    </div>
  {/if}
  <div bind:this={container} class="h-full w-full"></div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: black;
  }
</style>

