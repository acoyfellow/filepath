<script lang="ts">
  import "@xterm/xterm/css/xterm.css";
  import { onMount, onDestroy } from "svelte";
  import { browser, dev } from "$app/environment";
  import { page } from "$app/state";
  import { getApiUrl } from "$lib/api-utils";
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
  let isRetrying = $state(false);
  let lastRetryTime = $state(0);
  const RETRY_COOLDOWN = 10000; // 10 seconds between retries
  const MAX_RETRIES = 3; // Max 3 retry attempts

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
    if (isRetrying) return; // Already retrying, don't duplicate

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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (password) headers["X-Session-Password"] = password;

      // Start this specific tab's sandbox
      const tabStartRes = await fetch(
        getApiUrl(`/terminal/${sessionId}/${tabId}/start`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        }
      );

      if (!tabStartRes.ok) {
        const data = (await tabStartRes.json()) as { error?: string };
        throw new Error(data.error || "Failed to start tab");
      }

      // Connect WebSocket directly to Worker
      const passwordParam = password
        ? `?password=${encodeURIComponent(password)}`
        : "";
      const wsUrl = dev
        ? `ws://localhost:1337/terminal/${sessionId}/${tabId}/ws${passwordParam}`
        : `wss://api.myfilepath.com/terminal/${sessionId}/${tabId}/ws${passwordParam}`;

      console.log("[WS] Creating WebSocket connection:", {
        wsUrl,
        sessionId,
        tabId,
        hasPassword: !!password,
      });
      ws = new WebSocket(wsUrl, ["tty"]);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[WS] WebSocket opened successfully:", {
          sessionId,
          tabId,
          readyState: ws?.readyState,
        });
        if (!terminal || !ws) return;
        connected = true;
        error = null;

        // Clear loading message
        terminal.clear();

        // ttyd handshake - send terminal size (must be encoded)
        ws.send(
          textEncoder.encode(
            JSON.stringify({
              columns: terminal.cols,
              rows: terminal.rows,
            })
          )
        );

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

      ws.onerror = (event) => {
        console.error("[WS] WebSocket error:", {
          sessionId,
          tabId,
          readyState: ws?.readyState,
          url: wsUrl,
          error: event,
          type: event.type,
        });
        error = "Connection error";
        connected = false;
        // Don't retry on error - let onclose handle it
      };

      ws.onclose = (event) => {
        console.log("[WS] WebSocket closed:", {
          sessionId,
          tabId,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: wsUrl,
        });
        connected = false;

        // Normal close codes - don't retry
        if (event.code === 1000 || event.code === 1001) {
          console.log("[WS] Normal close, not retrying");
          return;
        }

        error = "Connection closed";

        // Prevent duplicate retries
        const now = Date.now();
        if (isRetrying || now - lastRetryTime < RETRY_COOLDOWN) {
          return;
        }

        // Only retry once, with long delay
        isRetrying = true;
        lastRetryTime = now;

        setTimeout(() => {
          isRetrying = false;
          if (!connected) {
            initializeTerminal();
          }
        }, 5000); // 5 second delay
      };

      // Helper to send resize message to ttyd (must match initial handshake format)
      const sendResize = () => {
        if (terminal && ws && ws.readyState === WebSocket.OPEN) {
          // Must use same encoded format as initial handshake
          ws.send(
            textEncoder.encode(
              JSON.stringify({
                columns: terminal.cols,
                rows: terminal.rows,
              })
            )
          );
        }
      };

      // Resize handler for window resize
      resizeHandler = () => {
        if (terminal && fitAddon && ws && ws.readyState === WebSocket.OPEN) {
          fitAddon.fit();
          sendResize();
        }
      };
      window.addEventListener("resize", resizeHandler);

      // Also listen to terminal resize events (catches terminal size changes)
      terminal.onResize(() => {
        sendResize();
      });
    } catch (err) {
      console.error("Terminal initialization error:", err);
      error = err instanceof Error ? err.message : String(err);
    }
  }

  onMount(() => {
    if (!browser || !tabId) return;

    // Wait for container
    const initWithRetry = (attempt = 0) => {
      if (
        container &&
        container.offsetWidth > 0 &&
        container.offsetHeight > 0
      ) {
        initializeTerminal();
      } else if (attempt < 10) {
        // Reduced from 20 to 10
        setTimeout(() => initWithRetry(attempt + 1), 200); // Increased from 100ms to 200ms
      } else {
        error = "Failed to initialize terminal container";
      }
    };

    setTimeout(() => initWithRetry(), 100); // Increased from 50ms to 100ms
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
